
// Bypass Ollama CORS
if (chrome.declarativeNetRequest) {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [11434],
    addRules: [{
      id: 11434,
      condition: { urlFilter: 'http://localhost:11434/*' },
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'origin', operation: 'set', value: 'http://localhost' }]
      }
    }]
  }).catch(e => console.error(e));
}

/**
 * FocusLock — Background Service Worker
 * Manages focus sessions, tracks flow state, handles tab monitoring, analytics
 */

const DEFAULT_BLOCK_LIST = [
  'twitter.com', 'x.com', 'reddit.com', 'facebook.com', 'instagram.com',
  'youtube.com', 'tiktok.com', 'linkedin.com', 'news.ycombinator.com',
  'hackernews.com', 'threads.net', 'hulu.com', 'netflix.com', 'twitch.tv'
];

// ─── Lifecycle ───
chrome.runtime.onInstalled.addListener(async () => {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings) {
    await chrome.storage.local.set({
      settings: {
        blockList: DEFAULT_BLOCK_LIST,
        defaultDuration: 25,
        nudgeMode: true, // gentle nudge instead of hard block
        scheduleEnabled: false,
        scheduleStart: '09:00', scheduleEnd: '17:00',
        showBadge: true
      },
      focusSession: null,
      analytics: {},
      streaks: { current: 0, longest: 0, lastFocusDate: null }
    });
  }
  chrome.alarms.create('analyticsTrack', { periodInMinutes: 1 });
  chrome.alarms.create('checkSchedule', { periodInMinutes: 5 });
  updateBadge();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'analyticsTrack') await trackTabTime();
  if (alarm.name === 'focusEnd') await endFocusSession('completed');
  if (alarm.name === 'checkSchedule') await checkSchedule();
});

// ─── Focus Session ───
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.action === 'startFocus') handleStartFocus(msg.duration, send);
  else if (msg.action === 'endFocus') handleEndFocus(send);
  else if (msg.action === 'getStatus') handleGetStatus(send);
  else if (msg.action === 'getAnalytics') handleGetAnalytics(msg.days, send);
  else if (msg.action === 'updateSettings') handleUpdateSettings(msg.settings, send);
  else if (msg.action === 'isBlocked') handleIsBlocked(msg.domain, send);
  else if (msg.action === 'getSettings') handleGetSettings(send);
  else if (msg.action === 'getAllowedBreak') handleAllowedBreak(msg.domain, send);
  else if (msg.action === 'ollamaFetch') {
    const { url, options = {} } = msg;
    if (!url || !url.startsWith('http://localhost:11434')) {
      send({ ok: false, error: 'Disallowed URL', data: null });
    } else {
      fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body || undefined,
      })
        .then(async (res) => {
          let data = null;
          try { data = await res.json(); } catch (_) {}
          send({ ok: res.ok, status: res.status, data });
        })
        .catch((err) => send({ ok: false, error: err.message, data: null }));
    }
  } else {
    return false;
  }
  return true;
});

async function handleStartFocus(duration, send) {
  const endTime = Date.now() + duration * 60 * 1000;
  const session = {
    startTime: Date.now(), duration, endTime, distractions: 0,
    lastDistractionTime: null, pausedAt: null
  };
  await chrome.storage.local.set({ focusSession: session });
  chrome.alarms.create('focusEnd', { when: endTime });
  updateBadge('🔒');
  send({ success: true });
}

async function handleEndFocus(send) {
  await endFocusSession('manual');
  send({ success: true });
}

async function endFocusSession(reason) {
  const { focusSession, analytics, streaks } = await chrome.storage.local.get(['focusSession', 'analytics', 'streaks']);
  if (!focusSession) return;

  const today = getToday();
  if (!analytics[today]) analytics[today] = { focusSessions: [], distractedMinutes: 0, productiveMinutes: 0 };

  const elapsed = Math.round((Date.now() - focusSession.startTime) / 60000);
  analytics[today].focusSessions.push({
    duration: focusSession.duration, elapsed, distractions: focusSession.distractions,
    reason, completedAt: Date.now()
  });
  analytics[today].productiveMinutes += elapsed;

  // Update streaks
  const lastDate = streaks.lastFocusDate;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  if (lastDate === yesterdayStr) {
    streaks.current += 1;
    streaks.longest = Math.max(streaks.longest, streaks.current);
  } else if (lastDate !== today) {
    streaks.current = 1;
  }
  streaks.lastFocusDate = today;

  await chrome.storage.local.set({ focusSession: null, analytics, streaks });
  chrome.alarms.clear('focusEnd');
  updateBadge();

  if (reason === 'completed') {
    chrome.notifications.create({ type: 'basic', iconUrl: '../icons/icon48.png',
      title: '🔒 Focus session complete!', message: `Great work! ${elapsed} min of deep focus with ${focusSession.distractions} distractions.` });
  }
}

async function handleGetStatus(send) {
  const { focusSession, streaks } = await chrome.storage.local.get(['focusSession', 'streaks']);
  if (!focusSession) { send({ success: true, active: false, streaks }); return; }

  const elapsed = Math.round((Date.now() - focusSession.startTime) / 60000);
  const remaining = Math.max(0, Math.round((focusSession.endTime - Date.now()) / 60000));
  const flowScore = calculateFlowScore(focusSession);

  send({ success: true, active: true, elapsed, remaining, duration: focusSession.duration,
    distractions: focusSession.distractions, flowScore, streaks });
}

function calculateFlowScore(session) {
  if (!session) return 0;
  const elapsed = (Date.now() - session.startTime) / 60000;
  const timeSinceDistraction = session.lastDistractionTime
    ? (Date.now() - session.lastDistractionTime) / 60000
    : elapsed;
  const baseScore = Math.min(100, (timeSinceDistraction / 23) * 100); // 23 min = full recovery
  const distractionPenalty = Math.min(50, session.distractions * 10);
  return Math.max(0, Math.round(baseScore - distractionPenalty));
}

async function handleIsBlocked(domain, send) {
  const { focusSession, settings } = await chrome.storage.local.get(['focusSession', 'settings']);
  if (!focusSession) { send({ blocked: false }); return; }
  const blockList = settings?.blockList || DEFAULT_BLOCK_LIST;
  const isBlocked = blockList.some(b => domain.includes(b) || b.includes(domain));
  if (isBlocked) {
    // Record distraction
    focusSession.distractions += 1;
    focusSession.lastDistractionTime = Date.now();
    await chrome.storage.local.set({ focusSession });
  }
  send({ blocked: isBlocked, nudgeMode: settings?.nudgeMode ?? true, flowScore: calculateFlowScore(focusSession) });
}

async function handleAllowedBreak(domain, send) {
  // Record as intentional break (no penalty)
  send({ success: true });
}

async function handleGetAnalytics(days = 7, send) {
  const { analytics = {}, streaks } = await chrome.storage.local.get(['analytics', 'streaks']);
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    result.push({ date: key, ...(analytics[key] || { focusSessions: [], distractedMinutes: 0, productiveMinutes: 0 }) });
  }
  const totalFocusTime = result.reduce((s, d) => s + d.productiveMinutes, 0);
  const totalSessions = result.reduce((s, d) => s + d.focusSessions.length, 0);
  send({ success: true, days: result.reverse(), totalFocusTime, totalSessions, streaks });
}

async function handleUpdateSettings(settings, send) {
  const { settings: current } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...current, ...settings } });
  send({ success: true });
}

async function handleGetSettings(send) {
  const { settings } = await chrome.storage.local.get('settings');
  send({ success: true, settings: settings || {} });
}

// ─── Tab Time Tracking ───
async function trackTabTime() {
  const { focusSession, analytics } = await chrome.storage.local.get(['focusSession', 'analytics']);
  if (!focusSession) return;
  const today = getToday();
  if (!analytics[today]) analytics[today] = { focusSessions: [], distractedMinutes: 0, productiveMinutes: 0 };
  // productiveMinutes updated on session end, this just maintains the store
  await chrome.storage.local.set({ analytics });
}

// ─── Schedule Check ───
async function checkSchedule() {
  const { settings } = await chrome.storage.local.get('settings');
  if (!settings?.scheduleEnabled) return;
  const now = new Date();
  const [startH, startM] = settings.scheduleStart.split(':').map(Number);
  const [endH, endM] = settings.scheduleEnd.split(':').map(Number);
  const start = startH * 60 + startM, end = endH * 60 + endM;
  const current = now.getHours() * 60 + now.getMinutes();
  // Auto-start if within schedule and no active session
  if (current >= start && current < end) {
    const { focusSession } = await chrome.storage.local.get('focusSession');
    // Don't auto-start here, just flag availability
  }
}

// ─── Badge ───
function updateBadge(text = '') {
  chrome.action.setBadgeText({ text });
  chrome.action.setBadgeBackgroundColor({ color: text ? '#00B894' : '#6C5CE7' });
}

// ─── Utils ───
function getToday() { return new Date().toISOString().split('T')[0]; }


