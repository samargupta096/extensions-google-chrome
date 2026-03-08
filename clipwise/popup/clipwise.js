const COLORS = ['#6C5CE7','#00CEC9','#FD79A8','#FDCB6E','#00B894','#E17055','#74B9FF','#A29BFE'];

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadClips();
  loadSnippets();
  loadStats();
  checkAI();
  document.getElementById('clip-search').addEventListener('input', () => loadClips());
  document.getElementById('clip-filter').addEventListener('change', () => loadClips());
  document.getElementById('btn-paste-clip').addEventListener('click', saveFromClipboard);
  document.getElementById('btn-save-snippet').addEventListener('click', saveSnippet);
  if (document.getElementById('model-select')) {
    document.getElementById('model-select').addEventListener('change', saveSelectedModel);
  }
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).style.display = 'block';
      if (tab.dataset.tab === 'stats') loadStats();
      if (tab.dataset.tab === 'snippets') loadSnippets();
    });
  });
}

async function saveFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    await chrome.runtime.sendMessage({ type: 'ADD_CLIP', text, source: 'clipboard' });
    loadClips();
    showToast('Clip saved!');
  } catch { showToast('Allow clipboard access'); }
}

async function loadClips() {
  const search = document.getElementById('clip-search').value;
  const typeFilter = document.getElementById('clip-filter').value;
  const { clips } = await chrome.runtime.sendMessage({ type: 'GET_CLIPS', search, type_filter: typeFilter, limit: 40 });
  const container = document.getElementById('clip-list');
  if (!clips || !clips.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No clips yet</div><div class="empty-state-text">Copy text and save from clipboard</div></div>';
    return;
  }
  container.innerHTML = clips.map(c => `
    <div class="clip-item" data-id="${c.id}">
      <div class="clip-text ${c.type === 'code' || c.type === 'command' ? 'is-code' : ''}">${esc(c.text.slice(0, 200))}</div>
      <div class="clip-meta">
        <span class="clip-type ${c.type}">${c.type}</span>
        <span class="clip-time">${timeAgo(c.timestamp)}</span>
        <div class="clip-actions">
          <button class="btn btn-ghost btn-sm js-clip-copy" title="Copy">📋</button>
          <button class="btn btn-ghost btn-sm js-clip-ai" title="AI Explain">🧠</button>
          <button class="btn btn-ghost btn-sm js-clip-del" title="Delete" style="color:var(--accent-red);">🗑️</button>
        </div>
      </div>
      <div id="ai-${c.id}"></div>
    </div>
  `).join('');
}

document.getElementById('clip-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const item = e.target.closest('.clip-item');
  if (!item) return;
  const id = item.dataset.id;
  
  if (btn.classList.contains('js-clip-copy')) { e.stopPropagation(); copyClipById(id); }
  else if (btn.classList.contains('js-clip-ai')) { e.stopPropagation(); aiAction(id, 'explain'); }
  else if (btn.classList.contains('js-clip-del')) { e.stopPropagation(); deleteClip(id); }
});

const copyClipById = async (id) => {
  const { clips } = await chrome.runtime.sendMessage({ type: 'GET_CLIPS', limit: 500 });
  const clip = clips.find(c => c.id === id);
  if (clip) { await navigator.clipboard.writeText(clip.text); showToast('Copied!'); }
};
const deleteClip = async (id) => {
  await chrome.runtime.sendMessage({ type: 'DELETE_CLIP', id });
  loadClips();
};
const aiAction = async (id, action) => {
  const el = document.getElementById('ai-'+id);
  el.innerHTML = '<div class="ai-result">🧠 Thinking...</div>';
  const { clips } = await chrome.runtime.sendMessage({ type: 'GET_CLIPS', limit: 500 });
  const clip = clips.find(c => c.id === id);
  if (!clip) return;
  const result = await chrome.runtime.sendMessage({ type: 'AI_ACTION', text: clip.text, action });
  el.innerHTML = `<div class="ai-result">${result.success ? esc(result.text) : '❌ '+result.text}</div>`;
};

async function saveSnippet() {
  const title = document.getElementById('snippet-title').value.trim();
  const code = document.getElementById('snippet-code').value.trim();
  const language = document.getElementById('snippet-lang').value;
  if (!title || !code) return;
  await chrome.runtime.sendMessage({ type: 'ADD_SNIPPET', title, code, language });
  document.getElementById('snippet-title').value = '';
  document.getElementById('snippet-code').value = '';
  loadSnippets();
  showToast('Snippet saved!');
}

async function loadSnippets() {
  const { snippets } = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
  const container = document.getElementById('snippet-list');
  if (!snippets || !snippets.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;"><div style="font-size:24px;opacity:0.3;margin-bottom:6px;">💾</div><div style="font-size:12px;color:var(--text-tertiary);">No snippets yet</div></div>';
    return;
  }
  container.innerHTML = snippets.map(s => `
    <div class="snippet-item">
      <div class="snippet-title">${esc(s.title)}</div>
      <div class="snippet-code">${esc(s.code.slice(0, 200))}</div>
      <div class="snippet-meta">
        <span class="badge badge-cyan">${s.language}</span>
        <span class="clip-time">${timeAgo(s.timestamp)}</span>
        <button class="btn btn-ghost btn-sm js-snip-copy" data-code="${esc(s.code)}">📋</button>
        <button class="btn btn-ghost btn-sm js-snip-del" data-id="${s.id}" style="color:var(--accent-red);">🗑️</button>
      </div>
    </div>
  `).join('');
}

document.getElementById('snippet-list').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  if (btn.classList.contains('js-snip-copy')) {
    const code = btn.dataset.code || '';
    navigator.clipboard.writeText(code.replace(/&quot;/g, '"'));
    showToast('Copied!');
  } else if (btn.classList.contains('js-snip-del')) {
    deleteSnippet(btn.dataset.id);
  }
});

const deleteSnippet = async (id) => {
  await chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', id });
  loadSnippets();
};

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  document.getElementById('stat-clips').textContent = stats.totalClips;
  document.getElementById('stat-snippets').textContent = stats.totalSnippets;
  const types = Object.entries(stats.types || {}).sort(([,a],[,b]) => b - a);
  if (types.length > 0) {
    ChartUtils.doughnutChart(document.getElementById('chart-types'), {}, {
      labels: types.map(([t]) => t), values: types.map(([,v]) => v), colors: COLORS,
      centerText: String(stats.totalClips), centerSubText: 'clips', lineWidth: 20
    });
  }
  const daily = Object.entries(stats.daily || {}).sort().slice(-7);
  if (daily.length > 0) {
    ChartUtils.barChart(document.getElementById('chart-daily'), {}, {
      labels: daily.map(([d]) => new Date(d).toLocaleDateString('en',{weekday:'short'})),
      values: daily.map(([,v]) => v), barColor: '#6C5CE7', formatValue: v => `${Math.round(v)}`
    });
  }
}

async function checkAI() {
  const ollama = new AIClient();
  const available = await ollama.isAvailable();
  const el = document.getElementById('ai-status');
  
  if (available) {
    el.className = 'ollama-status connected';
    el.innerHTML = '<span class="status-dot online"></span><span>AI</span>';
    loadModels(ollama);
  } else {
    el.className = 'ollama-status disconnected';
    el.innerHTML = '<span class="status-dot offline"></span><span>AI</span>';
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

    const savedModel = (await chrome.storage.local.get('cw_settings')).cw_settings?.ollamaModel || 'qwen3:latest';

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
  
  const data = await chrome.storage.local.get('cw_settings');
  const settings = data.cw_settings || {};
  await chrome.storage.local.set({ cw_settings: { ...settings, ollamaModel: model } });
}

function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function timeAgo(ts) { const d=(Date.now()-ts)/1000; if(d<60) return 'now'; if(d<3600) return `${Math.floor(d/60)}m`; if(d<86400) return `${Math.floor(d/3600)}h`; return `${Math.floor(d/86400)}d`; }
function showToast(m) { const t=document.createElement('div'); t.className='toast success'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),2500); }


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
