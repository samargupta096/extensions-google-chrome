/**
 * AIClient — Multi-provider AI abstraction for DeepWork Guardian
 * Supports: Ollama (local), OpenAI, Anthropic Claude, Cursor
 * Routes all fetch calls through the background service worker to avoid CORS.
 */

const AI_PROVIDERS = {
  ollama: {
    name: 'Ollama (Local)',
    icon: '🦙',
    baseUrl: 'http://127.0.0.1:11434',
    requiresKey: false,
    models: [], // populated dynamically
    defaultModel: 'qwen3:latest',
  },
  openai: {
    name: 'OpenAI',
    icon: '🤖',
    baseUrl: 'https://api.openai.com/v1',
    requiresKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4.1', name: 'GPT-4.1' },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'o3-mini', name: 'o3-mini' },
    ],
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    name: 'Anthropic',
    icon: '🧠',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresKey: true,
    models: [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    ],
    defaultModel: 'claude-sonnet-4-20250514',
  },
  cursor: {
    name: 'Cursor',
    icon: '📐',
    baseUrl: 'https://api.cursor.com/v1',
    requiresKey: true,
    models: [
      { id: 'cursor-small', name: 'Cursor Small' },
      { id: 'cursor-large', name: 'Cursor Large' },
    ],
    defaultModel: 'cursor-small',
  },
};

// ─── API Key Encryption (AES-GCM via Web Crypto API) ───
// Keys are encrypted at rest in chrome.storage.local.
// The encryption key is derived from the extension ID + a random salt using PBKDF2.
const KeyVault = {
  _ALGO: 'AES-GCM',
  _KEY_LENGTH: 256,
  _ITERATIONS: 100000,

  /** Get or create the PBKDF2 salt (stored once in chrome.storage.local) */
  async _getSalt() {
    const data = await chrome.storage.local.get('dwg_vault_salt');
    if (data.dwg_vault_salt) {
      return new Uint8Array(data.dwg_vault_salt);
    }
    const salt = crypto.getRandomValues(new Uint8Array(16));
    await chrome.storage.local.set({ dwg_vault_salt: Array.from(salt) });
    return salt;
  },

  /** Derive an AES-GCM key from the extension ID + salt */
  async _deriveKey() {
    const salt = await this._getSalt();
    // Use the extension ID as the passphrase — unique per-extension, not user-known
    const extensionId = (typeof chrome !== 'undefined' && chrome.runtime?.id) || 'dwg-fallback-id';
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(extensionId),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this._ITERATIONS, hash: 'SHA-256' },
      keyMaterial,
      { name: this._ALGO, length: this._KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );
  },

  /** Encrypt a plaintext string → { iv: number[], ciphertext: number[] } */
  async encrypt(plaintext) {
    if (!plaintext) return null;
    const key = await this._deriveKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuf = await crypto.subtle.encrypt(
      { name: this._ALGO, iv },
      key,
      encoded
    );
    return {
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(cipherBuf)),
    };
  },

  /** Decrypt { iv, ciphertext } → plaintext string */
  async decrypt(encryptedObj) {
    if (!encryptedObj || !encryptedObj.iv || !encryptedObj.ciphertext) return '';
    try {
      const key = await this._deriveKey();
      const iv = new Uint8Array(encryptedObj.iv);
      const ciphertext = new Uint8Array(encryptedObj.ciphertext);
      const plainBuf = await crypto.subtle.decrypt(
        { name: this._ALGO, iv },
        key,
        ciphertext
      );
      return new TextDecoder().decode(plainBuf);
    } catch {
      // If decryption fails (e.g. corrupted data), return empty
      return '';
    }
  },
};

class AIClient {
  constructor() {
    this._isServiceWorker =
      typeof ServiceWorkerGlobalScope !== 'undefined' &&
      self instanceof ServiceWorkerGlobalScope;
    this._isPopup =
      typeof chrome !== 'undefined' &&
      typeof chrome.runtime !== 'undefined' &&
      !this._isServiceWorker;

    // Will be lazily loaded from storage
    this._settingsCache = null;
    this._cryptoKeyCache = null; // cached derived key
  }

  // ─── Settings helpers ───

  async _getSettings() {
    if (this._settingsCache) return this._settingsCache;
    try {
      const data = await chrome.storage.local.get('dwg_settings');
      this._settingsCache = data.dwg_settings || {};
    } catch {
      this._settingsCache = {};
    }
    return this._settingsCache;
  }

  async _saveSettings(patch) {
    const settings = await this._getSettings();
    const updated = { ...settings, ...patch };
    await chrome.storage.local.set({ dwg_settings: updated });
    this._settingsCache = updated;
  }

  /** Currently selected provider id */
  async getProvider() {
    const s = await this._getSettings();
    return s.provider || 'ollama';
  }

  async setProvider(providerId) {
    const providerDef = AI_PROVIDERS[providerId];
    if (!providerDef) return;
    const defaultModel = providerDef.defaultModel || '';
    await this._saveSettings({ provider: providerId, model: defaultModel });
  }

  /** Currently selected model id */
  async getModel() {
    const s = await this._getSettings();
    return s.model || AI_PROVIDERS[s.provider || 'ollama']?.defaultModel || '';
  }

  async setModel(modelId) {
    await this._saveSettings({ model: modelId });
  }

  /** API key for a cloud provider (decrypted from vault) */
  async getApiKey(providerId) {
    const s = await this._getSettings();
    const encryptedKeys = s.encryptedApiKeys || {};
    const encObj = encryptedKeys[providerId];
    if (!encObj) {
      // Migrate legacy plaintext keys if they exist
      const legacyKey = (s.apiKeys || {})[providerId];
      if (legacyKey) {
        await this.setApiKey(providerId, legacyKey); // re-save encrypted
        // Remove legacy plaintext key
        const apiKeys = { ...(s.apiKeys || {}) };
        delete apiKeys[providerId];
        await this._saveSettings({ apiKeys });
        return legacyKey;
      }
      return '';
    }
    return KeyVault.decrypt(encObj);
  }

  async setApiKey(providerId, key) {
    const s = await this._getSettings();
    const encryptedKeys = { ...(s.encryptedApiKeys || {}) };
    if (key) {
      encryptedKeys[providerId] = await KeyVault.encrypt(key);
    } else {
      delete encryptedKeys[providerId];
    }
    await this._saveSettings({ encryptedApiKeys: encryptedKeys });
  }

  // ─── Fetch relay (reuses the SW relay pattern) ───

  async _fetch(url, options = {}) {
    if (this._isPopup) {
      return new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'aiFetch', url, options },
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

  // ─── Availability ───

  async isAvailable() {
    const providerId = await this.getProvider();
    const provider = AI_PROVIDERS[providerId];
    if (!provider) return false;

    if (providerId === 'ollama') {
      try {
        const r = await this._fetch(`${provider.baseUrl}/api/tags`, { method: 'GET' });
        return r.ok === true;
      } catch { return false; }
    }

    // Cloud providers: just check if key exists
    const key = await this.getApiKey(providerId);
    return !!key;
  }

  // ─── Model listing ───

  async listModels() {
    const providerId = await this.getProvider();
    const provider = AI_PROVIDERS[providerId];
    if (!provider) return [];

    if (providerId === 'ollama') {
      try {
        const r = await this._fetch(`${provider.baseUrl}/api/tags`, { method: 'GET' });
        const models = r.data?.models || [];
        return models.map(m => ({
          id: m.name || m.model,
          name: m.name || m.model,
          size: m.details?.parameter_size || '',
        }));
      } catch { return []; }
    }

    // Cloud providers — return static list
    return provider.models.map(m => ({ ...m, size: '' }));
  }

  // ─── Core generation ───

  async generate(prompt, options = {}) {
    const providerId = await this.getProvider();
    const model = options.model || await this.getModel();
    const {
      system = '',
      temperature = 0.7,
      maxTokens = 1024,
    } = options;

    try {
      switch (providerId) {
        case 'ollama':
          return await this._generateOllama(prompt, { model, system, temperature, maxTokens });
        case 'openai':
        case 'cursor':
          return await this._generateOpenAICompat(providerId, prompt, { model, system, temperature, maxTokens });
        case 'anthropic':
          return await this._generateAnthropic(prompt, { model, system, temperature, maxTokens });
        default:
          return { success: false, text: '', error: `Unknown provider: ${providerId}` };
      }
    } catch (error) {
      return { success: false, text: '', error: error.message };
    }
  }

  async chat(messages, options = {}) {
    const providerId = await this.getProvider();
    const model = options.model || await this.getModel();
    const { temperature = 0.7, maxTokens = 1024 } = options;

    try {
      switch (providerId) {
        case 'ollama':
          return await this._chatOllama(messages, { model, temperature, maxTokens });
        case 'openai':
        case 'cursor':
          return await this._chatOpenAICompat(providerId, messages, { model, temperature, maxTokens });
        case 'anthropic':
          return await this._chatAnthropic(messages, { model, temperature, maxTokens });
        default:
          return { success: false, text: '', error: `Unknown provider: ${providerId}` };
      }
    } catch (error) {
      return { success: false, text: '', error: error.message };
    }
  }

  // ─── Ollama ───

  async _generateOllama(prompt, { model, system, temperature, maxTokens }) {
    const baseUrl = AI_PROVIDERS.ollama.baseUrl;

    // Auto-fallback to first available model
    const models = await this.listModels();
    let useModel = model;
    if (models.length > 0 && !models.some(m => m.id === model)) {
      useModel = models[0].id;
    }

    const r = await this._fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      body: JSON.stringify({
        model: useModel,
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
  }

  async _chatOllama(messages, { model, temperature, maxTokens }) {
    const baseUrl = AI_PROVIDERS.ollama.baseUrl;
    const r = await this._fetch(`${baseUrl}/api/chat`, {
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
  }

  // ─── OpenAI / Cursor (OpenAI-compatible) ───

  async _generateOpenAICompat(providerId, prompt, { model, system, temperature, maxTokens }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: prompt });
    return this._chatOpenAICompat(providerId, messages, { model, temperature, maxTokens });
  }

  async _chatOpenAICompat(providerId, messages, { model, temperature, maxTokens }) {
    const provider = AI_PROVIDERS[providerId];
    const apiKey = await this.getApiKey(providerId);
    if (!apiKey) {
      return { success: false, text: '', error: `No API key set for ${provider.name}. Click 🔑 to add one.` };
    }

    const r = await this._fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
    });

    if (!r.ok || !r.data) {
      const errMsg = r.data?.error?.message || r.error || `HTTP ${r.status}`;
      return { success: false, text: '', error: errMsg };
    }

    return {
      success: true,
      text: r.data.choices?.[0]?.message?.content || '',
      model: r.data.model,
    };
  }

  // ─── Anthropic ───

  async _generateAnthropic(prompt, { model, system, temperature, maxTokens }) {
    const messages = [{ role: 'user', content: prompt }];
    return this._chatAnthropic(messages, { model, system, temperature, maxTokens });
  }

  async _chatAnthropic(messages, { model, system, temperature, maxTokens }) {
    const apiKey = await this.getApiKey('anthropic');
    if (!apiKey) {
      return { success: false, text: '', error: 'No API key set for Anthropic. Click 🔑 to add one.' };
    }

    const baseUrl = AI_PROVIDERS.anthropic.baseUrl;
    const body = {
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    };
    if (system) body.system = system;

    const r = await this._fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!r.ok || !r.data) {
      const errMsg = r.data?.error?.message || r.error || `HTTP ${r.status}`;
      return { success: false, text: '', error: errMsg };
    }

    const textBlock = r.data.content?.find(b => b.type === 'text');
    return {
      success: true,
      text: textBlock?.text || '',
      model: r.data.model,
    };
  }

  // ─── Convenience methods (same as OllamaClient API) ───

  async summarize(text, maxLength = 200) {
    return this.generate(
      `Summarize the following in ${maxLength} characters or less. Return ONLY the summary:\n\n${text}`,
      { temperature: 0.3 }
    );
  }

  async categorize(text, categories = []) {
    const catList = categories.length > 0
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
function registerAIFetchHandler() {
  const ALLOWED_ORIGINS = [
    'http://127.0.0.1:11434',
    'https://api.openai.com',
    'https://api.anthropic.com',
    'https://api.cursor.com',
  ];

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action !== 'aiFetch') return false;

    const { url, options = {} } = msg;

    // Security: only allow requests to known AI provider origins
    const allowed = ALLOWED_ORIGINS.some(origin => url.startsWith(origin));
    if (!allowed) {
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
  module.exports = { AIClient, AI_PROVIDERS, registerAIFetchHandler };
}
