// background.js — Focus Timer & Blocking Engine
let timeRemaining = 25 * 60;
let isRunning = false;
let timerInterval = null;
let blockList = [];

// Load state on startup
chrome.storage.local.get(['timeRemaining', 'isRunning', 'blockList'], (res) => {
  if (res.timeRemaining !== undefined) timeRemaining = res.timeRemaining;
  if (res.blockList) blockList = res.blockList;
  if (res.isRunning) startTimer();
});

// Message Listener
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'START_TIMER') {
    startTimer();
    sendResponse({ success: true });
  } else if (request.type === 'PAUSE_TIMER') {
    pauseTimer();
    sendResponse({ success: true });
  } else if (request.type === 'RESET_TIMER') {
    resetTimer(request.mode);
    sendResponse({ success: true });
  } else if (request.type === 'ADJUST_TIMER') {
    adjustTimer(request.amount);
    sendResponse({ success: true });
  } else if (request.type === 'GET_TIMER_STATE') {
    sendResponse({ timeRemaining, isRunning, blockList });
  } else if (request.type === 'UPDATE_BLOCKLIST') {
    blockList = request.list;
    chrome.storage.local.set({ blockList });
    if (isRunning) applyBlocking(); // Update immediately if running
    sendResponse({ success: true });
  }
  return true;
});

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
  pauseTimer();
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'Focus Time Over!',
    message: 'Time for a break or a new session.',
    priority: 2
  });
}

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
