/**
 * GitPulse — Enhanced Popup Controller (Round 2)
 * Features: Batch actions, label filter, review checklist with presets,
 * PR diff preview, search, keyboard shortcuts, notifications, export
 */

const ollama = new AIClient();
const $ = (id) => document.getElementById(id);
let allPRs = { review: [], authored: [], mentioned: [] };
let currentSearch = '';
let currentRepoFilter = 'all';
let currentUrgencyFilter = 'all';
let currentLabelFilter = 'all';
let selectedPRs = new Set();
let currentChecklistPrId = null;

const CHECKLIST_PRESETS = {
  code: ['Logic correctness', 'Code style & formatting', 'Error handling', 'Performance concerns', 'Documentation updated'],
  security: ['No hardcoded secrets', 'Input validation', 'SQL injection safe', 'XSS prevention', 'Auth checks present'],
  tests: ['Tests added/updated', 'Edge cases covered', 'Tests pass locally', 'Coverage adequate', 'Integration tests']
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  await checkAIStatus();
  await loadSettings();
  await loadData();
  initEventListeners();
  initKeyboardShortcuts();
});

async function checkAIStatus() {
  const available = await ollama.isAvailable();
  $('statusDot').className = `status-dot ${available ? 'online' : 'offline'}`;
  $('statusText').textContent = available ? 'AI Ready' : 'Offline';
}

async function loadSettings() {
  const { gpSettings = {} } = await chrome.storage.local.get('gpSettings');
  $('toggleNotifications').checked = gpSettings.notifications !== false;
  if (gpSettings.pollInterval) $('pollInterval').value = gpSettings.pollInterval;
}

function saveSettings() {
  const settings = { notifications: $('toggleNotifications').checked, pollInterval: $('pollInterval').value };
  chrome.storage.local.set({ gpSettings: settings });
  chrome.runtime.sendMessage({ action: 'updatePollInterval', interval: parseInt(settings.pollInterval) });
}

// ─── Load Data ───
async function loadData() {
  const data = await chrome.storage.local.get([
    'githubToken', 'prReview', 'prAuthored', 'prMentioned',
    'lastFetch', 'ghUsername', 'ghAvatar', 'velocityData', 'reviewHistory'
  ]);

  if (!data.githubToken) {
    $('noTokenState').style.display = '';
    $('mainContent').style.display = 'none';
    return;
  }

  $('noTokenState').style.display = 'none';
  $('mainContent').style.display = '';

  if (data.ghAvatar) { $('userAvatar').src = data.ghAvatar; $('userAvatar').style.display = ''; }
  else $('userAvatar').style.display = 'none';
  $('userName').textContent = data.ghUsername || 'Connected';
  if (data.lastFetch) $('lastFetch').textContent = `Updated ${getTimeAgo(data.lastFetch)}`;

  allPRs.review = data.prReview || [];
  allPRs.authored = data.prAuthored || [];
  allPRs.mentioned = data.prMentioned || [];

  $('reviewCount').textContent = allPRs.review.length;
  $('authoredCount').textContent = allPRs.authored.length;
  $('mentionedCount').textContent = allPRs.mentioned.length;

  populateRepoFilter();
  populateLabelFilter();
  renderFilteredLists();

  $('statPending').textContent = allPRs.review.length;
  $('statReviewed').textContent = (data.reviewHistory || []).length;
  $('statAuthored').textContent = allPRs.authored.length;
  $('statMentioned').textContent = allPRs.mentioned.length;

  renderVelocityChart(data.velocityData || {});
  renderAgeChart(allPRs.review);
  renderRepoChart([...allPRs.review, ...allPRs.authored, ...allPRs.mentioned]);
}

// ─── Filters ───
function populateRepoFilter() {
  const repos = new Set();
  [...allPRs.review, ...allPRs.authored, ...allPRs.mentioned].forEach(pr => { if (pr.repo) repos.add(pr.repo); });
  const select = $('repoFilter');
  select.innerHTML = `<option value="all">All Repos (${repos.size})</option>`;
  [...repos].sort().forEach(repo => {
    const opt = document.createElement('option');
    opt.value = repo;
    opt.textContent = repo.split('/').pop();
    select.appendChild(opt);
  });
}

function populateLabelFilter() {
  const labels = new Set();
  [...allPRs.review, ...allPRs.authored, ...allPRs.mentioned].forEach(pr => {
    (pr.labels || []).forEach(l => labels.add(l.name));
  });
  const select = $('labelFilter');
  select.innerHTML = `<option value="all">All Labels</option>`;
  [...labels].sort().forEach(label => {
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = label;
    select.appendChild(opt);
  });
}

function filterPRs(prs) {
  let filtered = prs;
  if (currentSearch) {
    const q = currentSearch.toLowerCase();
    filtered = filtered.filter(pr =>
      pr.title.toLowerCase().includes(q) || pr.repo.toLowerCase().includes(q) ||
      pr.author.toLowerCase().includes(q) || (pr.labels || []).some(l => l.name.toLowerCase().includes(q))
    );
  }
  if (currentRepoFilter !== 'all') filtered = filtered.filter(pr => pr.repo === currentRepoFilter);
  if (currentUrgencyFilter !== 'all') filtered = filtered.filter(pr => pr.urgency === currentUrgencyFilter);
  if (currentLabelFilter !== 'all') filtered = filtered.filter(pr => (pr.labels || []).some(l => l.name === currentLabelFilter));
  return filtered;
}

function renderFilteredLists() {
  renderPRList('reviewList', filterPRs(allPRs.review), 'reviewEmpty', true);
  renderPRList('authoredList', filterPRs(allPRs.authored), 'authoredEmpty', false);
  renderPRList('mentionedList', filterPRs(allPRs.mentioned), 'mentionedEmpty', false);
  updateBatchBar();
}

// ─── Render PR List ───
function renderPRList(containerId, prs, emptyId, showCheckbox) {
  const container = $(containerId);
  const empty = $(emptyId);

  if (prs.length === 0) {
    container.innerHTML = currentSearch
      ? `<div class="no-results"><div class="no-results-icon">🔍</div>No PRs match "${escapeHtml(currentSearch)}"</div>`
      : '';
    empty.style.display = currentSearch ? 'none' : '';
    return;
  }

  empty.style.display = 'none';
  container.innerHTML = prs.map((pr, i) => {
    const titleHtml = currentSearch ? highlightSearch(escapeHtml(pr.title), currentSearch) : escapeHtml(pr.title);
    const isSelected = selectedPRs.has(pr.id);
    return `
    <div class="pr-card urgency-${pr.urgency} slide-up ${isSelected ? 'selected' : ''}" style="animation-delay: ${i * 0.03}s" data-pr-id="${pr.id}">
      <div class="pr-card-top">
        ${showCheckbox ? `<input type="checkbox" class="pr-checkbox" data-pr-id="${pr.id}" ${isSelected ? 'checked' : ''}>` : ''}
        <img class="pr-author-avatar" src="${pr.authorAvatar}" alt="${pr.author}" onerror="this.style.display='none'">
        <div class="pr-card-info">
          <div class="pr-title">${titleHtml}</div>
          <div class="pr-meta">
            <span class="pr-repo">${pr.repo}</span>
            <span class="pr-number">#${pr.number}</span>
            ${pr.comments > 0 ? `<span class="pr-comments">💬 ${pr.comments}</span>` : ''}
            ${pr.reviewComments > 0 ? `<span class="pr-comments">📝 ${pr.reviewComments}</span>` : ''}
            <span class="pr-age">${formatAge(pr.ageHours)}</span>
          </div>
          <div class="pr-badges">
            ${pr.isDraft ? '<span class="pr-label pr-draft-badge">DRAFT</span>' : ''}
            ${pr.mergeable === false ? '<span class="pr-label pr-conflict-badge">CONFLICT</span>' : ''}
            ${(pr.labels || []).slice(0, 3).map(l => `<span class="pr-label" style="background: #${l.color}22; color: #${l.color};">${escapeHtml(l.name)}</span>`).join('')}
            ${getUrgencyBadge(pr.urgency)}
          </div>
          ${pr.additions !== undefined ? `
            <div class="pr-files">
              <span class="pr-additions">+${pr.additions || 0}</span>
              <span class="pr-deletions">-${pr.deletions || 0}</span>
              <span>${pr.changedFiles || '?'} files</span>
              ${getDiffSizeLabel(pr.additions, pr.deletions)}
            </div>
          ` : ''}
        </div>
      </div>
      <div class="pr-card-actions">
        <a href="${pr.url}" target="_blank" class="btn btn-primary btn-sm" style="text-decoration: none;">Open</a>
        <button class="btn btn-secondary btn-sm ai-summary-btn" data-pr-index="${containerId}-${i}">🧠 AI</button>
        <button class="btn btn-ghost btn-sm checklist-btn" data-pr-id="${pr.id}">📋</button>
        ${pr.type === 'review' ? `<button class="btn btn-ghost btn-sm mark-reviewed-btn" data-pr-id="${pr.id}">✅</button>` : ''}
      </div>
    </div>
  `;}).join('');

  container._prData = prs;
}

function getDiffSizeLabel(add, del) {
  const total = (add || 0) + (del || 0);
  if (total > 500) return '<span class="diff-size diff-xl">XL</span>';
  if (total > 200) return '<span class="diff-size diff-l">L</span>';
  if (total > 50) return '<span class="diff-size diff-m">M</span>';
  return '<span class="diff-size diff-s">S</span>';
}

function highlightSearch(text, query) {
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function getUrgencyBadge(urgency) {
  const badges = { fresh: '<span class="badge badge-green">FRESH</span>', normal: '', aging: '<span class="badge badge-yellow">AGING</span>', stale: '<span class="badge badge-red">STALE</span>' };
  return badges[urgency] || '';
}

function formatAge(hours) {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function getTimeAgo(timestamp) {
  const s = Math.floor((Date.now() - timestamp) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

// ─── Batch Actions ───
function updateBatchBar() {
  const bar = $('batchBar');
  const activeTab = document.querySelector('.tab.active');
  if (!activeTab || activeTab.dataset.tab !== 'review') { bar.style.display = 'none'; return; }
  bar.style.display = allPRs.review.length > 0 ? '' : 'none';
  $('batchCount').textContent = `${selectedPRs.size} selected`;
}

function toggleSelectAll() {
  const allChecked = $('selectAll').checked;
  selectedPRs.clear();
  if (allChecked) allPRs.review.forEach(pr => selectedPRs.add(pr.id));
  renderFilteredLists();
}

function batchMarkReviewed() {
  if (selectedPRs.size === 0) { showToast('Select PRs first', 'error'); return; }
  chrome.runtime.sendMessage({ action: 'batchMarkReviewed', prIds: [...selectedPRs] }, (r) => {
    if (r?.success) {
      showToast(`Marked ${selectedPRs.size} as reviewed!`, 'success');
      selectedPRs.clear();
      $('selectAll').checked = false;
      loadData();
    }
  });
}

// ─── Review Checklist ───
function openChecklist(prId) {
  currentChecklistPrId = prId;
  $('checklistModal').style.display = '';
  chrome.runtime.sendMessage({ action: 'getChecklist', prId }, (items) => {
    renderChecklistItems(items || []);
  });
}

function renderChecklistItems(items) {
  const container = $('checklistItems');
  if (items.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:var(--text-tertiary);font-size:12px;padding:12px;">Add items or load a preset ↓</div>';
    return;
  }
  container.innerHTML = items.map((item, i) => `
    <div class="checklist-item ${item.done ? 'done' : ''}">
      <input type="checkbox" class="cl-check" data-idx="${i}" ${item.done ? 'checked' : ''}>
      <span class="cl-text">${escapeHtml(item.text)}</span>
      <button class="cl-remove" data-idx="${i}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.cl-check').forEach(cb => {
    cb.addEventListener('change', () => {
      items[cb.dataset.idx].done = cb.checked;
      saveChecklistItems(items);
      renderChecklistItems(items);
    });
  });

  container.querySelectorAll('.cl-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      items.splice(btn.dataset.idx, 1);
      saveChecklistItems(items);
      renderChecklistItems(items);
    });
  });
}

function addChecklistItem(text) {
  if (!text || !currentChecklistPrId) return;
  chrome.runtime.sendMessage({ action: 'getChecklist', prId: currentChecklistPrId }, (items) => {
    const arr = items || [];
    arr.push({ text, done: false });
    saveChecklistItems(arr);
    renderChecklistItems(arr);
  });
}

function loadPreset(presetName) {
  const items = (CHECKLIST_PRESETS[presetName] || []).map(text => ({ text, done: false }));
  saveChecklistItems(items);
  renderChecklistItems(items);
}

function saveChecklistItems(items) {
  chrome.runtime.sendMessage({ action: 'saveChecklist', prId: currentChecklistPrId, items });
}

// ─── Charts ───
function renderVelocityChart(velocityData) {
  const canvas = $('velocityChart');
  if (!canvas) return;
  const last7 = StorageUtils.lastNDaysKeys(7);
  ChartUtils.barChart(canvas, {}, { labels: last7.map(k => new Date(k).toLocaleDateString('en', { weekday: 'short' })), values: last7.map(k => velocityData[k]?.pendingReviews || 0), barColor: '#6C5CE7', formatValue: v => Math.round(v).toString(), barRadius: 4, barGap: 0.3 });
}

function renderAgeChart(prs) {
  const canvas = $('ageChart');
  if (!canvas) return;
  const c = { 'Fresh': 0, 'Normal': 0, 'Aging': 0, 'Stale': 0 };
  for (const pr of prs) {
    if (pr.urgency === 'fresh') c['Fresh']++;
    else if (pr.urgency === 'aging') c['Aging']++;
    else if (pr.urgency === 'stale') c['Stale']++;
    else c['Normal']++;
  }
  ChartUtils.doughnutChart(canvas, {}, { labels: Object.keys(c), values: Object.values(c), colors: ['#00B894', '#74B9FF', '#FDCB6E', '#FF6B6B'], centerText: String(prs.length), centerSubText: 'PRs' });
}

function renderRepoChart(prs) {
  const canvas = $('repoChart');
  if (!canvas) return;
  const byRepo = {};
  for (const pr of prs) { const n = pr.repo?.split('/').pop() || 'unknown'; byRepo[n] = (byRepo[n] || 0) + 1; }
  const sorted = Object.entries(byRepo).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (sorted.length === 0) sorted.push(['No data', 0]);
  ChartUtils.barChart(canvas, {}, { labels: sorted.map(e => e[0]), values: sorted.map(e => e[1]), barColor: '#00CEC9', formatValue: v => Math.round(v).toString(), barRadius: 4 });
}

// ─── AI Summary ───
async function showAiSummary(pr) {
  $('aiModal').style.display = '';
  const body = $('aiModalBody');
  body.innerHTML = '<div class="ai-loading"><span class="spinner"></span><span>Generating summary...</span></div>';

  const prompt = `You are a senior software engineer. Summarize this PR concisely:
Title: ${pr.title}  |  Repo: ${pr.repo}  |  Author: ${pr.author}
Labels: ${(pr.labels || []).map(l => l.name).join(', ') || 'none'}
Age: ${formatAge(pr.ageHours)}  |  Draft: ${pr.isDraft}  |  Comments: ${pr.comments}
${pr.additions !== undefined ? `Changes: +${pr.additions} -${pr.deletions} (${pr.changedFiles} files)` : ''}

Description: ${pr.body || '(none)'}

Provide:
1. **What it does** (1-2 sentences)
2. **Key changes** (bullets)
3. **Review focus** (what to check)
4. **Risk level** (Low/Medium/High)`;

  const result = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 512 });
  body.innerHTML = result.success
    ? `<div style="white-space: pre-wrap; line-height: 1.6;">${escapeHtml(result.text)}</div>`
    : `<div style="color: var(--accent-red);">⚠️ AI unavailable. Make sure Ollama is running locally.</div>`;
}

// ─── Export ───
function exportData() {
  const data = { exportDate: new Date().toISOString(), reviewPRs: allPRs.review, authoredPRs: allPRs.authored, mentionedPRs: allPRs.mentioned };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `gitpulse-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click(); URL.revokeObjectURL(url);
  showToast('Data exported!', 'success');
}

// ─── Keyboard Shortcuts ───
function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    switch (e.key) {
      case '/': e.preventDefault(); $('searchInput').focus(); break;
      case 'r': case 'R': e.preventDefault(); $('refreshBtn').click(); break;
      case 's': case 'S': e.preventDefault(); $('settingsBtn').click(); break;
      case '1': switchTab('review'); break;
      case '2': switchTab('authored'); break;
      case '3': switchTab('mentioned'); break;
      case '4': switchTab('stats'); break;
      case 'a': case 'A': $('selectAll').click(); break;
      case '?': e.preventDefault(); toggle('shortcutsModal'); break;
      case 'Escape':
        ['aiModal', 'shortcutsModal', 'checklistModal'].forEach(id => $(id).style.display = 'none');
        $('settingsPanel').style.display = 'none';
        break;
    }
  });
}

function toggle(id) { $(id).style.display = $(id).style.display === 'none' ? '' : 'none'; }

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
  document.querySelector(`[data-tab="${tabName}"]`)?.classList.add('active');
  $(`tab-${tabName}`).style.display = '';
  updateBatchBar();
}

// ─── Event Listeners ───
function initEventListeners() {
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => switchTab(tab.dataset.tab)));

  let searchTimeout;
  $('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const val = e.target.value.trim();
    $('searchClear').style.display = val ? '' : 'none';
    searchTimeout = setTimeout(() => { currentSearch = val; renderFilteredLists(); }, 200);
  });
  $('searchClear').addEventListener('click', () => { $('searchInput').value = ''; $('searchClear').style.display = 'none'; currentSearch = ''; renderFilteredLists(); });

  $('repoFilter').addEventListener('change', (e) => { currentRepoFilter = e.target.value; renderFilteredLists(); });
  $('urgencyFilter').addEventListener('change', (e) => { currentUrgencyFilter = e.target.value; renderFilteredLists(); });
  $('labelFilter').addEventListener('change', (e) => { currentLabelFilter = e.target.value; renderFilteredLists(); });

  $('toggleNotifications').addEventListener('change', saveSettings);
  $('pollInterval').addEventListener('change', saveSettings);

  $('settingsBtn').addEventListener('click', () => toggle('settingsPanel'));
  $('closeSettings').addEventListener('click', () => { $('settingsPanel').style.display = 'none'; });
  $('setupBtn')?.addEventListener('click', () => { $('settingsPanel').style.display = ''; $('noTokenState').style.display = 'none'; });

  $('saveToken').addEventListener('click', async () => {
    const token = $('tokenInput').value.trim();
    if (!token) return;
    $('saveToken').textContent = '...';
    chrome.runtime.sendMessage({ action: 'setToken', token }, () => {
      $('saveToken').textContent = 'Save'; $('tokenInput').value = ''; $('settingsPanel').style.display = 'none';
      showToast('Connected!', 'success');
      setTimeout(loadData, 1000);
    });
  });

  $('clearToken').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearToken' }, () => { $('settingsPanel').style.display = 'none'; showToast('Disconnected', 'success'); loadData(); });
  });

  $('exportData').addEventListener('click', exportData);

  $('refreshBtn').addEventListener('click', () => {
    $('refreshBtn').classList.add('btn-spinning');
    chrome.runtime.sendMessage({ action: 'refresh' }, () => { $('refreshBtn').classList.remove('btn-spinning'); loadData(); showToast('Refreshed', 'success'); });
  });

  // Batch actions
  $('selectAll').addEventListener('change', toggleSelectAll);
  $('batchReviewed').addEventListener('click', batchMarkReviewed);

  // Delegated clicks
  document.addEventListener('click', (e) => {
    const aiBtn = e.target.closest('.ai-summary-btn');
    if (aiBtn) {
      const [cid, idx] = aiBtn.dataset.prIndex.split('-');
      if ($(cid)?._prData) showAiSummary($(cid)._prData[parseInt(idx)]);
    }

    const markBtn = e.target.closest('.mark-reviewed-btn');
    if (markBtn) {
      chrome.runtime.sendMessage({ action: 'markReviewed', prId: markBtn.dataset.prId });
      markBtn.closest('.pr-card').style.opacity = '0.4';
    }

    const clBtn = e.target.closest('.checklist-btn');
    if (clBtn) openChecklist(clBtn.dataset.prId);

    const checkbox = e.target.closest('.pr-checkbox');
    if (checkbox) {
      const prId = parseInt(checkbox.dataset.prId);
      checkbox.checked ? selectedPRs.add(prId) : selectedPRs.delete(prId);
      updateBatchBar();
    }
  });

  // Checklist modal
  $('closeChecklist').addEventListener('click', () => { $('checklistModal').style.display = 'none'; });
  $('checklistModal').addEventListener('click', (e) => { if (e.target.id === 'checklistModal') e.target.style.display = 'none'; });
  $('addChecklistItem').addEventListener('click', () => { addChecklistItem($('checklistNewItem').value.trim()); $('checklistNewItem').value = ''; });
  $('checklistNewItem').addEventListener('keydown', (e) => { if (e.key === 'Enter') { addChecklistItem(e.target.value.trim()); e.target.value = ''; } });
  document.querySelectorAll('.preset-btn').forEach(btn => btn.addEventListener('click', () => loadPreset(btn.dataset.preset)));

  // Close modals
  $('closeAiModal').addEventListener('click', () => { $('aiModal').style.display = 'none'; });
  $('aiModal').addEventListener('click', (e) => { if (e.target === $('aiModal')) $('aiModal').style.display = 'none'; });
  $('closeShortcuts').addEventListener('click', () => { $('shortcutsModal').style.display = 'none'; });
  $('shortcutsModal').addEventListener('click', (e) => { if (e.target === $('shortcutsModal')) $('shortcutsModal').style.display = 'none'; });
}

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
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
