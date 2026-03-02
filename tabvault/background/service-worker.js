/**
 * TabVault — Background Service Worker
 * Manages named tab sessions, stale tab detection, memory estimation
 */

const STALE_DAYS = 7;
const STALE_CHECK_HOURS = 6;

// ─── Lifecycle ───
chrome.runtime.onInstalled.addListener(async () => {
  const { tabSessions } = await chrome.storage.local.get('tabSessions');
  if (!tabSessions) await chrome.storage.local.set({ tabSessions: {}, tabOpenTimes: {} });
  chrome.alarms.create('staleCheck', { periodInMinutes: STALE_CHECK_HOURS * 60 });
  chrome.alarms.create('trackNewTabs', { periodInMinutes: 5 });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'staleCheck') await checkStaleTabs();
  if (alarm.name === 'trackNewTabs') await trackTabOpenTimes();
});

// Track when tabs are first opened
chrome.tabs.onCreated.addListener(async (tab) => {
  const { tabOpenTimes = {} } = await chrome.storage.local.get('tabOpenTimes');
  tabOpenTimes[tab.id] = { url: tab.url, openedAt: Date.now() };
  await chrome.storage.local.set({ tabOpenTimes });
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { tabOpenTimes = {} } = await chrome.storage.local.get('tabOpenTimes');
  delete tabOpenTimes[tabId];
  await chrome.storage.local.set({ tabOpenTimes });
});

// ─── Message Handler ───
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.action === 'saveSession') handleSaveSession(msg.name, msg.tabIds, send);
  else if (msg.action === 'restoreSession') handleRestoreSession(msg.sessionId, send);
  else if (msg.action === 'deleteSession') handleDeleteSession(msg.sessionId, send);
  else if (msg.action === 'getSessions') handleGetSessions(send);
  else if (msg.action === 'getCurrentTabs') handleGetCurrentTabs(send);
  else if (msg.action === 'getStaleTabs') handleGetStaleTabs(send);
  else if (msg.action === 'closeTab') handleCloseTab(msg.tabId, send);
  else if (msg.action === 'closeSession') handleCloseSession(msg.sessionId, send);
  else if (msg.action === 'renameSession') handleRenameSession(msg.sessionId, msg.name, send);
  else if (msg.action === 'exportSession') handleExportSession(msg.sessionId, send);
  return true;
});

// ─── Save Session ───
async function handleSaveSession(name, specificTabIds, send) {
  let tabs;
  if (specificTabIds) {
    tabs = await Promise.all(specificTabIds.map(id => chrome.tabs.get(id)));
  } else {
    tabs = await chrome.tabs.query({ currentWindow: true });
  }

  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  const sessionId = `session_${Date.now()}`;
  const sessionTabs = tabs
    .filter(t => t.url && !t.url.startsWith('chrome://') && !t.url.startsWith('chrome-extension://'))
    .map(t => ({
      url: t.url, title: t.title || t.url, favIconUrl: t.favIconUrl || '',
      pinned: t.pinned || false
    }));

  const domain = getDomainGroups(sessionTabs);
  const estimatedRamMB = Math.round(sessionTabs.length * 22); // ~22MB per tab estimate

  tabSessions[sessionId] = {
    id: sessionId, name: name || `Session ${Object.keys(tabSessions).length + 1}`,
    tabs: sessionTabs, tabCount: sessionTabs.length, createdAt: Date.now(),
    estimatedRamMB, domainGroups: domain, aiSummary: null
  };

  await chrome.storage.local.set({ tabSessions });
  send({ success: true, sessionId, tabCount: sessionTabs.length });
}

// ─── Restore Session ───
async function handleRestoreSession(sessionId, send) {
  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  const session = tabSessions[sessionId];
  if (!session) { send({ success: false, error: 'Session not found' }); return; }

  const window = await chrome.windows.create({ url: session.tabs[0].url });
  for (let i = 1; i < session.tabs.length; i++) {
    await chrome.tabs.create({ windowId: window.id, url: session.tabs[i].url });
  }

  // Update last restored
  tabSessions[sessionId].lastRestoredAt = Date.now();
  await chrome.storage.local.set({ tabSessions });
  send({ success: true });
}

// ─── Close All Tabs in Session ───
async function handleCloseSession(sessionId, send) {
  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  const session = tabSessions[sessionId];
  if (!session) { send({ success: false }); return; }

  const tabs = await chrome.tabs.query({ currentWindow: true });
  const sessionUrls = new Set(session.tabs.map(t => t.url));
  const toClose = tabs.filter(t => sessionUrls.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  send({ success: true, closed: toClose.length });
}

// ─── Delete Session ───
async function handleDeleteSession(sessionId, send) {
  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  delete tabSessions[sessionId];
  await chrome.storage.local.set({ tabSessions });
  send({ success: true });
}

// ─── Rename Session ───
async function handleRenameSession(sessionId, name, send) {
  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  if (tabSessions[sessionId]) { tabSessions[sessionId].name = name; await chrome.storage.local.set({ tabSessions }); }
  send({ success: true });
}

// ─── Get Sessions ───
async function handleGetSessions(send) {
  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  const sessions = Object.values(tabSessions).sort((a, b) => b.createdAt - a.createdAt);
  const totalSaved = sessions.length;
  const totalTabs = sessions.reduce((s, sess) => s + sess.tabCount, 0);
  send({ success: true, sessions, totalSaved, totalTabs });
}

// ─── Get Current Tabs ───
async function handleGetCurrentTabs(send) {
  const [tabs, { tabOpenTimes = {} }] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.storage.local.get('tabOpenTimes')
  ]);

  const now = Date.now();
  const enrichedTabs = tabs
    .filter(t => t.url && !t.url.startsWith('chrome://'))
    .map(t => {
      const openInfo = tabOpenTimes[t.id] || {};
      const openedAt = openInfo.openedAt || now;
      const daysOpen = Math.floor((now - openedAt) / (1000 * 60 * 60 * 24));
      return { id: t.id, url: t.url, title: t.title, favIconUrl: t.favIconUrl,
        daysOpen, isStale: daysOpen >= STALE_DAYS, pinned: t.pinned };
    });

  const domainGroups = getDomainGroups(enrichedTabs);
  const estimatedRamMB = Math.round(enrichedTabs.length * 22);
  const staleTabs = enrichedTabs.filter(t => t.isStale);

  send({ success: true, tabs: enrichedTabs, count: enrichedTabs.length,
    estimatedRamMB, domainGroups, staleCount: staleTabs.length });
}

// ─── Stale Tabs ───
async function handleGetStaleTabs(send) {
  const [tabs, { tabOpenTimes = {} }] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.storage.local.get('tabOpenTimes')
  ]);
  const now = Date.now();
  const staleTabs = tabs.filter(t => {
    const openInfo = tabOpenTimes[t.id];
    if (!openInfo) return false;
    return (now - openInfo.openedAt) >= STALE_DAYS * 24 * 60 * 60 * 1000;
  }).map(t => ({ id: t.id, url: t.url, title: t.title, daysOpen: Math.floor((now - tabOpenTimes[t.id].openedAt) / 86400000) }));
  send({ success: true, staleTabs });
}

async function checkStaleTabs() {
  const { tabs: staleTabs } = await new Promise(resolve =>
    chrome.runtime.sendMessage({ action: 'getStaleTabs' }, resolve).catch(() => resolve({ tabs: [] }))
  );
  if (staleTabs?.length >= 5) {
    chrome.notifications.create({ type: 'basic', iconUrl: '../icons/icon48.png',
      title: '📚 TabVault: Stale tabs detected',
      message: `You have ${staleTabs.length} tabs open for ${STALE_DAYS}+ days. Save them as a session?` });
  }
}

async function trackTabOpenTimes() {
  const [tabs, { tabOpenTimes = {} }] = await Promise.all([
    chrome.tabs.query({}),
    chrome.storage.local.get('tabOpenTimes')
  ]);
  const now = Date.now();
  for (const tab of tabs) {
    if (!tabOpenTimes[tab.id]) tabOpenTimes[tab.id] = { url: tab.url, openedAt: now };
  }
  await chrome.storage.local.set({ tabOpenTimes });
}

// ─── Close Single Tab ───
async function handleCloseTab(tabId, send) {
  await chrome.tabs.remove(tabId);
  send({ success: true });
}

// ─── Export Session ───
async function handleExportSession(sessionId, send) {
  const { tabSessions = {} } = await chrome.storage.local.get('tabSessions');
  const session = tabSessions[sessionId];
  if (!session) { send({ success: false }); return; }
  const md = `# ${session.name}\n\nSaved: ${new Date(session.createdAt).toLocaleDateString()}\n${session.tabs.length} tabs\n\n${session.tabs.map(t => `- [${t.title}](${t.url})`).join('\n')}`;
  send({ success: true, markdown: md });
}

// ─── Domain Grouping ───
function getDomainGroups(tabs) {
  const groups = {};
  for (const tab of tabs) {
    try {
      const url = new URL(tab.url);
      const domain = url.hostname.replace('www.', '');
      if (!groups[domain]) groups[domain] = { domain, count: 0, tabs: [] };
      groups[domain].count++;
      groups[domain].tabs.push({ title: tab.title, url: tab.url });
    } catch (_) {}
  }
  return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 10);
}
