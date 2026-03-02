/**
 * StandupScribe — Background Service Worker
 * Tracks time per domain, logs tab visits, provides data for AI standup draft
 */

const TRACK_INTERVAL_MINUTES = 1;
const MAX_SESSION_DAYS = 14;

// ─── Lifecycle ───
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('trackTime', { periodInMinutes: TRACK_INTERVAL_MINUTES });
  chrome.alarms.create('dailyReset', { periodInMinutes: 60 });
  initStorage();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'trackTime') await trackActiveTab();
  if (alarm.name === 'dailyReset') await checkDailyReset();
});

async function initStorage() {
  const { sessions } = await chrome.storage.local.get('sessions');
  if (!sessions) await chrome.storage.local.set({ sessions: {}, todayLog: getEmptyDayLog() });
}

// ─── Time Tracking ───
async function trackActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0] || !tabs[0].url) return;
  const tab = tabs[0];
  const url = new URL(tab.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const domain = url.hostname.replace('www.', '');
  const today = getToday();
  const { sessions = {}, todayLog = getEmptyDayLog() } = await chrome.storage.local.get(['sessions', 'todayLog']);

  // Init today's session
  if (!sessions[today]) sessions[today] = { date: today, domains: {}, visits: [], totalMinutes: 0 };
  const daySession = sessions[today];

  // Track domain time
  if (!daySession.domains[domain]) daySession.domains[domain] = { minutes: 0, title: getDomainLabel(domain, url) };
  daySession.domains[domain].minutes += TRACK_INTERVAL_MINUTES;
  daySession.totalMinutes += TRACK_INTERVAL_MINUTES;

  // Add visit if new URL
  const lastVisit = daySession.visits[daySession.visits.length - 1];
  if (!lastVisit || lastVisit.url !== tab.url) {
    daySession.visits.push({
      url: tab.url, title: tab.title || domain, domain,
      timestamp: Date.now(), minutesSpent: 0
    });
  } else {
    lastVisit.minutesSpent += TRACK_INTERVAL_MINUTES;
  }

  // Prune old sessions
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - MAX_SESSION_DAYS);
  for (const key of Object.keys(sessions)) {
    if (new Date(key) < cutoff) delete sessions[key];
  }

  await chrome.storage.local.set({ sessions, todayLog });
}

function getDomainLabel(domain, url) {
  const known = {
    'github.com': 'GitHub', 'gitlab.com': 'GitLab', 'jira.atlassian.net': 'Jira',
    'linear.app': 'Linear', 'notion.so': 'Notion', 'docs.google.com': 'Google Docs',
    'stackoverflow.com': 'Stack Overflow', 'slack.com': 'Slack', 'figma.com': 'Figma',
    'vercel.app': 'Vercel', 'netlify.app': 'Netlify'
  };
  return known[domain] || domain;
}

// ─── Daily Reset ───
async function checkDailyReset() {
  const { lastResetDate } = await chrome.storage.local.get('lastResetDate');
  const today = getToday();
  if (lastResetDate === today) return;
  await chrome.storage.local.set({ lastResetDate: today, todayLog: getEmptyDayLog() });
}

function getEmptyDayLog() {
  return { date: getToday(), manualBullets: [], blockers: [] };
}

// ─── Message Handler ───
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.action === 'getTodayData') handleGetTodayData(send);
  else if (msg.action === 'getHistory') handleGetHistory(msg.days, send);
  else if (msg.action === 'addBullet') handleAddBullet(msg.bullet, msg.type, send);
  else if (msg.action === 'saveDraft') handleSaveDraft(msg.draft, send);
  else if (msg.action === 'getDraft') handleGetDraft(send);
  else if (msg.action === 'clearToday') handleClearToday(send);
  return true;
});

async function handleGetTodayData(send) {
  const today = getToday();
  const { sessions = {}, todayLog = {} } = await chrome.storage.local.get(['sessions', 'todayLog']);
  const dayData = sessions[today] || { date: today, domains: {}, visits: [], totalMinutes: 0 };

  // Sort domains by time
  const topDomains = Object.entries(dayData.domains)
    .sort((a, b) => b[1].minutes - a[1].minutes)
    .slice(0, 10)
    .map(([domain, data]) => ({ domain, ...data }));

  // Get recent visits (last 30, deduplicated by title)
  const seen = new Set();
  const recentVisits = dayData.visits.filter(v => {
    if (seen.has(v.title)) return false;
    seen.add(v.title); return true;
  }).slice(-30);

  send({
    success: true, date: today, topDomains, recentVisits,
    totalMinutes: dayData.totalMinutes, manualBullets: todayLog.manualBullets || [],
    blockers: todayLog.blockers || []
  });
}

async function handleGetHistory(days = 7, send) {
  const { sessions = {} } = await chrome.storage.local.get('sessions');
  const result = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    if (sessions[key]) result.push(sessions[key]);
  }
  send({ success: true, history: result });
}

async function handleAddBullet(bullet, type, send) {
  const { todayLog = getEmptyDayLog() } = await chrome.storage.local.get('todayLog');
  if (type === 'blocker') todayLog.blockers = [...(todayLog.blockers || []), bullet];
  else todayLog.manualBullets = [...(todayLog.manualBullets || []), bullet];
  await chrome.storage.local.set({ todayLog });
  send({ success: true });
}

async function handleSaveDraft(draft, send) {
  const today = getToday();
  const { drafts = {} } = await chrome.storage.local.get('drafts');
  drafts[today] = { ...draft, savedAt: Date.now() };
  // Keep 14 days of drafts
  const keys = Object.keys(drafts).sort();
  while (keys.length > 14) { delete drafts[keys.shift()]; }
  await chrome.storage.local.set({ drafts });
  send({ success: true });
}

async function handleGetDraft(send) {
  const today = getToday();
  const { drafts = {} } = await chrome.storage.local.get('drafts');
  send({ success: true, draft: drafts[today] || null, allDrafts: drafts });
}

async function handleClearToday(send) {
  await chrome.storage.local.set({ todayLog: getEmptyDayLog() });
  send({ success: true });
}

// ─── Utils ───
function getToday() { return new Date().toISOString().split('T')[0]; }

// ─── Ollama Relay ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action !== 'ollamaFetch') return false;
  const { url, options = {} } = msg;
  if (!url || !url.startsWith('http://localhost:11434')) {
    sendResponse({ ok: false, error: 'Disallowed URL', data: null });
    return true;
  }
  fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body || undefined,
  })
    .then(async (res) => {
      let data = null;
      try { data = await res.json(); } catch (_) {}
      sendResponse({ ok: res.ok, status: res.status, data });
    })
    .catch((err) => sendResponse({ ok: false, error: err.message, data: null }));
  return true;
});
