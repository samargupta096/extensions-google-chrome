// Idea Backlog Widget — Capture, tag, and expand content ideas
document.addEventListener('DOMContentLoaded', () => {
  const addBtn = document.getElementById('idea-add-btn');
  const filterSelect = document.getElementById('idea-filter');
  const listEl = document.getElementById('idea-list');

  if (!addBtn || !listEl) return;

  const STORAGE_KEY = 'creator_ideas';
  const PILLARS = ['Tips', 'BTS', 'Story', 'Promo', 'Tutorial', 'Q&A'];
  const FORMATS = ['Short', 'Long', 'Reel', 'Tweet', 'Newsletter'];
  const STATUSES = ['new', 'inprogress', 'used'];
  const PILLAR_COLORS = {
    'Tips': '#4facfe', 'BTS': '#f6d365', 'Story': '#a29bfe',
    'Promo': '#ff6b6b', 'Tutorial': '#00cec9', 'Q&A': '#fd79a8'
  };

  let ideas = [];

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    ideas = res[STORAGE_KEY] || [];
    render();
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: ideas }, render);
  }

  function render() {
    const filter = filterSelect ? filterSelect.value : 'all';
    let filtered = ideas;
    if (filter === 'new' || filter === 'inprogress' || filter === 'used') {
      filtered = ideas.filter(i => i.status === filter);
    } else if (PILLARS.includes(filter)) {
      filtered = ideas.filter(i => i.pillar === filter);
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '<div class="idea-empty-state">No ideas yet — tap + to add one!</div>';
      return;
    }

    listEl.innerHTML = filtered.map((idea, idx) => {
      const origIdx = ideas.indexOf(idea);
      const statusIcon = idea.status === 'used' ? '✅' : idea.status === 'inprogress' ? '🔄' : '💡';
      const pillarColor = PILLAR_COLORS[idea.pillar] || '#4facfe';
      return `
        <div class="idea-item ${idea.status === 'used' ? 'idea-used' : ''}" data-idx="${origIdx}">
          <div class="idea-item-top">
            <span class="idea-status-icon">${statusIcon}</span>
            <span class="idea-title">${escHtml(idea.title)}</span>
          </div>
          <div class="idea-item-tags">
            <span class="idea-pillar-badge" style="background:${pillarColor}22;color:${pillarColor};border:1px solid ${pillarColor}44">${idea.pillar}</span>
            <span class="idea-format-badge">${idea.format}</span>
          </div>
          ${idea.notes ? `<div class="idea-notes">${escHtml(idea.notes)}</div>` : ''}
          ${idea.aiOutline ? `<div class="idea-ai-outline">${escHtml(idea.aiOutline)}</div>` : ''}
          <div class="idea-item-actions">
            <button class="idea-action-btn idea-cycle-btn" data-idx="${origIdx}" title="Cycle status">⏭️</button>
            <button class="idea-action-btn idea-ai-btn" data-idx="${origIdx}" title="Expand with AI">🤖</button>
            <button class="idea-action-btn idea-del-btn" data-idx="${origIdx}" title="Delete">×</button>
          </div>
        </div>`;
    }).join('');

    // Bind actions
    listEl.querySelectorAll('.idea-cycle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        const order = ['new', 'inprogress', 'used'];
        const cur = order.indexOf(ideas[i].status);
        ideas[i].status = order[(cur + 1) % order.length];
        save();
      });
    });

    listEl.querySelectorAll('.idea-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ideas.splice(parseInt(btn.dataset.idx), 1);
        save();
      });
    });

    listEl.querySelectorAll('.idea-ai-btn').forEach(btn => {
      btn.addEventListener('click', () => expandWithAI(parseInt(btn.dataset.idx), btn));
    });
  }

  // Add idea via modal
  addBtn.addEventListener('click', () => {
    showIdeaModal(null, (result) => {
      if (result) {
        ideas.unshift({
          id: crypto.randomUUID(),
          title: result.title,
          notes: result.notes || '',
          pillar: result.pillar || 'Tips',
          format: result.format || 'Short',
          status: 'new',
          aiOutline: '',
          createdAt: Date.now()
        });
        save();
      }
    });
  });

  if (filterSelect) {
    filterSelect.addEventListener('change', render);
  }

  function showIdeaModal(existing, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:340px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">💡 ${existing ? 'Edit' : 'New'} Idea</h3>
        <input type="text" id="idea-modal-title" class="glass-input" style="width:100%;box-sizing:border-box;margin-bottom:0.75rem;" placeholder="Idea title..." value="${existing ? escHtml(existing.title) : ''}" autofocus>
        <textarea id="idea-modal-notes" class="glass-input" style="width:100%;box-sizing:border-box;min-height:50px;resize:vertical;margin-bottom:0.75rem;" placeholder="Notes (optional)...">${existing ? escHtml(existing.notes) : ''}</textarea>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
          <select id="idea-modal-pillar" class="glass-select" style="flex:1;">
            ${PILLARS.map(p => `<option value="${p}" ${existing && existing.pillar === p ? 'selected' : ''}>${p}</option>`).join('')}
          </select>
          <select id="idea-modal-format" class="glass-select" style="flex:1;">
            ${FORMATS.map(f => `<option value="${f}" ${existing && existing.format === f ? 'selected' : ''}>${f}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="idea-modal-cancel" class="glass-btn">Cancel</button>
          <button id="idea-modal-save" class="glass-btn btn-primary">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#idea-modal-title').focus();

    overlay.querySelector('#idea-modal-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
      callback(null);
    });

    overlay.querySelector('#idea-modal-save').addEventListener('click', () => {
      const title = overlay.querySelector('#idea-modal-title').value.trim();
      if (!title) return;
      const result = {
        title,
        notes: overlay.querySelector('#idea-modal-notes').value.trim(),
        pillar: overlay.querySelector('#idea-modal-pillar').value,
        format: overlay.querySelector('#idea-modal-format').value
      };
      document.body.removeChild(overlay);
      callback(result);
    });
  }

  async function expandWithAI(idx, btn) {
    const idea = ideas[idx];
    if (!idea) return;
    const origText = btn.textContent;
    btn.textContent = '⏳';
    btn.disabled = true;

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: document.getElementById('ollama-model-select')?.value || 'llama3.2',
          prompt: `You are a content strategy assistant. Given this content idea, generate a brief outline (3-5 bullet points) for creating this content.\n\nIdea: ${idea.title}\nPillar: ${idea.pillar}\nFormat: ${idea.format}\n${idea.notes ? 'Notes: ' + idea.notes : ''}\n\nProvide a concise, actionable outline:`,
          stream: false,
          options: { temperature: 0.7, num_predict: 300 }
        }),
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      if (data.response) {
        ideas[idx].aiOutline = data.response.trim();
        save();
      }
    } catch (e) {
      console.warn('AI expand failed:', e);
      btn.textContent = '❌';
      setTimeout(() => { btn.textContent = origText; btn.disabled = false; }, 1500);
      return;
    }
    btn.textContent = origText;
    btn.disabled = false;
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
