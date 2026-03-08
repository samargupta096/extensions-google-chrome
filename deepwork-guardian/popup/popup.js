/**
 * DeepWork Guardian — Popup Script
 */

const COLORS = ['#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894', '#E17055', '#74B9FF', '#A29BFE'];

let currentState = null;
let focusDuration = 25 * 60;
let timerInterval = null;

// ============ Init ============
document.addEventListener('DOMContentLoaded', async () => {
  await refreshState();
  startUITimer();
  await initAI();

  // Event listeners
  document.getElementById('btn-start').addEventListener('click', toggleFocus);
  document.getElementById('btn-decrease').addEventListener('click', () => adjustDuration(-5));
  document.getElementById('btn-increase').addEventListener('click', () => adjustDuration(5));
  document.getElementById('btn-open-dashboard').addEventListener('click', openDashboard);
  document.getElementById('open-dashboard').addEventListener('click', openDashboard);

  document.getElementById('provider-select').addEventListener('change', onProviderChange);
  document.getElementById('model-select').addEventListener('change', onModelChange);
  document.getElementById('btn-api-key').addEventListener('click', toggleApiKeyInput);
  document.getElementById('btn-save-key').addEventListener('click', saveApiKey);
});

async function refreshState() {
  currentState = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (currentState.settings) {
    focusDuration = currentState.settings.focusDuration;
  }
  updateUI();
}

// ============ Timer ============
function startUITimer() {
  timerInterval = setInterval(() => {
    updateTimerDisplay();
  }, 1000);
}

function updateTimerDisplay() {
  if (!currentState) return;

  const timerEl = document.getElementById('timer-time');
  const labelEl = document.getElementById('timer-label');
  const circle = document.getElementById('timer-circle');
  const card = document.getElementById('focus-card');
  const btn = document.getElementById('btn-start');

  if (currentState.focusSession && !currentState.focusSession.pausedAt) {
    const elapsed = (Date.now() - currentState.focusSession.startTime) / 1000;
    const targetDuration = currentState.focusSession.isBreak
      ? currentState.focusSession.breakDuration
      : currentState.focusSession.duration;
    const remaining = Math.max(0, targetDuration - elapsed);
    const progress = 1 - (remaining / targetDuration);

    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    timerEl.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

    // Update circle progress
    const circumference = 2 * Math.PI * 88;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference * (1 - progress);
    circle.style.stroke = currentState.focusSession.isBreak ? '#00CEC9' : '#6C5CE7';

    if (currentState.focusSession.isBreak) {
      labelEl.textContent = '☕ Break Time';
      card.classList.add('break-state');
      btn.textContent = '⏹ Stop';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-danger');
    } else {
      labelEl.textContent = '🔥 Focusing...';
      card.classList.remove('break-state');
      btn.textContent = '⏹ Stop';
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-danger');
    }
  } else {
    const mins = Math.floor(focusDuration / 60);
    timerEl.textContent = `${String(mins).padStart(2, '0')}:00`;
    labelEl.textContent = 'Ready to focus';
    card.classList.remove('break-state');
    const circumference = 2 * Math.PI * 88;
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = circumference;

    const btn = document.getElementById('btn-start');
    btn.textContent = '▶ Start Focus';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-primary');
  }

  // Refresh state every 10 seconds to keep in sync
  if (Date.now() % 10000 < 1100) {
    chrome.runtime.sendMessage({ type: 'GET_STATE' }).then(s => {
      currentState = s;
      updateUI();
    }).catch(() => {});
  }
}

async function toggleFocus() {
  if (currentState.focusSession) {
    await chrome.runtime.sendMessage({ type: 'STOP_FOCUS' });
  } else {
    await chrome.runtime.sendMessage({ type: 'START_FOCUS', duration: focusDuration });
  }
  await refreshState();
}

function adjustDuration(minutes) {
  if (currentState.focusSession) return;
  focusDuration = Math.max(300, Math.min(7200, focusDuration + minutes * 60));
  updateTimerDisplay();
}

// ============ UI Update ============
function updateUI() {
  if (!currentState) return;

  // Stats
  const todayTime = currentState.todayTime || {};
  const totalSeconds = Object.values(todayTime).reduce((a, b) => a + b, 0);
  document.getElementById('total-time').textContent = formatDuration(totalSeconds);

  // Focus score = productive time / total time
  const categories = currentState.todayCategories || {};
  const productiveCategories = ['Development', 'Learning', 'AI Tools', 'Search'];
  const productiveTime = productiveCategories.reduce((sum, cat) => sum + (categories[cat] || 0), 0);
  const score = totalSeconds > 0 ? Math.round((productiveTime / totalSeconds) * 100) : 0;
  document.getElementById('focus-score').textContent = `${score}%`;

  // Sessions
  const sessions = currentState.todaySessions || [];
  const completedSessions = sessions.filter(s => s.completed !== false).length;
  document.getElementById('sessions-count').textContent = completedSessions;

  // Session dots
  const dotsContainer = document.getElementById('session-dots');
  dotsContainer.innerHTML = '';
  const targetSessions = currentState.settings?.sessionsBeforeLongBreak || 4;
  for (let i = 0; i < targetSessions; i++) {
    const dot = document.createElement('div');
    dot.className = 'session-dot';
    if (i < completedSessions % targetSessions) dot.classList.add('completed');
    if (i === completedSessions % targetSessions && currentState.focusSession) dot.classList.add('active');
    dotsContainer.appendChild(dot);
  }

  // Top sites
  renderTopSites(todayTime);

  // Category chart
  renderCategoryChart(categories);
}

function renderTopSites(timeData) {
  const container = document.getElementById('top-sites-list');
  const sorted = Object.entries(timeData)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 16px;">
        <div style="font-size: 24px; opacity: 0.3; margin-bottom: 8px;">🌐</div>
        <div style="font-size: 12px; color: var(--text-tertiary);">Browse to start tracking</div>
      </div>`;
    return;
  }

  const maxTime = sorted[0][1];
  container.innerHTML = sorted.map(([domain, seconds], i) => `
    <div class="site-row">
      <div class="site-favicon">${getFavicon(domain)}</div>
      <div class="site-name">${domain}</div>
      <div class="site-bar-container">
        <div class="site-bar" style="width: ${(seconds / maxTime * 100)}%; background: ${COLORS[i % COLORS.length]};"></div>
      </div>
      <div class="site-time">${formatDuration(seconds)}</div>
    </div>
  `).join('');
}

function renderCategoryChart(categories) {
  const canvas = document.getElementById('category-chart');
  const labels = Object.keys(categories);
  const values = Object.values(categories);

  if (values.length === 0) return;

  const total = values.reduce((a, b) => a + b, 0);

  ChartUtils.doughnutChart(canvas, { labels, values }, {
    labels,
    values,
    colors: COLORS,
    centerText: formatDuration(total),
    centerSubText: 'total today',
    lineWidth: 20
  });
}

// ============ Helpers ============
function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getFavicon(domain) {
  const icons = {
    'github.com': '🐙', 'stackoverflow.com': '📚', 'google.com': '🔍',
    'youtube.com': '📺', 'twitter.com': '🐦', 'x.com': '𝕏',
    'reddit.com': '🤖', 'facebook.com': '📘', 'instagram.com': '📷',
    'linkedin.com': '💼', 'medium.com': '📝', 'gmail.com': '📧',
    'amazon.com': '📦', 'netflix.com': '🎬', 'spotify.com': '🎵',
    'slack.com': '💬', 'discord.com': '🎮', 'chatgpt.com': '🤖',
    'claude.ai': '🧠', 'localhost': '🖥️'
  };
  for (const [site, icon] of Object.entries(icons)) {
    if (domain.includes(site)) return icon;
  }
  return domain.charAt(0).toUpperCase();
}

// ============ Multi-Provider AI ============
const aiClient = new AIClient();

async function initAI() {
  const providerId = await aiClient.getProvider();
  const providerSelect = document.getElementById('provider-select');
  if (providerSelect) providerSelect.value = providerId;

  updateApiKeyButton(providerId);
  await checkAI();
  await loadModels();
}

async function onProviderChange() {
  const providerId = document.getElementById('provider-select').value;
  await aiClient.setProvider(providerId);
  updateApiKeyButton(providerId);
  hideApiKeyInput();
  await checkAI();
  await loadModels();
}

async function onModelChange() {
  const modelId = document.getElementById('model-select').value;
  if (modelId) await aiClient.setModel(modelId);
}

function updateApiKeyButton(providerId) {
  const btn = document.getElementById('btn-api-key');
  const provider = AI_PROVIDERS[providerId];
  if (provider && provider.requiresKey) {
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
    hideApiKeyInput();
  }
}

function toggleApiKeyInput() {
  const wrap = document.getElementById('api-key-wrap');
  wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
  if (wrap.style.display === 'flex') {
    document.getElementById('api-key-input').focus();
  }
}

function hideApiKeyInput() {
  document.getElementById('api-key-wrap').style.display = 'none';
  document.getElementById('api-key-input').value = '';
}

async function saveApiKey() {
  const providerId = document.getElementById('provider-select').value;
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return;
  await aiClient.setApiKey(providerId, key);
  hideApiKeyInput();
  await checkAI();
}

async function checkAI() {
  const el = document.getElementById('ai-status');
  const providerId = await aiClient.getProvider();
  const provider = AI_PROVIDERS[providerId];
  const providerName = provider?.name || providerId;

  const available = await aiClient.isAvailable();
  if (available) {
    el.className = 'ollama-status connected';
    el.innerHTML = `<span class="status-dot online"></span><span>${providerName}</span>`;
  } else {
    el.className = 'ollama-status disconnected';
    const hint = provider?.requiresKey ? 'No Key' : 'Offline';
    el.innerHTML = `<span class="status-dot offline"></span><span>${hint}</span>`;
  }
}

async function loadModels() {
  const select = document.getElementById('model-select');
  if (!select) return;

  select.innerHTML = '<option value="">Loading...</option>';
  select.classList.add('loading');

  try {
    const models = await aiClient.listModels();
    const savedModel = await aiClient.getModel();

    if (models.length === 0) {
      const providerId = await aiClient.getProvider();
      const provider = AI_PROVIDERS[providerId];
      select.innerHTML = `<option value="">${providerId === 'ollama' ? 'Ollama offline' : 'No models'}</option>`;
      select.classList.add('loading');
      return;
    }

    select.innerHTML = models.map(m => {
      const label = m.size ? `${m.name} (${m.size})` : m.name;
      return `<option value="${m.id}" ${m.id === savedModel ? 'selected' : ''}>${label}</option>`;
    }).join('');

    select.classList.remove('loading');

    if (!models.some(m => m.id === savedModel) && models.length > 0) {
      select.selectedIndex = 0;
      await aiClient.setModel(models[0].id);
    }
  } catch {
    select.innerHTML = '<option value="">Error</option>';
    select.classList.add('loading');
  }
}

function openDashboard() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('dashboard/dashboard.html')
  });
}
