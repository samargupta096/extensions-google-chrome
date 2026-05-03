// No Zero Day Widget — DevDash mini version
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('nzd-list-widget');
  const streakEl = document.getElementById('nzd-streak-widget');
  const pctEl = document.getElementById('nzd-pct-widget');
  if (!listEl) return;

  const GOALS_KEY = 'ff_nzd_goals';
  const HIST_KEY = 'ff_nzd_history';
  function today() { return new Date().toISOString().slice(0, 10); }

  Promise.all([
    FlowForgeSync.load(GOALS_KEY),
    FlowForgeSync.load(HIST_KEY)
  ]).then(([goals, history]) => {
    render(goals || [], history || {});
  });

  function calcStreak(goalId, history) {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const day = d.toISOString().slice(0, 10);
      if (history[day]?.includes(goalId)) { streak++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    return streak;
  }

  function render(goals, history) {
    const t = today();
    const checked = history[t] || [];

    if (goals.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary);font-size:11px;">No goals. Add some in FlowForge! 🔴</div>';
      streakEl.textContent = '0';
      pctEl.textContent = '0%';
      return;
    }

    const pct = Math.round((checked.filter(id => goals.some(g => g.id === id)).length / goals.length) * 100);
    pctEl.textContent = pct + '%';

    let maxStreak = 0;
    listEl.innerHTML = goals.map(goal => {
      const isDone = checked.includes(goal.id);
      const streak = calcStreak(goal.id, history);
      if (streak > maxStreak) maxStreak = streak;
      return `
        <div class="nzd-item ${isDone ? 'done' : ''}" data-gid="${goal.id}">
          <span class="nzd-check-w">${isDone ? '✓' : '○'}</span>
          <span class="nzd-name-w">${goal.name}</span>
          <span class="nzd-streak-w">🔥${streak}</span>
        </div>
      `;
    }).join('');

    streakEl.textContent = maxStreak;

    listEl.querySelectorAll('.nzd-item').forEach(el => {
      el.addEventListener('click', () => {
        const gid = parseInt(el.dataset.gid);
        if (!history[t]) history[t] = [];
        const idx = history[t].indexOf(gid);
        if (idx >= 0) history[t].splice(idx, 1);
        else history[t].push(gid);
        FlowForgeSync.save(HIST_KEY, history);
        render(goals, history);
      });
    });
  }
});
