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

  // Check Ollama connection and load models
  async function checkConnection() {
    try {
      const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        isConnected = true;
        setStatus(true);
        populateModels(data.models || []);
      } else {
        throw new Error();
      }
    } catch {
      isConnected = false;
      setStatus(false);
    }
  }

  function setStatus(connected) {
    if (statusDot) {
      statusDot.className = `ollama-status-dot ${connected ? 'connected' : 'disconnected'}`;
    }
    if (statusText) {
      statusText.textContent = connected ? 'Connected' : 'Ollama not running';
    }
  }

  function populateModels(models) {
    if (!modelSelect) return;
    modelSelect.innerHTML = '';
    if (models.length === 0) {
      modelSelect.innerHTML = '<option value="">No models pulled</option>';
      return;
    }
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name.split(':')[0];
      modelSelect.appendChild(opt);
    });
    // Restore last used model
    chrome.storage.local.get(['ollamaModel'], (result) => {
      if (result.ollamaModel) modelSelect.value = result.ollamaModel;
    });
  }

  modelSelect && modelSelect.addEventListener('change', () => {
    chrome.storage.local.set({ ollamaModel: modelSelect.value });
  });

  function appendMessage(role, content, isStreamingMessage = false) {
    const div = document.createElement('div');
    div.className = `ollama-message ${role}`;
    if (isStreamingMessage) div.id = 'ollama-streaming-msg';

    const icon = role === 'user' ? '👤' : '🤖';
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
    if (!isConnected) {
      appendMessage('assistant', '⚠️ Ollama is not running. Please start it with `ollama serve`.');
      return;
    }
    const model = modelSelect?.value;
    if (!model) {
      appendMessage('assistant', '⚠️ No model selected. Pull one with `ollama pull llama3`.');
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
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: conversationHistory,
          stream: true,
        })
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      contentSpan.textContent = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Keep the partial line in the buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              fullResponse += json.message.content;
              contentSpan.innerHTML = escapeHtml(fullResponse) + '▋';
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            if (json.done) {
              contentSpan.innerHTML = escapeHtml(fullResponse);
            }
          } catch (err) {
            console.error('Error parsing JSON line:', line, err);
          }
        }
      }

      conversationHistory.push({ role: 'assistant', content: fullResponse });
    } catch (e) {
      contentSpan.textContent = `Error: ${e.message}`;
    } finally {
      isStreaming = false;
      sendBtn.disabled = false;
      sendBtn.textContent = '➤';
      assistantDiv.removeAttribute('id');
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

  // Retry connection button on disconnect message
  checkConnection();
  // Re-check every 30s
  setInterval(checkConnection, 30000);
});
