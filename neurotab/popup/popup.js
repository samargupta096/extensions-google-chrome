/**
 * NeuroTab — Popup Script
 */
const COLORS = ['#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894', '#E17055', '#74B9FF', '#A29BFE'];

document.addEventListener('DOMContentLoaded', async () => {
  setupTabs();
  loadPages();
  loadStats();
  checkOllama();

  document.getElementById('search-input').addEventListener('input', debounce(() => loadPages(), 300));
  document.getElementById('btn-save-page').addEventListener('click', savePage);
  document.getElementById('btn-ask').addEventListener('click', askBrain);
  document.getElementById('ask-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') askBrain();
  });
  document.getElementById('model-select').addEventListener('change', saveSelectedModel);
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => { c.style.display = 'none'; c.classList.remove('active'); });
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tab.dataset.tab}`);
      target.style.display = 'block';
      target.classList.add('active');
      if (tab.dataset.tab === 'stats') loadStats();
    });
  });
}

async function loadPages() {
  const search = document.getElementById('search-input').value;
  const response = await chrome.runtime.sendMessage({ type: 'GET_PAGES', search, limit: 30 });
  const pages = response.pages || [];
  const container = document.getElementById('pages-list');

  if (pages.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding:24px;">
        <div class="empty-state-icon">📚</div>
        <div class="empty-state-title">${search ? 'No results' : 'Your brain is empty'}</div>
        <div class="empty-state-text">${search ? 'Try different keywords' : 'Save pages to build your knowledge base'}</div>
      </div>`;
    return;
  }

  container.innerHTML = pages.map(p => `
    <div class="page-item" onclick="window.open('${p.url}', '_blank')">
      <div class="page-title">${escapeHtml(p.title || 'Untitled')}</div>
      <div class="page-domain">${p.domain} · ${p.type}</div>
      ${p.summary ? `<div class="page-summary">${escapeHtml(p.summary)}</div>` : ''}
      <div class="page-meta">
        <div class="page-tags">${(p.tags || []).slice(0, 3).map(t => `<span class="page-tag">${t}</span>`).join('')}</div>
        <span class="page-time">${timeAgo(p.savedAt)}</span>
        <button class="page-delete" onclick="event.stopPropagation();deletePage('${p.id}')">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function savePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  let text = '';
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' });
    text = response?.text || '';
  } catch {}

  await chrome.runtime.sendMessage({
    type: 'SAVE_PAGE',
    url: tab.url,
    title: tab.title,
    text: text.slice(0, 5000)
  });

  loadPages();
  showToast('Page saved to your brain! 🧠');
}

window.deletePage = async function(id) {
  await chrome.runtime.sendMessage({ type: 'DELETE_PAGE', id });
  loadPages();
};

async function askBrain() {
  const input = document.getElementById('ask-input');
  const question = input.value.trim();
  if (!question) return;

  const container = document.getElementById('ask-messages');
  const welcome = container.querySelector('.ask-welcome');
  if (welcome) welcome.remove();

  container.innerHTML += `<div class="ask-msg user">${escapeHtml(question)}</div>`;
  container.innerHTML += `<div class="ask-msg ai loading">🧠 Thinking...</div>`;
  container.scrollTop = container.scrollHeight;
  input.value = '';

  const result = await chrome.runtime.sendMessage({ type: 'ASK_BRAIN', question });
  const loadingMsg = container.querySelector('.loading');
  if (loadingMsg) loadingMsg.remove();

  if (result.success) {
    container.innerHTML += `<div class="ask-msg ai">${escapeHtml(result.text)}</div>`;
  } else {
    container.innerHTML += `<div class="ask-msg ai">❌ ${result.error || 'Could not connect to Ollama'}</div>`;
  }
  container.scrollTop = container.scrollHeight;
}

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  document.getElementById('stat-pages').textContent = stats.totalPages;
  document.getElementById('stat-tags').textContent = stats.totalTags;

  // Domains chart
  const domains = Object.entries(stats.domains || {}).sort(([,a],[,b]) => b - a).slice(0, 6);
  if (domains.length > 0) {
    ChartUtils.horizontalBarChart(document.getElementById('chart-domains'), {}, {
      labels: domains.map(([d]) => d),
      values: domains.map(([,v]) => v),
      colors: COLORS,
      formatValue: v => `${v}`,
      barHeight: 22,
      barGap: 6
    });
  }

  // Activity chart
  const daily = stats.daily || {};
  const days = Object.keys(daily).sort().slice(-7);
  if (days.length > 0) {
    ChartUtils.barChart(document.getElementById('chart-activity'), {}, {
      labels: days.map(d => new Date(d).toLocaleDateString('en', { weekday: 'short' })),
      values: days.map(d => daily[d] || 0),
      barColor: '#6C5CE7',
      formatValue: v => `${Math.round(v)}`
    });
  }

  // Tags cloud
  const tags = Object.entries(stats.tags || {}).sort(([,a],[,b]) => b - a).slice(0, 20);
  const maxCount = tags[0]?.[1] || 1;
  document.getElementById('tags-cloud').innerHTML = tags.map(([tag, count], i) => {
    const size = 10 + (count / maxCount) * 6;
    return `<span class="tag-pill" style="background:${COLORS[i % COLORS.length]}22;color:${COLORS[i % COLORS.length]};font-size:${size}px;">${tag} (${count})</span>`;
  }).join('');
}

async function checkOllama() {
  const ollama = new OllamaClient();
  const available = await ollama.isAvailable();
  const el = document.getElementById('ollama-status');
  el.className = available ? 'ollama-status connected' : 'ollama-status disconnected';
  el.innerHTML = `<span class="status-dot ${available ? 'online' : 'offline'}"></span><span>AI</span>`;

  // Load models if Ollama is available
  if (available) {
    loadModels(ollama);
  } else {
    const select = document.getElementById('model-select');
    select.innerHTML = '<option value="">Ollama offline</option>';
    select.classList.add('loading');
  }
}

async function loadModels(ollama) {
  const select = document.getElementById('model-select');
  try {
    const models = await ollama.listModels();
    if (models.length === 0) {
      select.innerHTML = '<option value="">No models</option>';
      select.classList.add('loading');
      return;
    }

    // Get saved model preference
    const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const savedModel = settings.ollamaModel || 'qwen3:latest';

    // Populate dropdown
    select.innerHTML = models.map(m => {
      const name = m.name || m.model;
      const size = m.details?.parameter_size || '';
      const label = size ? `${name} (${size})` : name;
      const selected = name === savedModel ? 'selected' : '';
      return `<option value="${name}" ${selected}>${label}</option>`;
    }).join('');

    select.classList.remove('loading');

    // If saved model isn't in the list, select the first one and save it
    if (!models.some(m => (m.name || m.model) === savedModel)) {
      select.selectedIndex = 0;
      saveSelectedModel();
    }
  } catch {
    select.innerHTML = '<option value="">Error loading</option>';
    select.classList.add('loading');
  }
}

async function saveSelectedModel() {
  const select = document.getElementById('model-select');
  const model = select.value;
  if (!model) return;

  const settings = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  await chrome.runtime.sendMessage({
    type: 'UPDATE_SETTINGS',
    settings: { ...settings, ollamaModel: model }
  });
}

// Helpers
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function timeAgo(ts) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
function debounce(fn, delay) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast success';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}
