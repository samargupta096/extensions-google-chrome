importScripts('../shared/ai-client.js');

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
 * NeuroTab — Background Service Worker
 * Manages knowledge base, Ollama summarization, and context menus
 */

// ============ Context Menus ============
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'neurotab-save',
    title: '🧠 Save to NeuroTab',
    contexts: ['selection', 'page']
  });
  chrome.contextMenus.create({
    id: 'neurotab-summarize',
    title: '🧠 Summarize Selection',
    contexts: ['selection']
  });

  // Initialize settings
  chrome.storage.local.get('nt_settings', (data) => {
    if (!data.nt_settings) {
      chrome.storage.local.set({
        nt_settings: {
          autoCapture: false,
          autoCapturedDomains: [],
          ollamaModel: 'qwen3:latest',
          maxSummaryLength: 200
        }
      });
    }
  });
});

// ============ Context Menu Actions ============
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'neurotab-save') {
    const text = info.selectionText || '';
    const page = {
      id: generateId(),
      url: tab.url,
      title: tab.title,
      domain: extractDomain(tab.url),
      text: text,
      savedAt: Date.now(),
      date: todayKey(),
      type: text ? 'selection' : 'page',
      tags: [],
      summary: '',
      category: ''
    };

    // Save to storage
    const data = await getStorage('nt_pages');
    const pages = data.nt_pages || [];
    pages.unshift(page);
    await setStorage({ nt_pages: pages });

    // Try to summarize with Ollama
    summarizePage(page);
  }

  if (info.menuItemId === 'neurotab-summarize' && info.selectionText) {
    try {
      const result = await ollamaGenerate(
        `Summarize this in 2-3 sentences:\n\n${info.selectionText}`,
        { temperature: 0.3 }
      );
      if (result.success) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_SUMMARY',
          summary: result.text
        });
      }
    } catch {}
  }
});

// ============ Ollama Integration ============
async function ollamaGenerate(prompt, options = {}) {
  const settings = (await getStorage('nt_settings')).nt_settings || {};
  const model = settings.ollamaModel || 'qwen3:latest';

  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.5,
          num_predict: options.maxTokens || 512
        }
      })
    });
    const data = await response.json();
    return { success: true, text: data.response };
  } catch (error) {
    return { success: false, text: '', error: error.message };
  }
}

async function summarizePage(page) {
  const text = page.text || page.title;
  if (!text || text.length < 50) return;

  const result = await ollamaGenerate(
    `Provide a brief summary (2-3 sentences) and 3-5 relevant tags for this content. Format: SUMMARY: [summary]\nTAGS: [tag1, tag2, tag3]\n\nContent:\n${text.slice(0, 3000)}`
  );

  if (result.success) {
    const lines = result.text.split('\n');
    let summary = '';
    let tags = [];

    for (const line of lines) {
      if (line.startsWith('SUMMARY:')) summary = line.replace('SUMMARY:', '').trim();
      if (line.startsWith('TAGS:')) {
        tags = line.replace('TAGS:', '').trim().split(',').map(t => t.trim().toLowerCase());
      }
    }

    // Update page in storage
    const data = await getStorage('nt_pages');
    const pages = data.nt_pages || [];
    const idx = pages.findIndex(p => p.id === page.id);
    if (idx >= 0) {
      pages[idx].summary = summary || result.text.slice(0, 200);
      pages[idx].tags = tags;
      await setStorage({ nt_pages: pages });
    }
  }
}

// ============ Message Handler ============
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'SAVE_PAGE': {
        const page = {
          id: generateId(),
          url: message.url,
          title: message.title,
          domain: extractDomain(message.url),
          text: message.text || '',
          savedAt: Date.now(),
          date: todayKey(),
          type: 'page',
          tags: [],
          summary: '',
          category: ''
        };

        const data = await getStorage('nt_pages');
        const pages = data.nt_pages || [];
        pages.unshift(page);
        await setStorage({ nt_pages: pages });
        summarizePage(page);
        sendResponse({ success: true, page });
        break;
      }

      case 'GET_PAGES': {
        const data = await getStorage('nt_pages');
        const pages = data.nt_pages || [];
        const search = (message.search || '').toLowerCase();
        const tag = message.tag || '';

        let filtered = pages;
        if (search) {
          filtered = filtered.filter(p =>
            p.title?.toLowerCase().includes(search) ||
            p.domain?.toLowerCase().includes(search) ||
            p.summary?.toLowerCase().includes(search) ||
            p.text?.toLowerCase().includes(search) ||
            p.tags?.some(t => t.includes(search))
          );
        }
        if (tag) {
          filtered = filtered.filter(p => p.tags?.includes(tag));
        }

        sendResponse({ pages: filtered.slice(0, message.limit || 50) });
        break;
      }

      case 'DELETE_PAGE': {
        const data = await getStorage('nt_pages');
        let pages = data.nt_pages || [];
        pages = pages.filter(p => p.id !== message.id);
        await setStorage({ nt_pages: pages });
        sendResponse({ success: true });
        break;
      }

      case 'ASK_BRAIN': {
        const data = await getStorage('nt_pages');
        const pages = data.nt_pages || [];
        const context = pages
          .slice(0, 20)
          .map(p => `[${p.title}] (${p.domain}): ${p.summary || p.text?.slice(0, 200) || ''}`)
          .join('\n\n');

        const result = await ollamaGenerate(
          `You are a knowledge assistant. Based on the user's saved pages, answer their question.\n\nSaved Knowledge:\n${context}\n\nQuestion: ${message.question}\n\nAnswer concisely based on the saved knowledge. If the answer isn't in the data, say so.`,
          { temperature: 0.4, maxTokens: 600 }
        );
        sendResponse(result);
        break;
      }

      case 'GET_STATS': {
        const data = await getStorage('nt_pages');
        const pages = data.nt_pages || [];
        const allTags = {};
        const domains = {};
        const daily = {};

        for (const p of pages) {
          for (const t of (p.tags || [])) {
            allTags[t] = (allTags[t] || 0) + 1;
          }
          domains[p.domain] = (domains[p.domain] || 0) + 1;
          daily[p.date] = (daily[p.date] || 0) + 1;
        }

        sendResponse({
          totalPages: pages.length,
          totalTags: Object.keys(allTags).length,
          tags: allTags,
          domains,
          daily
        });
        break;
      }

      case 'GET_SETTINGS': {
        const data = await getStorage('nt_settings');
        sendResponse(data.nt_settings || {});
        break;
      }

      case 'UPDATE_SETTINGS': {
        await setStorage({ nt_settings: message.settings });
        sendResponse({ success: true });
        break;
      }

      case 'EXTRACT_PAGE': {
        // Forward to content script
        try {
          const response = await chrome.tabs.sendMessage(sender.tab?.id || message.tabId, {
            type: 'EXTRACT_CONTENT'
          });
          sendResponse(response);
        } catch {
          sendResponse({ text: '', title: '' });
        }
        break;
      }

      default:
        sendResponse({ error: 'Unknown message type' });
    }
  })();
  return true;
});

// ============ Helpers ============
function getStorage(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function setStorage(data) {
  return new Promise(resolve => chrome.storage.local.set(data, resolve));
}
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 8);
}
function extractDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}
function todayKey() {
  return new Date().toISOString().split('T')[0];
}

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

// Register Multi-Provider AI Fetch Handler
if (typeof registerAIFetchHandler !== 'undefined') {
  registerAIFetchHandler();
}
