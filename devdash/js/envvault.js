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

  addProfileBtn.addEventListener('click', () => {
    const name = prompt('New profile name:');
    if (name && !profiles[name]) {
      profiles[name] = [];
      activeProfile = name;
      save();
      renderProfiles();
    }
  });

  addVarBtn.addEventListener('click', () => {
    const key = prompt('Variable name (e.g. API_KEY):');
    if (!key) return;
    const value = prompt('Value:');
    if (value === null) return;
    profiles[activeProfile].push({ key, value });
    save();
  });

  copyAllBtn.addEventListener('click', () => {
    const vars = profiles[activeProfile] || [];
    const text = vars.map(v => `${v.key}=${v.value}`).join('\n');
    navigator.clipboard.writeText(text);
    copyAllBtn.textContent = '✓';
    setTimeout(() => copyAllBtn.textContent = 'Copy All', 1500);
  });
});
