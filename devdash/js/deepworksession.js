// Deep Work Session Widget — DevDash mini version
document.addEventListener('DOMContentLoaded', () => {
  const totalEl = document.getElementById('dws-total');
  const sessionsEl = document.getElementById('dws-sessions');
  const qualityEl = document.getElementById('dws-quality');
  const listEl = document.getElementById('dws-list');
  if (!totalEl) return;

  const KEY = 'ff_deepwork_sessions';
  function today() { return new Date().toISOString().slice(0, 10); }

  FlowForgeSync.load(KEY).then((res) => {
    const sessions = (res || []).filter(s => s.date === today());
    render(sessions);
  });

  function render(sessions) {
    const totalMins = sessions.reduce((sum, s) => sum + s.duration, 0);
    const avgQ = sessions.length > 0 ? Math.round(sessions.reduce((sum, s) => sum + s.quality, 0) / sessions.length) : 0;

    totalEl.textContent = (totalMins / 60).toFixed(1) + 'h';
    sessionsEl.textContent = sessions.length;
    qualityEl.textContent = sessions.length > 0 ? avgQ + '/100' : '--';

    if (sessions.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary);font-size:11px;">No deep work sessions today yet 🔥</div>';
      return;
    }

    listEl.innerHTML = sessions.reverse().slice(0, 5).map(s => {
      const qClass = s.quality >= 80 ? 'dws-q-high' : s.quality >= 50 ? 'dws-q-mid' : 'dws-q-low';
      return `<div class="dws-item"><span class="dws-tag">${s.tag}</span><span class="dws-dur">${s.duration}m</span><span class="dws-qual ${qClass}">${s.quality}</span></div>`;
    }).join('');
  }
});
