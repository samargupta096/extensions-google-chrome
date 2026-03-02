/**
 * GitPulse — Enhanced Background Service Worker (Round 2)
 * GitHub API polling, batch actions, PR details, notifications, checklist
 */

const GITHUB_API = 'https://api.github.com';
let pollIntervalMinutes = 5;
const ALARM_NAME = 'gitpulse-poll';

// ─── Initialization ───
chrome.runtime.onInstalled.addListener(async () => {
  const { gpSettings = {} } = await chrome.storage.local.get('gpSettings');
  pollIntervalMinutes = parseInt(gpSettings.pollInterval) || 5;
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: pollIntervalMinutes });
  console.log('[GitPulse] Installed — polling every', pollIntervalMinutes, 'min');
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) fetchAllData();
});

// ─── GitHub API helpers ───
async function getToken() {
  const { githubToken } = await chrome.storage.local.get('githubToken');
  return githubToken || '';
}

async function githubFetch(endpoint, token) {
  if (!token) return null;
  try {
    const response = await fetch(`${GITHUB_API}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });
    if (!response.ok) {
      console.warn('[GitPulse] API error:', response.status, endpoint);
      return null;
    }
    return await response.json();
  } catch (err) {
    console.error('[GitPulse] Fetch error:', err.message);
    return null;
  }
}

// ─── Data fetching ───
async function fetchAllData() {
  const token = await getToken();
  if (!token) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }

  try {
    const user = await githubFetch('/user', token);
    if (!user) return;
    const username = user.login;

    // Parallel fetch all 3 categories
    const [reviewRequested, authored, mentioned] = await Promise.all([
      githubFetch(`/search/issues?q=is:open+is:pr+review-requested:${username}+archived:false&sort=updated&order=desc&per_page=30`, token),
      githubFetch(`/search/issues?q=is:open+is:pr+author:${username}+archived:false&sort=updated&order=desc&per_page=30`, token),
      githubFetch(`/search/issues?q=is:open+is:pr+mentions:${username}+-author:${username}+-review-requested:${username}+archived:false&sort=updated&order=desc&per_page=20`, token)
    ]);

    const reviewItems = (reviewRequested?.items || []).map(pr => parsePR(pr, 'review'));
    const authoredItems = (authored?.items || []).map(pr => parsePR(pr, 'authored'));
    const mentionedItems = (mentioned?.items || []).map(pr => parsePR(pr, 'mentioned'));

    // Fetch PR details (additions/deletions) for review PRs (top 10)
    const detailPromises = reviewItems.slice(0, 10).map(async (pr) => {
      const [owner, repo] = pr.repo.split('/');
      if (!owner || !repo) return pr;
      const details = await githubFetch(`/repos/${owner}/${repo}/pulls/${pr.number}`, token);
      if (details) {
        pr.additions = details.additions || 0;
        pr.deletions = details.deletions || 0;
        pr.changedFiles = details.changed_files || 0;
        pr.mergeable = details.mergeable;
        pr.reviewComments = details.review_comments || 0;
      }
      return pr;
    });
    await Promise.all(detailPromises);

    // Check for new reviews since last fetch (for notifications)
    const { prReview: prevReview = [], gpSettings = {} } = await chrome.storage.local.get(['prReview', 'gpSettings']);
    const prevIds = new Set(prevReview.map(p => p.id));
    const newReviews = reviewItems.filter(p => !prevIds.has(p.id));

    if (newReviews.length > 0 && gpSettings.notifications !== false) {
      chrome.notifications.create(`gitpulse-new-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: `🔍 ${newReviews.length} New Review Request${newReviews.length > 1 ? 's' : ''}`,
        message: newReviews.slice(0, 2).map(p => `${p.repo}: ${p.title}`).join('\n'),
        priority: 2
      });
    }

    await chrome.storage.local.set({
      prReview: reviewItems,
      prAuthored: authoredItems,
      prMentioned: mentionedItems,
      lastFetch: Date.now(),
      ghUsername: username,
      ghAvatar: user.avatar_url
    });

    const reviewCount = reviewItems.length;
    chrome.action.setBadgeText({ text: reviewCount > 0 ? String(reviewCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: reviewCount > 5 ? '#FF6B6B' : '#6C5CE7' });

    await trackVelocity(reviewItems.length);
    console.log('[GitPulse] Fetched:', reviewItems.length, 'review,', authoredItems.length, 'authored,', mentionedItems.length, 'mentioned');
  } catch (err) {
    console.error('[GitPulse] fetchAllData error:', err);
  }
}

function parsePR(pr, type) {
  const repoUrl = pr.repository_url || '';
  const repoParts = repoUrl.replace(GITHUB_API + '/repos/', '').split('/');
  const repoFullName = repoParts.length >= 2 ? repoParts.join('/') : 'unknown/repo';

  const createdAt = new Date(pr.created_at);
  const updatedAt = new Date(pr.updated_at);
  const now = new Date();
  const ageHours = Math.floor((now - createdAt) / (1000 * 60 * 60));
  const staleDays = Math.floor((now - updatedAt) / (1000 * 60 * 60 * 24));

  let urgency = 'normal';
  if (staleDays >= 7) urgency = 'stale';
  else if (ageHours < 4) urgency = 'fresh';
  else if (staleDays >= 3) urgency = 'aging';

  return {
    id: pr.id,
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    repo: repoFullName,
    author: pr.user?.login || 'unknown',
    authorAvatar: pr.user?.avatar_url || '',
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    ageHours,
    staleDays,
    urgency,
    isDraft: pr.draft || false,
    labels: (pr.labels || []).map(l => ({ name: l.name, color: l.color })),
    comments: pr.comments || 0,
    type,
    body: (pr.body || '').slice(0, 1000)
  };
}

// ─── Review velocity tracking ───
async function trackVelocity(reviewCount) {
  const { velocityData = {} } = await chrome.storage.local.get('velocityData');
  const today = new Date().toISOString().split('T')[0];
  if (!velocityData[today]) velocityData[today] = { pendingReviews: reviewCount, checksAt: [] };
  velocityData[today].pendingReviews = reviewCount;
  velocityData[today].checksAt.push(Date.now());

  const keys = Object.keys(velocityData).sort();
  if (keys.length > 30) {
    for (const k of keys.slice(0, keys.length - 30)) delete velocityData[k];
  }
  await chrome.storage.local.set({ velocityData });
}

// ─── Review checklist ───
async function getChecklist(prId) {
  const { reviewChecklists = {} } = await chrome.storage.local.get('reviewChecklists');
  return reviewChecklists[prId] || [];
}

async function saveChecklist(prId, items) {
  const { reviewChecklists = {} } = await chrome.storage.local.get('reviewChecklists');
  reviewChecklists[prId] = items;
  // Keep max 100 checklists
  const keys = Object.keys(reviewChecklists);
  if (keys.length > 100) {
    keys.sort().slice(0, keys.length - 100).forEach(k => delete reviewChecklists[k]);
  }
  await chrome.storage.local.set({ reviewChecklists });
}

// ─── Batch actions ───
async function batchMarkReviewed(prIds) {
  const { reviewHistory = [], prReview = [] } = await chrome.storage.local.get(['reviewHistory', 'prReview']);
  for (const id of prIds) {
    reviewHistory.push({ prId: id, reviewedAt: Date.now() });
  }
  if (reviewHistory.length > 200) reviewHistory.splice(0, reviewHistory.length - 200);
  const remaining = prReview.filter(p => !prIds.includes(p.id));
  await chrome.storage.local.set({ reviewHistory, prReview: remaining });
  chrome.action.setBadgeText({ text: remaining.length > 0 ? String(remaining.length) : '' });
  return { success: true, remaining: remaining.length };
}

// ─── Message handling ───
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'refresh') {
    fetchAllData().then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === 'setToken') {
    chrome.storage.local.set({ githubToken: msg.token }, () => {
      fetchAllData().then(() => sendResponse({ success: true }));
    });
    return true;
  }

  if (msg.action === 'clearToken') {
    chrome.storage.local.remove(['githubToken', 'prReview', 'prAuthored', 'prMentioned', 'ghUsername', 'ghAvatar'], () => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    });
    return true;
  }

  if (msg.action === 'markReviewed') {
    markPRReviewed(msg.prId).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === 'batchMarkReviewed') {
    batchMarkReviewed(msg.prIds).then(r => sendResponse(r));
    return true;
  }

  if (msg.action === 'getChecklist') {
    getChecklist(msg.prId).then(r => sendResponse(r));
    return true;
  }

  if (msg.action === 'saveChecklist') {
    saveChecklist(msg.prId, msg.items).then(() => sendResponse({ success: true }));
    return true;
  }

  if (msg.action === 'updatePollInterval') {
    pollIntervalMinutes = msg.interval || 5;
    chrome.alarms.clear(ALARM_NAME, () => {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: pollIntervalMinutes });
      sendResponse({ success: true });
    });
    return true;
  }
});

async function markPRReviewed(prId) {
  const { reviewHistory = [] } = await chrome.storage.local.get('reviewHistory');
  reviewHistory.push({ prId, reviewedAt: Date.now() });
  if (reviewHistory.length > 200) reviewHistory.splice(0, reviewHistory.length - 200);
  await chrome.storage.local.set({ reviewHistory });
}

// Initial fetch
fetchAllData();

// ─── Ollama Relay ─────────────────────────────────────────────────────────────
// Proxies fetch() calls from the popup context (which has CORS restrictions)
// through the service worker (which can fetch localhost freely).
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
