// FlowForge — Background Service Worker
// Handles: alarms, notifications, deep work blocking, no-zero-day reminders

// ===== Deep Work Blocking =====
let dwBlockList = [];
let dwActive = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'DW_START') {
    dwBlockList = request.blockList || [];
    dwActive = true;
    applyBlocking();
    // Set alarm for session end
    chrome.alarms.create('dw-session', { delayInMinutes: request.duration });
    sendResponse({ success: true });
  } else if (request.type === 'DW_END') {
    dwActive = false;
    removeBlocking();
    chrome.alarms.clear('dw-session');
    sendResponse({ success: true });
  } else if (request.type === 'DW_COMPLETE_NOTIFY') {
    chrome.notifications.create('dw-complete', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔥 Deep Work Complete!',
      message: `${request.duration}m session on "${request.tag}" — Quality: ${request.quality}/100. Time for momentum tasks!`,
      priority: 2
    });
    // Trigger AI momentum generation
    generateMomentumTasks(request.tag);
    sendResponse({ success: true });
  }
  return true;
});

// ===== Alarm Handlers =====
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'dw-session') {
    dwActive = false;
    removeBlocking();
    chrome.notifications.create('dw-timer-end', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🔥 Deep Work Session Complete!',
      message: 'Great work! Check your momentum queue for quick wins.',
      priority: 2
    });
  }

  if (alarm.name === 'nzd-evening-check') {
    checkNoZeroDayReminder();
  }
});

// ===== No Zero Day Evening Reminder =====
// Set a daily alarm at 9 PM
chrome.runtime.onInstalled.addListener(() => {
  const now = new Date();
  const ninePM = new Date();
  ninePM.setHours(21, 0, 0, 0);
  if (now > ninePM) ninePM.setDate(ninePM.getDate() + 1);

  chrome.alarms.create('nzd-evening-check', {
    when: ninePM.getTime(),
    periodInMinutes: 24 * 60 // repeat daily
  });
});

async function checkNoZeroDayReminder() {
  const result = await chrome.storage.local.get(['ff_nzd_goals', 'ff_nzd_history']);
  const goals = result.ff_nzd_goals || [];
  const history = result.ff_nzd_history || {};
  const today = new Date().toISOString().slice(0, 10);

  if (goals.length === 0) return;

  const todayChecked = history[today] || [];
  const unchecked = goals.filter(g => !todayChecked.includes(g.id));

  if (unchecked.length > 0) {
    chrome.notifications.create('nzd-reminder', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⚠️ No Zero Day Alert!',
      message: `${unchecked.length} goal${unchecked.length > 1 ? 's' : ''} unchecked: ${unchecked.map(g => g.name).join(', ')}. Don't let today be a zero day!`,
      priority: 2
    });
  }
}

// ===== Website Blocking (declarativeNetRequest) =====
async function applyBlocking() {
  if (dwBlockList.length === 0) return;

  const rules = dwBlockList.map((domain, index) => ({
    id: index + 1,
    priority: 1,
    action: { type: 'block' },
    condition: {
      urlFilter: `*://${domain}/*`,
      resourceTypes: ['main_frame']
    }
  }));

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

// ===== Cross-Extension Messaging & AI Integration =====
try {
  importScripts('../shared/ollama-client.js');
  if (typeof registerOllamaHandler === 'function') registerOllamaHandler();
} catch (e) {
  console.error('Failed to load OllamaClient', e);
}

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.action === 'GET_STATE') {
    chrome.storage.local.get([request.key], (res) => {
      sendResponse({ success: true, data: res[request.key] });
    });
    return true; // Keep channel open
  }
  
  if (request.action === 'UPDATE_STATE') {
    chrome.storage.local.set({ [request.key]: request.data }, () => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open
  }
});

async function generateMomentumTasks(tag) {
  if (typeof OllamaClient === 'undefined') return;
  const client = new OllamaClient();
  const prompt = `The user just finished a deep work session with the tag "${tag}". Give me exactly 3 short, actionable 5-10 minute tasks they should do right now to keep the momentum going. Return ONLY a JSON array of strings. Example: ["Review PRs", "Reply to emails", "Update Jira"]`;
  
  try {
    const res = await client.generate(prompt, { temperature: 0.6, maxTokens: 150 });
    if (res.success && res.text) {
      let tasks = [];
      try {
        tasks = JSON.parse(res.text.match(/\[.*\]/s)[0]);
      } catch (e) {
        // Fallback to splitting by newlines if JSON parsing fails
        tasks = res.text.split('\n').map(t => t.replace(/^- /, '').replace(/^\d+\.\s*/, '').trim()).filter(t => t);
        tasks = tasks.slice(0, 3);
      }
      
      if (tasks.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        chrome.storage.local.get(['ff_momentum_queue'], (stored) => {
          const queue = stored.ff_momentum_queue || [];
          tasks.forEach(text => {
            queue.push({
              id: Date.now() + Math.random(),
              text,
              cat: 'other',
              completed: false,
              completedDate: null,
              createdDate: today
            });
          });
          chrome.storage.local.set({ ff_momentum_queue: queue });
        });
      }
    }
  } catch (err) {
    console.error('Error generating momentum tasks:', err);
  }
}
