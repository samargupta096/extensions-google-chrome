/**
 * CodeArmor — Enhanced Background Service Worker
 * Secret patterns, domain whitelist, custom patterns, vault, clipboard scan,
 * interception logging, browser notifications, stats
 */

// ─── Default Secret Patterns ───
const DEFAULT_PATTERNS = [
  { name: 'AWS Access Key', regex: 'AKIA[0-9A-Z]{16}', severity: 'critical', enabled: true },
  { name: 'AWS Secret Key', regex: '[0-9a-zA-Z/+]{40}', severity: 'critical', context: 'aws', enabled: true },
  { name: 'GitHub Token', regex: 'gh[pousr]_[A-Za-z0-9_]{36,}', severity: 'critical', enabled: true },
  { name: 'GitHub Classic', regex: 'ghp_[A-Za-z0-9]{36}', severity: 'critical', enabled: true },
  { name: 'OpenAI Key', regex: 'sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}', severity: 'critical', enabled: true },
  { name: 'OpenAI Key (new)', regex: 'sk-proj-[A-Za-z0-9_-]{40,}', severity: 'critical', enabled: true },
  { name: 'Stripe Secret', regex: 'sk_live_[0-9a-zA-Z]{24,}', severity: 'critical', enabled: true },
  { name: 'Stripe Publishable', regex: 'pk_live_[0-9a-zA-Z]{24,}', severity: 'high', enabled: true },
  { name: 'Slack Token', regex: 'xox[baprs]-[0-9]{10,13}-[0-9a-zA-Z-]{20,}', severity: 'critical', enabled: true },
  { name: 'Slack Webhook', regex: 'https://hooks\\.slack\\.com/services/T[A-Z0-9]+/B[A-Z0-9]+/[a-zA-Z0-9]+', severity: 'high', enabled: true },
  { name: 'Google API Key', regex: 'AIza[0-9A-Za-z_-]{35}', severity: 'high', enabled: true },
  { name: 'Firebase Key', regex: 'AAAA[A-Za-z0-9_-]{7}:[A-Za-z0-9_-]{140}', severity: 'high', enabled: true },
  { name: 'Twilio API Key', regex: 'SK[0-9a-fA-F]{32}', severity: 'high', enabled: true },
  { name: 'SendGrid API Key', regex: 'SG\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]{43}', severity: 'critical', enabled: true },
  { name: 'Mailgun API Key', regex: 'key-[0-9a-zA-Z]{32}', severity: 'high', enabled: true },
  { name: 'Discord Bot Token', regex: '[MN][A-Za-z0-9]{23,}\\.[A-Za-z0-9-_]{6}\\.[A-Za-z0-9-_]{27}', severity: 'critical', enabled: true },
  { name: 'Heroku API Key', regex: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', severity: 'medium', enabled: true },
  { name: 'JWT Token', regex: 'eyJ[A-Za-z0-9_-]*\\.eyJ[A-Za-z0-9_-]*\\.[A-Za-z0-9_-]*', severity: 'high', enabled: true },
  { name: 'Private Key', regex: '-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----', severity: 'critical', enabled: true },
  { name: 'SSH Private Key', regex: '-----BEGIN OPENSSH PRIVATE KEY-----', severity: 'critical', enabled: true },
  { name: 'NPM Token', regex: 'npm_[A-Za-z0-9]{36}', severity: 'high', enabled: true },
  { name: 'PyPI Token', regex: 'pypi-[A-Za-z0-9_-]{100,}', severity: 'high', enabled: true },
  { name: 'Anthropic Key', regex: 'sk-ant-[A-Za-z0-9_-]{40,}', severity: 'critical', enabled: true },
  { name: 'Supabase Key', regex: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+', severity: 'high', enabled: true },
  { name: 'Azure Key', regex: '[a-zA-Z0-9+/]{86}==', severity: 'high', enabled: true },
  { name: 'Vercel Token', regex: 'vercel_[A-Za-z0-9]{24,}', severity: 'high', enabled: true },
  { name: 'Cloudflare Key', regex: 'cf_[A-Za-z0-9]{37}', severity: 'high', enabled: true },
  { name: 'Digital Ocean', regex: 'dop_v1_[a-f0-9]{64}', severity: 'critical', enabled: true }
];

const DEFAULT_WHITELIST = ['localhost', '127.0.0.1', 'github.com', 'gitlab.com', 'bitbucket.org'];

// ─── Initialization ───
chrome.runtime.onInstalled.addListener(async () => {
  const { secretPatterns } = await chrome.storage.local.get('secretPatterns');
  if (!secretPatterns) {
    await chrome.storage.local.set({
      secretPatterns: DEFAULT_PATTERNS,
      customPatterns: [],
      interceptions: [],
      scanHistory: [],
      vaultEntries: [],
      domainWhitelist: DEFAULT_WHITELIST,
      settings: {
        enablePasteGuard: true,
        enablePageScan: true,
        showNotifications: true,
        showBadge: true
      }
    });
  }
  updateBadge();
  console.log('[CodeArmor] Installed with', DEFAULT_PATTERNS.length, 'secret patterns');
});

// ─── Message handling ───
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const handlers = {
    checkText: () => checkTextForSecrets(msg.text),
    logInterception: () => logInterception(msg.data),
    logScan: () => logScan(msg.data),
    getPatterns: () => chrome.storage.local.get(['secretPatterns', 'customPatterns']).then(r => r),
    getStats: () => getStats(),
    getSettings: () => chrome.storage.local.get('settings').then(r => r.settings || {}),
    updateSettings: () => chrome.storage.local.set({ settings: msg.settings }).then(() => ({ success: true })),
    addVaultEntry: () => addVaultEntry(msg.data),
    getVault: () => chrome.storage.local.get('vaultEntries').then(r => r.vaultEntries || []),
    deleteVaultEntry: () => deleteVaultEntry(msg.id),
    getWhitelist: () => chrome.storage.local.get('domainWhitelist').then(r => r.domainWhitelist || DEFAULT_WHITELIST),
    updateWhitelist: () => chrome.storage.local.set({ domainWhitelist: msg.domains }).then(() => ({ success: true })),
    addCustomPattern: () => addCustomPattern(msg.data),
    deleteCustomPattern: () => deleteCustomPattern(msg.id),
    togglePattern: () => togglePattern(msg.name, msg.enabled),
    getInterceptions: () => chrome.storage.local.get('interceptions').then(r => r.interceptions || []),
    clearHistory: () => chrome.storage.local.set({ interceptions: [] }).then(() => { updateBadge(); return { success: true }; }),
    exportData: () => exportData()
  };

  const handler = handlers[msg.action];
  if (handler) {
    handler().then(r => sendResponse(r));
    return true;
  }
});

// ─── Text checking ───
async function checkTextForSecrets(text) {
  const { secretPatterns = DEFAULT_PATTERNS, customPatterns = [] } = await chrome.storage.local.get(['secretPatterns', 'customPatterns']);
  const allPatterns = [...secretPatterns.filter(p => p.enabled !== false), ...customPatterns.filter(p => p.enabled !== false)];
  const found = [];

  for (const pattern of allPatterns) {
    try {
      const regex = new RegExp(pattern.regex, 'g');
      const matches = text.match(regex);
      if (matches) {
        for (const match of matches) {
          found.push({
            type: pattern.name,
            severity: pattern.severity,
            match: maskSecret(match),
            fullMatch: match
          });
        }
      }
    } catch (e) { /* Skip invalid regex */ }
  }

  // Check vault entries
  const { vaultEntries = [] } = await chrome.storage.local.get('vaultEntries');
  for (const entry of vaultEntries) {
    if (text.includes(entry.value)) {
      found.push({
        type: `Vault: ${entry.label}`,
        severity: 'critical',
        match: maskSecret(entry.value),
        fullMatch: entry.value,
        isVault: true
      });
    }
  }

  return { found, hasSecrets: found.length > 0 };
}

function maskSecret(str) {
  if (str.length <= 8) return '****';
  return str.slice(0, 4) + '•'.repeat(Math.min(str.length - 8, 20)) + str.slice(-4);
}

// ─── Custom Patterns ───
async function addCustomPattern(data) {
  const { customPatterns = [] } = await chrome.storage.local.get('customPatterns');
  // Validate regex
  try { new RegExp(data.regex); } catch (e) { return { success: false, error: 'Invalid regex' }; }

  customPatterns.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    name: data.name || 'Custom Pattern',
    regex: data.regex,
    severity: data.severity || 'high',
    enabled: true,
    isCustom: true,
    addedAt: Date.now()
  });
  await chrome.storage.local.set({ customPatterns });
  return { success: true };
}

async function deleteCustomPattern(id) {
  const { customPatterns = [] } = await chrome.storage.local.get('customPatterns');
  await chrome.storage.local.set({ customPatterns: customPatterns.filter(p => p.id !== id) });
  return { success: true };
}

async function togglePattern(name, enabled) {
  const { secretPatterns = [] } = await chrome.storage.local.get('secretPatterns');
  const idx = secretPatterns.findIndex(p => p.name === name);
  if (idx !== -1) {
    secretPatterns[idx].enabled = enabled;
    await chrome.storage.local.set({ secretPatterns });
  }
  return { success: true };
}

// ─── Logging ───
async function logInterception(data) {
  const { interceptions = [], settings = {} } = await chrome.storage.local.get(['interceptions', 'settings']);
  interceptions.unshift({ ...data, timestamp: Date.now() });
  if (interceptions.length > 500) interceptions.splice(500);
  await chrome.storage.local.set({ interceptions });

  // Browser notification
  if (settings.showNotifications) {
    chrome.notifications.create(`intercept-${Date.now()}`, {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '🛡️ Secret Blocked!',
      message: `CodeArmor blocked a ${data.type} from being exposed on ${data.domain}`,
      priority: 2
    });
  }

  updateBadge();
  return { success: true };
}

async function logScan(data) {
  const { scanHistory = [] } = await chrome.storage.local.get('scanHistory');
  scanHistory.unshift({ ...data, timestamp: Date.now() });
  if (scanHistory.length > 300) scanHistory.splice(300);
  await chrome.storage.local.set({ scanHistory });
  return { success: true };
}

// ─── Badge ───
async function updateBadge() {
  const { interceptions = [], settings = {} } = await chrome.storage.local.get(['interceptions', 'settings']);
  if (!settings.showBadge) {
    chrome.action.setBadgeText({ text: '' });
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  const todayCount = interceptions.filter(i =>
    new Date(i.timestamp).toISOString().split('T')[0] === today
  ).length;
  chrome.action.setBadgeText({ text: todayCount > 0 ? String(todayCount) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
}

// ─── Vault ───
async function addVaultEntry(data) {
  const { vaultEntries = [] } = await chrome.storage.local.get('vaultEntries');
  vaultEntries.push({
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    label: data.label || 'Unnamed Key',
    type: data.type || 'custom',
    value: data.value,
    addedAt: Date.now()
  });
  await chrome.storage.local.set({ vaultEntries });
  return { success: true };
}

async function deleteVaultEntry(id) {
  const { vaultEntries = [] } = await chrome.storage.local.get('vaultEntries');
  await chrome.storage.local.set({ vaultEntries: vaultEntries.filter(v => v.id !== id) });
  return { success: true };
}

// ─── Export ───
async function exportData() {
  const data = await chrome.storage.local.get(['interceptions', 'scanHistory', 'vaultEntries', 'customPatterns']);
  return {
    success: true,
    data: {
      exportDate: new Date().toISOString(),
      interceptions: data.interceptions || [],
      scanHistory: data.scanHistory || [],
      vaultEntries: (data.vaultEntries || []).map(v => ({ ...v, value: maskSecret(v.value) })),
      customPatterns: data.customPatterns || []
    }
  };
}

// ─── Stats ───
async function getStats() {
  const { interceptions = [], scanHistory = [], customPatterns = [], secretPatterns = DEFAULT_PATTERNS } = await chrome.storage.local.get(['interceptions', 'scanHistory', 'customPatterns', 'secretPatterns']);

  const today = new Date().toISOString().split('T')[0];
  const todayInterceptions = interceptions.filter(i =>
    new Date(i.timestamp).toISOString().split('T')[0] === today
  );

  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  const byType = {};
  const byDomain = {};

  for (const i of interceptions) {
    bySeverity[i.severity || 'medium'] = (bySeverity[i.severity || 'medium'] || 0) + 1;
    byType[i.type] = (byType[i.type] || 0) + 1;
    byDomain[i.domain || 'unknown'] = (byDomain[i.domain || 'unknown'] || 0) + 1;
  }

  // Last 7 days trend
  const last7 = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const key = date.toISOString().split('T')[0];
    const count = interceptions.filter(i =>
      new Date(i.timestamp).toISOString().split('T')[0] === key
    ).length;
    last7.push({ date: key, count });
  }

  // Top risky domains
  const topDomains = Object.entries(byDomain).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return {
    success: true,
    stats: {
      totalInterceptions: interceptions.length,
      todayInterceptions: todayInterceptions.length,
      totalScans: scanHistory.length,
      totalPatterns: secretPatterns.filter(p => p.enabled !== false).length + customPatterns.filter(p => p.enabled !== false).length,
      customPatternCount: customPatterns.length,
      bySeverity,
      byType,
      byDomain,
      last7,
      topDomains
    }
  };
}

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
