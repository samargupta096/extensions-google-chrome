// FlowForge — Trigger System (Habit Stacking)
const TriggerSystem = {
  chains: [],

  async init() {
    this.chains = await FF.load('ff_trigger_chains') || [];
    this.bindUI();
    this.render();
    this.updateSummary();
  },

  bindUI() {
    const addBtn = document.getElementById('addChainBtn');
    const form = document.getElementById('chainForm');
    const saveBtn = document.getElementById('saveChainBtn');
    const cancelBtn = document.getElementById('cancelChainBtn');
    const addStepBtn = document.getElementById('addStepBtn');
    const timeSelect = document.getElementById('chainTimeSelect');
    const customTime = document.getElementById('chainCustomTime');

    addBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? '' : 'none';
    });

    cancelBtn.addEventListener('click', () => {
      form.style.display = 'none';
      this.resetForm();
    });

    addStepBtn.addEventListener('click', () => this.addStepInput());

    timeSelect.addEventListener('change', () => {
      customTime.style.display = timeSelect.value === 'custom' ? '' : 'none';
    });

    saveBtn.addEventListener('click', () => this.saveChain());
  },

  addStepInput() {
    const editor = document.getElementById('chainStepsEditor');
    const count = editor.children.length;
    const row = document.createElement('div');
    row.className = 'chain-step-row';
    row.innerHTML = `
      <span class="step-number">${count + 1}</span>
      <input type="text" class="input" placeholder="Then do..." data-step="${count}">
    `;
    editor.appendChild(row);
  },

  resetForm() {
    document.getElementById('chainNameInput').value = '';
    const editor = document.getElementById('chainStepsEditor');
    editor.innerHTML = `
      <div class="chain-step-row">
        <span class="step-number">1</span>
        <input type="text" class="input" placeholder="Trigger habit (e.g. Bathed)" data-step="0">
      </div>
      <div class="chain-step-row">
        <span class="step-number">2</span>
        <input type="text" class="input" placeholder="Then do... (e.g. 20 push-ups)" data-step="1">
      </div>
    `;
  },

  saveChain() {
    const name = document.getElementById('chainNameInput').value.trim();
    if (!name) return;

    const inputs = document.querySelectorAll('#chainStepsEditor input');
    const steps = [];
    inputs.forEach(inp => {
      const text = inp.value.trim();
      if (text) steps.push({ text, completed: false });
    });

    if (steps.length < 2) return FF.toast('Need at least 2 steps', 'error');

    const time = document.getElementById('chainTimeSelect').value;
    const customTime = document.getElementById('chainCustomTime').value;

    this.chains.push({
      id: Date.now(),
      name,
      steps,
      time: time === 'custom' ? customTime : time,
      streak: 0,
      history: {}
    });

    FF.save('ff_trigger_chains', this.chains);
    document.getElementById('chainForm').style.display = 'none';
    this.resetForm();
    this.render();
    this.updateSummary();
    FF.toast('Chain saved! ⚡');
  },

  render() {
    const list = document.getElementById('chainList');
    const today = FF.today();

    if (this.chains.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align:center; padding:24px;">
          <div style="font-size:32px; margin-bottom:8px;">⚡</div>
          <div style="color:var(--text-secondary); font-size:12px;">No habit chains yet.<br>Create your first chain to start stacking habits!</div>
        </div>
      `;
      return;
    }

    list.innerHTML = this.chains.map((chain, ci) => {
      const todaySteps = chain.history[today] || chain.steps.map(() => false);
      const allDone = todaySteps.every(s => s);

      return `
        <div class="chain-card ${allDone ? 'completed' : ''}">
          <div class="chain-card-header">
            <div class="chain-card-name">⚡ ${chain.name}</div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="chain-card-streak">🔥 ${chain.streak}d</span>
              <button class="chain-delete-btn" data-ci="${ci}" title="Delete chain">✕</button>
            </div>
          </div>
          <div class="chain-steps-list">
            ${chain.steps.map((step, si) => `
              ${si > 0 ? '<div class="chain-connector"></div>' : ''}
              <div class="chain-step-item ${todaySteps[si] ? 'completed' : ''}" data-ci="${ci}" data-si="${si}">
                <div class="chain-step-check">${todaySteps[si] ? '✓' : ''}</div>
                <span class="chain-step-text">${step.text}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Bind step clicks
    list.querySelectorAll('.chain-step-item').forEach(item => {
      item.addEventListener('click', () => {
        const ci = parseInt(item.dataset.ci);
        const si = parseInt(item.dataset.si);
        this.toggleStep(ci, si);
      });
    });

    // Bind delete
    list.querySelectorAll('.chain-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const ci = parseInt(btn.dataset.ci);
        this.chains.splice(ci, 1);
        FF.save('ff_trigger_chains', this.chains);
        this.render();
        this.updateSummary();
      });
    });
  },

  toggleStep(ci, si) {
    const today = FF.today();
    const chain = this.chains[ci];
    if (!chain.history[today]) {
      chain.history[today] = chain.steps.map(() => false);
    }

    // Can only complete steps in order
    if (si > 0 && !chain.history[today][si - 1]) {
      FF.toast('Complete the previous step first!', 'error');
      return;
    }

    chain.history[today][si] = !chain.history[today][si];
    // If unchecking, uncheck all after
    if (!chain.history[today][si]) {
      for (let i = si + 1; i < chain.steps.length; i++) {
        chain.history[today][i] = false;
      }
    }

    // Update streak
    this.updateStreak(chain);
    FF.save('ff_trigger_chains', this.chains);
    this.render();
    this.updateSummary();

    // Notify for next step
    if (chain.history[today][si] && si < chain.steps.length - 1) {
      const next = chain.steps[si + 1].text;
      FF.toast(`Next: ${next} →`);
    } else if (chain.history[today].every(s => s)) {
      FF.toast('Chain complete! 🎉');
    }
  },

  updateStreak(chain) {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const day = d.toISOString().slice(0, 10);
      const hist = chain.history[day];
      if (hist && hist.every(s => s)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else if (i === 0) {
        break; // today not done yet, streak from yesterday
      } else {
        break;
      }
    }
    chain.streak = streak;
  },

  updateSummary() {
    const today = FF.today();
    let completed = 0;
    let bestStreak = 0;
    this.chains.forEach(chain => {
      const hist = chain.history[today];
      if (hist && hist.every(s => s)) completed++;
      if (chain.streak > bestStreak) bestStreak = chain.streak;
    });

    document.getElementById('chainsCompleted').textContent = completed;
    document.getElementById('chainsTotal').textContent = this.chains.length;
    document.getElementById('chainsBestStreak').textContent = bestStreak;
  }
};
