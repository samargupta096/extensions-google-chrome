document.addEventListener('DOMContentLoaded', () => {
  const jobList = document.getElementById('cron-job-list');
  const addBtn = document.getElementById('cron-add-btn');
  const modal = document.getElementById('cron-modal');
  const saveBtn = document.getElementById('cron-save-btn');
  const cancelBtn = document.getElementById('cron-cancel-btn');
  
  const nameInput = document.getElementById('cron-name');
  const expInput = document.getElementById('cron-exp');

  let jobs = [];

  // Load jobs
  chrome.storage.local.get(['cron_jobs'], (result) => {
    jobs = result.cron_jobs || [
      { id: 1, name: 'Database Backup', exp: '0 0 * * *', lastStatus: 'success', lastRun: Date.now() - 86400000 },
      { id: 2, name: 'Log Rotation', exp: '*/30 * * * *', lastStatus: 'success', lastRun: Date.now() - 1800000 }
    ];
    renderJobs();
  });

  function renderJobs() {
    jobList.innerHTML = '';
    jobs.forEach(job => {
      const item = document.createElement('div');
      item.className = 'cron-item';
      
      const nextRun = calculateNextRun(job.exp);

      item.innerHTML = `
        <div class="cron-info">
          <span class="cron-name">${job.name}</span>
          <span class="cron-exp-text">${job.exp}</span>
          <span class="cron-next">Next: ${nextRun}</span>
        </div>
        <div class="cron-actions">
          <button class="glass-btn cron-del" data-id="${job.id}">🗑️</button>
        </div>
      `;
      jobList.appendChild(item);
    });

    document.querySelectorAll('.cron-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = parseInt(e.target.dataset.id);
        jobs = jobs.filter(j => j.id !== id);
        saveJobs();
      });
    });
  }

  function saveJobs() {
    chrome.storage.local.set({ cron_jobs: jobs }, () => {
      renderJobs();
    });
  }

  // Very basic cron next-run estimator (Simplified for extension environment)
  function calculateNextRun(exp) {
    try {
      if (exp.startsWith('*/')) {
        const mins = parseInt(exp.split(' ')[0].replace('*/', ''));
        const now = new Date();
        const next = new Date(now.getTime() + (mins - (now.getMinutes() % mins)) * 60000);
        next.setSeconds(0);
        return next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (exp === '0 0 * * *') return 'Midnight';
      if (exp === '0 * * * *') return 'Top of next hour';
      return 'Scheduled';
    } catch (e) {
      return 'Invalid Exp';
    }
  }

  addBtn.addEventListener('click', () => {
    modal.style.display = 'flex';
  });

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const exp = expInput.value.trim();
    if (name && exp) {
      jobs.push({
        id: Date.now(),
        name,
        exp,
        lastStatus: 'pending',
        lastRun: null
      });
      saveJobs();
      modal.style.display = 'none';
      nameInput.value = '';
      expInput.value = '';
    }
  });
});
