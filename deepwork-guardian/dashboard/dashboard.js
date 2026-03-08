/**
 * DeepWork Guardian — Dashboard Script
 * Full analytics dashboard with charts, AI insights, and settings
 */

const COLORS = ['#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894', '#E17055', '#74B9FF', '#A29BFE'];
const PRODUCTIVE_CATS = ['Development', 'Learning', 'AI Tools', 'Search', 'Finance'];
const DISTRACTING_CATS = ['Social Media', 'Entertainment', 'Shopping'];

const SITE_CATEGORIES = {
  'Development': ['github.com', 'gitlab.com', 'stackoverflow.com', 'developer.mozilla.org', 'codepen.io', 'npmjs.com', 'pypi.org', 'leetcode.com', 'hackerrank.com'],
  'Learning': ['udemy.com', 'coursera.org', 'edx.org', 'khanacademy.org', 'freecodecamp.org', 'pluralsight.com', 'medium.com', 'dev.to', 'hashnode.dev', 'wikipedia.org'],
  'Social Media': ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'linkedin.com', 'tiktok.com', 'threads.net'],
  'Communication': ['gmail.com', 'outlook.com', 'mail.google.com', 'slack.com', 'discord.com', 'telegram.org', 'web.whatsapp.com', 'teams.microsoft.com'],
  'Entertainment': ['netflix.com', 'primevideo.com', 'hotstar.com', 'twitch.tv', 'spotify.com', 'music.youtube.com', 'youtube.com'],
  'Shopping': ['amazon.com', 'amazon.in', 'flipkart.com', 'myntra.com', 'ebay.com', 'aliexpress.com'],
  'News': ['news.google.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'techcrunch.com', 'theverge.com', 'news.ycombinator.com'],
  'Finance': ['moneycontrol.com', 'zerodha.com', 'groww.in', 'tradingview.com', 'finance.yahoo.com'],
  'Search': ['google.com', 'bing.com', 'duckduckgo.com'],
  'AI Tools': ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'huggingface.co']
};

let currentPeriod = 'today';
let historyData = {};
let aiClient = new AIClient();

// ============ Init ============
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  checkAI();
});

async function loadData() {
  const days = currentPeriod === 'today' ? 1 : currentPeriod === '7d' ? 7 : 30;
  const response = await chrome.runtime.sendMessage({ type: 'GET_HISTORY', days });
  historyData = response.history || {};

  // Also get current state for today's data
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });

  renderStats(state);
  renderDailyTimeChart();
  renderFocusTrendChart();
  renderCategoryChart();
  renderTopSitesChart();
  renderSitesTable();
  renderHourlyChart();
}

function setupEventListeners() {
  // Period selector
  document.querySelectorAll('#period-selector .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#period-selector .btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      loadData();
    });
  });

  // Settings
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('close-settings').addEventListener('click', closeSettings);
  document.getElementById('btn-save-settings').addEventListener('click', saveSettings);

  // AI Insights
  document.getElementById('btn-generate-insights').addEventListener('click', generateInsights);

  // Site search
  document.getElementById('site-search').addEventListener('input', (e) => {
    renderSitesTable(e.target.value);
  });
}

// ============ Stats ============
function renderStats(state) {
  const allTime = aggregateField('time');
  const totalSeconds = Object.values(allTime).reduce((a, b) => a + b, 0);
  document.getElementById('stat-total-time').textContent = formatDuration(totalSeconds);

  // Focus score
  const allCats = aggregateField('categories');
  const productiveTime = PRODUCTIVE_CATS.reduce((sum, c) => sum + (allCats[c] || 0), 0);
  const score = totalSeconds > 0 ? Math.round((productiveTime / totalSeconds) * 100) : 0;
  document.getElementById('stat-focus-score').textContent = `${score}%`;

  // Sessions
  let totalSessions = 0;
  for (const day of Object.values(historyData)) {
    totalSessions += (day.sessions || []).filter(s => s.completed !== false).length;
  }
  document.getElementById('stat-sessions').textContent = totalSessions;

  // Sites visited
  const allVisits = aggregateField('visits');
  const uniqueSites = Object.keys(allVisits).length;
  document.getElementById('stat-sites').textContent = uniqueSites;

  // Change indicators (show vs previous period)
  const scoreClass = score >= 50 ? 'positive' : 'negative';
  const scoreArrow = score >= 50 ? '↑' : '↓';
  document.getElementById('stat-focus-change').className = `stat-change ${scoreClass}`;
  document.getElementById('stat-focus-change').textContent = `${scoreArrow} ${score >= 50 ? 'Productive' : 'Needs focus'}`;

  document.getElementById('stat-time-change').textContent = currentPeriod === 'today' ? 'Today' : `Last ${currentPeriod}`;
  document.getElementById('stat-time-change').className = 'stat-change positive';

  document.getElementById('stat-sessions-change').textContent = totalSessions > 0 ? `🎯 ${totalSessions} completed` : 'No sessions yet';
  document.getElementById('stat-sessions-change').className = 'stat-change positive';

  document.getElementById('stat-sites-change').textContent = `${uniqueSites} unique sites`;
  document.getElementById('stat-sites-change').className = 'stat-change positive';
}

// ============ Charts ============
function renderDailyTimeChart() {
  const canvas = document.getElementById('chart-daily-time');
  const dates = Object.keys(historyData).sort();
  const labels = dates.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en', { weekday: 'short', day: 'numeric' });
  });

  const values = dates.map(d => {
    const time = historyData[d]?.time || {};
    return Object.values(time).reduce((a, b) => a + b, 0) / 3600; // hours
  });

  ChartUtils.barChart(canvas, {}, {
    labels,
    values,
    title: 'Screen Time (hours)',
    colors: values.map(v => v > 6 ? '#E17055' : v > 4 ? '#FDCB6E' : '#6C5CE7'),
    formatValue: v => `${v.toFixed(1)}h`,
    barRadius: 8
  });
}

function renderFocusTrendChart() {
  const canvas = document.getElementById('chart-focus-trend');
  const dates = Object.keys(historyData).sort();
  const labels = dates.map(d => {
    const dt = new Date(d);
    return dt.toLocaleDateString('en', { weekday: 'short', day: 'numeric' });
  });

  const focusScores = dates.map(d => {
    const cats = historyData[d]?.categories || {};
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const productive = PRODUCTIVE_CATS.reduce((sum, c) => sum + (cats[c] || 0), 0);
    return total > 0 ? (productive / total) * 100 : 0;
  });

  const distractScores = dates.map(d => {
    const cats = historyData[d]?.categories || {};
    const total = Object.values(cats).reduce((a, b) => a + b, 0);
    const distracted = DISTRACTING_CATS.reduce((sum, c) => sum + (cats[c] || 0), 0);
    return total > 0 ? (distracted / total) * 100 : 0;
  });

  ChartUtils.lineChart(canvas, {}, {
    labels,
    datasets: [
      { values: focusScores, color: '#00B894', label: 'Focus', fill: true },
      { values: distractScores, color: '#FD79A8', label: 'Distraction', fill: true }
    ],
    title: 'Focus vs Distraction (%)',
    formatValue: v => `${Math.round(v)}%`,
    dotRadius: 3,
    lineWidth: 2.5
  });
}

function renderCategoryChart() {
  const canvas = document.getElementById('chart-categories');
  const allCats = aggregateField('categories');

  const sorted = Object.entries(allCats)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (sorted.length === 0) return;

  const labels = sorted.map(([k]) => k);
  const values = sorted.map(([, v]) => v);
  const total = values.reduce((a, b) => a + b, 0);

  ChartUtils.doughnutChart(canvas, {}, {
    labels,
    values,
    colors: COLORS,
    centerText: formatDuration(total),
    centerSubText: 'total',
    lineWidth: 24
  });

  // Legend
  const legendContainer = document.getElementById('legend-categories');
  legendContainer.innerHTML = labels.map((label, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background: ${COLORS[i % COLORS.length]};"></div>
      <span>${label} (${formatDuration(values[i])})</span>
    </div>
  `).join('');
}

function renderTopSitesChart() {
  const canvas = document.getElementById('chart-top-sites');
  const allTime = aggregateField('time');
  const sorted = Object.entries(allTime)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 8);

  if (sorted.length === 0) return;

  const labels = sorted.map(([d]) => d);
  const values = sorted.map(([, v]) => v / 60); // minutes

  ChartUtils.horizontalBarChart(canvas, {}, {
    labels,
    values,
    title: 'Top Sites (minutes)',
    colors: COLORS,
    formatValue: v => `${Math.round(v)}m`,
    barHeight: 28,
    barGap: 6
  });
}

function renderHourlyChart() {
  const canvas = document.getElementById('chart-hourly');
  // Simulate hourly data from sessions
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const labels = hours.map(h => `${String(h).padStart(2, '0')}`);

  // Aggregate visits per hour (approximate from session data)
  const hourlyActivity = new Array(24).fill(0);
  for (const day of Object.values(historyData)) {
    const sessions = day.sessions || [];
    for (const s of sessions) {
      const hour = new Date(s.start).getHours();
      hourlyActivity[hour] += (s.duration || 0) / 60; // minutes
    }
  }

  ChartUtils.barChart(canvas, {}, {
    labels,
    values: hourlyActivity,
    title: 'Focus Session Activity by Hour',
    colors: hourlyActivity.map((v, i) => {
      if (i >= 9 && i <= 12) return '#00B894'; // morning peak
      if (i >= 14 && i <= 18) return '#6C5CE7'; // afternoon
      if (i >= 20 || i < 6) return '#E17055';   // late night
      return '#74B9FF';
    }),
    formatValue: v => `${Math.round(v)}m`,
    barRadius: 4,
    barGap: 0.2
  });
}

// ============ Sites Table ============
function renderSitesTable(filter = '') {
  const container = document.getElementById('sites-table');
  const allTime = aggregateField('time');
  const allVisits = aggregateField('visits');

  let sorted = Object.entries(allTime)
    .sort(([, a], [, b]) => b - a);

  if (filter) {
    sorted = sorted.filter(([domain]) =>
      domain.toLowerCase().includes(filter.toLowerCase())
    );
  }

  if (sorted.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px;">
        <div style="font-size: 28px; opacity:0.3; margin-bottom:8px;">🌐</div>
        <div style="font-size:13px; color:var(--text-tertiary);">${filter ? 'No matching sites' : 'No browsing data yet'}</div>
      </div>`;
    return;
  }

  const maxTime = sorted[0][1];

  container.innerHTML = sorted.slice(0, 20).map(([domain, seconds], i) => {
    const cat = categorizeDomain(domain);
    const visits = allVisits[domain] || 0;
    return `
      <div class="site-row">
        <div class="site-emoji">${getFavicon(domain)}</div>
        <div>
          <div class="site-domain">${domain}</div>
          <div class="site-category">${cat} · ${visits} visits</div>
        </div>
        <div class="site-bar-wrap">
          <div class="site-bar-fill" style="width:${(seconds / maxTime * 100)}%; background:${COLORS[i % COLORS.length]};"></div>
        </div>
        <div class="site-time-val">${formatDuration(seconds)}</div>
      </div>`;
  }).join('');
}

// ============ AI Insights ============
async function generateInsights() {
  const container = document.getElementById('ai-insights');
  container.innerHTML = `
    <div class="insight-loading">
      <div class="spinner"></div>
      <div style="font-size:13px; color:var(--text-tertiary);">Analyzing your browsing patterns...</div>
    </div>`;

  const available = await aiClient.isAvailable();
  if (!available) {
    const providerId = await aiClient.getProvider();
    const provider = AI_PROVIDERS[providerId];
    const hint = provider?.requiresKey
      ? 'Set your API key in the popup for ' + (provider?.name || providerId) + '.'
      : 'Start Ollama locally to generate AI insights.<br><code style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:4px;font-size:12px;">ollama serve</code>';
    container.innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <div class="empty-state-icon">⚠️</div>
        <div class="empty-state-title">AI Not Connected</div>
        <div class="empty-state-text">${hint}</div>
      </div>`;
    return;
  }

  // Prepare data for AI
  const allTime = aggregateField('time');
  const allCats = aggregateField('categories');
  const totalSeconds = Object.values(allTime).reduce((a, b) => a + b, 0);
  const topSites = Object.entries(allTime).sort(([, a], [, b]) => b - a).slice(0, 10);
  const productiveTime = PRODUCTIVE_CATS.reduce((sum, c) => sum + (allCats[c] || 0), 0);
  const distractTime = DISTRACTING_CATS.reduce((sum, c) => sum + (allCats[c] || 0), 0);

  const prompt = `You are a productivity coach analyzing someone's browser usage data. Provide exactly 5 specific, actionable insights. Format each insight on its own line starting with an emoji and title, then a pipe | separator, then the insight text.

Data:
- Total screen time: ${formatDuration(totalSeconds)}
- Focus score: ${totalSeconds > 0 ? Math.round((productiveTime / totalSeconds) * 100) : 0}%
- Productive time: ${formatDuration(productiveTime)}
- Distraction time: ${formatDuration(distractTime)}
- Top sites: ${topSites.map(([d, t]) => `${d} (${formatDuration(t)})`).join(', ')}
- Categories: ${Object.entries(allCats).map(([c, t]) => `${c}: ${formatDuration(t)}`).join(', ')}
- Period: ${currentPeriod === 'today' ? 'Today' : `Last ${currentPeriod}`}

Format: 🎯 Title | Insight text here
One insight per line, exactly 5 lines, nothing else.`;

  const result = await aiClient.generate(prompt, { temperature: 0.6, maxTokens: 600 });

  if (!result.success) {
    container.innerHTML = `
      <div class="empty-state" style="padding:20px;">
        <div class="empty-state-icon">❌</div>
        <div class="empty-state-title">Error</div>
        <div class="empty-state-text">${result.error}</div>
      </div>`;
    return;
  }

  // Parse insights
  const lines = result.text.trim().split('\n').filter(l => l.trim());
  const insights = lines.map(line => {
    const parts = line.split('|');
    const title = parts[0]?.trim() || '';
    const text = parts[1]?.trim() || parts[0]?.trim() || '';
    return { title, text };
  });

  const insightColors = ['rgba(108,92,231,0.12)', 'rgba(0,206,201,0.12)', 'rgba(253,121,168,0.12)', 'rgba(0,184,148,0.12)', 'rgba(253,203,110,0.12)'];

  container.innerHTML = insights.slice(0, 5).map((insight, i) => `
    <div class="insight-item">
      <div class="insight-icon" style="background:${insightColors[i]};">
        ${insight.title.slice(0, 2)}
      </div>
      <div class="insight-content">
        <div class="insight-title">${insight.title.slice(2).trim()}</div>
        <div class="insight-text">${insight.text}</div>
      </div>
    </div>
  `).join('');
}

// ============ Settings ============
async function openSettings() {
  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  const settings = state.settings || {};

  document.getElementById('set-focus-duration').value = (settings.focusDuration || 1500) / 60;
  document.getElementById('set-break-duration').value = (settings.breakDuration || 300) / 60;
  document.getElementById('set-long-break').value = (settings.longBreakDuration || 900) / 60;
  document.getElementById('set-sessions-count').value = settings.sessionsBeforeLongBreak || 4;
  document.getElementById('set-notifications').checked = settings.notificationsEnabled !== false;

  const blockedSites = state.blockedSites || [];
  document.getElementById('set-blocked-sites').value = blockedSites.join('\n');

  document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettings() {
  document.getElementById('settings-modal').style.display = 'none';
}

async function saveSettings() {
  const settings = {
    focusDuration: parseInt(document.getElementById('set-focus-duration').value) * 60,
    breakDuration: parseInt(document.getElementById('set-break-duration').value) * 60,
    longBreakDuration: parseInt(document.getElementById('set-long-break').value) * 60,
    sessionsBeforeLongBreak: parseInt(document.getElementById('set-sessions-count').value),
    notificationsEnabled: document.getElementById('set-notifications').checked,
    trackingEnabled: true,
    idleThreshold: 120
  };

  const blockedSites = document.getElementById('set-blocked-sites').value
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  await chrome.runtime.sendMessage({ type: 'UPDATE_SETTINGS', settings });
  await chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKED_SITES', sites: blockedSites });

  closeSettings();
  showToast('Settings saved!', 'success');
}

// ============ Helpers ============
function aggregateField(field) {
  const result = {};
  for (const day of Object.values(historyData)) {
    const data = day[field] || {};
    for (const [key, val] of Object.entries(data)) {
      result[key] = (result[key] || 0) + val;
    }
  }
  return result;
}

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function categorizeDomain(domain) {
  for (const [category, sites] of Object.entries(SITE_CATEGORIES)) {
    if (sites.some(s => domain.includes(s) || s.includes(domain))) {
      return category;
    }
  }
  return 'Other';
}

function getFavicon(domain) {
  const icons = {
    'github.com': '🐙', 'stackoverflow.com': '📚', 'google.com': '🔍',
    'youtube.com': '📺', 'twitter.com': '🐦', 'x.com': '𝕏',
    'reddit.com': '🤖', 'facebook.com': '📘', 'instagram.com': '📷',
    'linkedin.com': '💼', 'medium.com': '📝', 'gmail.com': '📧',
    'amazon.com': '📦', 'netflix.com': '🎬', 'spotify.com': '🎵',
    'slack.com': '💬', 'discord.com': '🎮', 'chatgpt.com': '🤖',
    'claude.ai': '🧠', 'localhost': '🖥️', 'udemy.com': '🎓',
    'coursera.org': '🎓', 'leetcode.com': '💻', 'tradingview.com': '📈',
    'news.ycombinator.com': '🔶', 'dev.to': '👩‍💻'
  };
  for (const [site, icon] of Object.entries(icons)) {
    if (domain.includes(site)) return icon;
  }
  return domain.charAt(0).toUpperCase();
}

async function checkAI() {
  const available = await aiClient.isAvailable();
  const el = document.getElementById('ai-status');
  const providerId = await aiClient.getProvider();
  const provider = AI_PROVIDERS[providerId];
  const providerName = provider?.name || providerId;
  if (available) {
    el.className = 'ollama-status connected';
    el.innerHTML = `<span class="status-dot online"></span><span>${providerName}</span>`;
  } else {
    el.className = 'ollama-status disconnected';
    const hint = provider?.requiresKey ? 'No Key' : 'Offline';
    el.innerHTML = `<span class="status-dot offline"></span><span>${hint}</span>`;
  }
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}
