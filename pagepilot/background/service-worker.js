
// Bypass Ollama CORS
if (chrome.declarativeNetRequest) {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [11434],
    addRules: [{
      id: 11434,
      condition: { urlFilter: 'http://localhost:11434/*' },
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'origin', operation: 'set', value: 'http://localhost' }]
      }
    }]
  }).catch(e => console.error(e));
}

/**
 * PagePilot — Background Service Worker
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'pp-ask', title: '🔍 Ask PagePilot about this', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'pp-explain', title: '🔍 Explain this code', contexts: ['selection'] });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info.selectionText) return;
  const prompts = {
    'pp-ask': `Explain this clearly in 2-3 sentences:\n\n${info.selectionText}`,
    'pp-explain': `Explain this code simply. What does it do? Any issues?\n\n${info.selectionText}`
  };
  try {
    const data = await chrome.storage.local.get('pp_settings');
    const model = data.pp_settings?.ollamaModel || 'qwen3:latest';

    const r = await fetch('http://localhost:11434/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: prompts[info.menuItemId], stream: false, options: { temperature: 0.4, num_predict: 400 } })
    });
    const d = await r.json();
    chrome.tabs.sendMessage(tab.id, { type: 'SHOW_RESULT', text: d.response });
  } catch {}
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {
      case 'CHAT': {
        try {
          const data = await chrome.storage.local.get('pp_settings');
          const model = data.pp_settings?.ollamaModel || 'qwen3:latest';

          const r = await fetch('http://localhost:11434/api/generate', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model,
              prompt: `Page context:\nTitle: ${msg.pageTitle}\nURL: ${msg.pageUrl}\nContent (excerpt):\n${(msg.pageContent || '').slice(0, 3000)}\n\nUser question: ${msg.question}\n\nAnswer based on the page content. Be concise.`,
              stream: false,
              options: { temperature: 0.4, num_predict: 500 }
            })
          });
          const d = await r.json();
          sendResponse({ success: true, text: d.response });
        } catch (e) {
          sendResponse({ success: false, text: 'Ollama not running. Start with: ollama serve' });
        }
        break;
      }
      default: sendResponse({ error: 'Unknown' });
    }
  })();
  return true;
});

// ── Ollama Fetch Relay (handles ollamaFetch messages from popup) ──
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ollamaFetch') return false;
  const { url, options = {} } = msg;
  if (!url.startsWith('http://localhost:11434')) {
    sendResponse({ ok: false, error: 'Disallowed URL', data: null });
    return true;
  }
  fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body || undefined,
  })
    .then(async (res) => {
      let data = null;
      try { data = await res.json(); } catch (_) {}
      sendResponse({ ok: res.ok, status: res.status, data });
    })
    .catch((err) => {
      sendResponse({ ok: false, error: err.message, data: null });
    });
  return true;
});
