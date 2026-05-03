// Backup & Security Checklist Widget
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('backupcheck-list');
  const progressEl = document.getElementById('backupcheck-progress');
  const monthLabel = document.getElementById('backupcheck-month');

  if (!listEl) return;

  const STORAGE_KEY = 'creator_backup_checklist';
  const CHECKS = [
    { id: '2fa', label: 'Verified 2FA on all main accounts' },
    { id: 'local_backup', label: 'Local backup of this month\'s raw footage' },
    { id: 'cloud_sync', label: 'Cloud sync verified (Drive/Dropbox)' },
    { id: 'passwords', label: 'Rotated password for main email' },
    { id: 'finances', label: 'Downloaded invoices/payout statements' }
  ];

  let state = { month: '', checked: [] };

  function getCurrentMonthKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    state = res[STORAGE_KEY] || { month: '', checked: [] };
    const currentMonth = getCurrentMonthKey();
    
    // Auto-reset on new month
    if (state.month !== currentMonth) {
      state = { month: currentMonth, checked: [] };
      save();
    }
    render();
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: state });
  }

  function render() {
    if (monthLabel) {
      const d = new Date();
      monthLabel.textContent = d.toLocaleString('default', { month: 'long', year: 'numeric' });
    }

    listEl.innerHTML = CHECKS.map(c => {
      const isChecked = state.checked.includes(c.id);
      return `
        <label class="backup-item ${isChecked ? 'checked' : ''}">
          <input type="checkbox" value="${c.id}" ${isChecked ? 'checked' : ''}>
          <span class="backup-label">${c.label}</span>
        </label>
      `;
    }).join('');

    // Bind checkboxes
    listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!state.checked.includes(e.target.value)) state.checked.push(e.target.value);
        } else {
          state.checked = state.checked.filter(id => id !== e.target.value);
        }
        save();
        renderProgress();
        // toggle class for styling
        e.target.parentElement.classList.toggle('checked', e.target.checked);
      });
    });

    renderProgress();
  }

  function renderProgress() {
    if (!progressEl) return;
    const pct = (state.checked.length / CHECKS.length) * 100;
    progressEl.innerHTML = `
      <div class="backup-progress-bar">
        <div class="backup-progress-fill" style="width:${pct}%; background:${pct === 100 ? '#00cec9' : 'linear-gradient(90deg, #ff6b6b, #f6d365)'}"></div>
      </div>
      <div class="backup-status">${state.checked.length}/${CHECKS.length} Secured</div>
    `;
  }
});
