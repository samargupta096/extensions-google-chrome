// Experiment Tracker — A/B test definitions with metric comparison
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('exp-list');
  const addBtn = document.getElementById('exp-add-btn');

  if (!listEl) return;

  const STORAGE_KEY = 'creator_experiments';
  let experiments = [];

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    experiments = res[STORAGE_KEY] || [];
    render();
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: experiments }, render);
  }

  function render() {
    if (experiments.length === 0) {
      listEl.innerHTML = '<div class="exp-empty">No experiments yet. Tap + to start an A/B test!</div>';
      return;
    }

    listEl.innerHTML = experiments.map((exp, ei) => {
      const vA = exp.variants[0] || { name: 'A', pieces: [] };
      const vB = exp.variants[1] || { name: 'B', pieces: [] };
      const avgA = vA.pieces.length ? (vA.pieces.reduce((s, p) => s + (p.metric || 0), 0) / vA.pieces.length) : 0;
      const avgB = vB.pieces.length ? (vB.pieces.reduce((s, p) => s + (p.metric || 0), 0) / vB.pieces.length) : 0;
      const winner = exp.status === 'concluded' ? (avgA > avgB ? 'A' : avgB > avgA ? 'B' : 'Tie') : '';
      const statusBadge = exp.status === 'concluded'
        ? `<span class="exp-status-badge concluded">Concluded${winner ? ' — ' + winner + ' wins' : ''}</span>`
        : '<span class="exp-status-badge running">Running</span>';

      return `
        <div class="exp-card">
          <div class="exp-card-header">
            <strong class="exp-name">${escHtml(exp.name)}</strong>
            ${statusBadge}
          </div>
          <div class="exp-hypothesis">${escHtml(exp.hypothesis)}</div>
          <div class="exp-comparison">
            <div class="exp-variant">
              <div class="exp-variant-label">${escHtml(vA.name)}</div>
              <div class="exp-variant-avg">${avgA.toFixed(1)}</div>
              <div class="exp-variant-count">${vA.pieces.length} pieces</div>
              <button class="idea-action-btn exp-add-piece-btn" data-ei="${ei}" data-vi="0">+ Add</button>
            </div>
            <div class="exp-vs">vs</div>
            <div class="exp-variant">
              <div class="exp-variant-label">${escHtml(vB.name)}</div>
              <div class="exp-variant-avg">${avgB.toFixed(1)}</div>
              <div class="exp-variant-count">${vB.pieces.length} pieces</div>
              <button class="idea-action-btn exp-add-piece-btn" data-ei="${ei}" data-vi="1">+ Add</button>
            </div>
          </div>
          <div class="exp-card-actions">
            ${exp.status === 'running' ? `<button class="glass-btn btn-small exp-conclude-btn" data-ei="${ei}">Conclude</button>` : ''}
            <button class="idea-action-btn exp-del-btn" data-ei="${ei}" title="Delete">×</button>
          </div>
        </div>`;
    }).join('');

    // Bind actions
    listEl.querySelectorAll('.exp-add-piece-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ei = parseInt(btn.dataset.ei);
        const vi = parseInt(btn.dataset.vi);
        showPieceModal(ei, vi);
      });
    });

    listEl.querySelectorAll('.exp-conclude-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        experiments[parseInt(btn.dataset.ei)].status = 'concluded';
        save();
      });
    });

    listEl.querySelectorAll('.exp-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        experiments.splice(parseInt(btn.dataset.ei), 1);
        save();
      });
    });
  }

  addBtn && addBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:340px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">🧪 New Experiment</h3>
        <input type="text" id="exp-modal-name" class="glass-input" style="width:100%;box-sizing:border-box;margin-bottom:0.75rem;" placeholder="Experiment name..." autofocus>
        <textarea id="exp-modal-hypo" class="glass-input" style="width:100%;box-sizing:border-box;min-height:40px;resize:vertical;margin-bottom:0.75rem;" placeholder="Hypothesis (e.g. Short hooks get more views)"></textarea>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.75rem;">
          <input type="text" id="exp-modal-va" class="glass-input" style="flex:1;" placeholder="Variant A name" value="Short Hook">
          <input type="text" id="exp-modal-vb" class="glass-input" style="flex:1;" placeholder="Variant B name" value="Long Hook">
        </div>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="exp-modal-cancel" class="glass-btn">Cancel</button>
          <button id="exp-modal-save" class="glass-btn btn-primary">Create</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#exp-modal-name').focus();

    overlay.querySelector('#exp-modal-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#exp-modal-save').addEventListener('click', () => {
      const name = overlay.querySelector('#exp-modal-name').value.trim();
      if (!name) return;
      experiments.unshift({
        id: crypto.randomUUID(),
        name,
        hypothesis: overlay.querySelector('#exp-modal-hypo').value.trim(),
        variants: [
          { name: overlay.querySelector('#exp-modal-va').value.trim() || 'A', pieces: [] },
          { name: overlay.querySelector('#exp-modal-vb').value.trim() || 'B', pieces: [] }
        ],
        status: 'running',
        createdAt: Date.now()
      });
      document.body.removeChild(overlay);
      save();
    });
  });

  function showPieceModal(ei, vi) {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:300px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">📊 Add Data Point</h3>
        <input type="text" id="piece-title" class="glass-input" style="width:100%;box-sizing:border-box;margin-bottom:0.75rem;" placeholder="Content title..." autofocus>
        <input type="number" id="piece-metric" class="glass-input" style="width:100%;box-sizing:border-box;margin-bottom:0.75rem;" placeholder="Metric (views, CTR, etc.)">
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="piece-cancel" class="glass-btn">Cancel</button>
          <button id="piece-save" class="glass-btn btn-primary">Add</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#piece-title').focus();

    overlay.querySelector('#piece-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#piece-save').addEventListener('click', () => {
      const title = overlay.querySelector('#piece-title').value.trim();
      const metric = parseFloat(overlay.querySelector('#piece-metric').value) || 0;
      if (title) {
        experiments[ei].variants[vi].pieces.push({ title, metric });
        save();
      }
      document.body.removeChild(overlay);
    });
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
