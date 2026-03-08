
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
 * DeepWork Guardian — Background Service Worker
 * Tracks active tab time, manages focus sessions, and handles distraction blocking
 */

// ============ Site Categories ============
const SITE_CATEGORIES = {
  'Development': ['github.com', 'gitlab.com', 'stackoverflow.com', 'developer.mozilla.org', 'docs.google.com', 'codepen.io', 'jsfiddle.net', 'repl.it', 'leetcode.com', 'hackerrank.com', 'npmjs.com', 'pypi.org', 'crates.io'],
  'Learning': ['udemy.com', 'coursera.org', 'edx.org', 'khanacademy.org', 'freecodecamp.org', 'pluralsight.com', 'medium.com', 'dev.to', 'hashnode.dev', 'wikipedia.org', 'youtube.com'],
  'Social Media': ['twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'reddit.com', 'linkedin.com', 'tiktok.com', 'snapchat.com', 'threads.net', 'mastodon.social', 'bsky.app'],
  'Communication': ['gmail.com', 'outlook.com', 'mail.google.com', 'slack.com', 'discord.com', 'telegram.org', 'web.whatsapp.com', 'teams.microsoft.com', 'zoom.us'],
  'Entertainment': ['netflix.com', 'primevideo.com', 'hotstar.com', 'twitch.tv', 'spotify.com', 'music.youtube.com', 'disneyplus.com', 'hulu.com'],
  'Shopping': ['amazon.com', 'amazon.in', 'flipkart.com', 'myntra.com', 'ebay.com', 'aliexpress.com', 'walmart.com', 'etsy.com'],
  'News': ['news.google.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'theguardian.com', 'reuters.com', 'techcrunch.com', 'theverge.com', 'arstechnica.com', 'hackernews.com', 'news.ycombinator.com'],
  'Finance': ['moneycontrol.com', 'zerodha.com', 'groww.in', 'tradingview.com', 'robinhood.com', 'finance.yahoo.com', 'coinbase.com', 'binance.com'],
  'Search': ['google.com', 'bing.com', 'duckduckgo.com', 'perplexity.ai', 'chatgpt.com', 'claude.ai'],
  'AI Tools': ['chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com', 'perplexity.ai', 'huggingface.co', 'replicate.com']
};

const DEFAULT_BLOCKED_SITES = [
  'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'reddit.com',
  'tiktok.com', 'netflix.com', 'twitch.tv', 'youtube.com'
];

// ============ State ============
let state = {
  isTracking: true,
  activeTabId: null,
  activeTabUrl: '',
  activeTabDomain: '',
  lastActiveTime: Date.now(),
  focusSession: null, // { startTime, duration, breakDuration, isBreak, pausedAt }
  blockedSites: [],
  isBlocking: false
};

// ============ Initialize ============
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['settings', 'blockedSites']);
  if (!data.settings) {
    await chrome.storage.local.set({
      settings: {
        trackingEnabled: true,
        focusDuration: 25 * 60, // 25 minutes
        breakDuration: 5 * 60,  // 5 minutes
        longBreakDuration: 15 * 60, // 15 minutes
        sessionsBeforeLongBreak: 4,
        tabLimit: 20,
        tabLimitEnabled: false,
        notificationsEnabled: true,
        idleThreshold: 120 // 2 minutes idle
      }
    });
  }
  if (!data.blockedSites) {
    await chrome.storage.local.set({ blockedSites: DEFAULT_BLOCKED_SITES });
  }

  state.blockedSites = data.blockedSites || DEFAULT_BLOCKED_SITES;
});

// ============ Tab Tracking ============
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return '';
  }
}

function categorize(domain) {
  for (const [category, sites] of Object.entries(SITE_CATEGORIES)) {
    if (sites.some(s => domain.includes(s) || s.includes(domain))) {
      return category;
    }
  }
  return 'Other';
}

function todayKey() {
  return new Date().toISOString().split('T')[0];
}

async function recordTime(domain, seconds) {
  if (!domain || seconds <= 0 || seconds > 300) return; // max 5min chunks

  const key = `time_${todayKey()}`;
  const catKey = `cat_${todayKey()}`;
  const visitKey = `visits_${todayKey()}`;

  const data = await chrome.storage.local.get([key, catKey, visitKey]);

  // Domain time
  const timeData = data[key] || {};
  timeData[domain] = (timeData[domain] || 0) + seconds;

  // Category time
  const category = categorize(domain);
  const catData = data[catKey] || {};
  catData[category] = (catData[category] || 0) + seconds;

  // Page visits counter
  const visitData = data[visitKey] || {};
  visitData[domain] = (visitData[domain] || 0);

  await chrome.storage.local.set({
    [key]: timeData,
    [catKey]: catData,
    [visitKey]: visitData
  });
}

async function recordVisit(domain) {
  if (!domain) return;
  const visitKey = `visits_${todayKey()}`;
  const data = await chrome.storage.local.get([visitKey]);
  const visitData = data[visitKey] || {};
  visitData[domain] = (visitData[domain] || 0) + 1;
  await chrome.storage.local.set({ [visitKey]: visitData });
}

function handleTabUpdate() {
  const now = Date.now();
  const elapsed = (now - state.lastActiveTime) / 1000;

  if (state.activeTabDomain && elapsed > 0) {
    recordTime(state.activeTabDomain, elapsed);
  }

  state.lastActiveTime = now;
}

// Track active tab changes
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  handleTabUpdate();

  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    state.activeTabId = activeInfo.tabId;
    state.activeTabUrl = tab.url || '';
    state.activeTabDomain = extractDomain(tab.url || '');
    recordVisit(state.activeTabDomain);
  } catch {}
});

// Track URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === state.activeTabId && changeInfo.url) {
    handleTabUpdate();
    state.activeTabUrl = changeInfo.url;
    const newDomain = extractDomain(changeInfo.url);
    if (newDomain !== state.activeTabDomain) {
      state.activeTabDomain = newDomain;
      recordVisit(newDomain);
    }
  }
});

// Track window focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    handleTabUpdate();
    state.activeTabDomain = '';
  } else {
    state.lastActiveTime = Date.now();
    chrome.tabs.query({ active: true, windowId }, (tabs) => {
      if (tabs[0]) {
        state.activeTabId = tabs[0].id;
        state.activeTabUrl = tabs[0].url || '';
        state.activeTabDomain = extractDomain(tabs[0].url || '');
      }
    });
  }
});

// Periodic time recording
chrome.alarms.create('recordTime', { periodInMinutes: 0.5 }); // every 30 seconds
chrome.alarms.create('focusTick', { periodInMinutes: 1 / 60 }); // every 1 second (approximately)

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'recordTime') {
    handleTabUpdate();
  }
  if (alarm.name === 'focusTick') {
    if (state.focusSession && !state.focusSession.pausedAt) {
      const elapsed = (Date.now() - state.focusSession.startTime) / 1000;
      const targetDuration = state.focusSession.isBreak
        ? state.focusSession.breakDuration
        : state.focusSession.duration;

      if (elapsed >= targetDuration) {
        // Session completed
        if (!state.focusSession.isBreak) {
          // Work session done → start break
          const settings = (await chrome.storage.local.get('settings')).settings;

          state.focusSession.completedSessions = (state.focusSession.completedSessions || 0) + 1;

          // Record completed focus session
          const sessKey = `sessions_${todayKey()}`;
          const sessData = (await chrome.storage.local.get(sessKey))[sessKey] || [];
          sessData.push({
            start: state.focusSession.startTime,
            end: Date.now(),
            duration: state.focusSession.duration,
            type: 'work'
          });
          await chrome.storage.local.set({ [sessKey]: sessData });

          if (settings.notificationsEnabled) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '../icons/icon128.png',
              title: '🎉 Focus Session Complete!',
              message: 'Great work! Time for a break.',
              priority: 2
            });
          }

          const isLongBreak = state.focusSession.completedSessions % settings.sessionsBeforeLongBreak === 0;

          state.focusSession.isBreak = true;
          state.focusSession.breakDuration = isLongBreak ? settings.longBreakDuration : settings.breakDuration;
          state.focusSession.startTime = Date.now();
          state.isBlocking = false;
        } else {
          // Break done → start new work session
          const settings = (await chrome.storage.local.get('settings')).settings;

          if (settings.notificationsEnabled) {
            chrome.notifications.create({
              type: 'basic',
              iconUrl: '../icons/icon128.png',
              title: '💪 Break Over!',
              message: 'Time to focus again. You got this!',
              priority: 2
            });
          }

          state.focusSession.isBreak = false;
          state.focusSession.startTime = Date.now();
          state.isBlocking = true;
        }
      }
    }
  }
});

// ============ Message Handler ============
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const msgKey = message.type || message.action;

  // Ignore messages we don't handle so other listeners can pick them up
  if (!msgKey) return false;

  (async () => {
    try {
      switch (msgKey) {
        case 'GET_STATE': {
          const data = await chrome.storage.local.get(['settings', 'blockedSites']);
          const timeKey = `time_${todayKey()}`;
          const catKey = `cat_${todayKey()}`;
          const visitKey = `visits_${todayKey()}`;
          const sessKey = `sessions_${todayKey()}`;
          const dayData = await chrome.storage.local.get([timeKey, catKey, visitKey, sessKey]);

          // Get tab count
          const tabs = await chrome.tabs.query({});

          sendResponse({
            focusSession: state.focusSession,
            isBlocking: state.isBlocking,
            settings: data.settings,
            blockedSites: data.blockedSites || [],
            todayTime: dayData[timeKey] || {},
            todayCategories: dayData[catKey] || {},
            todayVisits: dayData[visitKey] || {},
            todaySessions: dayData[sessKey] || [],
            tabCount: tabs.length,
            currentDomain: state.activeTabDomain
          });
          break;
        }

        case 'START_FOCUS': {
          const settings = (await chrome.storage.local.get('settings')).settings;
          state.focusSession = {
            startTime: Date.now(),
            duration: message.duration || settings.focusDuration,
            breakDuration: settings.breakDuration,
            isBreak: false,
            pausedAt: null,
            completedSessions: 0
          };
          state.isBlocking = true;
          state.blockedSites = (await chrome.storage.local.get('blockedSites')).blockedSites || [];
          sendResponse({ success: true, focusSession: state.focusSession });
          break;
        }

        case 'STOP_FOCUS': {
          if (state.focusSession && !state.focusSession.isBreak) {
            // Record partial session
            const sessKey = `sessions_${todayKey()}`;
            const sessData = (await chrome.storage.local.get(sessKey))[sessKey] || [];
            sessData.push({
              start: state.focusSession.startTime,
              end: Date.now(),
              duration: (Date.now() - state.focusSession.startTime) / 1000,
              type: 'work',
              completed: false
            });
            await chrome.storage.local.set({ [sessKey]: sessData });
          }
          state.focusSession = null;
          state.isBlocking = false;
          sendResponse({ success: true });
          break;
        }

        case 'PAUSE_FOCUS': {
          if (state.focusSession) {
            state.focusSession.pausedAt = Date.now();
            state.isBlocking = false;
          }
          sendResponse({ success: true });
          break;
        }

        case 'RESUME_FOCUS': {
          if (state.focusSession && state.focusSession.pausedAt) {
            const pausedDuration = Date.now() - state.focusSession.pausedAt;
            state.focusSession.startTime += pausedDuration;
            state.focusSession.pausedAt = null;
            if (!state.focusSession.isBreak) {
              state.isBlocking = true;
            }
          }
          sendResponse({ success: true });
          break;
        }

        case 'UPDATE_SETTINGS': {
          await chrome.storage.local.set({ settings: message.settings });
          sendResponse({ success: true });
          break;
        }

        case 'UPDATE_BLOCKED_SITES': {
          state.blockedSites = message.sites;
          await chrome.storage.local.set({ blockedSites: message.sites });
          sendResponse({ success: true });
          break;
        }

        case 'CHECK_BLOCKED': {
          const domain = extractDomain(message.url || '');
          const blocked = state.isBlocking && state.blockedSites.some(s =>
            domain.includes(s) || s.includes(domain)
          );
          sendResponse({ blocked });
          break;
        }

        case 'GET_HISTORY': {
          const days = message.days || 7;
          const history = {};
          for (let i = 0; i < days; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateKey = d.toISOString().split('T')[0];
            const tk = `time_${dateKey}`;
            const ck = `cat_${dateKey}`;
            const vk = `visits_${dateKey}`;
            const sk = `sessions_${dateKey}`;
            const hData = await chrome.storage.local.get([tk, ck, vk, sk]);
            history[dateKey] = {
              time: hData[tk] || {},
              categories: hData[ck] || {},
              visits: hData[vk] || {},
              sessions: hData[sk] || []
            };
          }
          sendResponse({ history });
          break;
        }

        // ── Ollama Fetch Relay (handles ollamaFetch from popup) ──
        case 'ollamaFetch': {
          const { url, options = {} } = message;
          if (!url || !url.startsWith('http://localhost:11434')) {
            sendResponse({ ok: false, error: 'Disallowed URL', data: null });
            break;
          }
          try {
            const res = await fetch(url, {
              method: options.method || 'GET',
              headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
              body: options.body || undefined,
            });
            let data = null;
            try { data = await res.json(); } catch (_) {}
            sendResponse({ ok: res.ok, status: res.status, data });
          } catch (err) {
            sendResponse({ ok: false, error: err.message, data: null });
          }
          break;
        }

        // ── Multi-Provider AI Fetch Relay (handles aiFetch from AIClient) ──
        case 'aiFetch': {
          const AI_ALLOWED_ORIGINS = [
            'http://localhost:11434',
            'https://api.openai.com',
            'https://api.anthropic.com',
            'https://api.cursor.com',
          ];
          const { url: aiUrl, options: aiOpts = {} } = message;
          const isAllowed = aiUrl && AI_ALLOWED_ORIGINS.some(origin => aiUrl.startsWith(origin));
          if (!isAllowed) {
            sendResponse({ ok: false, error: 'Disallowed URL', data: null });
            break;
          }
          try {
            const res = await fetch(aiUrl, {
              method: aiOpts.method || 'GET',
              headers: { 'Content-Type': 'application/json', ...(aiOpts.headers || {}) },
              body: aiOpts.body || undefined,
            });
            let data = null;
            try { data = await res.json(); } catch (_) {}
            sendResponse({ ok: res.ok, status: res.status, data });
          } catch (err) {
            sendResponse({ ok: false, error: err.message, data: null });
          }
          break;
        }

        default:
          // Unknown message — don't respond, let other listeners handle it
          return;
      }
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  return true; // async response
});

