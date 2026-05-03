// FlowForge — Main Controller
// Handles tab switching and shared utilities

const FF = {
  today() { return new Date().toISOString().slice(0, 10); },
  save(key, data) { chrome.storage.local.set({ [key]: data }); },
  load(key) {
    return new Promise(r => chrome.storage.local.get([key], res => r(res[key])));
  },
  toast(msg, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
};

// ===== Tab Switching =====
document.addEventListener('DOMContentLoaded', () => {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => { c.style.display = 'none'; });
      tab.classList.add('active');
      const target = document.getElementById('tab-' + tab.dataset.tab);
      if (target) target.style.display = '';
    });
  });

  // Expand button
  const expandBtn = document.getElementById('expandBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
    });
  }

  // Init all systems
  TriggerSystem.init();
  TimeBlockSystem.init();
  DeepWorkSystem.init();
  MomentumSystem.init();
  NoZeroDaySystem.init();
  updateGlobalStreak();
});

async function updateGlobalStreak() {
  const streaks = await FF.load('ff_nzd_streaks') || {};
  const el = document.getElementById('globalStreakCount');
  if (el) el.textContent = streaks.current || 0;
}
