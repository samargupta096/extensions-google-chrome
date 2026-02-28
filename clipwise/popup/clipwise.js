const COLORS = ['#6C5CE7','#00CEC9','#FD79A8','#FDCB6E','#00B894','#E17055','#74B9FF','#A29BFE'];

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadClips();
  loadSnippets();
  loadStats();
  checkOllama();
  document.getElementById('clip-search').addEventListener('input', () => loadClips());
  document.getElementById('clip-filter').addEventListener('change', () => loadClips());
  document.getElementById('btn-paste-clip').addEventListener('click', saveFromClipboard);
  document.getElementById('btn-save-snippet').addEventListener('click', saveSnippet);
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).style.display = 'block';
      if (tab.dataset.tab === 'stats') loadStats();
      if (tab.dataset.tab === 'snippets') loadSnippets();
    });
  });
}

async function saveFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text) return;
    await chrome.runtime.sendMessage({ type: 'ADD_CLIP', text, source: 'clipboard' });
    loadClips();
    showToast('Clip saved!');
  } catch { showToast('Allow clipboard access'); }
}

async function loadClips() {
  const search = document.getElementById('clip-search').value;
  const typeFilter = document.getElementById('clip-filter').value;
  const { clips } = await chrome.runtime.sendMessage({ type: 'GET_CLIPS', search, type_filter: typeFilter, limit: 40 });
  const container = document.getElementById('clip-list');
  if (!clips || !clips.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-title">No clips yet</div><div class="empty-state-text">Copy text and save from clipboard</div></div>';
    return;
  }
  container.innerHTML = clips.map(c => `
    <div class="clip-item" data-id="${c.id}">
      <div class="clip-text ${c.type === 'code' || c.type === 'command' ? 'is-code' : ''}">${esc(c.text.slice(0, 200))}</div>
      <div class="clip-meta">
        <span class="clip-type ${c.type}">${c.type}</span>
        <span class="clip-time">${timeAgo(c.timestamp)}</span>
        <div class="clip-actions">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();copyClipById('${c.id}')" title="Copy">📋</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();aiAction('${c.id}','explain')" title="AI Explain">🧠</button>
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();deleteClip('${c.id}')" title="Delete" style="color:var(--accent-red);">🗑️</button>
        </div>
      </div>
      <div id="ai-${c.id}"></div>
    </div>
  `).join('');
}

window.copyClipById = async function(id) {
  const { clips } = await chrome.runtime.sendMessage({ type: 'GET_CLIPS', limit: 500 });
  const clip = clips.find(c => c.id === id);
  if (clip) { await navigator.clipboard.writeText(clip.text); showToast('Copied!'); }
};
window.deleteClip = async function(id) {
  await chrome.runtime.sendMessage({ type: 'DELETE_CLIP', id });
  loadClips();
};
window.aiAction = async function(id, action) {
  const el = document.getElementById('ai-'+id);
  el.innerHTML = '<div class="ai-result">🧠 Thinking...</div>';
  const { clips } = await chrome.runtime.sendMessage({ type: 'GET_CLIPS', limit: 500 });
  const clip = clips.find(c => c.id === id);
  if (!clip) return;
  const result = await chrome.runtime.sendMessage({ type: 'AI_ACTION', text: clip.text, action });
  el.innerHTML = `<div class="ai-result">${result.success ? esc(result.text) : '❌ '+result.text}</div>`;
};

async function saveSnippet() {
  const title = document.getElementById('snippet-title').value.trim();
  const code = document.getElementById('snippet-code').value.trim();
  const language = document.getElementById('snippet-lang').value;
  if (!title || !code) return;
  await chrome.runtime.sendMessage({ type: 'ADD_SNIPPET', title, code, language });
  document.getElementById('snippet-title').value = '';
  document.getElementById('snippet-code').value = '';
  loadSnippets();
  showToast('Snippet saved!');
}

async function loadSnippets() {
  const { snippets } = await chrome.runtime.sendMessage({ type: 'GET_SNIPPETS' });
  const container = document.getElementById('snippet-list');
  if (!snippets || !snippets.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px;"><div style="font-size:24px;opacity:0.3;margin-bottom:6px;">💾</div><div style="font-size:12px;color:var(--text-tertiary);">No snippets yet</div></div>';
    return;
  }
  container.innerHTML = snippets.map(s => `
    <div class="snippet-item">
      <div class="snippet-title">${esc(s.title)}</div>
      <div class="snippet-code">${esc(s.code.slice(0, 200))}</div>
      <div class="snippet-meta">
        <span class="badge badge-cyan">${s.language}</span>
        <span class="clip-time">${timeAgo(s.timestamp)}</span>
        <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard.writeText(${JSON.stringify(s.code)});showToast('Copied!')">📋</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteSnippet('${s.id}')" style="color:var(--accent-red);">🗑️</button>
      </div>
    </div>
  `).join('');
}

window.deleteSnippet = async function(id) {
  await chrome.runtime.sendMessage({ type: 'DELETE_SNIPPET', id });
  loadSnippets();
};

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type: 'GET_STATS' });
  document.getElementById('stat-clips').textContent = stats.totalClips;
  document.getElementById('stat-snippets').textContent = stats.totalSnippets;
  const types = Object.entries(stats.types || {}).sort(([,a],[,b]) => b - a);
  if (types.length > 0) {
    ChartUtils.doughnutChart(document.getElementById('chart-types'), {}, {
      labels: types.map(([t]) => t), values: types.map(([,v]) => v), colors: COLORS,
      centerText: String(stats.totalClips), centerSubText: 'clips', lineWidth: 20
    });
  }
  const daily = Object.entries(stats.daily || {}).sort().slice(-7);
  if (daily.length > 0) {
    ChartUtils.barChart(document.getElementById('chart-daily'), {}, {
      labels: daily.map(([d]) => new Date(d).toLocaleDateString('en',{weekday:'short'})),
      values: daily.map(([,v]) => v), barColor: '#6C5CE7', formatValue: v => `${Math.round(v)}`
    });
  }
}

async function checkOllama() {
  try {
    const r = await fetch('http://localhost:11434/api/tags',{signal:AbortSignal.timeout(2000)});
    const el = document.getElementById('ollama-status');
    el.className = r.ok ? 'ollama-status connected' : 'ollama-status disconnected';
    el.innerHTML = `<span class="status-dot ${r.ok?'online':'offline'}"></span><span>AI</span>`;
  } catch {}
}

function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function timeAgo(ts) { const d=(Date.now()-ts)/1000; if(d<60) return 'now'; if(d<3600) return `${Math.floor(d/60)}m`; if(d<86400) return `${Math.floor(d/3600)}h`; return `${Math.floor(d/86400)}d`; }
function showToast(m) { const t=document.createElement('div'); t.className='toast success'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),2500); }
