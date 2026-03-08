let pageContent = { title: '', url: '', text: '' };

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  checkAI();
  extractPage();
  setupToolsDelegation();

  document.getElementById('btn-send').addEventListener('click', sendChat);
  document.getElementById('chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendChat(); });
  document.getElementById('model-select').addEventListener('change', saveSelectedModel);
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).style.display = 'block';
    });
  });
}

async function extractPage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
    pageContent = response || pageContent;
  } catch {}
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const question = input.value.trim();
  if (!question) return;
  const container = document.getElementById('chat-messages');
  const welcome = container.querySelector('.chat-welcome');
  if (welcome) welcome.remove();
  container.innerHTML += `<div class="chat-msg user">${esc(question)}</div>`;
  container.innerHTML += `<div class="chat-msg ai" id="loading-msg">🔍 Analyzing page...</div>`;
  container.scrollTop = container.scrollHeight;
  input.value = '';
  const result = await chrome.runtime.sendMessage({
    type: 'CHAT', question, pageTitle: pageContent.title, pageUrl: pageContent.url, pageContent: pageContent.text
  });
  const loadEl = document.getElementById('loading-msg');
  if (loadEl) loadEl.remove();
  container.innerHTML += `<div class="chat-msg ai">${result.success ? esc(result.text) : '❌ '+result.text}</div>`;
  container.scrollTop = container.scrollHeight;
}

// ============ Tools ============
function setupToolsDelegation() {
  // Quick tool selector clicks
  document.getElementById('tool-grid').addEventListener('click', e => {
    const toolEl = e.target.closest('.tool-quick');
    if (toolEl) {
      showTool(toolEl.dataset.tool);
    }
  });

  // Action clicks inside the tool area
  document.getElementById('tool-area').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action]');
    if (btn) {
      const action = btn.dataset.action;
      if (typeof window[action] === 'function') {
        window[action]();
      }
    }
  });

  // Dynamic input listeners
  document.getElementById('tool-area').addEventListener('input', e => {
    if (e.target.id === 't-count-in') countText();
  });
  
  document.getElementById('tool-area').addEventListener('change', e => {
    if (e.target.id === 't-color-pick') {
      document.getElementById('t-color-in').value = e.target.value;
      convertColor();
    }
  });
}

function showTool(tool) {
  const area = document.getElementById('tool-area');
  const templates = {
    json: '<div class="tool-card"><h4>📋 JSON Formatter</h4><textarea class="input" id="t-json-in" rows="4" placeholder="Paste JSON..." style="font-family:monospace;font-size:11px;"></textarea><div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-primary btn-sm" data-action="formatJSON">Format</button><button class="btn btn-secondary btn-sm" data-action="minifyJSON">Minify</button></div><div class="tool-result" id="t-json-out" style="display:none;"></div></div>',
    base64: '<div class="tool-card"><h4>🔐 Base64</h4><textarea class="input" id="t-b64-in" rows="3" placeholder="Enter text..." style="font-size:12px;"></textarea><div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-primary btn-sm" data-action="b64Encode">Encode</button><button class="btn btn-secondary btn-sm" data-action="b64Decode">Decode</button></div><div class="tool-result" id="t-b64-out" style="display:none;"></div></div>',
    url: '<div class="tool-card"><h4>🔗 URL Encode/Decode</h4><textarea class="input" id="t-url-in" rows="2" placeholder="Enter text or URL..." style="font-size:12px;"></textarea><div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-primary btn-sm" data-action="urlEncode">Encode</button><button class="btn btn-secondary btn-sm" data-action="urlDecode">Decode</button></div><div class="tool-result" id="t-url-out" style="display:none;"></div></div>',
    timestamp: '<div class="tool-card"><h4>⏰ Timestamp</h4><input type="text" class="input" id="t-ts-in" placeholder="Unix timestamp or date string"><div style="display:flex;gap:6px;margin-top:8px;"><button class="btn btn-primary btn-sm" data-action="convertTS">Convert</button><button class="btn btn-secondary btn-sm" data-action="currentTS">Current</button></div><div class="tool-result" id="t-ts-out" style="display:none;"></div></div>',
    lorem: '<div class="tool-card"><h4>📝 Lorem Ipsum</h4><div class="input-group"><input type="number" class="input" id="t-lorem-n" value="3" min="1" max="20"><select class="input" id="t-lorem-type"><option value="paragraphs">Paragraphs</option><option value="sentences">Sentences</option><option value="words">Words</option></select></div><button class="btn btn-primary btn-sm" data-action="genLorem" style="margin-top:8px;">Generate</button><div class="tool-result" id="t-lorem-out" style="display:none;"></div></div>',
    counter: '<div class="tool-card"><h4>🔢 Counter</h4><textarea class="input" id="t-count-in" rows="3" placeholder="Paste text..." style="font-size:12px;"></textarea><div id="t-count-out" style="font-size:12px;color:var(--text-secondary);margin-top:8px;">0 words · 0 chars · 0 lines</div></div>',
    color: '<div class="tool-card"><h4>🎨 Color Converter</h4><div class="input-group"><input type="text" class="input" id="t-color-in" placeholder="#6C5CE7 or rgb(108,92,231)"><input type="color" id="t-color-pick" value="#6C5CE7" style="width:40px;height:36px;padding:2px;border:none;border-radius:6px;cursor:pointer;"></div><button class="btn btn-primary btn-sm" data-action="convertColor" style="margin-top:8px;">Convert</button><div class="tool-result" id="t-color-out" style="display:none;"></div></div>',
    regex: '<div class="tool-card"><h4>🔎 Regex Tester</h4><input type="text" class="input" id="t-regex-pattern" placeholder="Pattern (e.g. \\d+)" style="font-family:monospace;font-size:12px;"><input type="text" class="input" id="t-regex-flags" placeholder="Flags" value="g" style="width:60px;margin-top:6px;font-family:monospace;"><textarea class="input" id="t-regex-test" rows="3" placeholder="Test string..." style="margin-top:6px;font-size:12px;"></textarea><button class="btn btn-primary btn-sm" data-action="testRegex" style="margin-top:8px;">Test</button><div class="tool-result" id="t-regex-out" style="display:none;"></div></div>'
  };
  area.innerHTML = templates[tool] || '';
}

function show(id, text) { const el = document.getElementById(id); el.style.display = 'block'; el.textContent = text; }

window.formatJSON = function() { try { show('t-json-out', JSON.stringify(JSON.parse(document.getElementById('t-json-in').value), null, 2)); } catch(e) { show('t-json-out', 'Error: '+e.message); } };
window.minifyJSON = function() { try { show('t-json-out', JSON.stringify(JSON.parse(document.getElementById('t-json-in').value))); } catch(e) { show('t-json-out', 'Error: '+e.message); } };
window.b64Encode = function() { show('t-b64-out', btoa(unescape(encodeURIComponent(document.getElementById('t-b64-in').value)))); };
window.b64Decode = function() { try { show('t-b64-out', decodeURIComponent(escape(atob(document.getElementById('t-b64-in').value)))); } catch { show('t-b64-out', 'Invalid Base64'); } };
window.urlEncode = function() { show('t-url-out', encodeURIComponent(document.getElementById('t-url-in').value)); };
window.urlDecode = function() { show('t-url-out', decodeURIComponent(document.getElementById('t-url-in').value)); };
window.convertTS = function() {
  const v = document.getElementById('t-ts-in').value.trim();
  let d;
  if (/^\d{10}$/.test(v)) d = new Date(parseInt(v)*1000);
  else if (/^\d{13}$/.test(v)) d = new Date(parseInt(v));
  else d = new Date(v);
  if (isNaN(d)) { show('t-ts-out', 'Invalid'); return; }
  show('t-ts-out', `Unix: ${Math.floor(d.getTime()/1000)}\nUnix(ms): ${d.getTime()}\nISO: ${d.toISOString()}\nLocal: ${d.toLocaleString()}`);
};
window.currentTS = function() { document.getElementById('t-ts-in').value = Math.floor(Date.now()/1000); convertTS(); };
window.genLorem = function() {
  const n = parseInt(document.getElementById('t-lorem-n').value)||3;
  const type = document.getElementById('t-lorem-type').value;
  const w = 'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua'.split(' ');
  let r = '';
  if (type==='words') r = w.slice(0,n).join(' ');
  else if (type==='sentences') r = Array.from({length:n}, ()=>w.slice(0,8+Math.floor(Math.random()*6)).join(' ')+'.').join(' ');
  else r = Array.from({length:n}, ()=>w.slice(0,15+Math.floor(Math.random()*10)).join(' ')+'.').join('\n\n');
  show('t-lorem-out', r);
};
window.countText = function() {
  const t = document.getElementById('t-count-in').value;
  document.getElementById('t-count-out').textContent = `${t.trim()?t.trim().split(/\s+/).length:0} words · ${t.length} chars · ${t.split('\n').length} lines`;
};
window.convertColor = function() {
  const v = document.getElementById('t-color-in').value.trim();
  let r,g,b;
  if (/^#([0-9A-F]{6})$/i.test(v)){r=parseInt(v.slice(1,3),16);g=parseInt(v.slice(3,5),16);b=parseInt(v.slice(5,7),16);}
  else if (/^rgb/i.test(v)){const m=v.match(/(\d+)/g);if(m){r=+m[0];g=+m[1];b=+m[2];}}
  else{show('t-color-out','Enter hex or rgb');return;}
  const hex='#'+[r,g,b].map(x=>x.toString(16).padStart(2,'0')).join('');
  show('t-color-out', `HEX: ${hex}\nRGB: rgb(${r},${g},${b})`);
  document.getElementById('t-color-out').innerHTML+=`<div style="width:100%;height:24px;border-radius:6px;margin-top:6px;background:${hex};"></div>`;
};
window.testRegex = function() {
  try {
    const p=document.getElementById('t-regex-pattern').value,f=document.getElementById('t-regex-flags').value,t=document.getElementById('t-regex-test').value;
    const m=[...t.matchAll(new RegExp(p,f))];
    show('t-regex-out', m.length?`${m.length} match(es):\n${m.map((x,i)=>`${i+1}. "${x[0]}" @${x.index}`).join('\n')}`:'No matches');
  } catch(e) { show('t-regex-out','Error: '+e.message); }
};

async function checkAI() {
  const ollama = new AIClient();
  const available = await ollama.isAvailable();
  const el = document.getElementById('ai-status');
  el.className = available ? 'ollama-status connected' : 'ollama-status disconnected';
  el.innerHTML = `<span class="status-dot ${available ? 'online' : 'offline'}"></span><span>AI</span>`;

  if (available) loadModels(ollama);
  else {
    const select = document.getElementById('model-select');
    if (select) { select.innerHTML = '<option value="">Ollama offline</option>'; select.classList.add('loading'); }
  }
}

async function loadModels(ollama) {
  const select = document.getElementById('model-select');
  if (!select) return;
  try {
    const models = await ollama.listModels();
    if (models.length === 0) {
      select.innerHTML = '<option value="">No models</option>';
      select.classList.add('loading');
      return;
    }

    const savedModel = (await chrome.storage.local.get('pp_settings')).pp_settings?.ollamaModel || 'qwen3:latest';

    select.innerHTML = models.map(m => {
      const name = m.name || m.model;
      const size = m.details?.parameter_size || '';
      const label = size ? `${name} (${size})` : name;
      return `<option value="${name}" ${name === savedModel ? 'selected' : ''}>${label}</option>`;
    }).join('');

    select.classList.remove('loading');

    if (!models.some(m => (m.name || m.model) === savedModel)) {
      select.selectedIndex = 0;
      saveSelectedModel();
    }
  } catch {
    select.innerHTML = '<option value="">Error</option>';
    select.classList.add('loading');
  }
}

async function saveSelectedModel() {
  const select = document.getElementById('model-select');
  const model = select.value;
  if (!model) return;
  const data = await chrome.storage.local.get('pp_settings');
  const settings = data.pp_settings || {};
  await chrome.storage.local.set({ pp_settings: { ...settings, ollamaModel: model } });
}

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}


// ============ Multi-Provider AI Setup ============
(function initMultiProviderAI() {
  const aiClient = typeof window._aiClient !== 'undefined' ? window._aiClient : (typeof AIClient !== 'undefined' ? new AIClient() : null);
  if (!aiClient) return;

  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  const btnApiKey = document.getElementById('btn-api-key');
  const apiKeyWrap = document.getElementById('api-key-wrap');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const aiStatus = document.getElementById('ai-status');

  if (!providerSelect || !modelSelect) return;

  async function initAI() {
    const providerId = await aiClient.getProvider();
    providerSelect.value = providerId;
    updateApiKeyButton(providerId);
    await checkAIStatus();
    await loadAIModels();
  }

  async function checkAIStatus() {
    if (!aiStatus) return;
    const providerId = await aiClient.getProvider();
    const provider = typeof AI_PROVIDERS !== 'undefined' ? AI_PROVIDERS[providerId] : null;
    const providerName = provider?.name || providerId;
    const available = await aiClient.isAvailable();
    if (available) {
      aiStatus.className = 'ollama-status connected';
      aiStatus.innerHTML = '<span class="status-dot online"></span><span>' + providerName + '</span>';
    } else {
      aiStatus.className = 'ollama-status disconnected';
      const hint = provider?.requiresKey ? 'No Key' : 'Offline';
      aiStatus.innerHTML = '<span class="status-dot offline"></span><span>' + hint + '</span>';
    }
  }

  async function loadAIModels() {
    modelSelect.innerHTML = '<option value="">Loading...</option>';
    try {
      const models = await aiClient.listModels();
      const savedModel = await aiClient.getModel();
      if (models.length === 0) {
        const pid = await aiClient.getProvider();
        modelSelect.innerHTML = '<option value="">' + (pid === 'ollama' ? 'Ollama offline' : 'No models') + '</option>';
        return;
      }
      modelSelect.innerHTML = models.map(function(m) {
        const label = m.size ? m.name + ' (' + m.size + ')' : m.name;
        return '<option value="' + m.id + '"' + (m.id === savedModel ? ' selected' : '') + '>' + label + '</option>';
      }).join('');
      if (!models.some(function(m) { return m.id === savedModel; })) {
        modelSelect.selectedIndex = 0;
        await aiClient.setModel(models[0].id);
      }
    } catch(e) {
      modelSelect.innerHTML = '<option value="">Error</option>';
    }
  }

  function updateApiKeyButton(providerId) {
    if (!btnApiKey) return;
    const provider = typeof AI_PROVIDERS !== 'undefined' ? AI_PROVIDERS[providerId] : null;
    btnApiKey.style.display = (provider && provider.requiresKey) ? '' : 'none';
    if (apiKeyWrap) apiKeyWrap.style.display = 'none';
  }

  providerSelect.addEventListener('change', async function() {
    const pid = providerSelect.value;
    await aiClient.setProvider(pid);
    updateApiKeyButton(pid);
    if (apiKeyWrap) apiKeyWrap.style.display = 'none';
    await checkAIStatus();
    await loadAIModels();
  });

  modelSelect.addEventListener('change', async function() {
    if (modelSelect.value) await aiClient.setModel(modelSelect.value);
  });

  if (btnApiKey) {
    btnApiKey.addEventListener('click', function() {
      if (apiKeyWrap) {
        apiKeyWrap.style.display = apiKeyWrap.style.display === 'none' ? 'flex' : 'none';
        if (apiKeyInput && apiKeyWrap.style.display === 'flex') apiKeyInput.focus();
      }
    });
  }

  if (btnSaveKey) {
    btnSaveKey.addEventListener('click', async function() {
      const pid = providerSelect.value;
      const key = apiKeyInput ? apiKeyInput.value.trim() : '';
      if (!key) return;
      await aiClient.setApiKey(pid, key);
      if (apiKeyWrap) apiKeyWrap.style.display = 'none';
      if (apiKeyInput) apiKeyInput.value = '';
      await checkAIStatus();
    });
  }

  // Initialize after a short delay to ensure DOM is ready
  setTimeout(initAI, 100);
})();
