/**
 * Ollama Client — Unified API client for local Ollama instance
 * Routes all fetch calls through the background service worker to avoid
 * CORS issues in extension popup/content script contexts.
 */
class OllamaClient {
  constructor(baseUrl = 'http://127.0.0.1:11434') {
    this.baseUrl = baseUrl;
    this.defaultModel = 'llama3.2';

    // Detect execution context
    this._isServiceWorker =
      typeof ServiceWorkerGlobalScope !== 'undefined' &&
      self instanceof ServiceWorkerGlobalScope;
    this._isPopup =
      typeof chrome !== 'undefined' &&
      typeof chrome.runtime !== 'undefined' &&
      !this._isServiceWorker;
  }

  // ─── Core fetch — routes through SW when in popup context ───

  async _fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`;

    // If we're in a popup, route through the background service worker
    // to avoid CORS restrictions
    if (this._isPopup) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'ollamaFetch', url, options },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve({ ok: false, error: chrome.runtime.lastError.message, data: null });
            } else {
              resolve(response);
            }
          }
        );
      });
    }

    // Service worker: fetch directly
    try {
      const response = await fetch(url, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
      let data = null;
      try { data = await response.json(); } catch (_) {}
      return { ok: response.ok, status: response.status, data };
    } catch (err) {
      return { ok: false, error: err.message, data: null };
    }
  }

  // ─── Public API ───

  async isAvailable() {
    try {
      const r = await this._fetch('/api/tags', {
        method: 'GET',
        signal: AbortSignal.timeout ? AbortSignal.timeout(3000) : undefined,
      });
      return r.ok === true;
    } catch {
      return false;
    }
  }

  async listModels() {
    try {
      const r = await this._fetch('/api/tags', { method: 'GET' });
      return r.data?.models || [];
    } catch {
      return [];
    }
  }

  async generate(prompt, options = {}) {
    const {
      system = '',
      temperature = 0.7,
      maxTokens = 1024,
    } = options;

    let model = options.model;
    if (!model && typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const { settings } = await chrome.storage.local.get('settings');
        model = settings?.defaultModel || this.defaultModel;
      } catch (e) { model = this.defaultModel; }
    } else if (!model) {
      model = this.defaultModel;
    }

    try {
      const r = await this._fetch('/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          model,
          prompt: system ? `${system}\n\n${prompt}` : prompt,
          stream: false,
          options: { temperature, num_predict: maxTokens },
        }),
      });

      if (!r.ok || !r.data) {
        return { success: false, text: '', error: r.error || `HTTP ${r.status}` };
      }

      return {
        success: true,
        text: r.data.response || '',
        model: r.data.model,
        totalDuration: r.data.total_duration,
      };
    } catch (error) {
      return { success: false, text: '', error: error.message };
    }
  }

  async chat(messages, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 1024,
    } = options;

    let model = options.model;
    if (!model && typeof chrome !== 'undefined' && chrome.storage) {
      try {
        const { settings } = await chrome.storage.local.get('settings');
        model = settings?.defaultModel || this.defaultModel;
      } catch (e) { model = this.defaultModel; }
    } else if (!model) {
      model = this.defaultModel;
    }

    try {
      const r = await this._fetch('/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: { temperature, num_predict: maxTokens },
        }),
      });

      if (!r.ok || !r.data) {
        return { success: false, text: '', error: r.error || `HTTP ${r.status}` };
      }

      return {
        success: true,
        text: r.data.message?.content || '',
        model: r.data.model,
      };
    } catch (error) {
      return { success: false, text: '', error: error.message };
    }
  }

  async summarize(text, maxLength = 200) {
    return this.generate(
      `Summarize the following in ${maxLength} characters or less. Return ONLY the summary:\n\n${text}`,
      { temperature: 0.3 }
    );
  }

  async categorize(text, categories = []) {
    const catList =
      categories.length > 0
        ? `Choose from: ${categories.join(', ')}`
        : 'Choose appropriate categories';
    return this.generate(
      `Categorize this content. ${catList}. Return ONLY comma-separated tags:\n\n${text}`,
      { temperature: 0.2, maxTokens: 100 }
    );
  }

  async analyzeInsights(data, context = '') {
    return this.generate(
      `Analyze this data and provide 3-5 actionable insights. Be concise.\n\nContext: ${context}\n\nData:\n${JSON.stringify(data, null, 2)}`,
      { temperature: 0.5, maxTokens: 512 }
    );
  }
}

// ─── Background Service Worker Handler ───
// Call this in every extension's service-worker.js to enable the relay
function registerOllamaHandler() {
  // Set up declarativeNetRequest rule to spoof Origin header to bypass Ollama's CORS
  if (chrome.declarativeNetRequest) {
    chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [11434],
      addRules: [{
        id: 11434,
        condition: { urlFilter: "http://127.0.0.1:11434/*" },
        action: {
          type: "modifyHeaders",
          requestHeaders: [{ header: "origin", operation: "set", value: "http://127.0.0.1" }]
        }
      }]
    }).catch(e => console.error("Failed to set declarativeNetRequest rules:", e));
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action !== 'ollamaFetch') return false;

    const { url, options = {} } = msg;

    // Only allow requests to localhost Ollama
    if (!url.startsWith('http://127.0.0.1:11434')) {
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

    return true; // keep message channel open for async response
  });
}

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { OllamaClient, registerOllamaHandler };
}
