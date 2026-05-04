// Time Blocks Widget — DevDash mini version
document.addEventListener('DOMContentLoaded', () => {
  const timeline = document.getElementById('timeblocks-timeline');
  const countEl = document.getElementById('timeblocks-count');
  const hoursEl = document.getElementById('timeblocks-hours');
  if (!timeline) return;

  const KEY = 'ff_timeblocks';
  const CAT_COLORS = { deepwork: '#6c5ce7', admin: '#00cec9', learning: '#00b894', health: '#e17055', creative: '#fd79a8' };

  function today() { return new Date().toISOString().slice(0, 10); }

  FlowForgeSync.load(KEY).then((res) => {
    const blocks = (res || []).filter(b => b.date === today());
    render(blocks);
  });

  function render(blocks) {
    if (blocks.length === 0) {
      timeline.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary);font-size:11px;">No blocks today. Plan your day! 📅</div>';
      countEl.textContent = '0';
      hoursEl.textContent = '0h';
      return;
    }

    let totalMins = 0;
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    timeline.innerHTML = blocks.sort((a, b) => a.start.localeCompare(b.start)).map(block => {
      const [sh, sm] = block.start.split(':').map(Number);
      const [eh, em] = block.end.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      totalMins += endMins - startMins;
      const isCurrent = nowMins >= startMins && nowMins < endMins;
      const isPast = nowMins >= endMins;
      const color = CAT_COLORS[block.cat] || '#6c5ce7';

      return `
        <div class="tb-block ${isCurrent ? 'current' : ''} ${isPast ? 'past' : ''}" style="border-left: 3px solid ${color};">
          <div class="tb-time">${block.start} – ${block.end}</div>
          <div class="tb-label">${block.label}</div>
          ${isCurrent ? '<span class="tb-now-badge">NOW</span>' : ''}
        </div>
      `;
    }).join('');

    countEl.textContent = blocks.length;
    hoursEl.textContent = (totalMins / 60).toFixed(1) + 'h';
  }
});
