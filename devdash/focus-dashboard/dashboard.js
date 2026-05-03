/**
 * dashboard.js — FocusLock Intelligence Dashboard
 */
document.addEventListener('DOMContentLoaded', () => {
  const state = {
    activeTab: 'overview',
    stats: null,
    settings: null,
    currentSession: null
  };

  // Check URL params
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab');
  if (targetTab) {
    state.activeTab = targetTab;
  }

  // ─── Tab Management ───
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function switchTab(tabId) {
    navItems.forEach(i => {
      if (i.dataset.tab === tabId) i.classList.add('active');
      else i.classList.remove('active');
    });
    
    tabPanes.forEach(p => {
      p.style.display = p.id === `pane-${tabId}` ? 'block' : 'none';
    });

    if (tabId === 'analytics' || tabId === 'overview') renderCharts();
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.dataset.tab;
      state.activeTab = tab;
      switchTab(tab);
    });
  });

  // Init tab
  switchTab(state.activeTab);

  // ─── Data Sync ───
  function refreshData() {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (res) => {
      if (res && res.success) {
        state.currentSession = res;
        updateUI();
      }
    });

    chrome.runtime.sendMessage({ action: 'getAnalytics', days: 30 }, (res) => {
      if (res && res.success) {
        state.stats = res;
        updateHero();
        updateHistory();
        renderCharts();
      }
    });

    chrome.runtime.sendMessage({ action: 'getSettings' }, (res) => {
      if (res && res.success) {
        state.settings = res.settings;
        updateSettingsUI();
      }
    });
  }

  function updateUI() {
    const statusText = document.getElementById('global-status-text');
    const statusDot = document.getElementById('global-status-dot');
    const timerDisplay = document.getElementById('active-timer-display');
    const headerTimer = document.getElementById('header-timer');
    const headerBtn = document.getElementById('header-start-btn');
    const gauge = document.getElementById('overview-flow-gauge');
    const gaugeVal = document.getElementById('overview-flow-val');

    if (state.currentSession.active) {
      statusText.textContent = 'Session in Progress';
      statusDot.style.background = '#6c5ce7';
      statusDot.style.boxShadow = '0 0 10px #6c5ce7';
      timerDisplay.style.display = 'inline-block';
      const mins = Math.floor(state.currentSession.remaining);
      headerTimer.textContent = `${mins}m left`;
      headerBtn.textContent = '⏹ End Session';
      headerBtn.classList.remove('btn-primary');
      headerBtn.classList.add('btn-ghost');
      
      gauge.style.setProperty('--pct', state.currentSession.flowScore);
      gaugeVal.textContent = state.currentSession.flowScore;
    } else {
      statusText.textContent = 'Ready to Focus';
      statusDot.style.background = '#00b894';
      statusDot.style.boxShadow = '0 0 10px #00b894';
      timerDisplay.style.display = 'none';
      headerBtn.textContent = '🔒 Start Session';
      headerBtn.classList.add('btn-primary');
      headerBtn.classList.remove('btn-ghost');
      
      gauge.style.setProperty('--pct', 0);
      gaugeVal.textContent = 0;
    }

    if (state.currentSession.streaks) {
      document.getElementById('sidebar-streak').textContent = state.currentSession.streaks.current;
    }
  }

  function updateHero() {
    if (!state.stats) return;
    document.getElementById('hero-sessions').textContent = state.stats.totalSessions;
    document.getElementById('hero-total-time').textContent = Math.round(state.stats.totalFocusTime / 60) + 'h';
    document.getElementById('hero-longest-streak').textContent = state.stats.streaks.longest;
    
    // Calculate avg flow
    let totalFlow = 0;
    let count = 0;
    state.stats.days.forEach(d => {
      d.focusSessions.forEach(s => {
        // Simple flow calc for history
        totalFlow += Math.min(100, Math.max(0, 100 - (s.distractions * 15)));
        count++;
      });
    });
    document.getElementById('hero-avg-flow').textContent = count > 0 ? Math.round(totalFlow / count) : '--';
  }

  function updateHistory() {
    const table = document.getElementById('history-table-body');
    if (!table || !state.stats) return;
    table.innerHTML = '';
    
    // Flatten and sort sessions
    const sessions = [];
    state.stats.days.forEach(day => {
      day.focusSessions.forEach(s => {
        sessions.push({ date: day.date, ...s });
      });
    });
    
    sessions.sort((a, b) => b.completedAt - a.completedAt).slice(0, 20).forEach(s => {
      const tr = document.createElement('tr');
      const flow = Math.min(100, Math.max(0, 100 - (s.distractions * 15)));
      const flowClass = flow > 80 ? 'text-success' : flow > 50 ? 'text-warning' : 'text-danger';
      
      tr.innerHTML = `
        <td>${new Date(s.completedAt).toLocaleDateString()} <span style="color:var(--text-dim);font-size:0.8rem;">${new Date(s.completedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></td>
        <td>${s.elapsed}m / ${s.duration}m</td>
        <td><span class="badge ${s.reason === 'completed' ? 'badge-green' : 'badge-red'}">${s.reason}</span></td>
        <td>${s.distractions}</td>
        <td class="${flowClass}" style="font-weight:700;">${flow}</td>
      `;
      table.appendChild(tr);
    });
  }

  function updateSettingsUI() {
    if (!state.settings) return;
    const blockList = document.getElementById('dashboard-block-list');
    blockList.innerHTML = '';
    state.settings.blockList.forEach(domain => {
      const div = document.createElement('div');
      div.className = 'domain-item';
      div.style = 'display:flex; justify-content:space-between; padding:8px; background:rgba(255,255,255,0.02); border-radius:8px; margin-bottom:4px;';
      div.innerHTML = `
        <span>${domain}</span>
        <button class="btn-text" style="color:var(--accent-red); cursor:pointer;">&times;</button>
      `;
      div.querySelector('button').onclick = () => removeDomain(domain);
      blockList.appendChild(div);
    });

    document.getElementById('setting-hard-block').checked = !state.settings.nudgeMode;
  }

  // ─── Charts ───
  let mainChart = null;
  function renderCharts() {
    if (!state.stats) return;
    const ctx = document.getElementById('main-focus-chart');
    if (!ctx) return;

    if (mainChart) mainChart.destroy();

    const last7 = state.stats.days.slice(-7);
    const labels = last7.map(d => {
      const date = new Date(d.date);
      return date.toLocaleDateString([], { weekday: 'short' });
    });
    const data = last7.map(d => Math.round(d.productiveMinutes / 60 * 10) / 10);

    mainChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Focus Hours',
          data: data,
          backgroundColor: 'rgba(108, 92, 231, 0.4)',
          borderColor: '#6c5ce7',
          borderWidth: 2,
          borderRadius: 8,
          hoverBackgroundColor: '#6c5ce7'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
        }
      }
    });
  }

  // ─── Actions ───
  document.getElementById('header-start-btn').onclick = () => {
    if (state.currentSession.active) {
      chrome.runtime.sendMessage({ action: 'endFocus' }, refreshData);
    } else {
      chrome.runtime.sendMessage({ action: 'startFocus', duration: state.settings?.defaultDuration || 25 }, refreshData);
    }
  };

  document.getElementById('add-domain-btn').onclick = () => {
    const input = document.getElementById('new-block-domain');
    const domain = input.value.trim();
    if (domain) {
      const newList = [...state.settings.blockList, domain];
      chrome.runtime.sendMessage({ action: 'updateSettings', settings: { blockList: newList } }, () => {
        input.value = '';
        refreshData();
      });
    }
  };

  function removeDomain(domain) {
    const newList = state.settings.blockList.filter(d => d !== domain);
    chrome.runtime.sendMessage({ action: 'updateSettings', settings: { blockList: newList } }, refreshData);
  }

  document.getElementById('setting-hard-block').onchange = (e) => {
    chrome.runtime.sendMessage({ action: 'updateSettings', settings: { nudgeMode: !e.target.checked } }, refreshData);
  };

  // Auto Refresh
  setInterval(refreshData, 5000);
  refreshData();
});
