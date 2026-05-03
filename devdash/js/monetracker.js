// Monetization Tracker — YouTube progress bars + income stream tracking
document.addEventListener('DOMContentLoaded', () => {
  const subsInput = document.getElementById('monet-subs');
  const hoursInput = document.getElementById('monet-hours');
  const saveBtn = document.getElementById('monet-save-btn');
  const progressEl = document.getElementById('monet-progress');
  const incomeEl = document.getElementById('monet-income-list');
  const addIncomeBtn = document.getElementById('monet-add-income-btn');
  const totalEl = document.getElementById('monet-total');
  const riskEl = document.getElementById('monet-risk');

  if (!progressEl) return;

  const STORAGE_KEY = 'creator_monetization';
  let data = { subs: 0, watchHours: 0, income: [] };

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    data = res[STORAGE_KEY] || { subs: 0, watchHours: 0, income: [
      { source: 'Ads', amount: 0 },
      { source: 'Sponsorships', amount: 0 },
      { source: 'Affiliate', amount: 0 },
      { source: 'Products', amount: 0 }
    ]};
    if (subsInput) subsInput.value = data.subs || '';
    if (hoursInput) hoursInput.value = data.watchHours || '';
    renderProgress();
    renderIncome();
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  saveBtn && saveBtn.addEventListener('click', () => {
    data.subs = parseInt(subsInput.value) || 0;
    data.watchHours = parseInt(hoursInput.value) || 0;
    save();
    renderProgress();
    saveBtn.textContent = '✅';
    setTimeout(() => saveBtn.textContent = 'Update', 1500);
  });

  function renderProgress() {
    const subsPct = Math.min(100, (data.subs / 1000) * 100);
    const hoursPct = Math.min(100, (data.watchHours / 4000) * 100);

    progressEl.innerHTML = `
      <div class="monet-progress-row">
        <div class="monet-progress-label">
          <span>Subscribers</span>
          <span class="monet-progress-count">${formatNum(data.subs)} / 1,000</span>
        </div>
        <div class="monet-progress-bar">
          <div class="monet-progress-fill monet-fill-subs" style="width:${subsPct}%"></div>
        </div>
      </div>
      <div class="monet-progress-row">
        <div class="monet-progress-label">
          <span>Watch Hours</span>
          <span class="monet-progress-count">${formatNum(data.watchHours)} / 4,000</span>
        </div>
        <div class="monet-progress-bar">
          <div class="monet-progress-fill monet-fill-hours" style="width:${hoursPct}%"></div>
        </div>
      </div>
      ${subsPct >= 100 && hoursPct >= 100 ? '<div class="monet-eligible">🎉 Monetization eligible!</div>' : ''}
    `;
  }

  function renderIncome() {
    if (!incomeEl) return;
    const income = data.income || [];

    incomeEl.innerHTML = income.map((item, i) => `
      <div class="monet-income-row">
        <span class="monet-income-source">${escHtml(item.source)}</span>
        <div class="monet-income-input-wrap">
          <span class="monet-currency">$</span>
          <input type="number" class="glass-input monet-amount-input" data-idx="${i}" value="${item.amount || 0}" min="0">
        </div>
        <button class="idea-action-btn monet-del-btn" data-idx="${i}" title="Remove">×</button>
      </div>
    `).join('');

    // Bind amount changes
    incomeEl.querySelectorAll('.monet-amount-input').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.idx);
        data.income[idx].amount = parseFloat(inp.value) || 0;
        save();
        updateTotals();
      });
    });

    incomeEl.querySelectorAll('.monet-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        data.income.splice(parseInt(btn.dataset.idx), 1);
        save();
        renderIncome();
      });
    });

    updateTotals();
  }

  function updateTotals() {
    const income = data.income || [];
    const total = income.reduce((s, i) => s + (i.amount || 0), 0);
    if (totalEl) totalEl.textContent = `$${total.toLocaleString()}/mo`;

    // Risk check
    if (riskEl && total > 0) {
      const max = Math.max(...income.map(i => i.amount || 0));
      const maxPct = (max / total) * 100;
      const maxSource = income.find(i => i.amount === max);
      if (maxPct > 70) {
        riskEl.innerHTML = `<span class="monet-risk-warn">⚠️ ${Math.round(maxPct)}% from ${escHtml(maxSource?.source || 'one source')} — consider diversifying</span>`;
      } else {
        riskEl.innerHTML = `<span class="monet-risk-ok">✅ Income well diversified</span>`;
      }
    }
  }

  addIncomeBtn && addIncomeBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:280px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">💰 Add Income Stream</h3>
        <input type="text" id="income-modal-name" class="glass-input" style="width:100%;box-sizing:border-box;margin-bottom:0.75rem;" placeholder="Source name (e.g. Patreon)" autofocus>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="income-cancel" class="glass-btn">Cancel</button>
          <button id="income-save" class="glass-btn btn-primary">Add</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#income-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#income-save').addEventListener('click', () => {
      const name = overlay.querySelector('#income-modal-name').value.trim();
      if (name) {
        data.income.push({ source: name, amount: 0 });
        save();
        renderIncome();
      }
      document.body.removeChild(overlay);
    });
  });

  function formatNum(n) { return (n || 0).toLocaleString(); }
  function escHtml(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
});
