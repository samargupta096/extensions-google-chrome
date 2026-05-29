// AI Chat Widget — Multi-Provider Chat Engine
// Supports: Ollama (local), OpenRouter, OpenAI, Groq, Google Gemini
document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('ollama-messages');
  const chatInput = document.getElementById('ollama-input');
  const sendBtn = document.getElementById('ollama-send-btn');
  const modelSelect = document.getElementById('ollama-model-select');
  const statusDot = document.getElementById('ollama-status-dot');
  const statusText = document.getElementById('ollama-status-text');
  const clearBtn = document.getElementById('ollama-clear-btn');
  const settingsBtn = document.getElementById('ai-settings-btn');

  if (!chatMessages || !chatInput) return;

  let isConnected = false;
  let isStreaming = false;
  const conversationHistory = [];
  let cachedModels = {};          // keyed by provider id

  /* ═══════════════════════════════════════════════════════════
     Provider Registry
     ═══════════════════════════════════════════════════════════ */
  const PROVIDERS = {
    ollama: {
      name: 'Ollama (Local)',
      requiresKey: false,
      defaultBaseUrl: 'http://localhost:11434',
      defaultModel: '',
      // --- models ---
      modelsUrl(cfg)     { return `${cfg.baseUrl || 'http://localhost:11434'}/api/tags`; },
      modelsHeaders()    { return {}; },
      parseModels(json)  { return (json.models || []).map(m => m.name); },
      modelLabel(id)     { return id.split(':')[0]; },
      // --- chat ---
      chatUrl(cfg)       { return `${cfg.baseUrl || 'http://localhost:11434'}/api/chat`; },
      chatHeaders()      { return { 'Content-Type': 'application/json' }; },
      buildBody(model, messages) {
        return JSON.stringify({ model, messages, stream: true });
      },
      parseStream: 'ndjson'
    },

    openrouter: {
      name: 'OpenRouter',
      requiresKey: true,
      defaultModel: 'openai/gpt-4o',
      modelsUrl()        { return 'https://openrouter.ai/api/v1/models'; },
      modelsHeaders(cfg) { return { 'Authorization': `Bearer ${cfg.apiKey}` }; },
      parseModels(json)  { return (json.data || []).map(m => m.id).sort(); },
      modelLabel(id)     { return id.split('/').pop(); },
      chatUrl()          { return 'https://openrouter.ai/api/v1/chat/completions'; },
      chatHeaders(cfg)   {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`,
          'HTTP-Referer': 'https://github.com/samargupta096/devdash',
          'X-Title': 'DevDash'
        };
      },
      buildBody(model, messages) {
        return JSON.stringify({ model, messages, stream: true });
      },
      parseStream: 'sse'
    },

    openai: {
      name: 'OpenAI',
      requiresKey: true,
      defaultModel: 'gpt-4o',
      modelsUrl()        { return 'https://api.openai.com/v1/models'; },
      modelsHeaders(cfg) { return { 'Authorization': `Bearer ${cfg.apiKey}` }; },
      parseModels(json)  {
        return (json.data || [])
          .map(m => m.id)
          .filter(id => /^(gpt-|o[1-9]|chatgpt)/.test(id))
          .sort();
      },
      modelLabel(id)     { return id; },
      chatUrl()          { return 'https://api.openai.com/v1/chat/completions'; },
      chatHeaders(cfg)   {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`
        };
      },
      buildBody(model, messages) {
        return JSON.stringify({ model, messages, stream: true });
      },
      parseStream: 'sse'
    },

    groq: {
      name: 'Groq',
      requiresKey: true,
      defaultModel: '',
      modelsUrl()        { return 'https://api.groq.com/openai/v1/models'; },
      modelsHeaders(cfg) { return { 'Authorization': `Bearer ${cfg.apiKey}` }; },
      parseModels(json)  {
        return (json.data || [])
          .map(m => m.id)
          .filter(id => !/whisper/.test(id))
          .sort();
      },
      modelLabel(id)     { return id; },
      chatUrl()          { return 'https://api.groq.com/openai/v1/chat/completions'; },
      chatHeaders(cfg)   {
        return {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cfg.apiKey}`
        };
      },
      buildBody(model, messages) {
        return JSON.stringify({ model, messages, stream: true });
      },
      parseStream: 'sse'
    },

    gemini: {
      name: 'Google Gemini',
      requiresKey: true,
      defaultModel: '',
      modelsUrl(cfg)     { return `https://generativelanguage.googleapis.com/v1beta/models?key=${cfg.apiKey}&pageSize=100`; },
      modelsHeaders()    { return {}; },
      parseModels(json)  {
        return (json.models || [])
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => m.name.replace('models/', ''))
          .sort();
      },
      modelLabel(id)     { return id; },
      chatUrl(cfg, model){ return `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${cfg.apiKey}`; },
      chatHeaders()      { return { 'Content-Type': 'application/json' }; },
      buildBody(_model, messages) {
        // Translate OpenAI-style messages → Gemini contents format
        const contents = messages.map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));
        return JSON.stringify({ contents });
      },
      parseStream: 'gemini-sse'
    }
  };

  /* ═══════════════════════════════════════════════════════════
     Config Management
     ═══════════════════════════════════════════════════════════ */
  const DEFAULT_CONFIG = {
    provider: 'ollama',
    providers: {}
  };
  // Initialise defaults for every provider
  for (const [key, p] of Object.entries(PROVIDERS)) {
    DEFAULT_CONFIG.providers[key] = {
      apiKey: '',
      model: p.defaultModel || '',
      ...(p.defaultBaseUrl ? { baseUrl: p.defaultBaseUrl } : {})
    };
  }

  let aiConfig = structuredClone(DEFAULT_CONFIG);

  function migrateOldConfig(raw) {
    // Old format: { provider, openRouterKey, openRouterModel, ollamaModel }
    if (raw && raw.openRouterKey !== undefined && !raw.providers) {
      const migrated = structuredClone(DEFAULT_CONFIG);
      migrated.provider = raw.provider || 'ollama';
      if (raw.openRouterKey) migrated.providers.openrouter.apiKey = raw.openRouterKey;
      if (raw.openRouterModel) migrated.providers.openrouter.model = raw.openRouterModel;
      if (raw.ollamaModel) migrated.providers.ollama.model = raw.ollamaModel;
      return migrated;
    }
    return null;
  }

  // Load config
  chrome.storage.local.get(['aiConfig'], (res) => {
    if (res.aiConfig) {
      const migrated = migrateOldConfig(res.aiConfig);
      if (migrated) {
        aiConfig = migrated;
        chrome.storage.local.set({ aiConfig });
      } else {
        // Merge stored config over defaults (handles new providers added later)
        aiConfig = { ...structuredClone(DEFAULT_CONFIG), ...res.aiConfig };
        aiConfig.providers = { ...structuredClone(DEFAULT_CONFIG.providers), ...res.aiConfig.providers };
      }
    }
    checkConnection();
  });

  function saveConfig() {
    chrome.storage.local.set({ aiConfig });
  }

  function activeProvider()    { return PROVIDERS[aiConfig.provider]; }
  function activeProviderCfg() { return aiConfig.providers[aiConfig.provider] || {}; }

  /* ═══════════════════════════════════════════════════════════
     Connection & Model Fetching
     ═══════════════════════════════════════════════════════════ */
  async function checkConnection() {
    const pid = aiConfig.provider;
    const p = PROVIDERS[pid];
    const cfg = activeProviderCfg();

    // If key is required but missing
    if (p.requiresKey && !cfg.apiKey) {
      isConnected = false;
      setStatus('Missing API Key');
      modelSelect.innerHTML = '<option value="">Set API Key in ⚙️</option>';
      return;
    }

    try {
      const url = p.modelsUrl(cfg);
      const headers = p.modelsHeaders(cfg);
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });

      if (!res.ok) throw new Error(`${res.status}`);

      const data = await res.json();
      const models = p.parseModels(data);
      cachedModels[pid] = models;
      isConnected = true;
      setStatus(p.name);
      populateModels(models, pid);
    } catch (e) {
      isConnected = false;
      setStatus(`${p.name} offline`);
      modelSelect.innerHTML = `<option value="">${p.name} unavailable</option>`;
    }
  }

  function setStatus(label) {
    if (statusDot) {
      statusDot.className = `ollama-status-dot ${isConnected ? 'connected' : 'disconnected'}`;
      statusDot.style.backgroundColor = '';
      statusDot.style.boxShadow = '';
    }
    if (statusText) {
      statusText.textContent = isConnected ? label : (label || 'Offline');
    }
  }

  function populateModels(models, providerId) {
    if (!modelSelect) return;
    modelSelect.innerHTML = '';

    if (models.length === 0) {
      modelSelect.innerHTML = '<option value="">No models found</option>';
      return;
    }

    const p = PROVIDERS[providerId];
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = p.modelLabel(m);
      modelSelect.appendChild(opt);
    });

    const cfg = aiConfig.providers[providerId];
    if (cfg.model && models.includes(cfg.model)) {
      modelSelect.value = cfg.model;
    } else if (models.length > 0) {
      modelSelect.value = models[0];
      cfg.model = models[0];
      saveConfig();
    }
  }

  modelSelect && modelSelect.addEventListener('change', () => {
    const cfg = aiConfig.providers[aiConfig.provider];
    cfg.model = modelSelect.value;
    saveConfig();
  });

  /* ═══════════════════════════════════════════════════════════
     Settings Modal
     ═══════════════════════════════════════════════════════════ */
  settingsBtn && settingsBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';

    // Build provider options
    const providerOpts = Object.entries(PROVIDERS).map(([key, p]) =>
      `<option value="${key}" ${aiConfig.provider === key ? 'selected' : ''}>${p.name}</option>`
    ).join('');

    const currentPid = aiConfig.provider;
    const currentCfg = aiConfig.providers[currentPid] || {};
    const currentP = PROVIDERS[currentPid];

    overlay.innerHTML = `
      <div class="env-modal glass-card ai-settings-modal" style="animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1.25rem 0;font-size:1.1rem;">🤖 AI Provider Settings</h3>

        <div class="ai-settings-field">
          <label class="ai-settings-label">Provider</label>
          <select id="ai-provider-select" class="glass-select ai-provider-select">
            ${providerOpts}
          </select>
        </div>

        <div id="ai-key-section" class="ai-settings-field" style="display:${currentP.requiresKey ? 'block' : 'none'}">
          <label class="ai-settings-label">API Key</label>
          <div class="ai-key-row">
            <input type="password" id="ai-api-key" class="glass-input ai-key-input"
                   placeholder="Enter API key..." value="${currentCfg.apiKey || ''}">
            <button id="ai-toggle-key" class="glass-btn btn-small ai-toggle-key-btn" title="Show/Hide">👁️</button>
          </div>
          <div id="ai-key-hint" class="ai-key-hint">${getKeyHint(currentPid)}</div>
        </div>

        <div id="ai-base-url-section" class="ai-settings-field" style="display:${currentPid === 'ollama' ? 'block' : 'none'}">
          <label class="ai-settings-label">Base URL</label>
          <input type="text" id="ai-base-url" class="glass-input"
                 placeholder="http://localhost:11434" value="${currentCfg.baseUrl || ''}">
        </div>

        <div id="ai-test-section" class="ai-settings-field">
          <button id="ai-test-btn" class="glass-btn btn-small ai-test-btn">🔌 Test Connection</button>
          <span id="ai-test-result" class="ai-test-result"></span>
        </div>

        <div class="ai-settings-actions">
          <button id="ai-settings-cancel" class="glass-btn">Cancel</button>
          <button id="ai-settings-save" class="glass-btn btn-primary">Save</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    // ── Wire up events ──
    const providerSelect = overlay.querySelector('#ai-provider-select');
    const keySection = overlay.querySelector('#ai-key-section');
    const keyInput = overlay.querySelector('#ai-api-key');
    const keyHint = overlay.querySelector('#ai-key-hint');
    const baseUrlSection = overlay.querySelector('#ai-base-url-section');
    const baseUrlInput = overlay.querySelector('#ai-base-url');
    const toggleKeyBtn = overlay.querySelector('#ai-toggle-key');
    const testBtn = overlay.querySelector('#ai-test-btn');
    const testResult = overlay.querySelector('#ai-test-result');

    providerSelect.addEventListener('change', () => {
      const pid = providerSelect.value;
      const p = PROVIDERS[pid];
      const cfg = aiConfig.providers[pid] || {};

      keySection.style.display = p.requiresKey ? 'block' : 'none';
      keyInput.value = cfg.apiKey || '';
      keyHint.textContent = getKeyHint(pid);
      baseUrlSection.style.display = pid === 'ollama' ? 'block' : 'none';
      baseUrlInput.value = cfg.baseUrl || '';
      testResult.textContent = '';
    });

    toggleKeyBtn.addEventListener('click', () => {
      keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
    });

    testBtn.addEventListener('click', async () => {
      const pid = providerSelect.value;
      const p = PROVIDERS[pid];
      const tempCfg = {
        apiKey: keyInput.value.trim(),
        baseUrl: baseUrlInput.value.trim() || PROVIDERS[pid].defaultBaseUrl || ''
      };

      testResult.textContent = '⏳ Testing...';
      testResult.style.color = 'var(--text-dim)';

      try {
        const url = p.modelsUrl(tempCfg);
        const headers = p.modelsHeaders(tempCfg);
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = p.parseModels(data);
        testResult.textContent = `✅ Connected — ${models.length} models`;
        testResult.style.color = '#4ade80';
      } catch (e) {
        testResult.textContent = `❌ Failed: ${e.message}`;
        testResult.style.color = '#ff6b6b';
      }
    });

    overlay.querySelector('#ai-settings-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.querySelector('#ai-settings-save').addEventListener('click', () => {
      const pid = providerSelect.value;
      aiConfig.provider = pid;

      // Save key for the selected provider
      if (!aiConfig.providers[pid]) aiConfig.providers[pid] = {};
      aiConfig.providers[pid].apiKey = keyInput.value.trim();

      if (pid === 'ollama') {
        aiConfig.providers[pid].baseUrl = baseUrlInput.value.trim() || 'http://localhost:11434';
      }

      saveConfig();
      document.body.removeChild(overlay);
      modelSelect.innerHTML = '<option value="">Loading...</option>';
      checkConnection();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  });

  function getKeyHint(pid) {
    const hints = {
      ollama: '',
      openrouter: 'Get key at openrouter.ai/keys',
      openai: 'Get key at platform.openai.com/api-keys',
      groq: 'Get key at console.groq.com/keys',
      gemini: 'Get key at aistudio.google.dev/apikey'
    };
    return hints[pid] || '';
  }

  /* ═══════════════════════════════════════════════════════════
     Message Rendering
     ═══════════════════════════════════════════════════════════ */
  function appendMessage(role, content, isStreamingMessage = false) {
    const div = document.createElement('div');
    div.className = `ollama-message ${role}`;
    if (isStreamingMessage) div.id = 'ollama-streaming-msg';

    div.innerHTML = `<span class="msg-content">${escapeHtml(content)}</span>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return div;
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }

  /* ═══════════════════════════════════════════════════════════
     Send Message — Routes to the active provider
     ═══════════════════════════════════════════════════════════ */
  async function sendMessage() {
    if (isStreaming || !chatInput.value.trim()) return;

    const pid = aiConfig.provider;
    const p = PROVIDERS[pid];
    const cfg = activeProviderCfg();
    const modelId = modelSelect?.value;

    // Validate
    if (p.requiresKey && !cfg.apiKey) {
      appendMessage('assistant', `⚠️ ${p.name} API key missing. Click ⚙️ to add it.`);
      return;
    }
    if (!isConnected) {
      appendMessage('assistant', `⚠️ ${p.name} is offline. Check connection in ⚙️.`);
      return;
    }
    if (!modelId) {
      appendMessage('assistant', `⚠️ No model selected for ${p.name}.`);
      return;
    }

    const userText = chatInput.value.trim();
    chatInput.value = '';
    chatInput.style.height = 'auto';
    conversationHistory.push({ role: 'user', content: userText });
    appendMessage('user', userText);

    isStreaming = true;
    sendBtn.disabled = true;
    sendBtn.textContent = '⏳';

    const assistantDiv = appendMessage('assistant', '▋', true);
    const contentSpan = assistantDiv.querySelector('.msg-content');
    let fullResponse = '';

    try {
      const url = p.chatUrl(cfg, modelId);
      const headers = p.chatHeaders(cfg);
      const body = p.buildBody(modelId, conversationHistory);

      const res = await fetch(url, { method: 'POST', headers, body });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`${p.name} Error: ${res.status} ${errText.substring(0, 200)}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      contentSpan.textContent = '';
      let buffer = '';

      if (p.parseStream === 'ndjson') {
        // ── Ollama NDJSON stream ──
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const json = JSON.parse(line);
                if (json.message?.content) {
                  fullResponse += json.message.content;
                  contentSpan.innerHTML = escapeHtml(fullResponse) + '▋';
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                }
                if (json.done) contentSpan.innerHTML = escapeHtml(fullResponse);
              } catch (err) {}
            }
          }
          if (done) break;
        }

      } else if (p.parseStream === 'sse') {
        // ── OpenAI-compatible SSE stream (OpenAI, OpenRouter, Groq) ──
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (let line of lines) {
              line = line.trim();
              if (!line) continue;
              if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const json = JSON.parse(dataStr);
                  const chunk = json.choices?.[0]?.delta?.content || '';
                  fullResponse += chunk;
                  contentSpan.innerHTML = escapeHtml(fullResponse) + '▋';
                  chatMessages.scrollTop = chatMessages.scrollHeight;
                } catch (e) {}
              }
            }
          }
          if (done) {
            contentSpan.innerHTML = escapeHtml(fullResponse);
            break;
          }
        }

      } else if (p.parseStream === 'gemini-sse') {
        // ── Google Gemini SSE stream ──
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (let line of lines) {
              line = line.trim();
              if (!line) continue;
              if (line.startsWith('data: ')) {
                const dataStr = line.substring(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const json = JSON.parse(dataStr);
                  const parts = json.candidates?.[0]?.content?.parts || [];
                  for (const part of parts) {
                    if (part.text) {
                      fullResponse += part.text;
                      contentSpan.innerHTML = escapeHtml(fullResponse) + '▋';
                      chatMessages.scrollTop = chatMessages.scrollHeight;
                    }
                  }
                } catch (e) {}
              }
            }
          }
          if (done) {
            contentSpan.innerHTML = escapeHtml(fullResponse);
            break;
          }
        }
      }

      conversationHistory.push({ role: 'assistant', content: fullResponse });
    } catch (e) {
      console.error('Chat Error:', e);
      contentSpan.innerHTML = `<span style="color: #ff6b6b;">Error: ${escapeHtml(e.message)}</span>`;
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      sendBtn.textContent = '➤';
      if (assistantDiv.id === 'ollama-streaming-msg') assistantDiv.removeAttribute('id');
    }
  }

  /* ═══════════════════════════════════════════════════════════
     Event Listeners
     ═══════════════════════════════════════════════════════════ */
  sendBtn && sendBtn.addEventListener('click', sendMessage);
  chatInput && chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  // Auto-grow textarea
  chatInput && chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
  });

  clearBtn && clearBtn.addEventListener('click', () => {
    conversationHistory.length = 0;
    chatMessages.innerHTML = '<div class="ollama-welcome">Ask me anything... 💡<br><small>Ollama · OpenAI · Groq · Gemini · OpenRouter</small></div>';
  });

  // Re-check connection every 30s
  setInterval(checkConnection, 30000);
});
