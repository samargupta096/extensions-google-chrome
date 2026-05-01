document.addEventListener('DOMContentLoaded', () => {
  const profileSelect = document.getElementById('env-profile-select');
  const addProfileBtn = document.getElementById('env-add-profile-btn');
  const addVarBtn = document.getElementById('env-add-var-btn');
  const copyAllBtn = document.getElementById('env-copy-all-btn');
  const varList = document.getElementById('env-var-list');

  if (!profileSelect) return;

  let profiles = {};
  let activeProfile = 'dev';

  chrome.storage.local.get(['env_profiles'], (result) => {
    profiles = result.env_profiles || {
      dev: [
        { key: 'API_URL', value: 'http://localhost:3000' },
        { key: 'DB_HOST', value: 'localhost:5432' },
        { key: 'DEBUG', value: 'true' }
      ],
      staging: [
        { key: 'API_URL', value: 'https://staging-api.example.com' },
        { key: 'DB_HOST', value: 'staging-db.example.com' },
        { key: 'DEBUG', value: 'false' }
      ],
      prod: [
        { key: 'API_URL', value: 'https://api.example.com' },
        { key: 'DB_HOST', value: 'prod-db.example.com' },
        { key: 'DEBUG', value: 'false' }
      ]
    };
    renderProfiles();
    renderVars();
  });

  function renderProfiles() {
    profileSelect.innerHTML = Object.keys(profiles).map(p =>
      `<option value="${p}" ${p === activeProfile ? 'selected' : ''}>${p}</option>`
    ).join('');
  }

  function renderVars() {
    const vars = profiles[activeProfile] || [];
    varList.innerHTML = vars.length === 0
      ? '<div style="text-align:center;color:var(--text-dim);padding:1rem;font-size:0.8rem;">No variables in this profile.</div>'
      : vars.map((v, i) => `
        <div class="env-var-item">
          <span class="env-key">${v.key}</span>
          <span class="env-val">${v.value}</span>
          <button class="env-copy-btn" data-val="${v.key}=${v.value}" title="Copy">📋</button>
          <button class="env-del-btn" data-idx="${i}" title="Delete">×</button>
        </div>
      `).join('');

    varList.querySelectorAll('.env-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.val);
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = '📋', 1500);
      });
    });

    varList.querySelectorAll('.env-del-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        profiles[activeProfile].splice(parseInt(btn.dataset.idx), 1);
        save();
      });
    });
  }

  function save() {
    chrome.storage.local.set({ env_profiles: profiles }, () => renderVars());
  }

  profileSelect.addEventListener('change', () => {
    activeProfile = profileSelect.value;
    renderVars();
  });

  function showModal(title, fields, callback) {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    
    let fieldsHtml = fields.map((f, i) => `
      <div style="margin-bottom: 1rem;">
        <label style="display:block; margin-bottom: 0.5rem; font-size: 0.9rem; color: var(--text-dim);">${f.label}</label>
        <input type="text" id="modal-input-${f.id}" class="glass-input" style="width: 100%; box-sizing: border-box;" placeholder="${f.placeholder || ''}" ${i === 0 ? 'autofocus' : ''}>
      </div>
    `).join('');

    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width: 300px; padding: 1.5rem; border-radius: var(--widget-radius); animation: fade-in 0.2s ease;">
        <h3 style="margin-top: 0; margin-bottom: 1.5rem;">${title}</h3>
        ${fieldsHtml}
        <div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.5rem;">
          <button id="modal-cancel" class="glass-btn">Cancel</button>
          <button id="modal-save" class="glass-btn btn-primary">Save</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);

    const firstInput = overlay.querySelector('input');
    if (firstInput) firstInput.focus();

    overlay.querySelector('#modal-cancel').addEventListener('click', () => {
      document.body.removeChild(overlay);
      callback(null);
    });

    overlay.querySelector('#modal-save').addEventListener('click', () => {
      const results = {};
      fields.forEach(f => {
        results[f.id] = overlay.querySelector(`#modal-input-${f.id}`).value.trim();
      });
      document.body.removeChild(overlay);
      callback(results);
    });
  }

  addProfileBtn.addEventListener('click', () => {
    showModal('New Profile', [{ id: 'name', label: 'Profile Name', placeholder: 'e.g. testing' }], (res) => {
      if (res && res.name && !profiles[res.name]) {
        profiles[res.name] = [];
        activeProfile = res.name;
        save();
        renderProfiles();
      }
    });
  });

  addVarBtn.addEventListener('click', () => {
    showModal('New Variable', [
      { id: 'key', label: 'Variable Name', placeholder: 'API_KEY' },
      { id: 'value', label: 'Value', placeholder: 'your_value_here' }
    ], (res) => {
      if (res && res.key) {
        profiles[activeProfile].push({ key: res.key, value: res.value || '' });
        save();
      }
    });
  });

  copyAllBtn.addEventListener('click', () => {
    const vars = profiles[activeProfile] || [];
    const text = vars.map(v => `${v.key}=${v.value}`).join('\n');
    navigator.clipboard.writeText(text);
    copyAllBtn.textContent = '✓';
    setTimeout(() => copyAllBtn.textContent = 'Copy All', 1500);
  });
});
