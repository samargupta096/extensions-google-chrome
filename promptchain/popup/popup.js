/**
 * PromptChain — Popup Controller
 * Handles tabs, chain builder, execution runner, chat, and settings
 */

const ollama = new AIClient();
let chains = [];
let pageContext = { page: '', url: '', title: '', selection: '' };
let currentEditChain = null;

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  await checkAIStatus();
  await loadPageContext();
  await loadChains();
  setupTabs();
  setupRunTab();
  setupBuildTab();
  setupLibraryTab();
  setupChatTab();
  setupSettings();
});

// ─── Ollama Status ───
async function checkAIStatus() {
  const badge = document.getElementById('aiStatus');
  try {
    const available = await ollama.isAvailable();
    if (available) {
      badge.textContent = '● AI Ready';
      badge.className = 'ai-badge online';
    } else {
      badge.textContent = '● Offline';
      badge.className = 'ai-badge offline';
    }
  } catch {
    badge.textContent = '● Offline';
    badge.className = 'ai-badge offline';
  }
}

// ─── Page Context ───
async function loadPageContext() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getPageContent' }, (res) => {
      if (res?.success) {
        pageContext = { page: res.page, url: res.url, title: res.title, selection: res.selection };
        document.getElementById('contextUrl').textContent = res.url || 'No page loaded';
        document.getElementById('contextUrl').title = res.title || '';
      }
      resolve();
    });
  });
}

// ─── Chains ───
async function loadChains() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getChains' }, (res) => {
      if (res?.success) chains = res.chains;
      resolve();
    });
  });
}

// ─── Tabs ───
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

      if (tab.dataset.tab === 'library') renderLibrary();
      if (tab.dataset.tab === 'chat') loadChatHistory();
    });
  });
}

// ═══════════════════════════════════════════
// ⚡ RUN TAB
// ═══════════════════════════════════════════

function setupRunTab() {
  const select = document.getElementById('chainSelect');
  const runBtn = document.getElementById('runChainBtn');
  const descEl = document.getElementById('chainDescription');
  const stepsEl = document.getElementById('chainSteps');

  // Populate chain select
  select.innerHTML = '<option value="">Select a chain...</option>';
  chains.forEach(chain => {
    const opt = document.createElement('option');
    opt.value = chain.id;
    opt.textContent = `${chain.icon} ${chain.name}`;
    select.appendChild(opt);
  });

  // Chain selection
  select.addEventListener('change', () => {
    const chain = chains.find(c => c.id === select.value);
    if (chain) {
      descEl.textContent = chain.description;
      descEl.classList.remove('hidden');
      stepsEl.innerHTML = chain.steps.map((s, i) =>
        `<span class="step-pill"><span class="step-num">${i + 1}</span>${s.name}</span>`
      ).join('');
      stepsEl.classList.remove('hidden');
      runBtn.disabled = false;
    } else {
      descEl.classList.add('hidden');
      stepsEl.classList.add('hidden');
      runBtn.disabled = true;
    }
  });

  // Run chain
  runBtn.addEventListener('click', () => executeChain(select.value));
}

async function executeChain(chainId) {
  const runBtn = document.getElementById('runChainBtn');
  const execArea = document.getElementById('executionArea');
  const resultsEl = document.getElementById('executionResults');
  const timerEl = document.getElementById('execTimer');

  const chain = chains.find(c => c.id === chainId);
  if (!chain) return;

  runBtn.disabled = true;
  runBtn.textContent = '⏳ Running...';
  execArea.classList.remove('hidden');
  resultsEl.innerHTML = '';

  // Show pending steps
  chain.steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'step-result';
    div.id = `step-result-${i}`;
    div.innerHTML = `
      <div class="step-result-header js-step-header">
        <div class="step-result-title">
          <span class="step-status pending" id="step-status-${i}"></span>
          <span>${i + 1}. ${step.name}</span>
        </div>
        <span style="font-size:10px; color: var(--pc-text-dim)">▼</span>
      </div>
      <div class="step-result-body" id="step-body-${i}">Waiting...</div>
      <div class="step-result-meta" id="step-meta-${i}"></div>
    `;
    resultsEl.appendChild(div);
  });

  const startTime = Date.now();
  timerEl.textContent = '0.0s';
  const timerInterval = setInterval(() => {
    timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
  }, 100);

  // Set first step as running
  const statusEl0 = document.getElementById('step-status-0');
  if (statusEl0) statusEl0.className = 'step-status running';

  const useContext = document.getElementById('usePageContext').checked;
  const context = useContext ? pageContext : { page: '', url: '', title: '', selection: '' };

  chrome.runtime.sendMessage({
    action: 'executeChain',
    chainId,
    context
  }, (response) => {
    clearInterval(timerInterval);
    timerEl.textContent = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
    runBtn.disabled = false;
    runBtn.textContent = '▶ Run Chain';

    if (response?.success) {
      response.results.forEach((result, i) => {
        const statusEl = document.getElementById(`step-status-${i}`);
        const bodyEl = document.getElementById(`step-body-${i}`);
        const metaEl = document.getElementById(`step-meta-${i}`);
        const cardEl = document.getElementById(`step-result-${i}`);

        if (statusEl) statusEl.className = `step-status ${result.status}`;
        if (bodyEl) {
          bodyEl.textContent = result.output || result.error || 'No output';
          if (result.status === 'error') bodyEl.classList.add('error');
        }
        if (metaEl && result.model) {
          metaEl.textContent = `Model: ${result.model}`;
        }
        // Auto-expand last step
        if (i === response.results.length - 1 && cardEl) {
          cardEl.classList.add('expanded');
        }
      });

      // Mark remaining steps as pending (if chain stopped early)
      for (let i = response.results.length; i < chain.steps.length; i++) {
        const statusEl = document.getElementById(`step-status-${i}`);
        const bodyEl = document.getElementById(`step-body-${i}`);
        if (statusEl) statusEl.className = 'step-status error';
        if (bodyEl) bodyEl.textContent = 'Skipped (previous step failed)';
      }
    } else {
      resultsEl.innerHTML = `<div class="step-result-body error" style="display:block">${response?.error || 'Execution failed'}</div>`;
    }
  });
}

document.getElementById('executionResults').addEventListener('click', (e) => {
  const header = e.target.closest('.js-step-header');
  if (header) header.parentElement.classList.toggle('expanded');
});

// ═══════════════════════════════════════════
// 🔧 BUILD TAB
// ═══════════════════════════════════════════

function setupBuildTab() {
  document.getElementById('addStepBtn').addEventListener('click', () => addStepCard());
  document.getElementById('saveChainBtn').addEventListener('click', saveCurrentChain);
  document.getElementById('testChainBtn').addEventListener('click', testCurrentChain);

  // Add initial step
  addStepCard();
}

let stepCounter = 0;

function addStepCard(data = null) {
  const container = document.getElementById('stepsContainer');
  const index = container.children.length;

  if (index > 0) {
    const connector = document.createElement('div');
    connector.className = 'step-connector';
    connector.textContent = '↓';
    container.appendChild(connector);
  }

  stepCounter++;
  const card = document.createElement('div');
  card.className = 'step-card';
  card.dataset.stepId = data?.id || `step_${stepCounter}`;
  card.innerHTML = `
    <div class="step-card-header">
      <div>
        <span class="step-number">${index + 1}</span>
        <input type="text" value="${data?.name || `Step ${index + 1}`}" placeholder="Step name" class="step-name-input">
      </div>
      <div class="step-actions">
        <button class="js-move-up" title="Move up">⬆️</button>
        <button class="js-move-down" title="Move down">⬇️</button>
        <button class="js-remove-step" title="Remove">❌</button>
      </div>
    </div>
    <textarea placeholder="Enter your prompt here. Use {{page}}, {{previous}}, {{selection}}, {{url}} variables...">${data?.prompt || ''}</textarea>
    <div class="var-hints">
      <span class="var-hint js-insert-var" data-var="{{page}}">{{page}}</span>
      <span class="var-hint js-insert-var" data-var="{{previous}}">{{previous}}</span>
      <span class="var-hint js-insert-var" data-var="{{selection}}">{{selection}}</span>
      <span class="var-hint js-insert-var" data-var="{{url}}">{{url}}</span>
      <span class="var-hint js-insert-var" data-var="{{title}}">{{title}}</span>
    </div>
  `;
  container.appendChild(card);
}

document.getElementById('stepsContainer').addEventListener('click', (e) => {
  const btn = e.target.closest('button, .var-hint');
  if (!btn) return;
  if (btn.classList.contains('js-move-up')) moveStep(btn, -1);
  else if (btn.classList.contains('js-move-down')) moveStep(btn, 1);
  else if (btn.classList.contains('js-remove-step')) removeStep(btn);
  else if (btn.classList.contains('js-insert-var')) insertVar(btn, btn.dataset.var);
});

// Global functions for inline handlers
const insertVar = (hintEl, variable) => {
  const textarea = hintEl.closest('.step-card').querySelector('textarea');
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  textarea.value = textarea.value.slice(0, start) + variable + textarea.value.slice(end);
  textarea.focus();
  textarea.setSelectionRange(start + variable.length, start + variable.length);
};

const removeStep = (btn) => {
  const card = btn.closest('.step-card');
  const container = document.getElementById('stepsContainer');
  // Remove connector before this card
  const prev = card.previousElementSibling;
  if (prev?.classList.contains('step-connector')) prev.remove();
  else {
    const next = card.nextElementSibling;
    if (next?.classList.contains('step-connector')) next.remove();
  }
  card.remove();
  renumberSteps();
};

const moveStep = (btn, direction) => {
  const card = btn.closest('.step-card');
  const container = document.getElementById('stepsContainer');
  const cards = [...container.querySelectorAll('.step-card')];
  const idx = cards.indexOf(card);
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= cards.length) return;

  // Rebuild: collect data, remove all, re-add in new order
  const stepsData = collectStepsData();
  const [moved] = stepsData.splice(idx, 1);
  stepsData.splice(targetIdx, 0, moved);

  container.innerHTML = '';
  stepCounter = 0;
  stepsData.forEach(s => addStepCard(s));
};

function renumberSteps() {
  document.querySelectorAll('.step-card').forEach((card, i) => {
    card.querySelector('.step-number').textContent = i + 1;
  });
}

function collectStepsData() {
  return [...document.querySelectorAll('.step-card')].map(card => ({
    id: card.dataset.stepId,
    name: card.querySelector('.step-name-input').value.trim() || 'Untitled Step',
    prompt: card.querySelector('textarea').value,
    model: 'auto'
  }));
}

async function saveCurrentChain() {
  const name = document.getElementById('chainName').value.trim();
  const icon = document.getElementById('chainIcon').value.trim() || '🔗';
  const description = document.getElementById('chainDesc').value.trim();
  const steps = collectStepsData();

  if (!name) { alert('Please enter a chain name'); return; }
  if (steps.length === 0 || !steps[0].prompt) { alert('Add at least one step with a prompt'); return; }

  const chain = {
    id: currentEditChain?.id || undefined,
    name, icon, description, steps,
    isBuiltIn: false
  };

  chrome.runtime.sendMessage({ action: 'saveChain', chain }, async (res) => {
    if (res?.success) {
      await loadChains();
      currentEditChain = res.chain;
      // Refresh the Run tab select
      setupRunTab();
      // Flash save button
      const btn = document.getElementById('saveChainBtn');
      btn.textContent = '✅ Saved!';
      setTimeout(() => { btn.textContent = '💾 Save Chain'; }, 1500);
    }
  });
}

async function testCurrentChain() {
  const steps = collectStepsData();
  if (steps.length === 0 || !steps[0].prompt) return;

  const testEl = document.getElementById('testResults');
  testEl.classList.remove('hidden');
  testEl.innerHTML = '<div class="loading-dots">Testing first step</div>';

  const useContext = document.getElementById('usePageContext')?.checked;
  const context = useContext ? pageContext : { page: '', url: '', title: '', selection: '' };

  chrome.runtime.sendMessage({
    action: 'executeStep',
    step: steps[0],
    context: { ...context, previous: '' }
  }, (res) => {
    if (res?.success) {
      testEl.innerHTML = `<div style="color: var(--pc-success); margin-bottom: 4px;">✅ Step 1 passed (${res.model})</div><div style="white-space: pre-wrap; font-size: 11px; max-height: 150px; overflow-y: auto;">${res.output.slice(0, 500)}${res.output.length > 500 ? '...' : ''}</div>`;
    } else {
      testEl.innerHTML = `<div style="color: var(--pc-error);">❌ Test failed: ${res?.error || 'Unknown error'}</div>`;
    }
  });
}

function loadChainIntoBuilder(chain) {
  currentEditChain = chain;
  document.getElementById('chainName').value = chain.name;
  document.getElementById('chainIcon').value = chain.icon || '🔗';
  document.getElementById('chainDesc').value = chain.description || '';

  const container = document.getElementById('stepsContainer');
  container.innerHTML = '';
  stepCounter = 0;
  chain.steps.forEach(s => addStepCard(s));

  // Switch to build tab
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-tab="build"]').classList.add('active');
  document.getElementById('tab-build').classList.add('active');
}

// ═══════════════════════════════════════════
// 📚 LIBRARY TAB
// ═══════════════════════════════════════════

function setupLibraryTab() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderLibrary(btn.dataset.filter);
    });
  });
  renderLibrary();
  renderExecutionHistory();
}

function renderLibrary(filter = 'all') {
  const container = document.getElementById('chainLibrary');
  let filtered = chains;
  if (filter === 'builtin') filtered = chains.filter(c => c.isBuiltIn);
  else if (filter === 'custom') filtered = chains.filter(c => !c.isBuiltIn);

  container.innerHTML = filtered.map(chain => `
    <div class="library-card" data-chain-id="${chain.id}">
      <div class="library-card-header">
        <div class="library-card-info">
          <span class="library-card-icon">${chain.icon}</span>
          <div>
            <div class="library-card-title">${chain.name}</div>
            <div class="library-card-steps">${chain.steps.length} steps</div>
          </div>
        </div>
        <span class="library-card-badge ${chain.isBuiltIn ? 'builtin' : 'custom'}">
          ${chain.isBuiltIn ? 'Built-in' : 'Custom'}
        </span>
      </div>
      <div class="library-card-desc">${chain.description || 'No description'}</div>
      <div class="library-card-actions">
        <button class="btn btn-small btn-secondary js-edit-chain" data-id="${chain.id}">✏️ Edit</button>
        <button class="btn btn-small btn-accent js-dup-chain" data-id="${chain.id}">📋 Duplicate</button>
        ${!chain.isBuiltIn ? `<button class="btn btn-small btn-danger js-del-chain" data-id="${chain.id}">🗑️</button>` : ''}
      </div>
    </div>
  `).join('');
}

document.getElementById('chainLibrary').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.classList.contains('js-edit-chain')) handleEditChain(id);
  else if (btn.classList.contains('js-dup-chain')) handleDuplicateChain(id);
  else if (btn.classList.contains('js-del-chain')) handleDeleteChain(id);
});

const handleEditChain = (chainId) => {
  const chain = chains.find(c => c.id === chainId);
  if (chain) loadChainIntoBuilder(chain);
};

const handleDuplicateChain = (chainId) => {
  const chain = chains.find(c => c.id === chainId);
  if (!chain) return;
  const dup = {
    ...JSON.parse(JSON.stringify(chain)),
    id: undefined,
    name: `${chain.name} (Copy)`,
    isBuiltIn: false
  };
  chrome.runtime.sendMessage({ action: 'saveChain', chain: dup }, async (res) => {
    if (res?.success) {
      await loadChains();
      renderLibrary();
      setupRunTab();
    }
  });
};

const handleDeleteChain = (chainId) => {
  if (!confirm('Delete this chain?')) return;
  chrome.runtime.sendMessage({ action: 'deleteChain', chainId }, async (res) => {
    if (res?.success) {
      await loadChains();
      renderLibrary();
      setupRunTab();
    }
  });
};

function renderExecutionHistory() {
  chrome.runtime.sendMessage({ action: 'getExecutionHistory' }, (res) => {
    if (!res?.success) return;
    const container = document.getElementById('executionHistory');
    const history = (res.history || []).slice(0, 10);

    if (history.length === 0) {
      container.innerHTML = '<div style="text-align:center; color: var(--pc-text-dim); padding: 12px; font-size: 11px;">No runs yet</div>';
      return;
    }

    container.innerHTML = history.map(exec => {
      const ago = timeAgo(exec.startTime);
      const dur = ((exec.endTime - exec.startTime) / 1000).toFixed(1);
      return `
        <div class="history-item">
          <div class="history-item-info">
            <span class="${exec.success ? 'history-success' : 'history-fail'}">${exec.success ? '✅' : '❌'}</span>
            <span>${exec.chainName}</span>
          </div>
          <span class="history-time">${dur}s · ${ago}</span>
        </div>
      `;
    }).join('');
  });
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// ═══════════════════════════════════════════
// 💬 CHAT TAB
// ═══════════════════════════════════════════

let chatHistory = [];

function setupChatTab() {
  const sendBtn = document.getElementById('chatSendBtn');
  const input = document.getElementById('chatInput');
  const clearBtn = document.getElementById('clearChatBtn');

  sendBtn.addEventListener('click', sendChatMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 80) + 'px';
  });

  clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearChatHistory' }, () => {
      chatHistory = [];
      renderChatMessages();
    });
  });
}

function loadChatHistory() {
  chrome.runtime.sendMessage({ action: 'getChatHistory' }, (res) => {
    if (res?.success) {
      chatHistory = res.history || [];
      renderChatMessages();
    }
  });
}

function renderChatMessages() {
  const container = document.getElementById('chatMessages');
  if (chatHistory.length === 0) {
    container.innerHTML = `
      <div class="chat-welcome">
        <span class="chat-welcome-icon">⛓️</span>
        <p>Chat with your local AI. Toggle page context to ask about the current page.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = chatHistory.map(msg =>
    `<div class="chat-msg ${msg.role}">${escapeHtml(msg.content)}</div>`
  ).join('');

  container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  input.value = '';
  input.style.height = 'auto';

  // Add user message
  chatHistory.push({ role: 'user', content: message });
  renderChatMessages();

  // Add typing indicator
  const container = document.getElementById('chatMessages');
  const typingDiv = document.createElement('div');
  typingDiv.className = 'chat-msg assistant typing';
  typingDiv.innerHTML = 'Thinking<span class="loading-dots"></span>';
  container.appendChild(typingDiv);
  container.scrollTop = container.scrollHeight;

  const useContext = document.getElementById('chatUseContext').checked;
  const context = useContext ? pageContext : { page: '', url: '', title: '' };

  chrome.runtime.sendMessage({
    action: 'chatMessage',
    message,
    context,
    history: chatHistory.filter(m => m.role !== 'system').slice(-10)
  }, (res) => {
    typingDiv.remove();
    if (res?.success) {
      chatHistory.push({ role: 'assistant', content: res.text });
      renderChatMessages();
    } else {
      const errDiv = document.createElement('div');
      errDiv.className = 'chat-msg assistant';
      errDiv.style.color = 'var(--pc-error)';
      errDiv.textContent = `Error: ${res?.error || 'Failed to get response'}`;
      container.appendChild(errDiv);
      container.scrollTop = container.scrollHeight;
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══════════════════════════════════════════
// ⚙️ SETTINGS
// ═══════════════════════════════════════════

function setupSettings() {
  const settingsBtn = document.getElementById('settingsBtn');
  const closeBtn = document.getElementById('closeSettingsBtn');
  const modal = document.getElementById('settingsModal');
  const saveBtn = document.getElementById('saveSettingsBtn');
  const tempSlider = document.getElementById('settingTemp');
  const tempValue = document.getElementById('tempValue');

  settingsBtn.addEventListener('click', () => {
    modal.classList.remove('hidden');
    loadSettings();
  });

  closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  tempSlider.addEventListener('input', () => {
    tempValue.textContent = tempSlider.value;
  });

  saveBtn.addEventListener('click', () => {
    const settings = {
      defaultModel: document.getElementById('settingModel').value,
      temperature: parseFloat(tempSlider.value),
      maxTokens: parseInt(document.getElementById('settingMaxTokens').value)
    };
    chrome.runtime.sendMessage({ action: 'updateSettings', settings }, (res) => {
      if (res?.success) {
        modal.classList.add('hidden');
        const btn = document.getElementById('saveSettingsBtn');
        btn.textContent = '✅ Saved!';
        setTimeout(() => { btn.textContent = 'Save Settings'; }, 1500);
      }
    });
  });
}

function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (res) => {
    if (!res?.success) return;
    const s = res.settings;
    if (s.defaultModel) document.getElementById('settingModel').value = s.defaultModel;
    if (s.temperature !== undefined) {
      document.getElementById('settingTemp').value = s.temperature;
      document.getElementById('tempValue').textContent = s.temperature;
    }
    if (s.maxTokens) document.getElementById('settingMaxTokens').value = s.maxTokens;
  });
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
