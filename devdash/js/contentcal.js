// Content Calendar Widget — Weekly grid with platform chips & status tracking
document.addEventListener('DOMContentLoaded', () => {
  const calGrid = document.getElementById('contentcal-grid');
  const weekLabel = document.getElementById('contentcal-week-label');
  const prevBtn = document.getElementById('contentcal-prev');
  const nextBtn = document.getElementById('contentcal-next');
  const statsEl = document.getElementById('contentcal-stats');

  if (!calGrid) return;

  const STORAGE_KEY = 'creator_calendar';
  const PLATFORMS = {
    youtube: { emoji: '▶️', color: '#FF0000', label: 'YouTube' },
    instagram: { emoji: '📸', color: '#E1306C', label: 'Instagram' },
    x: { emoji: '𝕏', color: '#1DA1F2', label: 'X / Twitter' },
    tiktok: { emoji: '🎵', color: '#00f2ea', label: 'TikTok' },
    newsletter: { emoji: '📧', color: '#f6d365', label: 'Newsletter' }
  };
  const STATUS_COLORS = {
    planned: 'rgba(255,255,255,0.3)',
    filmed: '#f6d365',
    edited: '#fda085',
    published: '#00cec9'
  };

  let calData = {};
  let currentWeekOffset = 0;

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    calData = res[STORAGE_KEY] || {};
    render();
  });

  function save() {
    chrome.storage.local.set({ [STORAGE_KEY]: calData }, render);
  }

  function getWeekDays(offset) {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(now.setDate(diff));
    monday.setDate(monday.getDate() + (offset * 7));
    monday.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }

  function dateKey(d) {
    return d.toISOString().slice(0, 10);
  }

  function weekKey(days) {
    const y = days[0].getFullYear();
    const start = new Date(y, 0, 1);
    const daysSinceStart = Math.floor((days[0] - start) / 86400000);
    const weekNum = Math.ceil((daysSinceStart + start.getDay() + 1) / 7);
    return `${y}-W${String(weekNum).padStart(2, '0')}`;
  }

  function render() {
    const days = getWeekDays(currentWeekOffset);
    const wk = weekKey(days);
    const today = dateKey(new Date());
    const weekData = calData[wk] || {};

    // Week label
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (weekLabel) {
      weekLabel.textContent = `${monthNames[days[0].getMonth()]} ${days[0].getDate()} – ${monthNames[days[6].getMonth()]} ${days[6].getDate()}`;
    }

    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    let publishedDays = 0;

    calGrid.innerHTML = days.map((d, i) => {
      const dk = dateKey(d);
      const entries = weekData[dk] || [];
      const isToday = dk === today;
      const hasPublished = entries.some(e => e.status === 'published');
      if (hasPublished) publishedDays++;

      const chips = entries.map(e => {
        const plat = PLATFORMS[e.platforms[0]] || PLATFORMS.youtube;
        const statusColor = STATUS_COLORS[e.status] || STATUS_COLORS.planned;
        return `<div class="cal-chip" style="background:${statusColor}" title="${escHtml(e.title)} (${e.status})">${plat.emoji}</div>`;
      }).join('');

      return `
        <div class="cal-day-cell ${isToday ? 'cal-today' : ''}" data-date="${dk}">
          <div class="cal-day-header">
            <span class="cal-day-name">${dayNames[i]}</span>
            <span class="cal-day-num">${d.getDate()}</span>
          </div>
          <div class="cal-day-chips">${chips}</div>
          <button class="cal-add-btn" data-date="${dk}" title="Add content">+</button>
        </div>`;
    }).join('');

    // Stats
    if (statsEl) {
      statsEl.innerHTML = `<span class="cal-stats-text">${publishedDays}/7 days posted</span>
        <div class="cal-stats-bar"><div class="cal-stats-fill" style="width:${(publishedDays / 7) * 100}%"></div></div>`;
    }

    // Bind add buttons
    calGrid.querySelectorAll('.cal-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        showCalModal(btn.dataset.date, wk);
      });
    });

    // Click on chips to view/edit
    calGrid.querySelectorAll('.cal-day-cell').forEach(cell => {
      cell.addEventListener('dblclick', () => {
        showCalModal(cell.dataset.date, wk);
      });
    });
  }

  function showCalModal(date, wk) {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';

    const platOptions = Object.entries(PLATFORMS).map(([k, v]) =>
      `<label class="cal-plat-check"><input type="checkbox" value="${k}"> ${v.emoji} ${v.label}</label>`
    ).join('');

    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:340px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">📅 Add Content — ${date}</h3>
        <input type="text" id="cal-modal-title" class="glass-input" style="width:100%;box-sizing:border-box;margin-bottom:0.75rem;" placeholder="Content title..." autofocus>
        <div style="margin-bottom:0.75rem;">
          <label style="display:block;font-size:0.8rem;color:var(--text-dim);margin-bottom:0.4rem;">Platforms</label>
          <div class="cal-plat-list">${platOptions}</div>
        </div>
        <select id="cal-modal-status" class="glass-select" style="width:100%;margin-bottom:0.75rem;">
          <option value="planned">📋 Planned</option>
          <option value="filmed">🎬 Filmed</option>
          <option value="edited">✂️ Edited</option>
          <option value="published">✅ Published</option>
        </select>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;">
          <button id="cal-modal-cancel" class="glass-btn">Cancel</button>
          <button id="cal-modal-save" class="glass-btn btn-primary">Add</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#cal-modal-title').focus();

    overlay.querySelector('#cal-modal-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#cal-modal-save').addEventListener('click', () => {
      const title = overlay.querySelector('#cal-modal-title').value.trim();
      if (!title) return;
      const platforms = Array.from(overlay.querySelectorAll('.cal-plat-check input:checked')).map(cb => cb.value);
      if (platforms.length === 0) platforms.push('youtube');
      const status = overlay.querySelector('#cal-modal-status').value;

      if (!calData[wk]) calData[wk] = {};
      if (!calData[wk][date]) calData[wk][date] = [];
      calData[wk][date].push({ id: crypto.randomUUID(), title, platforms, status, link: '' });

      document.body.removeChild(overlay);
      save();
    });
  }

  prevBtn && prevBtn.addEventListener('click', () => { currentWeekOffset--; render(); });
  nextBtn && nextBtn.addEventListener('click', () => { currentWeekOffset++; render(); });

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
});
