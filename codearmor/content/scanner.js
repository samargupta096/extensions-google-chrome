/**
 * CodeArmor — Enhanced Content Script (Secret Scanner)
 * Paste guard with domain whitelist, page scanner, warning modal
 */

(function () {
  'use strict';

  const QUICK_PATTERNS = [
    { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
    { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: 'critical' },
    { name: 'OpenAI Key', regex: /sk-proj-[A-Za-z0-9_-]{40,}/g, severity: 'critical' },
    { name: 'OpenAI Key (old)', regex: /sk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}/g, severity: 'critical' },
    { name: 'Stripe Secret', regex: /sk_live_[0-9a-zA-Z]{24,}/g, severity: 'critical' },
    { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9a-zA-Z-]{20,}/g, severity: 'critical' },
    { name: 'Google API Key', regex: /AIza[0-9A-Za-z_-]{35}/g, severity: 'high' },
    { name: 'SendGrid Key', regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g, severity: 'critical' },
    { name: 'Discord Bot Token', regex: /[MN][A-Za-z0-9]{23,}\.[A-Za-z0-9-_]{6}\.[A-Za-z0-9-_]{27}/g, severity: 'critical' },
    { name: 'Private Key', regex: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g, severity: 'critical' },
    { name: 'SSH Key', regex: /-----BEGIN OPENSSH PRIVATE KEY-----/g, severity: 'critical' },
    { name: 'NPM Token', regex: /npm_[A-Za-z0-9]{36}/g, severity: 'high' },
    { name: 'Anthropic Key', regex: /sk-ant-[A-Za-z0-9_-]{40,}/g, severity: 'critical' },
    { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g, severity: 'high' },
    { name: 'Vercel Token', regex: /vercel_[A-Za-z0-9]{24,}/g, severity: 'high' },
    { name: 'Cloudflare Key', regex: /cf_[A-Za-z0-9]{37}/g, severity: 'high' },
    { name: 'DigitalOcean', regex: /dop_v1_[a-f0-9]{64}/g, severity: 'critical' }
  ];

  let settings = { enablePasteGuard: true, enablePageScan: true };
  let whitelist = ['localhost', '127.0.0.1'];

  // Load settings and whitelist
  chrome.runtime.sendMessage({ action: 'getSettings' }, (s) => {
    if (s) settings = { ...settings, ...s };
  });
  chrome.runtime.sendMessage({ action: 'getWhitelist' }, (wl) => {
    if (wl) whitelist = wl;
  });

  function isWhitelisted() {
    const host = window.location.hostname;
    return whitelist.some(d => host === d || host.endsWith('.' + d));
  }

  function checkForSecrets(text) {
    const found = [];
    for (const pattern of QUICK_PATTERNS) {
      pattern.regex.lastIndex = 0;
      const matches = text.match(pattern.regex);
      if (matches) {
        for (const match of matches) {
          found.push({ type: pattern.name, severity: pattern.severity, preview: maskSecret(match) });
        }
      }
    }
    return found;
  }

  function maskSecret(str) {
    if (str.length <= 8) return '****';
    return str.slice(0, 4) + '•'.repeat(Math.min(str.length - 8, 16)) + str.slice(-4);
  }

  // ─── Paste Event Interceptor ───
  document.addEventListener('paste', (e) => {
    if (!settings.enablePasteGuard) return;
    if (isWhitelisted()) return;

    const text = e.clipboardData?.getData('text') || '';
    if (!text || text.length < 10) return;

    const found = checkForSecrets(text);
    if (found.length === 0) return;

    // Skip code editors
    const target = e.target;
    if (target.closest('.monaco-editor, .CodeMirror, .ace_editor, [data-lexical-editor]')) return;

    e.preventDefault();
    e.stopPropagation();
    showWarningModal(found, text, target);

    chrome.runtime.sendMessage({
      action: 'logInterception',
      data: {
        type: found[0].type,
        severity: found[0].severity,
        url: window.location.href,
        domain: window.location.hostname,
        context: 'paste',
        secretCount: found.length
      }
    }).catch(() => {});
  }, true);

  // ─── Warning Modal ───
  function showWarningModal(secrets, originalText, target) {
    const existing = document.querySelector('.ca-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'ca-modal-overlay';
    overlay.innerHTML = `
      <div class="ca-modal">
        <div class="ca-modal-header">
          <span class="ca-modal-icon">🛡️</span>
          <span class="ca-modal-title">CodeArmor — ${secrets.length} Secret${secrets.length > 1 ? 's' : ''} Detected!</span>
        </div>
        <div class="ca-modal-body">
          <p class="ca-modal-desc">
            Pasting on <strong>${window.location.hostname}</strong> with <strong>${secrets.length} secret(s)</strong>:
          </p>
          <div class="ca-secrets-list">
            ${secrets.slice(0, 5).map(s => `
              <div class="ca-secret-item ca-severity-${s.severity}">
                <span class="ca-secret-type">${s.type}</span>
                <span class="ca-secret-preview">${s.preview}</span>
                <span class="ca-secret-severity">${s.severity.toUpperCase()}</span>
              </div>
            `).join('')}
            ${secrets.length > 5 ? `<div class="ca-more">+${secrets.length - 5} more</div>` : ''}
          </div>
          <p class="ca-modal-warning">⚠️ Pasting secrets on public websites can lead to credential theft, unauthorized access, and financial loss.</p>
        </div>
        <div class="ca-modal-actions">
          <button class="ca-btn ca-btn-cancel" id="caCancel">✕ Block Paste</button>
          <button class="ca-btn ca-btn-whitelist" id="caWhitelist">🔓 Trust this site</button>
          <button class="ca-btn ca-btn-force" id="caForce">⚠️ Paste Anyway</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#caCancel').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#caWhitelist').addEventListener('click', () => {
      overlay.remove();
      whitelist.push(window.location.hostname);
      chrome.runtime.sendMessage({ action: 'updateWhitelist', domains: whitelist });
      insertText(target, originalText);
    });

    overlay.querySelector('#caForce').addEventListener('click', () => {
      overlay.remove();
      insertText(target, originalText);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  function insertText(target, text) {
    settings.enablePasteGuard = false;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = target.value.slice(0, start) + text + target.value.slice(end);
      target.selectionStart = target.selectionEnd = start + text.length;
      target.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (target.isContentEditable || target.contentEditable === 'true') {
      document.execCommand('insertText', false, text);
    }
    setTimeout(() => { settings.enablePasteGuard = true; }, 100);
  }

  // ─── Page Scan ───
  function scanPage() {
    if (!settings.enablePageScan) return;
    if (isWhitelisted()) return;

    const bodyText = document.body?.innerText || '';
    if (bodyText.length < 50) return;

    const found = checkForSecrets(bodyText);
    if (found.length > 0) {
      chrome.runtime.sendMessage({
        action: 'logScan',
        data: { url: window.location.href, domain: window.location.hostname, secretsFound: found.length, types: [...new Set(found.map(f => f.type))] }
      }).catch(() => {});
      showScanIndicator(found.length);
    }
  }

  function showScanIndicator(count) {
    if (document.querySelector('.ca-scan-indicator')) return;
    const indicator = document.createElement('div');
    indicator.className = 'ca-scan-indicator';
    indicator.innerHTML = `
      <span class="ca-scan-icon">🛡️</span>
      <span class="ca-scan-text">${count} exposed secret${count > 1 ? 's' : ''} on this page</span>
      <button class="ca-scan-dismiss" id="ca-scan-dismiss-btn">✕</button>
    `;
    document.body.appendChild(indicator);
    document.getElementById('ca-scan-dismiss-btn')?.addEventListener('click', function() {
      this.parentElement.remove();
    });
    setTimeout(() => indicator.remove(), 8000);
  }

  setTimeout(scanPage, 3000);
  console.log('[CodeArmor] Active — paste guard & page scanner enabled');
})();
