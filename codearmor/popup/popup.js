/**
 * CodeArmor — Enhanced Popup Controller
 * Dashboard, vault, manual scanner + clipboard scan, custom patterns,
 * domain whitelist, AI analysis, history search, export, settings
 */

const ollama = new OllamaClient();
const $ = (id) => document.getElementById(id);

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  await checkOllamaStatus();
  await loadDashboard();
  await loadProtectionScore();
  await loadVault();
  await loadPatterns();
  await loadSettings();
  await loadWhitelist();
  initEventListeners();
});


// ─── Ollama ───
async function checkOllamaStatus() {
  const available = await ollama.isAvailable();
  $('statusDot').className = `status-dot ${available ? 'online' : 'offline'}`;
  $('statusText').textContent = available ? 'AI Ready' : 'AI Offline';
}

// ─── Dashboard ───
async function loadDashboard() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getStats' }, (r) => {
      if (!r?.success) { resolve(); return; }
      const s = r.stats;
      $('statInterceptions').textContent = s.totalInterceptions;
      $('statScans').textContent = s.totalScans;
      $('statToday').textContent = s.todayInterceptions;
      renderTrendChart(s.last7);
      renderTypeChart(s.byType);
      loadRecentInterceptions();
      resolve();
    });
  });
}

// ─── Protection Score ───
async function loadProtectionScore() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getStats' }, async (r) => {
      const stats = r?.stats || {};
      const { settings = {}, vaultEntries = [], customPatterns = [] } = await chrome.storage.local.get(['settings', 'vaultEntries', 'customPatterns']);

      let score = 0;
      const good = [];
      const warn = [];

      // Scoring criteria
      if (settings.enablePasteGuard !== false) { score += 30; good.push('Paste Guard ✅'); }
      else warn.push('Paste Guard off ⚠️');

      if (settings.enablePageScan !== false) { score += 20; good.push('Page Scan ✅'); }
      else warn.push('Page Scan off');

      if (vaultEntries.length > 0) { score += 20; good.push(`${vaultEntries.length} Keys in Vault`); }
      else warn.push('Vault empty');

      if (customPatterns.length > 0) { score += 10; good.push('Custom Patterns'); }

      if (settings.showNotifications !== false) { score += 10; good.push('Notifications ✅'); }

      if (stats.totalInterceptions === 0) { score += 10; good.push('Clean history'); }
      else if (stats.totalInterceptions < 5) score += 5;

      // Cap at 100
      score = Math.min(100, score);

      // Render
      const numEl = $('scoreNumber'); const fgEl = $('scoreFg');
      const descEl = $('scoreDesc'); const itemsEl = $('scoreItems');

      numEl.textContent = score;
      fgEl.style.setProperty('--pct', score);
      fgEl.className = `score-fg ${score >= 75 ? 'score-good' : score >= 45 ? 'score-medium' : 'score-poor'}`;
      descEl.textContent = score >= 75 ? 'Well protected' : score >= 45 ? 'Moderate protection' : 'Needs attention';
      itemsEl.innerHTML = [
        ...good.map(g => `<span class="score-item score-item-good">${g}</span>`),
        ...warn.map(w => `<span class="score-item score-item-warn">${w}</span>`)
      ].join('');

      resolve();
    });
  });
}

function renderTrendChart(last7) {
  const canvas = $('trendChart');
  if (!canvas || !last7) return;
  const labels = last7.map(d => new Date(d.date).toLocaleDateString('en', { weekday: 'short' }));
  const values = last7.map(d => d.count);
  ChartUtils.barChart(canvas, {}, { labels, values, barColor: '#FF6B6B', formatValue: v => Math.round(v).toString(), barRadius: 4 });
}

function renderTypeChart(byType) {
  const canvas = $('typeChart');
  if (!canvas) return;
  const labels = Object.keys(byType || {});
  const values = Object.values(byType || {});
  if (labels.length === 0) { labels.push('No data'); values.push(0); }
  ChartUtils.doughnutChart(canvas, {}, { labels: labels.slice(0, 6), values: values.slice(0, 6), colors: ['#FF6B6B', '#FDCB6E', '#6C5CE7', '#00CEC9', '#FD79A8', '#00B894'], centerText: String(values.reduce((a, b) => a + b, 0)), centerSubText: 'total' });
}

async function loadRecentInterceptions(filter = '') {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getInterceptions' }, (interceptions) => {
      const container = $('recentList');
      const empty = $('recentEmpty');
      let recent = (interceptions || []).slice(0, 20);

      if (filter) {
        const q = filter.toLowerCase();
        recent = recent.filter(i => (i.type || '').toLowerCase().includes(q) || (i.domain || '').toLowerCase().includes(q));
      }

      if (recent.length === 0) {
        container.innerHTML = '';
        empty.style.display = '';
        resolve(); return;
      }

      empty.style.display = 'none';
      container.innerHTML = recent.map(i => `
        <div class="recent-item">
          <span class="recent-icon">${getSeverityIcon(i.severity)}</span>
          <div class="recent-info">
            <div class="recent-type">${escapeHtml(i.type)}</div>
            <div class="recent-domain">${escapeHtml(i.domain || '')} ${i.secretCount > 1 ? `(${i.secretCount} secrets)` : ''}</div>
          </div>
          <span class="recent-severity severity-${i.severity}">${(i.severity || '').toUpperCase()}</span>
          <span class="recent-time">${getTimeAgo(i.timestamp)}</span>
        </div>
      `).join('');
      resolve();
    });
  });
}

function getSeverityIcon(s) {
  return { critical: '🔴', high: '🟡', medium: '🔵', low: '⚪' }[s] || '⚪';
}

// ─── Vault ───
async function loadVault() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getVault' }, (entries) => {
      const container = $('vaultList');
      const empty = $('vaultEmpty');
      if (!entries || entries.length === 0) { container.innerHTML = ''; empty.style.display = ''; resolve(); return; }

      empty.style.display = 'none';
      container.innerHTML = entries.map(e => `
        <div class="vault-item" data-id="${e.id}">
          <div class="vault-item-info">
            <div class="vault-item-label">${escapeHtml(e.label)}</div>
            <div class="vault-item-type">${e.type}</div>
            <div class="vault-item-preview">${maskSecret(e.value)}</div>
          </div>
          <button class="vault-delete-btn" data-id="${e.id}">🗑️</button>
        </div>
      `).join('');

      container.querySelectorAll('.vault-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'deleteVaultEntry', id: btn.dataset.id }, () => {
            showToast('Removed', 'success');
            loadVault();
          });
        });
      });
      resolve();
    });
  });
}

function maskSecret(str) {
  if (!str) return '';
  if (str.length <= 8) return '••••';
  return str.slice(0, 4) + '•'.repeat(Math.min(str.length - 8, 12)) + str.slice(-4);
}

// ─── Patterns ───
async function loadPatterns(filter = '') {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getPatterns' }, (data) => {
      const builtIn = (data?.secretPatterns || []);
      const custom = (data?.customPatterns || []);
      const all = [...builtIn, ...custom];
      let filtered = all;

      if (filter) {
        const q = filter.toLowerCase();
        filtered = all.filter(p => p.name.toLowerCase().includes(q));
      }

      $('patternTotal').textContent = all.filter(p => p.enabled !== false).length;

      const container = $('patternList');
      container.innerHTML = filtered.map(p => `
        <div class="pattern-item">
          <label class="toggle" style="flex-shrink: 0;">
            <input type="checkbox" class="pattern-toggle" data-name="${escapeHtml(p.name)}" ${p.enabled !== false ? 'checked' : ''}>
            <span class="toggle-slider"></span>
          </label>
          <span class="pattern-name">${escapeHtml(p.name)}</span>
          ${p.isCustom ? '<span class="pattern-custom-tag">CUSTOM</span>' : ''}
          <span class="pattern-severity severity-${p.severity}">${(p.severity || '').toUpperCase()}</span>
          ${p.isCustom ? `<button class="action-btn-sm del-pattern" data-id="${p.id}" title="Delete">🗑️</button>` : ''}
        </div>
      `).join('');

      container.querySelectorAll('.pattern-toggle').forEach(toggle => {
        toggle.addEventListener('change', () => {
          chrome.runtime.sendMessage({ action: 'togglePattern', name: toggle.dataset.name, enabled: toggle.checked });
        });
      });

      container.querySelectorAll('.del-pattern').forEach(btn => {
        btn.addEventListener('click', () => {
          chrome.runtime.sendMessage({ action: 'deleteCustomPattern', id: btn.dataset.id }, () => {
            showToast('Pattern deleted', 'success');
            loadPatterns($('patternSearch').value);
          });
        });
      });
      resolve();
    });
  });
}

// ─── Whitelist ───
async function loadWhitelist() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getWhitelist' }, (domains) => {
      const container = $('whitelistDomains');
      if (!domains || domains.length === 0) { container.innerHTML = '<span style="font-size:11px;color:var(--text-tertiary)">No whitelisted domains</span>'; resolve(); return; }

      container.innerHTML = domains.map(d => `
        <span class="whitelist-tag">
          ${escapeHtml(d)}
          <button class="whitelist-remove" data-domain="${escapeHtml(d)}">✕</button>
        </span>
      `).join('');

      container.querySelectorAll('.whitelist-remove').forEach(btn => {
        btn.addEventListener('click', () => {
          const updated = domains.filter(dd => dd !== btn.dataset.domain);
          chrome.runtime.sendMessage({ action: 'updateWhitelist', domains: updated }, () => {
            showToast('Removed from whitelist', 'success');
            loadWhitelist();
          });
        });
      });
      resolve();
    });
  });
}

// ─── Scanner ───
async function scanText() {
  const text = $('scanInput').value.trim();
  const result = $('scanResult');
  if (!text) { showToast('Enter text to scan', 'error'); return; }

  result.style.display = '';
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'checkText', text }, (r) => {
      if (r?.hasSecrets) {
        result.className = 'scan-result found';
        result.innerHTML = `<div style="font-weight:700;margin-bottom:8px;color:var(--accent-red);">⚠️ ${r.found.length} Secret(s) Found!</div>` +
          r.found.map(s => `<div class="scan-found-item"><span class="recent-severity severity-${s.severity}">${s.severity.toUpperCase()}</span><strong>${escapeHtml(s.type)}</strong><span style="color:var(--text-tertiary);font-family:monospace;font-size:10px;">${escapeHtml(s.match)}</span></div>`).join('');
      } else {
        result.className = 'scan-result clean';
        result.innerHTML = '✅ No secrets detected. Text appears safe.';
      }
      resolve();
    });
  });
}

async function scanClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) { showToast('Clipboard is empty', 'error'); return; }
    $('scanInput').value = text;
    await scanText();
    showToast('Clipboard scanned!', 'success');
  } catch (err) {
    showToast('Clipboard access denied', 'error');
  }
}

// ─── Regex Tester ───
function testRegex() {
  const pattern = $('regexPattern').value.trim();
  const text = $('regexTestText').value.trim();
  const result = $('regexResult');
  result.style.display = '';

  if (!pattern) { result.className = 'scan-result found'; result.innerHTML = '⚠️ Enter a regex pattern'; return; }
  if (!text) { result.className = 'scan-result found'; result.innerHTML = '⚠️ Enter test text'; return; }

  try {
    const regex = new RegExp(pattern, 'g');
    const matches = [...text.matchAll(regex)];

    if (matches.length === 0) {
      result.className = 'scan-result clean';
      result.innerHTML = '✅ No matches found. Pattern does not match.';
      return;
    }

    result.className = 'scan-result found';
    // Highlight matches in text
    let highlighted = escapeHtml(text);
    const safePattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, (m) => `\\${m}`);
    try {
      const hlRegex = new RegExp(`(${pattern})`, 'g');
      highlighted = escapeHtml(text).replace(
        new RegExp(`(${escapeHtml(pattern)})`, 'g'),
        (m) => `<mark style="background:rgba(255,107,107,0.3);color:white;border-radius:2px;">${m}</mark>`
      );
      // Re-apply without escaping the source text
      highlighted = text.replace(hlRegex, (m) => `<mark style="background:rgba(255,107,107,0.3);color:white;border-radius:2px;padding:0 2px;">${escapeHtml(m)}</mark>`);
    } catch(_) {}

    result.innerHTML = `
      <div style="font-weight:700;margin-bottom:8px;color:var(--accent-red);">🎯 ${matches.length} match${matches.length > 1 ? 'es' : ''}</div>
      <div style="margin-bottom:8px;">
        <strong>Matches:</strong><br>
        ${matches.slice(0, 10).map((m, i) => `<code style="display:block;padding:2px 0;font-size:10px;color:var(--accent-yellow);">[${i+1}] ${escapeHtml(m[0])}</code>`).join('')}
        ${matches.length > 10 ? `<span style="font-size:10px;color:var(--text-tertiary)">+${matches.length - 10} more...</span>` : ''}
      </div>
      <div style="font-size:11px;color:var(--text-tertiary);word-break:break-all;line-height:1.6;">${highlighted}</div>
    `;
  } catch (e) {
    result.className = 'scan-result found';
    result.innerHTML = `⚠️ Invalid regex: ${escapeHtml(e.message)}`;
  }
}

async function aiAnalyze() {
  const text = $('aiInput').value.trim();
  const result = $('aiResult');
  if (!text) { showToast('Enter text for AI analysis', 'error'); return; }

  result.style.display = '';
  result.className = 'scan-result ai-result';
  result.innerHTML = '<div class="loading-state"><span class="spinner"></span><span>Analyzing...</span></div>';

  const prompt = `You are a cybersecurity expert. Analyze this text for potential exposed secrets, API keys, tokens, credentials:

${text.slice(0, 2000)}

Provide:
1. **Secrets Found**: List any API keys, tokens, passwords (type + masked preview)
2. **Risk Assessment**: Low/Medium/High/Critical
3. **Recommendations**: What to do if these are real credentials
4. **False Positives**: Note if any matches might be examples
Be concise.`;

  const response = await ollama.generate(prompt, { temperature: 0.2, maxTokens: 600 });
  result.innerHTML = response.success ? escapeHtml(response.text) : '⚠️ AI unavailable. Make sure Ollama is running.';
}

// ─── Settings ───
async function loadSettings() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (s) => {
      if (s) {
        $('togglePasteGuard').checked = s.enablePasteGuard !== false;
        $('togglePageScan').checked = s.enablePageScan !== false;
        $('toggleNotifications').checked = s.showNotifications !== false;
        $('toggleBadge').checked = s.showBadge !== false;
      }
      resolve();
    });
  });
}

function saveSettings() {
  const settings = {
    enablePasteGuard: $('togglePasteGuard').checked,
    enablePageScan: $('togglePageScan').checked,
    showNotifications: $('toggleNotifications').checked,
    showBadge: $('toggleBadge').checked
  };
  chrome.runtime.sendMessage({ action: 'updateSettings', settings });
}

// ─── Export ───
function exportData() {
  chrome.runtime.sendMessage({ action: 'exportData' }, (r) => {
    if (!r?.success) { showToast('Export failed', 'error'); return; }
    const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `codearmor-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported!', 'success');
  });
}

// ─── Event Listeners ───
function initEventListeners() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
      tab.classList.add('active');
      $(`tab-${tab.dataset.tab}`).style.display = '';
    });
  });

  // Vault
  $('addVaultBtn').addEventListener('click', () => {
    const label = $('vaultLabel').value.trim();
    const value = $('vaultValue').value.trim();
    const type = $('vaultType').value;
    if (!label || !value) { showToast('Label and value required', 'error'); return; }
    chrome.runtime.sendMessage({ action: 'addVaultEntry', data: { label, value, type } }, (r) => {
      if (r?.success) { showToast('Added to vault!', 'success'); $('vaultLabel').value = ''; $('vaultValue').value = ''; loadVault(); }
    });
  });

  // Scanner
  $('scanBtn').addEventListener('click', scanText);
  $('clipboardBtn').addEventListener('click', scanClipboard);
  $('aiScanBtn').addEventListener('click', aiAnalyze);
  $('testRegexBtn').addEventListener('click', testRegex);
  $('regexPattern').addEventListener('keydown', (e) => { if (e.key === 'Enter') testRegex(); });

  // Custom patterns
  $('addPatternBtn').addEventListener('click', () => {
    const name = $('patternName').value.trim();
    const regex = $('patternRegex').value.trim();
    const severity = $('patternSeverity').value;
    if (!name || !regex) { showToast('Name and regex required', 'error'); return; }
    try { new RegExp(regex); } catch (e) { showToast('Invalid regex', 'error'); return; }
    chrome.runtime.sendMessage({ action: 'addCustomPattern', data: { name, regex, severity } }, (r) => {
      if (r?.success) { showToast('Pattern added!', 'success'); $('patternName').value = ''; $('patternRegex').value = ''; loadPatterns(); }
      else showToast(r?.error || 'Failed', 'error');
    });
  });

  // Pattern search
  let ptTimeout;
  $('patternSearch').addEventListener('input', (e) => {
    clearTimeout(ptTimeout);
    ptTimeout = setTimeout(() => loadPatterns(e.target.value.trim()), 200);
  });

  // History search
  let hsTimeout;
  $('historySearch').addEventListener('input', (e) => {
    clearTimeout(hsTimeout);
    hsTimeout = setTimeout(() => loadRecentInterceptions(e.target.value.trim()), 200);
  });

  // Clear history
  $('clearHistory').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'clearHistory' }, () => {
      showToast('History cleared', 'success');
      loadDashboard();
    });
  });

  // Export
  $('exportBtn').addEventListener('click', exportData);

  // Settings
  ['togglePasteGuard', 'togglePageScan', 'toggleNotifications', 'toggleBadge'].forEach(id => {
    $(id).addEventListener('change', () => { saveSettings(); showToast('Saved', 'success'); });
  });

  // Whitelist
  $('addWhitelistBtn').addEventListener('click', () => {
    const domain = $('whitelistInput').value.trim().toLowerCase();
    if (!domain) return;
    chrome.runtime.sendMessage({ action: 'getWhitelist' }, (existing) => {
      const updated = [...(existing || []), domain];
      chrome.runtime.sendMessage({ action: 'updateWhitelist', domains: [...new Set(updated)] }, () => {
        $('whitelistInput').value = '';
        showToast('Domain whitelisted', 'success');
        loadWhitelist();
      });
    });
  });
}

// ─── Utilities ───
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function getTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}


// --- Global Model Selector ---
async function initGlobalModelSelector() {
  const select = document.getElementById('globalModelSelect');
  if (!select) return;

  try {
    const models = await ollama.listModels();
    if (!models || models.length === 0) {
      select.style.display = 'none';
      return;
    }
    
    select.style.display = ''; // show it
    const local = await chrome.storage.local.get('settings');
    const settings = local.settings || {};
    const savedModel = settings.defaultModel || ollama.defaultModel || 'llama3.2';

    select.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    if (models.some(m => m.name === savedModel)) {
      select.value = savedModel;
    } else {
      select.value = models[0].name;
      await chrome.storage.local.set({ settings: { ...settings, defaultModel: select.value } });
    }

    select.addEventListener('change', async (e) => {
      const current = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(current.settings || {}), defaultModel: e.target.value } });
    });
  } catch(e) { console.error('Failed to init model selector', e); }
}

// Auto-run after DOM load and status check
setTimeout(initGlobalModelSelector, 500);
