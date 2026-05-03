// Momentum Queue Widget — DevDash mini version
document.addEventListener('DOMContentLoaded', () => {
  const listEl = document.getElementById('momentum-list-widget');
  const doneEl = document.getElementById('momentum-done');
  const pendingEl = document.getElementById('momentum-pending');
  if (!listEl) return;

  const KEY = 'ff_momentum_queue';
  const ICONS = { email: '📧', chat: '💬', admin: '📋', review: '🔍', cleanup: '🧹', other: '⚡' };
  function today() { return new Date().toISOString().slice(0, 10); }

  FlowForgeSync.load(KEY).then((res) => {
    const tasks = res || [];
    render(tasks);
  });

  function render(tasks) {
    const pending = tasks.filter(t => !t.completed);
    const doneToday = tasks.filter(t => t.completed && t.completedDate === today());

    doneEl.textContent = doneToday.length;
    pendingEl.textContent = pending.length;

    if (pending.length === 0 && doneToday.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary);font-size:11px;">No momentum tasks. Add some in FlowForge! 🚀</div>';
      return;
    }

    const items = [...pending.slice(0, 4), ...doneToday.slice(0, 2)];
    listEl.innerHTML = items.map((t, i) => {
      const icon = ICONS[t.cat] || '⚡';
      return `
        <div class="mom-item ${t.completed ? 'done' : ''}" data-idx="${tasks.indexOf(t)}">
          <span class="mom-icon">${icon}</span>
          <span class="mom-text">${t.text}</span>
          <span class="mom-check">${t.completed ? '✓' : '○'}</span>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.mom-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx);
        tasks[idx].completed = !tasks[idx].completed;
        tasks[idx].completedDate = tasks[idx].completed ? today() : null;
        FlowForgeSync.save(KEY, tasks);
        render(tasks);
      });
    });
  }
});
