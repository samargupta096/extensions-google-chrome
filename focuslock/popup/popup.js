/**
 * FocusLock — Popup Controller
 * Focus sessions, flow score, analytics, settings
 */

const $ = (id) => document.getElementById(id);
let timerInterval = null;
let sessionEndTime = null;
let selectedDuration = 25;

document.addEventListener('DOMContentLoaded', async () => {
  initTabs();
  await loadFocusStatus();
  initSessionControls();
  initSettings();
  startStatusPoll();
});

// ─── Tabs ───
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
      tab.classList.add('active');
      $(`tab-${tab.dataset.tab}`).style.display = '';
      if (tab.dataset.tab === 'analytics') loadAnalytics();
      if (tab.dataset.tab === 'settings') loadSettings();
    });
  });
}

// ─── Focus Status ───
async function loadFocusStatus() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getStatus' }, (r) => {
      if (!r?.success) { resolve(); return; }
      updateStreakBadge(r.streaks);
      $('todayStreak').textContent = r.streaks?.current || 0;

      if (r.active) {
        showActiveSession(r);
      } else {
        showIdleState();
      }

      // Load today's stats
      chrome.runtime.sendMessage({ action: 'getAnalytics', days: 1 }, (ar) => {
        if (ar?.days?.[0]) {
          const today = ar.days[0];
          $('todayFocusMin').textContent = today.productiveMinutes || 0;
          $('todaySessions').textContent = today.focusSessions?.length || 0;
        }
        resolve();
      });
    });
  });
}

function showActiveSession(r) {
  // Flow score ring
  updateFlowRing(r.flowScore);
  $('flowStatus').textContent = 'In the zone 🧘';
  $('flowTimer').style.display = '';
  $('flowDistractions').style.display = '';
  $('distractCount').textContent = r.distractions;
  sessionEndTime = Date.now() + r.remaining * 60 * 1000;
  updateTimerDisplay(r.remaining);
  startTimer();

  // Switch buttons
  $('sessionCard').style.display = 'none';
  $('activeSessionCard').style.display = '';
}

function showIdleState() {
  updateFlowRing(0);
  $('flowStatus').textContent = 'No active session';
  $('flowTimer').style.display = 'none';
  $('flowDistractions').style.display = 'none';
  $('sessionCard').style.display = '';
  $('activeSessionCard').style.display = 'none';
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function updateFlowRing(score) {
  const fg = $('flowFg');
  $('flowNumber').textContent = score > 0 ? score : '--';
  fg.style.setProperty('--pct', score);
  fg.className = `flow-fg ${score >= 70 ? 'flow-high' : score >= 40 ? 'flow-medium' : 'flow-low'}`;
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.round((sessionEndTime - Date.now()) / 60000));
    updateTimerDisplay(remaining);
    if (remaining === 0) { clearInterval(timerInterval); showIdleState(); }
    // Poll flow score
    chrome.runtime.sendMessage({ action: 'getStatus' }, (r) => {
      if (r?.active) updateFlowRing(r.flowScore);
      else { clearInterval(timerInterval); showIdleState(); }
    });
  }, 30000); // update every 30s
}

function updateTimerDisplay(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  $('timerRemaining').textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function updateStreakBadge(streaks) {
  $('streakCount').textContent = streaks?.current || 0;
  $('streakBadge').style.display = (streaks?.current > 0) ? '' : 'none';
}

// ─── Session Controls ───
function initSessionControls() {
  // Duration buttons
  document.querySelectorAll('.dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.mins === 'custom') {
        $('customDurRow').style.display = '';
        selectedDuration = parseInt($('customDur').value) || 25;
      } else {
        $('customDurRow').style.display = 'none';
        selectedDuration = parseInt(btn.dataset.mins);
      }
    });
  });

  $('customDur').addEventListener('input', () => { selectedDuration = parseInt($('customDur').value) || 25; });

  $('startFocusBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'startFocus', duration: selectedDuration }, async () => {
      showToast(`🔒 Focus started! ${selectedDuration} minutes`, 'success');
      await loadFocusStatus();
    });
  });

  $('endFocusBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'endFocus' }, () => {
      showToast('Session ended', 'success');
      showIdleState();
      loadFocusStatus();
    });
  });
}

function startStatusPoll() {
  // Poll every 60s while popup is open
  setInterval(() => chrome.runtime.sendMessage({ action: 'getStatus' }, (r) => {
    if (r?.active) updateFlowRing(r.flowScore);
  }), 60000);
}

// ─── Analytics ───
async function loadAnalytics() {
  chrome.runtime.sendMessage({ action: 'getAnalytics', days: 7 }, (r) => {
    if (!r?.success) return;
    $('totalFocusHours').textContent = `${Math.round(r.totalFocusTime / 60 * 10) / 10}h`;
    $('totalSessions').textContent = r.totalSessions;

    // Chart
    const canvas = $('focusChart');
    if (canvas && ChartUtils) {
      ChartUtils.barChart(canvas, {}, {
        labels: r.days.map(d => new Date(d.date).toLocaleDateString('en', { weekday: 'short' })),
        values: r.days.map(d => d.productiveMinutes),
        barColor: '#00B894',
        formatValue: v => `${Math.round(v)}m`,
        barRadius: 4
      });
    }

    // Session history
    const list = $('sessionHistoryList');
    const allSessions = r.days.flatMap(d => (d.focusSessions || []).map(s => ({ ...s, date: d.date }))).reverse().slice(0, 20);
    list.innerHTML = allSessions.map(s => `
      <div class="session-history-item">
        <span class="shi-date">${new Date(s.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</span>
        <span class="shi-duration">${s.elapsed}/${s.duration}m</span>
        <span class="shi-distractions">⚡ ${s.distractions} distracts</span>
        <span class="shi-reason">${s.reason === 'completed' ? '✅' : '⏹'}</span>
      </div>
    `).join('') || '<div style="color:var(--text-tertiary);font-size:12px;padding:12px;">No sessions yet</div>';
  });
}

// ─── Settings ───
async function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (r) => {
    const s = r?.settings || {};
    $('nudgeModeToggle').checked = s.nudgeMode !== false;
    $('scheduleToggle').checked = !!s.scheduleEnabled;
    $('scheduleStart').value = s.scheduleStart || '09:00';
    $('scheduleEnd').value = s.scheduleEnd || '17:00';
    $('scheduleHours').style.display = s.scheduleEnabled ? '' : 'none';
    renderBlockList(s.blockList || []);
  });
}

function renderBlockList(list) {
  $('blockListItems').innerHTML = list.map(d => `
    <div class="block-item">
      <span class="block-item-domain">🚫 ${d}</span>
      <button class="block-remove" data-domain="${d}">✕</button>
    </div>
  `).join('');
  $('blockListItems').querySelectorAll('.block-remove').forEach(btn =>
    btn.addEventListener('click', () => removeFromBlockList(btn.dataset.domain))
  );
}

function initSettings() {
  $('nudgeModeToggle').addEventListener('change', (e) => saveSettings({ nudgeMode: e.target.checked }));
  $('scheduleToggle').addEventListener('change', (e) => {
    $('scheduleHours').style.display = e.target.checked ? '' : 'none';
    saveSettings({ scheduleEnabled: e.target.checked });
  });
  $('scheduleStart').addEventListener('change', (e) => saveSettings({ scheduleStart: e.target.value }));
  $('scheduleEnd').addEventListener('change', (e) => saveSettings({ scheduleEnd: e.target.value }));
  $('addBlockBtn').addEventListener('click', addToBlockList);
  $('blockInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addToBlockList(); });
}

function saveSettings(partial) {
  chrome.runtime.sendMessage({ action: 'updateSettings', settings: partial });
}

function addToBlockList() {
  const domain = $('blockInput').value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!domain) return;
  chrome.runtime.sendMessage({ action: 'getSettings' }, (r) => {
    const list = [...(r?.settings?.blockList || [])];
    if (!list.includes(domain)) { list.push(domain); saveSettings({ blockList: list }); renderBlockList(list); }
    $('blockInput').value = '';
  });
}

function removeFromBlockList(domain) {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (r) => {
    const list = (r?.settings?.blockList || []).filter(d => d !== domain);
    saveSettings({ blockList: list });
    renderBlockList(list);
  });
}

// ─── Utils ───
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast'); if (existing) existing.remove();
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}
