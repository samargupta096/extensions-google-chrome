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
  const settingsBtn = document.getElementById('focus-settings-btn');
  const maximizeBtn = document.getElementById('maximize-timer-btn');
  
  const mainView = document.getElementById('timer-main-view');
  const settingsView = document.getElementById('timer-settings-view');
  
  const blockInput = document.getElementById('blocklist-input');
  const addBlockBtn = document.getElementById('add-block-btn');
  const blockListContainer = document.getElementById('blocklist-items');

  const CIRCUMFERENCE = 283; // 2 * PI * 45
  let blockList = [];

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
    const { timeRemaining, isRunning, blockList: list } = state;
    
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

    // Update blocklist if view is active
    if (list) {
      blockList = list;
      if (settingsView.classList.contains('active')) renderBlockList();
    }
  }

  function fetchState() {
    safeSendMessage({ type: 'GET_TIMER_STATE' }, (state) => {
      if (state) updateUI(state);
    });
  }

  // View Toggle
  settingsBtn && settingsBtn.addEventListener('click', () => {
    const isSettings = settingsView.classList.contains('active');
    if (isSettings) {
      settingsView.classList.remove('active');
      mainView.classList.add('active');
      settingsBtn.textContent = '⚙️';
    } else {
      mainView.classList.remove('active');
      settingsView.classList.add('active');
      settingsBtn.textContent = '←';
      renderBlockList();
    }
  });

  // Maximize to Full Dashboard
  maximizeBtn && maximizeBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('focus.html') });
  });

  // Blocklist Logic
  function renderBlockList() {
    blockListContainer.innerHTML = '';
    blockList.forEach((domain, idx) => {
      const li = document.createElement('li');
      li.className = 'item-row';
      li.innerHTML = `
        <span class="domain-name">${domain}</span>
        <button class="remove-btn" data-idx="${idx}">✕</button>
      `;
      blockListContainer.appendChild(li);
    });

    blockListContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        blockList.splice(idx, 1);
        safeSendMessage({ type: 'UPDATE_BLOCKLIST', list: blockList }, fetchState);
      });
    });
  }

  addBlockBtn && addBlockBtn.addEventListener('click', () => {
    const domain = blockInput.value.trim().toLowerCase();
    if (!domain || domain.length < 4 || !domain.includes('.')) {
      blockInput.classList.add('input-error');
      setTimeout(() => blockInput.classList.remove('input-error'), 1500);
      return;
    }
    if (!blockList.includes(domain)) {
      blockList.push(domain);
      safeSendMessage({ type: 'UPDATE_BLOCKLIST', list: blockList }, fetchState);
    }
    blockInput.value = '';
  });

  blockInput && blockInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBlockBtn.click();
  });

  // Timer Control Listeners
  startBtn && startBtn.addEventListener('click', () => safeSendMessage({ type: 'START_TIMER' }, fetchState));
  pauseBtn && pauseBtn.addEventListener('click', () => safeSendMessage({ type: 'PAUSE_TIMER' }, fetchState));
  resetBtn && resetBtn.addEventListener('click', () => {
    const mode = document.querySelector('input[name="timer-mode"]:checked').value;
    safeSendMessage({ type: 'RESET_TIMER', mode }, fetchState);
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
});
