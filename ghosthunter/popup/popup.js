/**
 * GhostHunter — Enhanced Popup Controller (Round 2)
 * Kanban board, cover letter generator, interview prep, search, 
 * timeline, CSV export, reminders, salary estimate
 */

const ollama = new OllamaClient();
const $ = (id) => document.getElementById(id);
let currentEditId = null;
let currentSearch = '';

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  await checkOllamaStatus();
  await loadApplications();
  await loadStats();
  initEventListeners();
  setDefaultDate();
});

async function checkOllamaStatus() {
  const available = await ollama.isAvailable();
  $('statusDot').className = `status-dot ${available ? 'online' : 'offline'}`;
  $('statusText').textContent = available ? 'AI Ready' : 'AI Offline';
}

function setDefaultDate() {
  const di = $('addDate');
  if (di) di.value = new Date().toISOString().split('T')[0];
}

// ─── Load Applications ───
async function loadApplications(filterStatus = 'all') {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getApplications' }, (response) => {
      if (!response?.success) { resolve(); return; }
      let apps = response.applications || [];
      if (filterStatus !== 'all') apps = apps.filter(a => a.status === filterStatus);
      if (currentSearch) {
        const q = currentSearch.toLowerCase();
        apps = apps.filter(a =>
          (a.title || '').toLowerCase().includes(q) ||
          (a.company || '').toLowerCase().includes(q) ||
          (a.salary || '').toLowerCase().includes(q) ||
          (a.location || '').toLowerCase().includes(q)
        );
      }

      const container = $('applicationList');
      const empty = $('trackerEmpty');

      if (apps.length === 0) { container.innerHTML = ''; empty.style.display = ''; resolve(); return; }

      empty.style.display = 'none';
      container.innerHTML = apps.map((app, i) => {
        const title = currentSearch ? highlightSearch(escapeHtml(app.title), currentSearch) : escapeHtml(app.title);
        const hasReminder = app.reminderDate && new Date(app.reminderDate) > new Date();
        return `
        <div class="app-card slide-up ${hasReminder ? 'has-reminder' : ''}" style="animation-delay: ${i * 0.03}s" data-id="${app.id}">
          <div class="app-card-top">
            <div class="app-card-info">
              <div class="app-title">${title}</div>
              <div class="app-company">${escapeHtml(app.company)}</div>
              <div class="app-meta">
                <span class="app-platform">${app.platform}</span>
                <span class="app-date">📅 ${formatDate(app.appliedDate)}</span>
                ${app.salary ? `<span class="app-salary">💰 ${escapeHtml(app.salary)}</span>` : ''}
                ${app.location ? `<span class="app-location">📍 ${escapeHtml(app.location)}</span>` : ''}
                ${hasReminder ? `<span class="app-reminder-badge">⏰ ${formatDate(app.reminderDate)}</span>` : ''}
                ${app.ghostScore > 0 ? `<span class="app-ghost-score ${getGhostClass(app.ghostScore)}">👻 ${app.ghostScore}%</span>` : ''}
              </div>
              ${app.notes ? `<div class="app-notes">📝 ${escapeHtml(app.notes.slice(0, 60))}${app.notes.length > 60 ? '...' : ''}</div>` : ''}
            </div>
          </div>
          <div class="app-status-row">
            <select class="status-select" data-id="${app.id}">
              <option value="applied" ${app.status === 'applied' ? 'selected' : ''}>📨 Applied</option>
              <option value="interviewing" ${app.status === 'interviewing' ? 'selected' : ''}>🎯 Interviewing</option>
              <option value="offered" ${app.status === 'offered' ? 'selected' : ''}>🎉 Offered</option>
              <option value="rejected" ${app.status === 'rejected' ? 'selected' : ''}>❌ Rejected</option>
              <option value="ghosted" ${app.status === 'ghosted' ? 'selected' : ''}>👻 Ghosted</option>
            </select>
            ${app.url ? `<a href="${app.url}" target="_blank" class="app-action-btn" title="Open">🔗</a>` : ''}
            <button class="app-action-btn edit-btn" data-id="${app.id}" title="Edit">✏️</button>
            <button class="app-action-btn app-delete-btn" data-id="${app.id}" title="Delete">🗑️</button>
          </div>
        </div>
      `;}).join('');

      container.querySelectorAll('.status-select').forEach(sel =>
        sel.addEventListener('change', () => updateStatus(sel.dataset.id, sel.value))
      );
      container.querySelectorAll('.edit-btn').forEach(btn =>
        btn.addEventListener('click', () => openEditModal(btn.dataset.id, apps))
      );
      container.querySelectorAll('.app-delete-btn').forEach(btn =>
        btn.addEventListener('click', () => deleteApp(btn.dataset.id))
      );
      resolve();
    });
  });
}

// ─── Kanban Board ───
async function loadKanban() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getApplications' }, (response) => {
      const apps = response?.applications || [];
      const columns = { applied: [], interviewing: [], offered: [], rejected: [], ghosted: [] };

      for (const app of apps) {
        if (columns[app.status]) columns[app.status].push(app);
        else columns.applied.push(app);
      }

      const statusMap = {
        applied: { cardId: 'kanbanAppliedCards', countId: 'kanbanApplied' },
        interviewing: { cardId: 'kanbanInterviewingCards', countId: 'kanbanInterviewing' },
        offered: { cardId: 'kanbanOfferedCards', countId: 'kanbanOffered' },
        rejected: { cardId: 'kanbanRejectedCards', countId: 'kanbanRejected' },
        ghosted: { cardId: 'kanbanGhostedCards', countId: 'kanbanGhosted' }
      };

      for (const [status, { cardId, countId }] of Object.entries(statusMap)) {
        const col = $(cardId);
        const countEl = $(countId);
        const appsInCol = columns[status] || [];
        countEl.textContent = appsInCol.length;

        if (appsInCol.length === 0) {
          col.innerHTML = `<div class="kanban-empty">Drop apps here</div>`;
        } else {
          col.innerHTML = appsInCol.map(app => `
            <div class="kanban-card">
              <div class="kanban-card-title">${escapeHtml(app.title)}</div>
              <div class="kanban-card-company">${escapeHtml(app.company)}</div>
              <div class="kanban-card-meta">
                <span class="kanban-card-date">${formatDate(app.appliedDate)}</span>
                ${app.ghostScore >= 50 ? '<span class="kanban-ghost-dot" title="High ghost risk"></span>' : ''}
              </div>
            </div>
          `).join('');
        }
      }

      resolve();
    });
  });
}

// ─── Helpers ───
function highlightSearch(text, query) {
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function getGhostClass(score) {
  if (score >= 50) return 'ghost-high';
  if (score >= 25) return 'ghost-medium';
  return 'ghost-low';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function formatDateTime(ts) {
  return new Date(ts).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Status / Delete ───
function updateStatus(id, status) {
  chrome.runtime.sendMessage({ action: 'updateApplication', id, data: { status } }, () => {
    showToast(`→ ${status}`, 'success');
    loadStats();
  });
}

function deleteApp(id) {
  chrome.runtime.sendMessage({ action: 'deleteApplication', id }, () => {
    showToast('Removed', 'success');
    loadApplications($('statusFilter').value);
    loadStats();
  });
}

// ─── Edit Modal ───
function openEditModal(id, apps) {
  const app = apps.find(a => a.id === id);
  if (!app) return;
  currentEditId = id;
  $('editNotes').value = app.notes || '';
  $('editSalary').value = app.salary || '';
  $('editContact').value = app.contactEmail || '';
  $('editReminder').value = app.reminderDate || '';
  $('editModal').style.display = '';
}

function saveEdit() {
  if (!currentEditId) return;
  const data = {
    notes: $('editNotes').value.trim(),
    salary: $('editSalary').value.trim(),
    contactEmail: $('editContact').value.trim(),
    reminderDate: $('editReminder').value || null
  };
  chrome.runtime.sendMessage({ action: 'updateApplication', id: currentEditId, data }, () => {
    $('editModal').style.display = 'none';
    currentEditId = null;
    showToast('Updated!', 'success');
    loadApplications($('statusFilter').value);
  });
  if (data.reminderDate) chrome.runtime.sendMessage({ action: 'setReminder', id: currentEditId, reminderDate: data.reminderDate });
}

// ─── CSV Export ───
function exportCSV() {
  chrome.runtime.sendMessage({ action: 'exportCSV' }, (r) => {
    if (!r?.success) { showToast('Export failed', 'error'); return; }
    const blob = new Blob([r.csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `ghosthunter-${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
    showToast('CSV exported!', 'success');
  });
}

// ─── Stats ───
async function loadStats() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getStats' }, (r) => {
      if (!r?.success) { resolve(); return; }
      const s = r.stats;
      $('statTotal').textContent = s.total;
      $('statResponseRate').textContent = s.responseRate + '%';
      $('statGhostRate').textContent = s.ghostRate + '%';
      renderStatusChart(s.byStatus);
      renderPlatformChart(s.byPlatform);
      renderTrendChart(s.weeklyTrend);
      resolve();
    });
  });
}

function renderStatusChart(byStatus) {
  const canvas = $('statusChart');
  if (!canvas) return;
  const labels = ['Applied', 'Interviewing', 'Offered', 'Rejected', 'Ghosted'];
  const keys = ['applied', 'interviewing', 'offered', 'rejected', 'ghosted'];
  ChartUtils.barChart(canvas, {}, { labels, values: keys.map(k => byStatus[k] || 0), colors: ['#74B9FF', '#00CEC9', '#00B894', '#FF6B6B', '#636e72'], formatValue: v => Math.round(v).toString(), barRadius: 4 });
}

function renderPlatformChart(byPlatform) {
  const canvas = $('platformChart');
  if (!canvas) return;
  const labels = Object.keys(byPlatform); const values = Object.values(byPlatform);
  if (!labels.length) { labels.push('No data'); values.push(0); }
  ChartUtils.doughnutChart(canvas, {}, { labels, values, colors: ['#6C5CE7', '#00CEC9', '#FD79A8', '#FDCB6E', '#00B894', '#E17055', '#74B9FF'], centerText: String(values.reduce((a, b) => a + b, 0)), centerSubText: 'total' });
}

function renderTrendChart(weeklyTrend) {
  const canvas = $('trendChart');
  if (!canvas || !weeklyTrend) return;
  ChartUtils.barChart(canvas, {}, { labels: weeklyTrend.map(w => w.week), values: weeklyTrend.map(w => w.count), barColor: '#00CEC9', formatValue: v => Math.round(v).toString(), barRadius: 4 });
}

// ─── AI: Ghost Analysis ───
async function analyzeJob() {
  const text = $('analyzeInput').value.trim();
  const result = $('analyzeResult');
  if (!text) { showToast('Paste a job description first', 'error'); return; }
  result.style.display = '';
  result.innerHTML = '<div class="analyze-loading"><span class="spinner"></span><span>Analyzing...</span></div>';
  const prompt = `You are an expert job market analyst. Analyze this job description for ghost job signals:

${text.slice(0, 2000)}

Provide:
1. **Ghost Risk Score** (0-100)
2. **Red Flags** (specific warning signs)
3. **Green Flags** (positive indicators)
4. **Salary Assessment** (fair/missing/suspicious)
5. **Recommendation** (apply or skip?)

Be concise and actionable.`;
  const r = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 800 });
  result.innerHTML = r.success ? escapeHtml(r.text) : '⚠️ AI unavailable. Make sure Ollama is running.';
}

// ─── AI: Salary Estimate ───
async function estimateSalary() {
  const text = $('analyzeInput').value.trim();
  const result = $('analyzeResult');
  if (!text) { showToast('Paste a job description first', 'error'); return; }
  result.style.display = '';
  result.innerHTML = '<div class="analyze-loading"><span class="spinner"></span><span>Estimating...</span></div>';
  const prompt = `You are a compensation expert. Estimate the salary for this role:
${text.slice(0, 1500)}
Provide: Estimated Range, Confidence (Low/Medium/High), key factors, market context, and negotiation tips.`;
  const r = await ollama.generate(prompt, { temperature: 0.3, maxTokens: 500 });
  result.innerHTML = r.success ? escapeHtml(r.text) : '⚠️ AI unavailable.';
}

// ─── AI: Cover Letter ───
async function generateCoverLetter() {
  const jd = $('coverLetterJD').value.trim();
  const exp = $('coverLetterExp').value.trim();
  const result = $('coverLetterResult');
  if (!jd) { showToast('Paste a job description first', 'error'); return; }
  result.style.display = '';
  result.innerHTML = '<div class="analyze-loading"><span class="spinner"></span><span>Generating cover letter...</span></div>';
  const prompt = `Write a professional, concise cover letter for this job application.

Job Description:
${jd.slice(0, 1500)}

Candidate Experience:
${exp || 'Experienced software professional with relevant background.'}

Requirements:
- 3-4 short paragraphs
- Opening that shows genuine interest and why this company/role
- Middle showing specific relevant experience aligned to the JD
- Closing with call to action
- Professional but personable tone
- Do NOT use cliches like "I am excited to apply"

Write the letter directly, no meta-commentary.`;
  const r = await ollama.generate(prompt, { temperature: 0.7, maxTokens: 800 });
  if (r.success) {
    result.innerHTML = escapeHtml(r.text) +
      `<div class="copy-btn"><button class="btn btn-secondary btn-sm" id="copyCoverLetter">📋 Copy</button></div>`;
    document.getElementById('copyCoverLetter')?.addEventListener('click', () => {
      navigator.clipboard.writeText(r.text);
      showToast('Copied!', 'success');
    });
  } else {
    result.innerHTML = '⚠️ AI unavailable. Make sure Ollama is running.';
  }
}

// ─── AI: Interview Prep ───
async function generateInterviewPrep() {
  const jd = $('interviewJD').value.trim();
  const result = $('interviewResult');
  if (!jd) { showToast('Paste a job description first', 'error'); return; }
  result.style.display = '';
  result.innerHTML = '<div class="analyze-loading"><span class="spinner"></span><span>Generating questions...</span></div>';
  const prompt = `You are an expert interviewer. Based on this job description, generate likely interview questions:

${jd.slice(0, 1500)}

Generate 3 sections:
1. **Technical Questions** (5 specific questions based on the tech stack/requirements)
2. **Behavioral Questions** (3 role-specific STAR-format questions)
3. **Questions to Ask Them** (3 smart questions the candidate should ask)

For each question, include a brief tip on what a strong answer covers.`;
  const r = await ollama.generate(prompt, { temperature: 0.5, maxTokens: 1000 });
  if (r.success) {
    result.innerHTML = escapeHtml(r.text) +
      `<div class="copy-btn"><button class="btn btn-secondary btn-sm" id="copyInterviewPrep">📋 Copy</button></div>`;
    document.getElementById('copyInterviewPrep')?.addEventListener('click', () => {
      navigator.clipboard.writeText(r.text);
      showToast('Copied!', 'success');
    });
  } else {
    result.innerHTML = '⚠️ AI unavailable. Make sure Ollama is running.';
  }
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
      if (tab.dataset.tab === 'kanban') loadKanban();
    });
  });

  // Search
  let searchTimeout;
  $('appSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => { currentSearch = e.target.value.trim(); loadApplications($('statusFilter').value); }, 200);
  });

  $('statusFilter').addEventListener('change', (e) => loadApplications(e.target.value));
  $('exportCSV').addEventListener('click', exportCSV);

  // Add application
  $('addSubmit').addEventListener('click', () => {
    const data = {
      title: $('addTitle').value.trim(), company: $('addCompany').value.trim(),
      url: $('addUrl').value.trim(), salary: $('addSalary').value.trim(),
      location: $('addLocation').value.trim(), platform: $('addPlatform').value,
      appliedDate: $('addDate').value, contactEmail: $('addContact').value.trim(),
      notes: $('addNotes').value.trim()
    };
    if (!data.title || !data.company) { showToast('Title and Company required', 'error'); return; }
    chrome.runtime.sendMessage({ action: 'addApplication', data }, (r) => {
      if (r?.success) {
        showToast('Added!', 'success');
        ['addTitle', 'addCompany', 'addUrl', 'addSalary', 'addLocation', 'addContact', 'addNotes'].forEach(id => $(id).value = '');
        setDefaultDate();
        document.querySelector('[data-tab="tracker"]').click();
        loadApplications(); loadStats();
      }
    });
  });

  // AI buttons
  $('analyzeBtn').addEventListener('click', analyzeJob);
  $('salaryBtn').addEventListener('click', estimateSalary);
  $('generateCoverLetter').addEventListener('click', generateCoverLetter);
  $('generateInterviewPrep').addEventListener('click', generateInterviewPrep);

  // Edit modal
  $('saveEdit').addEventListener('click', saveEdit);
  $('cancelEdit').addEventListener('click', () => { $('editModal').style.display = 'none'; });
  $('closeEdit').addEventListener('click', () => { $('editModal').style.display = 'none'; });
  $('editModal').addEventListener('click', (e) => { if (e.target === $('editModal')) $('editModal').style.display = 'none'; });
}

// ─── Utilities ───
function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

function showToast(msg, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div'); t.className = `toast ${type}`; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}
