// Platform Dependency Radar Widget
document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('radar-chart');
  const editBtn = document.getElementById('radar-edit-btn');
  const summaryEl = document.getElementById('radar-summary');
  
  if (!canvas) return;

  const STORAGE_KEY = 'creator_platform_radar';
  const DEFAULT_DATA = {
    YouTube: 10000,
    Instagram: 5000,
    Twitter: 8000,
    TikTok: 2000,
    Newsletter: 1500
  };

  let radarData = {};

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    radarData = res[STORAGE_KEY];
    if (!radarData || Object.keys(radarData).length === 0) {
      radarData = { ...DEFAULT_DATA };
    }
    renderChart();
    renderSummary();
  });

  // Listen for sync events from other widgets
  window.addEventListener('creator-data-synced', (e) => {
    const { platform, value } = e.detail;
    if (radarData.hasOwnProperty(platform)) {
      radarData[platform] = value;
      save();
      renderChart();
      renderSummary();
    }
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: radarData });
  }

  function renderChart() {
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) / 2 - 25; 
    const labels = Object.keys(radarData);
    const values = Object.values(radarData);
    const maxVal = Math.max(...values, 1);
    
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let level = 1; level <= 4; level++) {
      const r = radius * (level / 4);
      ctx.beginPath();
      for (let i = 0; i < labels.length; i++) {
        const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '10px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    for (let i = 0; i < labels.length; i++) {
      const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.stroke();

      const lx = cx + Math.cos(angle) * (radius + 15);
      const ly = cy + Math.sin(angle) * (radius + 15);
      ctx.fillText(labels[i], lx, ly);
    }

    ctx.beginPath();
    for (let i = 0; i < labels.length; i++) {
      const val = radarData[labels[i]] || 0;
      const logMax = Math.log10(maxVal);
      const logVal = val > 0 ? Math.log10(val) : 0;
      const ratio = logMax > 0 ? logVal / logMax : 0;
      
      const r = radius * Math.max(0.1, ratio); 
      const angle = (Math.PI * 2 * i) / labels.length - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    ctx.fillStyle = 'rgba(79, 172, 254, 0.3)';
    ctx.fill();
    ctx.strokeStyle = '#4facfe';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function renderSummary() {
    if (!summaryEl) return;
    const total = Object.values(radarData).reduce((a, b) => a + b, 0);
    if (total === 0) {
      summaryEl.innerHTML = '<span style="color:var(--text-dim)">No data</span>';
      return;
    }
    
    let maxPlat = '', maxVal = -1;
    for (const [p, v] of Object.entries(radarData)) {
      if (v > maxVal) { maxVal = v; maxPlat = p; }
    }
    
    const pct = (maxVal / total) * 100;
    let riskHtml = '';
    if (pct > 75) {
      riskHtml = `<div class="radar-risk high">⚠️ High risk: ${pct.toFixed(0)}% concentrated on ${maxPlat}</div>`;
    } else if (pct > 50) {
      riskHtml = `<div class="radar-risk med">🟡 Medium risk: ${pct.toFixed(0)}% on ${maxPlat}</div>`;
    } else {
      riskHtml = `<div class="radar-risk low">✅ Well diversified audience</div>`;
    }
    
    summaryEl.innerHTML = riskHtml;
  }

  editBtn && editBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    
    let inputsHtml = Object.keys(radarData).map(p => `
      <div style="display:flex;align-items:center;margin-bottom:0.5rem;gap:0.5rem;">
        <label style="width:80px;font-size:0.85rem;color:var(--text-dim);">${p}</label>
        <input type="number" class="glass-input radar-input" data-plat="${p}" value="${radarData[p]}" style="flex:1;">
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:300px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">🕸️ Audience Size</h3>
        ${inputsHtml}
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
          <button id="radar-cancel" class="glass-btn">Cancel</button>
          <button id="radar-save" class="glass-btn btn-primary">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#radar-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#radar-save').addEventListener('click', () => {
      overlay.querySelectorAll('.radar-input').forEach(inp => {
        radarData[inp.dataset.plat] = parseInt(inp.value) || 0;
      });
      save();
      renderChart();
      renderSummary();
      document.body.removeChild(overlay);
    });
  });
});
