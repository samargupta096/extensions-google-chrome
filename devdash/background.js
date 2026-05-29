// background.js — Focus Timer & Blocking Engine

// ─── Side Panel: open DevDash beside the active tab ───
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(() => { /* sidePanel API unavailable */ });

let timeRemaining = 25 * 60;
let isRunning = false;
let currentMode = 'work';
let initialDuration = 25 * 60;
let timerInterval = null;
let blockList = [];

// Stats tracking
let todaySessions = 0;
let todayFocusMinutes = 0;
let todayFocusScore = 100;
let lastResetDate = new Date().toISOString().slice(0, 10);

// Load state on startup
chrome.storage.local.get(['timeRemaining', 'isRunning', 'blockList', 'todaySessions', 'todayFocusMinutes', 'todayFocusScore', 'lastResetDate'], (res) => {
  if (res.timeRemaining !== undefined) timeRemaining = res.timeRemaining;
  if (res.blockList) blockList = res.blockList;
  if (res.todaySessions !== undefined) todaySessions = res.todaySessions;
  if (res.todayFocusMinutes !== undefined) todayFocusMinutes = res.todayFocusMinutes;
  if (res.todayFocusScore !== undefined) todayFocusScore = res.todayFocusScore;
  if (res.lastResetDate) lastResetDate = res.lastResetDate;

  checkDailyReset();
  if (res.isRunning) startTimer();
});

function checkDailyReset() {
  const now = new Date().toISOString().slice(0, 10);
  if (lastResetDate !== now) {
    todaySessions = 0;
    todayFocusMinutes = 0;
    todayFocusScore = 100;
    lastResetDate = now;
    chrome.storage.local.set({ todaySessions, todayFocusMinutes, todayFocusScore, lastResetDate });
  }
}

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_TIMER') {
    startTimer();
    sendResponse({ success: true });
  } else if (request.type === 'PAUSE_TIMER') {
    pauseTimer();
    sendResponse({ success: true });
  } else if (request.type === 'RESET_TIMER') {
    currentMode = request.mode;
    initialDuration = currentMode === 'work' ? 25 * 60 : 5 * 60;
    resetTimer(request.mode);
    sendResponse({ success: true });
  } else if (request.type === 'ADJUST_TIMER') {
    adjustTimer(request.amount);
    sendResponse({ success: true });
  } else if (request.type === 'GET_TIMER_STATE') {
    checkDailyReset();
    sendResponse({ 
      timeRemaining, 
      isRunning, 
      blockList,
      stats: {
        sessions: todaySessions,
        minutes: todayFocusMinutes,
        score: todayFocusScore
      }
    });
  } else if (request.type === 'UPDATE_BLOCKLIST') {
    blockList = request.list;
    chrome.storage.local.set({ blockList });
    if (isRunning) applyBlocking(); // Update immediately if running
    sendResponse({ success: true });
  } else if (request.type === 'CLIPBOARD_ADD') {
    updateClipboardHistory(request.text);
    sendResponse({ success: true });
  } else if (request.type === 'GET_CLIPBOARD') {
    chrome.storage.local.get(['clipboardHistory'], (res) => {
      sendResponse({ history: res.clipboardHistory || [] });
    });
    return true; // async
  }
  return true;
});

function updateClipboardHistory(text) {
  chrome.storage.local.get(['clipboardHistory'], (res) => {
    let history = res.clipboardHistory || [];
    // Remove if already exists to move to top
    history = history.filter(item => item !== text);
    history.unshift(text);
    // Limit to 20 items
    if (history.length > 20) history = history.slice(0, 20);
    chrome.storage.local.set({ clipboardHistory: history });
    // Notify all tabs (especially the dashboard)
    chrome.runtime.sendMessage({ type: 'CLIPBOARD_UPDATED', history });
  });
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  applyBlocking();
  
  timerInterval = setInterval(() => {
    timeRemaining--;
    
    // Sync to storage periodically or on stop
    if (timeRemaining % 10 === 0) {
      chrome.storage.local.set({ timeRemaining, isRunning });
    }

    // Increment focus minutes every 60 seconds
    if (timeRemaining > 0 && (25 * 60 - timeRemaining) % 60 === 0) {
      const activeMode = timeRemaining > 0 ? 'work' : 'break'; // Basic check
      // We only track work mode minutes
      // Wait, we don't know the mode here easily without a global variable.
      // I'll add currentMode.
    }

    if (timeRemaining <= 0) {
      completeTimer();
    }
  }, 1000);
}

function pauseTimer() {
  isRunning = false;
  clearInterval(timerInterval);
  removeBlocking();
  chrome.storage.local.set({ timeRemaining, isRunning });
}

function resetTimer(mode) {
  isRunning = false;
  clearInterval(timerInterval);
  removeBlocking();
  timeRemaining = mode === 'work' ? 25 * 60 : 5 * 60;
  chrome.storage.local.set({ timeRemaining, isRunning });
}

function adjustTimer(amount) {
  timeRemaining = Math.max(0, timeRemaining + amount);
  chrome.storage.local.set({ timeRemaining });
}

function completeTimer() {
  const finishedMode = currentMode;
  pauseTimer();
  
  if (finishedMode === 'work') {
    todaySessions++;
    const duration = Math.round(initialDuration / 60);
    todayFocusMinutes += duration;
    chrome.storage.local.set({ todaySessions, todayFocusMinutes });

    // Save to analytics for the dashboard
    chrome.storage.local.get(['analytics', 'streaks'], (res) => {
      let analytics = res.analytics || {};
      let streaks = res.streaks || { current: 0, longest: 0, lastFocusDate: null };
      const today = new Date().toISOString().slice(0, 10);
      
      if (!analytics[today]) {
        analytics[today] = { focusSessions: [], distractedMinutes: 0, productiveMinutes: 0 };
      }
      
      analytics[today].focusSessions.push({
        duration: duration,
        elapsed: duration,
        distractions: 0, // DevDash basic timer doesn't track distractions yet
        reason: 'completed',
        completedAt: Date.now()
      });
      analytics[today].productiveMinutes += duration;

      // Update streaks
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      if (streaks.lastFocusDate === yesterdayStr) {
        streaks.current += 1;
        streaks.longest = Math.max(streaks.longest, streaks.current);
      } else if (streaks.lastFocusDate !== today) {
        streaks.current = 1;
      }
      streaks.lastFocusDate = today;

      chrome.storage.local.set({ analytics, streaks });
    });
  }

  // Notify UI for celebration and sound
  chrome.runtime.sendMessage({ type: 'TIMER_COMPLETE', mode: finishedMode });

  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: finishedMode === 'work' ? 'Focus Session Complete!' : 'Break Over!',
    message: finishedMode === 'work' ? 'Great job! Time for a break.' : 'Time to get back to work!',
    priority: 2
  });
}

// Analytics and Settings Handlers for Dashboard
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getStatus') {
    // Adapter for dashboard
    chrome.storage.local.get(['streaks'], (res) => {
      const remainingMins = Math.max(0, Math.round(timeRemaining / 60));
      sendResponse({ 
        success: true, 
        active: isRunning, 
        elapsed: Math.round((initialDuration - timeRemaining) / 60), 
        remaining: remainingMins, 
        duration: Math.round(initialDuration / 60),
        distractions: 0, 
        flowScore: todayFocusScore, 
        streaks: res.streaks 
      });
    });
    return true;
  } else if (request.action === 'getAnalytics') {
    chrome.storage.local.get(['analytics', 'streaks'], (res) => {
      const daysParam = request.days || 7;
      const analytics = res.analytics || {};
      const result = [];
      for (let i = 0; i < daysParam; i++) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        result.push({ date: key, ...(analytics[key] || { focusSessions: [], distractedMinutes: 0, productiveMinutes: 0 }) });
      }
      const totalFocusTime = result.reduce((s, d) => s + d.productiveMinutes, 0);
      const totalSessions = result.reduce((s, d) => s + d.focusSessions.length, 0);
      sendResponse({ success: true, days: result.reverse(), totalFocusTime, totalSessions, streaks: res.streaks });
    });
    return true;
  } else if (request.action === 'getSettings') {
    sendResponse({ success: true, settings: { blockList, defaultDuration: 25, nudgeMode: true } });
    return true;
  } else if (request.action === 'updateSettings') {
    if (request.settings.blockList) {
      blockList = request.settings.blockList;
      chrome.storage.local.set({ blockList });
      if (isRunning) applyBlocking();
    }
    sendResponse({ success: true });
    return true;
  }
});

// Website Blocking Logic (declarativeNetRequest)
async function applyBlocking() {
  if (blockList.length === 0) return;

  const rules = blockList.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: domain,
      resourceTypes: ['main_frame']
    }
  }));

  // Remove old rules first
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds,
    addRules: rules
  });
}

async function removeBlocking() {
  const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
  const oldRuleIds = oldRules.map(r => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: oldRuleIds
  });
}
