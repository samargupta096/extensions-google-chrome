/**
 * StandupScribe — Popup Controller
 * Today view, AI draft generation, history
 */

const ollama = new OllamaClient();
const $ = (id) => document.getElementById(id);
let todayData = null;
let bullets = [];
let blockers = [];

document.addEventListener('DOMContentLoaded', async () => {
  await checkOllamaStatus();
  initTabs();
  setupEventListeners();
  await loadToday();
  await loadDraft();
  updateDate();
});

async function checkOllamaStatus() {
  const available = await ollama.isAvailable();
  $('statusDot').className = `status-dot ${available ? 'online' : 'offline'}`;
  $('statusText').textContent = available ? 'AI Ready' : 'AI Offline';
}

function updateDate() {
  const d = new Date();
  $('todayDate').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── Tabs ───
function initTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(tc => tc.style.display = 'none');
      tab.classList.add('active');
      $(`tab-${tab.dataset.tab}`).style.display = '';
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
}

// ─── Today ───
async function loadToday() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getTodayData' }, (r) => {
      if (!r?.success) { resolve(); return; }
      todayData = r;
      bullets = r.manualBullets || [];
      blockers = r.blockers || [];

      $('trackTime').textContent = r.totalMinutes;
      $('trackVisits').textContent = r.recentVisits.length;

      renderDomains(r.topDomains);
      renderBullets();
      resolve();
    });
  });
}

function renderDomains(domains) {
  const list = $('domainList');
  const empty = $('domainEmpty');
  if (!domains.length) { list.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';
  const max = domains[0]?.minutes || 1;
  list.innerHTML = domains.slice(0, 8).map(d => `
    <div class="domain-item">
      <span class="domain-name" title="${d.domain}">${d.title || d.domain}</span>
      <div class="domain-bar-wrap">
        <div class="domain-bar" style="width:${Math.round((d.minutes / max) * 100)}%"></div>
      </div>
      <span class="domain-time">${d.minutes}m</span>
    </div>
  `).join('');
}

function renderBullets() {
  const list = $('bulletList');
  const all = [
    ...bullets.map(b => ({ text: b, isBlocker: false })),
    ...blockers.map(b => ({ text: b, isBlocker: true }))
  ];
  list.innerHTML = all.map((b, i) => `
    <div class="bullet-item ${b.isBlocker ? 'is-blocker' : ''}">
      <span class="bullet-icon">${b.isBlocker ? '🚫' : '•'}</span>
      <span class="bullet-text">${escapeHtml(b.text)}</span>
      <button class="bullet-del" data-idx="${i}" data-blocker="${b.isBlocker}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('.bullet-del').forEach(btn => btn.addEventListener('click', () => {
    const idx = +btn.dataset.idx;
    const isBlocker = btn.dataset.blocker === 'true';
    if (isBlocker) blockers.splice(idx - bullets.length, 1);
    else bullets.splice(idx, 1);
    renderBullets();
  }));
}

// ─── Draft ───
async function loadDraft() {
  return new Promise(resolve => {
    chrome.runtime.sendMessage({ action: 'getDraft' }, (r) => {
      if (r?.draft) renderDraft(r.draft);
      resolve();
    });
  });
}

function setupEventListeners() {
  $('generateDraft').addEventListener('click', generateDraft);
  $('refreshDraft').addEventListener('click', generateDraft);
  
  // Bullet input
  $('bulletInput').addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const text = $('bulletInput').value.trim(); if (!text) return;
    chrome.runtime.sendMessage({ action: 'addBullet', bullet: text, type: 'work' });
    bullets.push(text); renderBullets();
    $('bulletInput').value = '';
  });

  $('blockerBtn').addEventListener('click', () => {
    const text = $('bulletInput').value.trim(); if (!text) return;
    chrome.runtime.sendMessage({ action: 'addBullet', bullet: text, type: 'blocker' });
    blockers.push(text); renderBullets();
    $('bulletInput').value = '';
  });

  // Copy handlers
  $('copySlack').addEventListener('click', () => {
    const text = `*Yesterday:*\n${$('draftYesterday').textContent}\n\n*Today:*\n${$('draftToday').textContent}\n\n*Blockers:*\n${$('draftBlockers').textContent}`;
    navigator.clipboard.writeText(text);
    showToast('Copied for Slack! 📋', 'success');
  });

  $('copyMarkdown').addEventListener('click', () => {
    const d = new Date().toISOString().split('T')[0];
    const text = `# Standup — ${d}\n\n## Yesterday\n${$('draftYesterday').textContent}\n\n## Today\n${$('draftToday').textContent}\n\n## Blockers\n${$('draftBlockers').textContent}`;
    navigator.clipboard.writeText(text);
    showToast('Copied as Markdown! 📝', 'success');
  });

  $('saveDraft').addEventListener('click', () => {
    const draft = {
      yesterday: $('draftYesterday').textContent,
      today: $('draftToday').textContent,
      blockers: $('draftBlockers').textContent
    };
    chrome.runtime.sendMessage({ action: 'saveDraft', draft });
    showToast('Saved!', 'success');
  });
}

async function generateDraft() {
  $('draftEmpty').style.display = 'none';
  $('draftContainer').style.display = 'none';
  $('draftLoading').style.display = '';

  // Gather context
  if (!todayData) await loadToday();
  const topSites = (todayData?.topDomains || []).slice(0, 5).map(d => `${d.title || d.domain} (${d.minutes}min)`).join(', ');
  const recentPages = (todayData?.recentVisits || []).slice(-10).map(v => v.title).filter(Boolean).join(', ');
  const manualBullets = bullets.length ? bullets.join('; ') : '';
  const manualBlockers = blockers.length ? blockers.join('; ') : '';

  const prompt = `You are writing a professional async standup update for an engineer.

Context from today's work session:
- Top sites visited: ${topSites || 'No data yet'}
- Recent pages: ${recentPages || 'No data yet'}
- Manual notes: ${manualBullets || 'None'}
- Blockers: ${manualBlockers || 'None mentioned'}
- Total tracked time: ${todayData?.totalMinutes || 0} minutes

Write a concise standup with exactly 3 sections:

**Yesterday:** (2-3 bullet points of what was likely worked on based on sites/pages)
**Today:** (2-3 bullet points of planned work continuing from yesterday's context)  
**Blockers:** (Any blockers, or "None" if no blockers mentioned)

Keep each bullet to one line. Be specific and professional. Infer from the context what they were working on (e.g. github.com = code review/PRs, jira = tickets, stackoverflow = debugging).`;

  const r = await ollama.generate(prompt, { temperature: 0.4, maxTokens: 500 });
  $('draftLoading').style.display = 'none';

  if (r.success) {
    const parsed = parseDraft(r.text);
    renderDraft(parsed);
    chrome.runtime.sendMessage({ action: 'saveDraft', draft: parsed });
  } else {
    // Fallback: generate minimal draft from bullets
    const fallback = {
      yesterday: bullets.length ? bullets.map(b => `• ${b}`).join('\n') : '• (Add notes in Today tab)',
      today: '• Continuing from yesterday',
      blockers: blockers.length ? blockers.map(b => `• ${b}`).join('\n') : '• None'
    };
    renderDraft(fallback);
  }
}

function parseDraft(text) {
  const yesterday = extractSection(text, ['Yesterday', 'YESTERDAY']) || '';
  const today = extractSection(text, ['Today', 'TODAY']) || '';
  const blockers = extractSection(text, ['Blockers', 'BLOCKERS', 'Blocker']) || 'None';
  return { yesterday, today, blockers };
}

function extractSection(text, labels) {
  for (const label of labels) {
    const regex = new RegExp(`\\*{0,2}${label}:?\\*{0,2}\\s*([\\s\\S]*?)(?=\\*{0,2}(?:Yesterday|Today|Blockers|Blocker):|$)`, 'i');
    const match = text.match(regex);
    if (match) return match[1].trim();
  }
  return null;
}

function renderDraft(draft) {
  $('draftContainer').style.display = '';
  $('draftEmpty').style.display = 'none';
  $('draftYesterday').textContent = draft.yesterday || '';
  $('draftToday').textContent = draft.today || '';
  $('draftBlockers').textContent = draft.blockers || 'None';
}



// ─── History ───
async function loadHistory() {
  chrome.runtime.sendMessage({ action: 'getDraft' }, (r) => {
    const allDrafts = r?.allDrafts || {};
    const list = $('historyList');
    const empty = $('historyEmpty');
    const entries = Object.entries(allDrafts).sort((a, b) => b[0].localeCompare(a[0]));
    if (!entries.length) { list.innerHTML = ''; empty.style.display = ''; return; }
    empty.style.display = 'none';
    list.innerHTML = entries.map(([date, draft]) => `
      <div class="history-item">
        <div class="history-date">📅 ${date}</div>
        <div class="history-preview">${escapeHtml((draft.yesterday || '').slice(0, 120))}...</div>
        <div class="history-actions">
          <button class="btn btn-ghost btn-sm history-copy-btn" data-draft='${escapeHtml(JSON.stringify(draft))}'>📋 Copy</button>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.history-copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const draftStr = btn.dataset.draft || btn.getAttribute('data-draft');
        if (!draftStr) return;
        const draft = JSON.parse(draftStr.replace(/&quot;/g, '"'));
        const text = `Yesterday:\n${draft.yesterday}\n\nToday:\n${draft.today}\n\nBlockers:\n${draft.blockers}`;
        navigator.clipboard.writeText(text);
        showToast('Copied!', 'success');
      });
    });
  });
}

// ─── Utilities ───
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast'); if (existing) existing.remove();
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
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
