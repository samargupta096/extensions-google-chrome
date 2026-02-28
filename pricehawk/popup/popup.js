const COLORS = ['#6C5CE7','#00CEC9','#FD79A8','#FDCB6E','#00B894','#E17055','#74B9FF','#A29BFE'];

document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  loadProducts();
  loadStats();
  checkOllama();
  setupDelegation();

  document.getElementById('btn-add').addEventListener('click', addProduct);
  document.getElementById('btn-autofill').addEventListener('click', autofill);
  document.getElementById('model-select').addEventListener('change', saveSelectedModel);
});

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.style.display='none');
      tab.classList.add('active');
      document.getElementById('tab-'+tab.dataset.tab).style.display='block';
      if (tab.dataset.tab === 'products') loadProducts();
      if (tab.dataset.tab === 'stats') loadStats();
    });
  });
}

function setupDelegation() {
  // Use event delegation for list elements loaded dynamically (Manifest V3 blocks inline onclick)
  document.getElementById('product-list').addEventListener('click', (e) => {
    const btnUpdate = e.target.closest('button[data-action="update"]');
    if (btnUpdate) return updatePrice(btnUpdate.dataset.id);

    const btnAnalyze = e.target.closest('button[data-action="analyze"]');
    if (btnAnalyze) return analyzeDeal(btnAnalyze.dataset.id);

    const btnDelete = e.target.closest('button[data-action="delete"]');
    if (btnDelete) return deleteProduct(btnDelete.dataset.id);
  });
}

async function addProduct() {
  const name = document.getElementById('input-name').value.trim();
  const url = document.getElementById('input-url').value.trim();
  const price = parseFloat(document.getElementById('input-price').value) || 0;
  const target = parseFloat(document.getElementById('input-target').value) || null;
  if (!name || !url) return;
  await chrome.runtime.sendMessage({ type:'ADD_PRODUCT', name, url, currentPrice: price, targetPrice: target });
  document.getElementById('input-name').value = '';
  document.getElementById('input-url').value = '';
  document.getElementById('input-price').value = '';
  document.getElementById('input-target').value = '';
  showToast('Product tracked! 📦');
}

async function autofill() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    document.getElementById('input-name').value = tab.title?.slice(0, 80) || '';
    document.getElementById('input-url').value = tab.url || '';
  }
}

async function loadProducts() {
  const { products } = await chrome.runtime.sendMessage({ type:'GET_PRODUCTS' });
  const container = document.getElementById('product-list');
  if (!products || !products.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><div class="empty-state-title">No products tracked</div><div class="empty-state-text">Add a product to start tracking prices</div></div>';
    return;
  }

  container.innerHTML = products.map(p => {
    const prices = p.priceHistory.map(h => h.price);
    const current = prices[prices.length - 1] || 0;
    const avg = prices.length > 0 ? prices.reduce((a,b)=>a+b,0)/prices.length : 0;
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;
    const isFakeSale = current > avg * 0.95 && prices.length > 2;
    const isGoodDeal = current <= min * 1.05 && prices.length > 2;

    return `<div class="product-item" data-id="${p.id}">
      <div class="product-name">${esc(p.name)}
        ${isFakeSale ? '<span class="fake-sale-badge">⚠️ Possible Fake Sale</span>' : ''}
        ${isGoodDeal ? '<span class="fake-sale-badge good-deal-badge">✅ Good Deal</span>' : ''}
      </div>
      <div class="product-domain">${p.domain}</div>
      <div class="price-row">
        <div class="price-current">${p.currency}${current.toLocaleString()}</div>
        ${p.targetPrice ? `<span class="badge badge-purple">Target: ${p.currency}${p.targetPrice}</span>` : ''}
      </div>
      <div class="price-stats">
        <div class="price-stat">Avg: <span>${p.currency}${avg.toFixed(0)}</span></div>
        <div class="price-stat">Low: <span>${p.currency}${min}</span></div>
        <div class="price-stat">High: <span>${p.currency}${max}</span></div>
      </div>
      ${prices.length > 1 ? `<div class="chart-mini"><canvas id="chart-${p.id}"></canvas></div>` : ''}
      <div class="form-row">
        <input type="number" class="input" id="price-update-${p.id}" placeholder="Update price" step="0.01" style="font-size:12px;padding:8px 10px;">
        <button class="btn btn-secondary btn-sm" data-action="update" data-id="${p.id}">Update</button>
        <button class="btn btn-secondary btn-sm" data-action="analyze" data-id="${p.id}">🤖 AI</button>
        <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${p.id}" style="color:var(--accent-red);">🗑️</button>
      </div>
      <div id="analysis-${p.id}"></div>
    </div>`;
  }).join('');

  setTimeout(() => {
    products.forEach(p => {
      const canvas = document.getElementById('chart-'+p.id);
      if (canvas && p.priceHistory.length > 1) {
        ChartUtils.lineChart(canvas, {}, {
          labels: p.priceHistory.map(h => h.date?.slice(5) || ''),
          datasets: [{ values: p.priceHistory.map(h => h.price), color: '#6C5CE7', fill: true }],
          showDots: p.priceHistory.length < 20, dotRadius: 3, lineWidth: 2, animate: false
        });
      }
    });
  }, 100);
}

window.updatePrice = async function(id) {
  const price = parseFloat(document.getElementById('price-update-'+id).value);
  if (!price) return;
  await chrome.runtime.sendMessage({ type:'UPDATE_PRICE', id, price });
  loadProducts();
};

window.analyzeDeal = async function(id) {
  const el = document.getElementById('analysis-'+id);
  el.innerHTML = '<div class="ai-analysis">🧠 Analyzing deal...</div>';
  const result = await chrome.runtime.sendMessage({ type:'ANALYZE_DEAL', id });
  el.innerHTML = `<div class="ai-analysis">${result.success ? result.text : '❌ '+result.text}</div>`;
};

window.deleteProduct = async function(id) {
  await chrome.runtime.sendMessage({ type:'DELETE_PRODUCT', id });
  loadProducts();
};

async function loadStats() {
  const stats = await chrome.runtime.sendMessage({ type:'GET_STATS' });
  document.getElementById('stat-products').textContent = stats.totalProducts;
  document.getElementById('stat-savings').textContent = '₹'+Math.round(stats.totalSavings).toLocaleString();
  const domains = Object.entries(stats.domainCounts||{}).sort(([,a],[,b])=>b-a).slice(0,5);
  if (domains.length > 0) {
    ChartUtils.horizontalBarChart(document.getElementById('chart-stores'),{},{
      labels: domains.map(([d])=>d), values: domains.map(([,v])=>v), colors: COLORS,
      formatValue: v=>`${v}`, barHeight: 24, barGap: 8
    });
  }
}

async function checkOllama() {
  const ollama = new OllamaClient();
  const available = await ollama.isAvailable();
  const el = document.getElementById('ollama-status');
  el.className = available ? 'ollama-status connected' : 'ollama-status disconnected';
  el.innerHTML = `<span class="status-dot ${available ? 'online':'offline'}"></span><span>Ollama</span>`;

  if (available) loadModels(ollama);
  else {
    const select = document.getElementById('model-select');
    if (select) { select.innerHTML = '<option value="">Ollama offline</option>'; select.classList.add('loading'); }
  }
}

async function loadModels(ollama) {
  const select = document.getElementById('model-select');
  if (!select) return;
  try {
    const models = await ollama.listModels();
    if (models.length === 0) {
      select.innerHTML = '<option value="">No models</option>';
      select.classList.add('loading');
      return;
    }

    const savedModel = (await chrome.storage.local.get('ph_settings')).ph_settings?.ollamaModel || 'qwen3:latest';

    select.innerHTML = models.map(m => {
      const name = m.name || m.model;
      const size = m.details?.parameter_size || '';
      const label = size ? `${name} (${size})` : name;
      return `<option value="${name}" ${name === savedModel ? 'selected' : ''}>${label}</option>`;
    }).join('');

    select.classList.remove('loading');

    if (!models.some(m => (m.name || m.model) === savedModel)) {
      select.selectedIndex = 0;
      saveSelectedModel();
    }
  } catch {
    select.innerHTML = '<option value="">Error</option>';
    select.classList.add('loading');
  }
}

async function saveSelectedModel() {
  const select = document.getElementById('model-select');
  const model = select.value;
  if (!model) return;
  const data = await chrome.storage.local.get('ph_settings');
  const settings = data.ph_settings || {};
  await chrome.storage.local.set({ ph_settings: { ...settings, ollamaModel: model } });
}

function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function showToast(m) { const t=document.createElement('div'); t.className='toast success'; t.textContent=m; document.body.appendChild(t); setTimeout(()=>t.remove(),2500); }
