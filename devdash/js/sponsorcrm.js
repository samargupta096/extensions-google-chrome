// Sponsorship CRM Widget
document.addEventListener('DOMContentLoaded', () => {
  const crmList = document.getElementById('sponsorcrm-list');
  const addBtn = document.getElementById('sponsorcrm-add-btn');
  const ratesBtn = document.getElementById('sponsorcrm-rates-btn');

  if (!crmList) return;

  const STORAGE_KEY = 'creator_sponsor_crm';
  const RATES_KEY = 'creator_sponsor_rates';
  let deals = [];
  let rates = [];

  const STATUSES = ['contacted', 'negotiating', 'signed', 'completed'];
  const STATUS_COLORS = {
    contacted: '#4facfe',
    negotiating: '#f6d365',
    signed: '#00cec9',
    completed: '#a29bfe'
  };

  chrome.storage.local.get([STORAGE_KEY, RATES_KEY], (res) => {
    deals = res[STORAGE_KEY] || [];
    rates = res[RATES_KEY] || [{ item: '60s Integration', price: 1500 }, { item: 'Dedicated Video', price: 4000 }];
    render();
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: deals });
  }

  function saveRates() {
    chrome.storage.local.set({ [RATES_KEY]: rates });
  }

  function render() {
    if (deals.length === 0) {
      crmList.innerHTML = '<div class="crm-empty">No active deals. Tap + to track a sponsorship!</div>';
      return;
    }

    // Sort by status priority (signed/negotiating first)
    const statusVal = { signed: 0, negotiating: 1, contacted: 2, completed: 3 };
    const sorted = [...deals].sort((a, b) => statusVal[a.status] - statusVal[b.status]);

    crmList.innerHTML = sorted.map(deal => {
      const origIdx = deals.indexOf(deal);
      const color = STATUS_COLORS[deal.status] || '#fff';
      return `
        <div class="crm-deal-card">
          <div class="crm-deal-header">
            <strong class="crm-brand">${escHtml(deal.brand)}</strong>
            <span class="crm-status-badge" style="background:${color}22;color:${color};border:1px solid ${color}44" data-idx="${origIdx}">
              ${deal.status.toUpperCase()}
            </span>
          </div>
          <div class="crm-deal-details">
            <span class="crm-amount">${deal.amount ? '$' + deal.amount.toLocaleString() : 'TBD'}</span>
            <span class="crm-deliverable">${escHtml(deal.deliverable)}</span>
          </div>
          <div class="crm-deal-actions">
            <button class="idea-action-btn crm-cycle-btn" data-idx="${origIdx}">⏭️</button>
            <button class="idea-action-btn crm-del-btn" data-idx="${origIdx}">×</button>
          </div>
        </div>
      `;
    }).join('');

    // Bind cycle
    crmList.querySelectorAll('.crm-cycle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.idx);
        const cur = STATUSES.indexOf(deals[i].status);
        deals[i].status = STATUSES[(cur + 1) % STATUSES.length];
        save();
        render();
      });
    });

    crmList.querySelectorAll('.crm-status-badge').forEach(badge => {
       badge.addEventListener('click', () => {
        const i = parseInt(badge.dataset.idx);
        const cur = STATUSES.indexOf(deals[i].status);
        deals[i].status = STATUSES[(cur + 1) % STATUSES.length];
        save();
        render();
       });
    });

    crmList.querySelectorAll('.crm-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        deals.splice(parseInt(btn.dataset.idx), 1);
        save();
        render();
      });
    });
  }

  addBtn && addBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:300px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">🤝 New Deal</h3>
        <input type="text" id="crm-brand" class="glass-input" style="width:100%;margin-bottom:0.75rem;" placeholder="Brand name..." autofocus>
        <input type="text" id="crm-deliverable" class="glass-input" style="width:100%;margin-bottom:0.75rem;" placeholder="Deliverable (e.g. 60s integration)">
        <input type="number" id="crm-amount" class="glass-input" style="width:100%;margin-bottom:0.75rem;" placeholder="Amount ($)">
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="crm-cancel" class="glass-btn">Cancel</button>
          <button id="crm-save" class="glass-btn btn-primary">Add</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#crm-brand').focus();

    overlay.querySelector('#crm-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#crm-save').addEventListener('click', () => {
      const brand = overlay.querySelector('#crm-brand').value.trim();
      if (!brand) return;
      deals.push({
        brand,
        deliverable: overlay.querySelector('#crm-deliverable').value.trim() || 'TBD',
        amount: parseFloat(overlay.querySelector('#crm-amount').value) || 0,
        status: 'contacted'
      });
      save();
      render();
      document.body.removeChild(overlay);
    });
  });

  ratesBtn && ratesBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    
    let ratesHtml = rates.map((r, i) => `
      <div class="crm-rate-row" style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
        <input type="text" class="glass-input crm-rate-item" data-idx="${i}" value="${escHtml(r.item)}" style="flex:2;" placeholder="Deliverable">
        <input type="number" class="glass-input crm-rate-price" data-idx="${i}" value="${r.price}" style="flex:1;" placeholder="$">
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:320px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">📋 Rate Card</h3>
        <div id="crm-rates-container">${ratesHtml}</div>
        <button id="crm-add-rate" class="glass-btn btn-small" style="width:100%;margin-bottom:1rem;">+ Add Deliverable</button>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="crm-rates-close" class="glass-btn btn-primary">Done</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#crm-add-rate').addEventListener('click', () => {
      rates.push({ item: '', price: 0 });
      saveRates();
      // lazy re-render of modal content
      ratesBtn.click();
      document.body.removeChild(overlay);
    });

    overlay.querySelectorAll('.crm-rate-item').forEach(inp => {
      inp.addEventListener('change', () => {
        rates[parseInt(inp.dataset.idx)].item = inp.value;
        saveRates();
      });
    });
    overlay.querySelectorAll('.crm-rate-price').forEach(inp => {
      inp.addEventListener('change', () => {
        rates[parseInt(inp.dataset.idx)].price = parseFloat(inp.value) || 0;
        saveRates();
      });
    });

    overlay.querySelector('#crm-rates-close').addEventListener('click', () => document.body.removeChild(overlay));
  });

  function escHtml(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
});
