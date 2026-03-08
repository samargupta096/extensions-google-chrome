/**
 * TabVault — Popup Controller
 * Current tabs, named session save/restore, stale tab detection, AI summaries
 */

const ollama = new AIClient();
const $ = (id) => document.getElementById(id);
let currentTabs = [];
let savedSessions = [];

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadCurrentTabs();
});

// ─── Tabs ───
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
      tab.classList.add('active');
      $(`tab-${tab.dataset.tab}`).style.display = '';
      if (tab.dataset.tab === 'sessions') loadSessions();
      if (tab.dataset.tab === 'stale') loadStaleTabs();
      if (tab.dataset.tab === 'current') loadCurrentTabs();
    });
  });
}

// ─── Current Tabs ───
async function loadCurrentTabs() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getCurrentTabs' }, (r) => {
      if (!r?.success) { resolve(); return; }
      currentTabs = r.tabs || [];
      $('ramMB').textContent = r.estimatedRamMB;
      $('currentTabCount').textContent = `${r.count} tabs`;
      $('currentRamEst').textContent = `~${r.estimatedRamMB} MB RAM`;

      renderDomainGroups(r.domainGroups);
      renderCurrentTabs(currentTabs);
      resolve();
    });
  });
}

function renderDomainGroups(groups) {
  $('domainGroups').innerHTML = (groups || []).map(g =>
    `<span class="domain-group-chip">${g.domain} (${g.count})</span>`
  ).join('');
}

function renderCurrentTabs(tabs) {
  const list = $('currentTabList');
  const empty = $('currentEmpty');
  if (!tabs.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  list.innerHTML = tabs.map(t => `
    <div class="tab-item ${t.isStale ? 'is-stale' : ''}">
      ${t.favIconUrl ? `<img class="tab-favicon" src="${t.favIconUrl}" onerror="this.style.display='none'">` : '<span class="tab-favicon">🌐</span>'}
      <span class="tab-title" title="${escapeHtml(t.title || t.url)}">${escapeHtml(t.title || t.url)}</span>
      ${t.isStale ? `<span class="tab-days">${t.daysOpen}d</span>` : ''}
      <button class="tab-close-btn" data-id="${t.id}" title="Close tab">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.tab-close-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'closeTab', tabId: parseInt(btn.dataset.id) }, () => {
        showToast('Tab closed', 'success');
        loadCurrentTabs();
      });
    })
  );
}

// Save all tabs as session
$('saveAllBtn').addEventListener('click', () => {
  const name = $('sessionNameInput').value.trim() || `Session ${new Date().toLocaleDateString()}`;
  chrome.runtime.sendMessage({ action: 'saveSession', name }, (r) => {
    if (r?.success) {
      showToast(`💾 Saved ${r.tabCount} tabs`, 'success');
      $('sessionNameInput').value = '';
    }
  });
});

$('sessionNameInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('saveAllBtn').click();
});

// ─── Saved Sessions ───
async function loadSessions() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getSessions' }, (r) => {
      if (!r?.success) { resolve(); return; }
      savedSessions = r.sessions || [];
      const list = $('sessionList');
      const empty = $('sessionsEmpty');
      const count = $('sessionsCount');

      count.textContent = `${savedSessions.length} sessions`;

      if (!savedSessions.length) { list.innerHTML = ''; empty.style.display = ''; resolve(); return; }
      empty.style.display = 'none';
      renderSessionList(savedSessions);
      resolve();
    });
  });
}

function renderSessionList(sessions) {
  const list = $('sessionList');
  list.innerHTML = sessions.map(s => `
    <div class="session-card" id="sc-${s.id}" data-id="${s.id}">
      <div class="session-card-top">
        <div class="session-name js-rename" title="Double-click to rename">${escapeHtml(s.name)}</div>
      </div>
      <div class="session-meta">
        <span class="session-tab-count">📑 ${s.tabCount} tabs</span>
        <span class="session-ram">💾 ~${s.estimatedRamMB}MB</span>
        <span class="session-date">🗓 ${new Date(s.createdAt).toLocaleDateString()}</span>
      </div>
      <div class="session-domains">
        ${(s.domainGroups || []).slice(0, 5).map(d => `<span class="session-domain-chip">${d.domain}</span>`).join('')}
      </div>
      ${s.aiSummary ? `<div class="session-ai-summary">🤖 ${escapeHtml(s.aiSummary)}</div>` : ''}
      <div class="session-actions">
        <button class="btn btn-primary btn-sm js-restore">↩️ Restore</button>
        <button class="btn btn-secondary btn-sm js-summary">🤖 Summary</button>
        <button class="btn btn-ghost btn-sm js-export">📤 Export</button>
        <button class="btn btn-ghost btn-sm js-delete" style="color:var(--accent-red)">🗑️</button>
      </div>
    </div>
  `).join('');
}

// Global delegated listeners for sessionList
$('sessionList').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const card = e.target.closest('.session-card');
  if (!card) return;
  const id = card.dataset.id;
  if (btn.classList.contains('js-restore')) restoreSession(id);
  else if (btn.classList.contains('js-summary')) generateSummary(id);
  else if (btn.classList.contains('js-export')) exportSession(id);
  else if (btn.classList.contains('js-delete')) deleteSession(id);
});

$('sessionList').addEventListener('dblclick', (e) => {
  if (e.target.classList.contains('js-rename')) {
    const card = e.target.closest('.session-card');
    if (card) renameSession(card.dataset.id, e.target);
  }
});

const restoreSession = (id) => {
  chrome.runtime.sendMessage({ action: 'restoreSession', sessionId: id }, (r) => {
    if (r?.success) showToast('Session restored in new window! 🚀', 'success');
    else showToast('Restore failed', 'error');
  });
};

const deleteSession = (id) => {
  chrome.runtime.sendMessage({ action: 'deleteSession', sessionId: id }, () => {
    showToast('Session deleted', 'success');
    loadSessions();
  });
};

const exportSession = (id) => {
  chrome.runtime.sendMessage({ action: 'exportSession', sessionId: id }, (r) => {
    if (r?.success) {
      navigator.clipboard.writeText(r.markdown);
      showToast('Copied as Markdown! 📝', 'success');
    }
  });
};

const renameSession = (id, el) => {
  const current = el.textContent;
  const input = document.createElement('input');
  input.value = current;
  input.className = 'input';
  input.style.fontSize = '13px';
  el.replaceWith(input);
  input.focus(); input.select();
  input.addEventListener('blur', () => {
    const newName = input.value.trim() || current;
    chrome.runtime.sendMessage({ action: 'renameSession', sessionId: id, name: newName }, () => {
      input.replaceWith(el);
      el.textContent = newName;
      showToast('Renamed!', 'success');
    });
  });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
};

const generateSummary = async (id) => {
  const session = savedSessions.find(s => s.id === id);
  if (!session) return;

  const available = await ollama.isAvailable();
  if (!available) { showToast('AI offline', 'error'); return; }

  // Find existing summary element or create one
  const card = document.getElementById(`sc-${id}`);
  let summaryEl = card.querySelector('.session-ai-summary');
  if (!summaryEl) {
    summaryEl = document.createElement('div');
    summaryEl.className = 'session-ai-summary';
    card.querySelector('.session-actions').before(summaryEl);
  }
  summaryEl.innerHTML = '<span class="spinner"></span> Summarizing...';

  const tabList = session.tabs.slice(0, 20).map(t => t.title || t.url).join(', ');
  const prompt = `In 1-2 sentences, describe what a developer was researching/working on based on these browser tabs:\n\n${tabList}\n\nBe specific and technical. Focus on what they were likely doing (e.g. debugging auth issues, researching React hooks, reviewing PRs).`;
  const r = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 150 });

  if (r.success) {
    summaryEl.textContent = `🤖 ${r.text}`;
    // Save summary
    chrome.runtime.sendMessage({ action: 'getSessions' }, (sr) => {
      const s = (sr?.sessions || []).find(s => s.id === id);
      if (s) {
        s.aiSummary = r.text;
        chrome.storage.local.get('tabSessions', ({ tabSessions }) => {
          if (tabSessions?.[id]) { tabSessions[id].aiSummary = r.text; chrome.storage.local.set({ tabSessions }); }
        });
      }
    });
  } else {
    summaryEl.textContent = '⚠️ AI unavailable';
  }
};

// Session search
$('sessionSearch').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = savedSessions.filter(s =>
    s.name.toLowerCase().includes(q) ||
    (s.tabs || []).some(t => (t.title || '').toLowerCase().includes(q))
  );
  renderSessionList(filtered);
});

// ─── Stale Tabs ───
async function loadStaleTabs() {
  chrome.runtime.sendMessage({ action: 'getStaleTabs' }, (r) => {
    const staleTabs = r?.staleTabs || [];
    const list = $('staleTabList');
    const empty = $('staleEmpty');

    if (!staleTabs.length) { list.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    list.innerHTML = staleTabs.map(t => `
      <div class="stale-tab-item">
        <span class="stale-tab-title" title="${escapeHtml(t.url)}">${escapeHtml(t.title || t.url)}</span>
        <span class="stale-tab-days">${t.daysOpen}d old</span>
        <button class="stale-tab-close" data-id="${t.id}" title="Close this tab">✕</button>
      </div>
    `).join('');

    list.querySelectorAll('.stale-tab-close').forEach(btn =>
      btn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'closeTab', tabId: parseInt(btn.dataset.id) }, () => {
          btn.closest('.stale-tab-item').remove();
          showToast('Tab closed', 'success');
        });
      })
    );
  });
}

$('saveStaleBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getStaleTabs' }, (r) => {
    const staleTabs = r?.staleTabs || [];
    if (!staleTabs.length) { showToast('No stale tabs', 'error'); return; }
    const name = `Stale Tabs — ${new Date().toLocaleDateString()}`;
    const tabIds = staleTabs.map(t => t.id);
    chrome.runtime.sendMessage({ action: 'saveSession', name, tabIds }, (sr) => {
      if (sr?.success) {
        chrome.runtime.sendMessage({ action: 'closeSession', sessionId: sr.sessionId });
        showToast(`Saved ${sr.tabCount} stale tabs & closed ✅`, 'success');
        loadStaleTabs();
      }
    });
  });
});

// ─── Utils ───
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div'); d.textContent = str; return d.innerHTML;
}
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast'); if (existing) existing.remove();
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}


// --- Global Model Selector ---
async function initGlobalModelSelector() {
  const select = document.getElementById('globalModelSelect');
  if (!select) return;

  try {
    const models = await ollama.listModels();
    if (!models || models.length === 0) {
      select.style.display = 'none';
      return;
    }
    
    select.style.display = ''; // show it
    const local = await chrome.storage.local.get('settings');
    const settings = local.settings || {};
    const savedModel = settings.defaultModel || ollama.defaultModel || 'llama3.2';

    select.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    if (models.some(m => m.name === savedModel)) {
      select.value = savedModel;
    } else {
      select.value = models[0].name;
      await chrome.storage.local.set({ settings: { ...settings, defaultModel: select.value } });
    }

    select.addEventListener('change', async (e) => {
      const current = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(current.settings || {}), defaultModel: e.target.value } });
    });
  } catch(e) { console.error('Failed to init model selector', e); }
}

// Auto-run after DOM load and status check
setTimeout(initGlobalModelSelector, 500);


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
