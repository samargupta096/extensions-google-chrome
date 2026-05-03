// Habit Chain Widget — DevDash mini version
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('habitchain-list');
  const addBtn = document.getElementById('habitchain-add-btn');
  const form = document.getElementById('habitchain-form');
  const saveBtn = document.getElementById('habitchain-save');
  const cancelBtn = document.getElementById('habitchain-cancel');
  const nameInput = document.getElementById('habitchain-name');
  const step1 = document.getElementById('habitchain-step1');
  const step2 = document.getElementById('habitchain-step2');
  const streakEl = document.getElementById('habitchain-streak');

  if (!list) return;

  const KEY = 'ff_trigger_chains';
  let chains = [];

  function today() { return new Date().toISOString().slice(0, 10); }

  FlowForgeSync.load(KEY).then((res) => {
    chains = res || [];
    render();
  });

  addBtn.addEventListener('click', () => { form.style.display = form.style.display === 'none' ? '' : 'none'; });
  cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

  saveBtn.addEventListener('click', () => {
    const name = nameInput.value.trim();
    const s1 = step1.value.trim();
    const s2 = step2.value.trim();
    if (!name || !s1 || !s2) return;
    chains.push({ id: Date.now(), name, steps: [{ text: s1 }, { text: s2 }], time: 'morning', streak: 0, history: {} });
    FlowForgeSync.save(KEY, chains);
    nameInput.value = ''; step1.value = ''; step2.value = '';
    form.style.display = 'none';
    render();
  });

  function render() {
    const t = today();
    let bestStreak = 0;
    if (chains.length === 0) {
      list.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-tertiary);font-size:11px;">No chains yet. Add one to start! ⚡</div>';
      streakEl.textContent = '0';
      return;
    }

    list.innerHTML = chains.map((chain, ci) => {
      const todaySteps = chain.history[t] || chain.steps.map(() => false);
      if (chain.streak > bestStreak) bestStreak = chain.streak;
      return `
        <div class="hc-chain" data-ci="${ci}">
          <div class="hc-chain-header">
            <span class="hc-name">⚡ ${chain.name}</span>
            <span class="hc-streak-mini">🔥${chain.streak}</span>
          </div>
          ${chain.steps.map((step, si) => `
            <div class="hc-step ${todaySteps[si] ? 'done' : ''}" data-ci="${ci}" data-si="${si}">
              <span class="hc-check">${todaySteps[si] ? '✓' : (si + 1)}</span>
              <span class="hc-text">${step.text}</span>
            </div>
          `).join('')}
        </div>
      `;
    }).join('');

    streakEl.textContent = bestStreak;

    list.querySelectorAll('.hc-step').forEach(el => {
      el.addEventListener('click', () => {
        const ci = parseInt(el.dataset.ci);
        const si = parseInt(el.dataset.si);
        const chain = chains[ci];
        if (!chain.history[t]) chain.history[t] = chain.steps.map(() => false);
        if (si > 0 && !chain.history[t][si - 1]) return;
        chain.history[t][si] = !chain.history[t][si];
        if (!chain.history[t][si]) for (let i = si + 1; i < chain.steps.length; i++) chain.history[t][i] = false;
        // Update streak
        let streak = 0;
        const d = new Date();
        for (let i = 0; i < 365; i++) {
          const day = d.toISOString().slice(0, 10);
          if (chain.history[day]?.every(s => s)) { streak++; d.setDate(d.getDate() - 1); }
          else if (i === 0) break;
          else break;
        }
        chain.streak = streak;
        FlowForgeSync.save(KEY, chains);
        render();
      });
    });
  }
});
