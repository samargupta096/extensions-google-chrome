/**
 * GhostHunter — Enhanced Background Service Worker
 * Application tracking, follow-up reminders, stats, CSV export
 */

const REMINDER_ALARM = 'ghosthunter-reminders';
const REMINDER_CHECK_MINUTES = 60;

// ─── Init ───
chrome.runtime.onInstalled.addListener(() => {
  console.log('[GhostHunter] Installed');
  initStorage();
  chrome.alarms.create(REMINDER_ALARM, { periodInMinutes: REMINDER_CHECK_MINUTES });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REMINDER_ALARM) {
    checkFollowUpReminders();
  }
});

async function initStorage() {
  const { applications } = await chrome.storage.local.get('applications');
  if (!applications) {
    await chrome.storage.local.set({ applications: [], ghostStats: {}, ghostSignals: [] });
  }
}

// ─── Messages ───
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    addApplication: () => addApplication(msg.data),
    updateApplication: () => updateApplication(msg.id, msg.data),
    deleteApplication: () => deleteApplication(msg.id),
    getApplications: () => getApplications(),
    getStats: () => getStats(),
    reportGhostSignal: () => recordGhostSignal(msg.data),
    exportCSV: () => generateCSV(),
    setReminder: () => setReminder(msg.id, msg.reminderDate),
    clearReminder: () => clearReminder(msg.id),
    getTimeline: () => getTimeline()
  };

  const handler = handlers[msg.action];
  if (handler) {
    handler().then(r => sendResponse(r));
    return true;
  }
});

// ─── Application CRUD ───
async function addApplication(data) {
  const { applications = [] } = await chrome.storage.local.get('applications');
  const app = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    title: data.title || 'Untitled Position',
    company: data.company || 'Unknown Company',
    url: data.url || '',
    platform: data.platform || 'other',
    appliedDate: data.appliedDate || new Date().toISOString().split('T')[0],
    status: data.status || 'applied',
    ghostScore: data.ghostScore || 0,
    ghostSignals: data.ghostSignals || [],
    notes: data.notes || '',
    salary: data.salary || '',
    location: data.location || '',
    contactEmail: data.contactEmail || '',
    reminderDate: null,
    lastUpdated: Date.now(),
    statusHistory: [{ status: 'applied', date: Date.now() }]
  };

  applications.unshift(app);
  await chrome.storage.local.set({ applications });
  return { success: true, app };
}

async function updateApplication(id, updates) {
  const { applications = [] } = await chrome.storage.local.get('applications');
  const idx = applications.findIndex(a => a.id === id);
  if (idx === -1) return { success: false, error: 'Not found' };

  // Track status changes in history
  if (updates.status && updates.status !== applications[idx].status) {
    if (!applications[idx].statusHistory) applications[idx].statusHistory = [];
    applications[idx].statusHistory.push({ status: updates.status, date: Date.now() });
  }

  applications[idx] = { ...applications[idx], ...updates, lastUpdated: Date.now() };
  await chrome.storage.local.set({ applications });
  return { success: true };
}

async function deleteApplication(id) {
  const { applications = [] } = await chrome.storage.local.get('applications');
  await chrome.storage.local.set({ applications: applications.filter(a => a.id !== id) });
  return { success: true };
}

async function getApplications() {
  const { applications = [] } = await chrome.storage.local.get('applications');
  return { success: true, applications };
}

// ─── Reminders ───
async function setReminder(id, reminderDate) {
  const { applications = [] } = await chrome.storage.local.get('applications');
  const idx = applications.findIndex(a => a.id === id);
  if (idx === -1) return { success: false };

  applications[idx].reminderDate = reminderDate;
  await chrome.storage.local.set({ applications });
  return { success: true };
}

async function clearReminder(id) {
  return setReminder(id, null);
}

async function checkFollowUpReminders() {
  const { applications = [] } = await chrome.storage.local.get('applications');
  const now = Date.now();
  let updated = false;

  for (const app of applications) {
    if (app.reminderDate && new Date(app.reminderDate).getTime() <= now) {
      // Send notification
      chrome.notifications.create(`reminder-${app.id}`, {
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: '👻 Follow-up Reminder',
        message: `Time to follow up on "${app.title}" at ${app.company}`,
        priority: 2
      });

      // Clear the reminder
      app.reminderDate = null;
      updated = true;
    }
  }

  // Also check for apps that have been "applied" for 2+ weeks with no update
  for (const app of applications) {
    if (app.status === 'applied' && !app.reminderDate) {
      const appliedTime = new Date(app.appliedDate).getTime();
      const twoWeeks = 14 * 24 * 60 * 60 * 1000;
      if (now - appliedTime > twoWeeks && now - (app.lastNotified || 0) > twoWeeks) {
        chrome.notifications.create(`stale-${app.id}`, {
          type: 'basic',
          iconUrl: 'icons/icon128.png',
          title: '⏰ No Response After 2 Weeks',
          message: `"${app.title}" at ${app.company} — Consider following up or marking as ghosted`,
          priority: 1
        });
        app.lastNotified = now;
        updated = true;
      }
    }
  }

  if (updated) {
    await chrome.storage.local.set({ applications });
  }
}

// ─── Timeline ───
async function getTimeline() {
  const { applications = [] } = await chrome.storage.local.get('applications');

  const events = [];
  for (const app of applications) {
    events.push({
      type: 'applied',
      date: new Date(app.appliedDate).getTime(),
      title: app.title,
      company: app.company,
      appId: app.id
    });

    if (app.statusHistory) {
      for (const sh of app.statusHistory) {
        if (sh.status !== 'applied') {
          events.push({
            type: sh.status,
            date: sh.date,
            title: app.title,
            company: app.company,
            appId: app.id
          });
        }
      }
    }
  }

  events.sort((a, b) => b.date - a.date);
  return { success: true, events: events.slice(0, 50) };
}

// ─── CSV Export ───
async function generateCSV() {
  const { applications = [] } = await chrome.storage.local.get('applications');

  const headers = ['Title', 'Company', 'Platform', 'Status', 'Applied Date', 'Ghost Score', 'Salary', 'Location', 'URL', 'Notes'];
  const rows = applications.map(a => [
    `"${(a.title || '').replace(/"/g, '""')}"`,
    `"${(a.company || '').replace(/"/g, '""')}"`,
    a.platform || '',
    a.status || '',
    a.appliedDate || '',
    a.ghostScore || 0,
    `"${(a.salary || '').replace(/"/g, '""')}"`,
    `"${(a.location || '').replace(/"/g, '""')}"`,
    a.url || '',
    `"${(a.notes || '').replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  return { success: true, csv };
}

// ─── Stats ───
async function getStats() {
  const { applications = [], ghostSignals = [] } = await chrome.storage.local.get(['applications', 'ghostSignals']);

  const total = applications.length;
  const byStatus = {};
  const byPlatform = {};
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  let last30Days = 0;
  let totalSalaryApps = 0;

  for (const app of applications) {
    byStatus[app.status] = (byStatus[app.status] || 0) + 1;
    byPlatform[app.platform] = (byPlatform[app.platform] || 0) + 1;
    if (new Date(app.appliedDate).getTime() > thirtyDaysAgo) last30Days++;
    if (app.salary) totalSalaryApps++;
  }

  const ghosted = byStatus['ghosted'] || 0;
  const responded = (byStatus['interviewing'] || 0) + (byStatus['rejected'] || 0) + (byStatus['offered'] || 0);
  const responseRate = total > 0 ? Math.round((responded / total) * 100) : 0;
  const ghostRate = total > 0 ? Math.round((ghosted / total) * 100) : 0;
  const avgGhostScore = total > 0 ? Math.round(applications.reduce((s, a) => s + (a.ghostScore || 0), 0) / total) : 0;

  // Weekly application trend
  const weeklyTrend = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = Date.now() - (w + 1) * 7 * 24 * 60 * 60 * 1000;
    const weekEnd = Date.now() - w * 7 * 24 * 60 * 60 * 1000;
    const count = applications.filter(a => {
      const t = new Date(a.appliedDate).getTime();
      return t >= weekStart && t < weekEnd;
    }).length;
    weeklyTrend.push({ week: `Week ${4 - w}`, count });
  }

  return {
    success: true,
    stats: {
      total, byStatus, byPlatform, responseRate, ghostRate, avgGhostScore,
      last30DaysCount: last30Days, totalSignals: (ghostSignals || []).length,
      weeklyTrend, totalSalaryApps
    }
  };
}

// ─── Ghost signal recording ───
async function recordGhostSignal(data) {
  const { ghostSignals = [] } = await chrome.storage.local.get('ghostSignals');
  ghostSignals.push({ ...data, timestamp: Date.now() });
  if (ghostSignals.length > 500) ghostSignals.splice(0, ghostSignals.length - 500);
  await chrome.storage.local.set({ ghostSignals });
  return { success: true };
}
