/**
 * ClipWise — Background Service Worker
 * Manages clipboard history, snippets, and AI text actions
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('cw_clips', data => {
    if (!data.cw_clips) chrome.storage.local.set({ cw_clips: [], cw_snippets: [] });
  });

  // Context menu
  const actions = [
    { id: 'cw-explain', title: '🧠 Explain This' },
    { id: 'cw-summarize', title: '📝 Summarize This' },
    { id: 'cw-improve', title: '✨ Improve This' },
    { id: 'cw-translate', title: '🌐 Translate to English' }
  ];

  chrome.contextMenus.create({ id: 'clipwise', title: '📋 ClipWise', contexts: ['selection'] });
  actions.forEach(a => {
    chrome.contextMenus.create({ ...a, parentId: 'clipwise', contexts: ['selection'] });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;
  const text = info.selectionText;
  const prompts = {
    'cw-explain': `Explain this clearly in 2-3 sentences:\n\n${text}`,
    'cw-summarize': `Summarize this in 1-2 sentences:\n\n${text}`,
    'cw-improve': `Improve this text for clarity and grammar. Return ONLY the improved text:\n\n${text}`,
    'cw-translate': `Translate this to English. Return ONLY the translation:\n\n${text}`
  };

  const prompt = prompts[info.menuItemId];
  if (!prompt) return;

  try {
    const data = await chrome.storage.local.get('cw_settings');
    const model = data.cw_settings?.ollamaModel || 'qwen3:latest';

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model, prompt, stream: false,
        options: { temperature: 0.3, num_predict: 400 }
      })
    });
    const result = await response.json();
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULT', result: result.response, action: info.menuItemId.replace('cw-', '') });
  } catch {
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULT', result: 'Ollama not running. Start with: ollama serve', action: 'error' });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'ADD_CLIP': {
        const data = await getStorage(['cw_clips']);
        const clips = data.cw_clips || [];
        const clip = {
          id: genId(), text: msg.text, source: msg.source || '', domain: msg.domain || '',
          timestamp: Date.now(), date: new Date().toISOString().split('T')[0],
          type: detectType(msg.text), pinned: false
        };
        clips.unshift(clip);
        if (clips.length > 500) clips.splice(500);
        await setStorage({ cw_clips: clips });
        sendResponse({ success: true });
        break;
      }
      case 'GET_CLIPS': {
        const data = await getStorage(['cw_clips']);
        let clips = data.cw_clips || [];
        if (msg.search) {
          const s = msg.search.toLowerCase();
          clips = clips.filter(c => c.text.toLowerCase().includes(s) || c.type.includes(s));
        }
        if (msg.type_filter) clips = clips.filter(c => c.type === msg.type_filter);
        sendResponse({ clips: clips.slice(0, msg.limit || 50) });
        break;
      }
      case 'DELETE_CLIP': {
        const data = await getStorage(['cw_clips']);
        const clips = (data.cw_clips || []).filter(c => c.id !== msg.id);
        await setStorage({ cw_clips: clips });
        sendResponse({ success: true });
        break;
      }
      case 'PIN_CLIP': {
        const data = await getStorage(['cw_clips']);
        const clips = data.cw_clips || [];
        const idx = clips.findIndex(c => c.id === msg.id);
        if (idx >= 0) clips[idx].pinned = !clips[idx].pinned;
        await setStorage({ cw_clips: clips });
        sendResponse({ success: true });
        break;
      }
      case 'ADD_SNIPPET': {
        const data = await getStorage(['cw_snippets']);
        const snippets = data.cw_snippets || [];
        snippets.unshift({
          id: genId(), title: msg.title, code: msg.code, language: msg.language || 'text',
          tags: msg.tags || [], timestamp: Date.now()
        });
        await setStorage({ cw_snippets: snippets });
        sendResponse({ success: true });
        break;
      }
      case 'GET_SNIPPETS': {
        const data = await getStorage(['cw_snippets']);
        sendResponse({ snippets: data.cw_snippets || [] });
        break;
      }
      case 'DELETE_SNIPPET': {
        const data = await getStorage(['cw_snippets']);
        const snippets = (data.cw_snippets || []).filter(s => s.id !== msg.id);
        await setStorage({ cw_snippets: snippets });
        sendResponse({ success: true });
        break;
      }
      case 'GET_STATS': {
        const data = await getStorage(['cw_clips', 'cw_snippets']);
        const clips = data.cw_clips || [];
        const types = {};
        const daily = {};
        clips.forEach(c => { types[c.type] = (types[c.type] || 0) + 1; daily[c.date] = (daily[c.date] || 0) + 1; });
        sendResponse({
          totalClips: clips.length,
          totalSnippets: (data.cw_snippets || []).length,
          types, daily
        });
        break;
      }
      case 'AI_ACTION': {
        const prompts = {
          explain: `Explain this clearly:\n\n${msg.text}`,
          summarize: `Summarize in 1-2 sentences:\n\n${msg.text}`,
          improve: `Improve for clarity. Return ONLY improved text:\n\n${msg.text}`,
          translate: `Translate to English. Return ONLY translation:\n\n${msg.text}`
        };
        try {
          const data = await chrome.storage.local.get('cw_settings');
          const model = data.cw_settings?.ollamaModel || 'qwen3:latest';

          const r = await fetch('http://localhost:11434/api/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: prompts[msg.action], stream:false, options:{ temperature:0.3, num_predict:400 } })
          });
          const d = await r.json();
          sendResponse({ success: true, text: d.response });
        } catch (e) {
          sendResponse({ success: false, text: 'Ollama not running' });
        }
        break;
      }
      default: sendResponse({ error: 'Unknown' });
    }
  })();
  return true;
});

function detectType(text) {
  if (/^https?:\/\//.test(text)) return 'url';
  if (/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(text.trim())) return 'email';
  if (/[{}\[\]();]/.test(text) && /\n/.test(text)) return 'code';
  if (/^\s*(npm|pip|yarn|git|docker|curl|wget|sudo|cd|ls|mkdir)/.test(text)) return 'command';
  if (text.length > 200) return 'text';
  return 'text';
}

function getStorage(k) { return new Promise(r => chrome.storage.local.get(k, r)); }
function setStorage(d) { return new Promise(r => chrome.storage.local.set(d, r)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 6); }
