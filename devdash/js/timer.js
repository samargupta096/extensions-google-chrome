// timer.js — Focus Timer View (syncs with background.js)
document.addEventListener('DOMContentLoaded', () => {
  const timerDisplay = document.getElementById('timer-display');
  const startBtn = document.getElementById('start-timer-btn');
  const pauseBtn = document.getElementById('pause-timer-btn');
  const resetBtn = document.getElementById('reset-timer-btn');
  const incBtn = document.getElementById('inc-timer-btn');
  const decBtn = document.getElementById('dec-timer-btn');
  const modeRadios = document.querySelectorAll('input[name="timer-mode"]');
  const progressCircle = document.querySelector('.timer-progress');
  
  const CIRCUMFERENCE = 283; // 2 * PI * 45

  function safeSendMessage(message, callback) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn(`Message '${message.type}' failed:`, chrome.runtime.lastError.message);
          if (callback) callback(null);
          return;
        }
        if (callback) callback(response);
      });
    } catch (e) {
      console.error(`Message '${message.type}' failed:`, e);
      if (callback) callback(null);
    }
  }

  function updateUI(state) {
    if (!state) return;
    const { timeRemaining, isRunning } = state;
    
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

    // Update circular progress
    const activeMode = document.querySelector('input[name="timer-mode"]:checked');
    const mode = activeMode ? activeMode.value : 'work';
    const totalTime = mode === 'work' ? 25 * 60 : 5 * 60;

    // Update buttons
    if (isRunning) {
      if (startBtn) startBtn.style.display = 'none';
      if (pauseBtn) pauseBtn.style.display = 'inline-block';
    } else {
      if (startBtn) startBtn.style.display = 'inline-block';
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (startBtn) startBtn.textContent = timeRemaining < totalTime ? 'Resume' : 'Start';
    }

    const progress = Math.min(1, Math.max(0, timeRemaining / totalTime));
    const offset = CIRCUMFERENCE - (progress * CIRCUMFERENCE);
    if (progressCircle) progressCircle.style.strokeDashoffset = offset;

    // Update stats
    if (state.stats) {
      const sessionsEl = document.getElementById('today-sessions');
      const timeEl = document.getElementById('today-time');
      const focusEl = document.getElementById('today-focus');
      
      if (sessionsEl) sessionsEl.textContent = state.stats.sessions;
      if (timeEl) {
        const mins = state.stats.minutes;
        timeEl.textContent = mins >= 60 ? `${(mins / 60).toFixed(1)}h` : `${mins}m`;
      }
      if (focusEl) focusEl.textContent = `${state.stats.score}%`;
    }
  }

  function fetchState() {
    safeSendMessage({ type: 'GET_TIMER_STATE' }, (state) => {
      if (state) updateUI(state);
    });
  }

  // Timer Control Listeners
  startBtn && startBtn.addEventListener('click', () => safeSendMessage({ type: 'START_TIMER' }, fetchState));
  pauseBtn && pauseBtn.addEventListener('click', () => safeSendMessage({ type: 'PAUSE_TIMER' }, fetchState));
  resetBtn && resetBtn.addEventListener('click', () => {
    const activeMode = document.querySelector('input[name="timer-mode"]:checked');
    if (activeMode) safeSendMessage({ type: 'RESET_TIMER', mode: activeMode.value }, fetchState);
  });
  
  // +/- 5 minutes = 300 seconds
  incBtn && incBtn.addEventListener('click', () => safeSendMessage({ type: 'ADJUST_TIMER', amount: 300 }, fetchState));
  decBtn && decBtn.addEventListener('click', () => safeSendMessage({ type: 'ADJUST_TIMER', amount: -300 }, fetchState));
  
  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      safeSendMessage({ type: 'RESET_TIMER', mode: radio.value }, fetchState);
    });
  });

  setInterval(fetchState, 1000);
  fetchState();

  // Dashboard & Settings Buttons
  const dashboardBtn = document.getElementById('timer-dashboard-btn');
  const settingsBtn = document.getElementById('timer-settings-btn');
  if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('focus-dashboard/dashboard.html') });
    });
  }
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('focus-dashboard/dashboard.html?tab=settings') });
    });
  }
});
