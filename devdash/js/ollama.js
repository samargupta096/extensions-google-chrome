// Ollama Chat Widget — Chat with local Ollama instance
document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('ollama-messages');
  const chatInput = document.getElementById('ollama-input');
  const sendBtn = document.getElementById('ollama-send-btn');
  const modelSelect = document.getElementById('ollama-model-select');
  const statusDot = document.getElementById('ollama-status-dot');
  const statusText = document.getElementById('ollama-status-text');
  const clearBtn = document.getElementById('ollama-clear-btn');

  if (!chatMessages || !chatInput) return;

  const OLLAMA_BASE = 'http://localhost:11434';
  let isConnected = false;
  let isStreaming = false;
  const conversationHistory = [];
  
  let aiConfig = {
    provider: 'ollama', // 'ollama' or 'openrouter'
    openRouterKey: '',
    openRouterModel: 'openai/gpt-4o'
  };

  const settingsBtn = document.getElementById('ai-settings-btn');

  // Load API key initially
  chrome.storage.local.get(['aiConfig'], (res) => {
    if (res.aiConfig) {
      aiConfig = { ...aiConfig, ...res.aiConfig };
    }
    checkConnection();
  });

  // Settings Modal
  settingsBtn && settingsBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:320px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">⚙️ AI Settings</h3>
        
        <div style="margin-bottom: 1rem;">
          <label style="font-size:0.8rem;color:var(--text-dim);display:block;margin-bottom:0.5rem;">AI Provider</label>
          <div style="display:flex;gap:1rem;">
            <label style="font-size:0.85rem;cursor:pointer;">
              <input type="radio" name="ai-provider" value="ollama" ${aiConfig.provider === 'ollama' ? 'checked' : ''}> Local Ollama
            </label>
            <label style="font-size:0.85rem;cursor:pointer;">
              <input type="radio" name="ai-provider" value="openrouter" ${aiConfig.provider === 'openrouter' ? 'checked' : ''}> OpenRouter (Cloud)
            </label>
          </div>
        </div>

        <div id="or-settings" style="display: ${aiConfig.provider === 'openrouter' ? 'block' : 'none'};">
          <label style="font-size:0.8rem;color:var(--text-dim);margin-bottom:0.3rem;display:block;">OpenRouter API Key</label>
          <input type="password" id="ai-or-key" class="glass-input" style="width:100%;margin-bottom:0.75rem;box-sizing:border-box;" placeholder="sk-or-v1-..." value="${aiConfig.openRouterKey}">
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
          <button id="ai-settings-cancel" class="glass-btn">Cancel</button>
          <button id="ai-settings-save" class="glass-btn btn-primary">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const providerRadios = overlay.querySelectorAll('input[name="ai-provider"]');
    const orSettings = overlay.querySelector('#or-settings');
    
    providerRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        if (e.target.value === 'openrouter') {
          orSettings.style.display = 'block';
        } else {
          orSettings.style.display = 'none';
        }
      });
    });

    overlay.querySelector('#ai-settings-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#ai-settings-save').addEventListener('click', () => {
      aiConfig.provider = overlay.querySelector('input[name="ai-provider"]:checked').value;
      aiConfig.openRouterKey = overlay.querySelector('#ai-or-key').value.trim();
      
      chrome.storage.local.set({ aiConfig });
      document.body.removeChild(overlay);
      modelSelect.innerHTML = '<option value="">Loading...</option>';
      checkConnection();
    });
  });

  let cachedOrModels = [];

  // Check connections and load models
  async function checkConnection() {
    if (aiConfig.provider === 'ollama') {
      try {
        const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const data = await res.json();
          isConnected = true;
          setStatus();
          populateModels(data.models ? data.models.map(m => m.name) : [], 'ollama');
        } else {
          throw new Error();
        }
      } catch {
        isConnected = false;
        setStatus();
        modelSelect.innerHTML = '<option value="">Ollama Offline</option>';
      }
    } else {
      // OpenRouter selected
      isConnected = !!aiConfig.openRouterKey;
      setStatus();
      if (isConnected) {
        if (cachedOrModels.length === 0) {
          try {
            const res = await fetch('https://openrouter.ai/api/v1/models');
            if (res.ok) {
              const data = await res.json();
              cachedOrModels = data.data.map(m => m.id).sort((a,b) => a.localeCompare(b));
            }
          } catch(e) {
            console.warn('Failed to fetch OpenRouter models:', e);
          }
        }
        populateModels(cachedOrModels, 'openrouter');
      } else {
        modelSelect.innerHTML = '<option value="">Missing API Key</option>';
      }
    }
  }

  function setStatus() {
    if (statusDot) {
      statusDot.className = `ollama-status-dot ${isConnected ? 'connected' : 'disconnected'}`;
      statusDot.style.backgroundColor = ''; // reset to default green
      statusDot.style.boxShadow = '';
    }
    if (statusText) {
      if (aiConfig.provider === 'openrouter') {
        statusText.textContent = isConnected ? 'OpenRouter API' : 'Missing API Key';
      } else {
        statusText.textContent = isConnected ? '' : 'Ollama offline';
      }
    }
  }

  function populateModels(models, provider) {
    if (!modelSelect) return;
    modelSelect.innerHTML = '';
    
    if (models.length === 0) {
      modelSelect.innerHTML = '<option value="">No models available</option>';
      return;
    }

    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = provider === 'ollama' ? m.split(':')[0] : m.split('/').pop();
      modelSelect.appendChild(opt);
    });

    const savedModel = provider === 'ollama' ? aiConfig.ollamaModel : aiConfig.openRouterModel;
    if (savedModel && models.includes(savedModel)) {
      modelSelect.value = savedModel;
    } else if (models.length > 0) {
      modelSelect.value = models[0];
      if (provider === 'ollama') aiConfig.ollamaModel = models[0];
      else aiConfig.openRouterModel = models[0];
      chrome.storage.local.set({ aiConfig });
    }
  }

  modelSelect && modelSelect.addEventListener('change', () => {
    if (aiConfig.provider === 'ollama') {
      aiConfig.ollamaModel = modelSelect.value;
    } else {
      aiConfig.openRouterModel = modelSelect.value;
    }
    chrome.storage.local.set({ aiConfig });
  });

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

  async function sendMessage() {
    if (isStreaming || !chatInput.value.trim()) return;
    
    const provider = aiConfig.provider;
    let modelId = '';

    if (provider === 'ollama') {
      modelId = modelSelect?.value;
      if (!isConnected) {
        appendMessage('assistant', '⚠️ Local Ollama is offline. Please start it with `OLLAMA_ORIGINS="*" ollama serve`.');
        return;
      }
      if (!modelId) {
        appendMessage('assistant', '⚠️ No Ollama model selected.');
        return;
      }
    } else {
      modelId = modelSelect?.value;
      if (!aiConfig.openRouterKey) {
        appendMessage('assistant', '⚠️ OpenRouter API key missing. Please add it in settings (⚙️).');
        return;
      }
      if (!modelId) {
        appendMessage('assistant', '⚠️ No OpenRouter model selected.');
        return;
      }
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
      if (provider === 'ollama') {
        const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelId,
            messages: conversationHistory,
            stream: true,
          })
        });

        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        contentSpan.textContent = '';
        let buffer = '';

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

      } else if (provider === 'openrouter') {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.openRouterKey}`,
            'HTTP-Referer': 'https://github.com/samargupta096/devdash',
            'X-Title': 'DevDash'
          },
          body: JSON.stringify({
            model: modelId,
            messages: conversationHistory,
            stream: true
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`OpenRouter Error: ${res.status} ${errText}`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        contentSpan.textContent = '';
        let buffer = '';

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
      }

      conversationHistory.push({ role: 'assistant', content: fullResponse });
    } catch (e) {
      console.error('Chat Error:', e);
      let errorMsg = `Error: ${e.message}`;
      contentSpan.innerHTML = `<span style="color: #ff6b6b;">${errorMsg}</span>`;
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      sendBtn.textContent = '➤';
      if (assistantDiv.id === 'ollama-streaming-msg') assistantDiv.removeAttribute('id');
    }
  }

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
    chatMessages.innerHTML = '<div class="ollama-welcome">Ask me anything... 💡</div>';
  });

  // Re-check every 30s
  setInterval(checkConnection, 30000);
});
