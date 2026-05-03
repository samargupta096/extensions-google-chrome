// FlowForge — No Zero Days System
const NoZeroDaySystem = {
  goals: [],
  history: {},

  async init() {
    this.goals = await FF.load('ff_nzd_goals') || [];
    this.history = await FF.load('ff_nzd_history') || {};
    this.bindUI();
    this.render();
    this.renderHeatmap();
    this.updateStats();
  },

  bindUI() {
    const addBtn = document.getElementById('addGoalBtn');
    const form = document.getElementById('nzdGoalForm');
    const saveBtn = document.getElementById('saveGoalNzd');
    const cancelBtn = document.getElementById('cancelGoalNzd');

    addBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? '' : 'none';
    });
    cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });
    saveBtn.addEventListener('click', () => this.addGoal());
  },

  addGoal() {
    const name = document.getElementById('nzdGoalName').value.trim();
    const minAction = document.getElementById('nzdGoalMin').value.trim();
    if (!name) return;

    this.goals.push({
      id: Date.now(),
      name,
      minAction: minAction || 'Take one small action',
      streak: 0,
      bestStreak: 0
    });

    FF.save('ff_nzd_goals', this.goals);
    document.getElementById('nzdGoalName').value = '';
    document.getElementById('nzdGoalMin').value = '';
    document.getElementById('nzdGoalForm').style.display = 'none';
    this.render();
    this.updateStats();
    FF.toast('Goal added! 🔴');
  },

  render() {
    const list = document.getElementById('nzdGoalList');
    const today = FF.today();

    if (this.goals.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align:center; padding:24px;">
          <div style="font-size:32px; margin-bottom:8px;">🔴</div>
          <div style="color:var(--text-secondary); font-size:12px;">No goals yet.<br>Add goals and commit to doing at least ONE thing daily!</div>
        </div>
      `;
      return;
    }

    list.innerHTML = this.goals.map((goal, gi) => {
      const checked = this.history[today]?.includes(goal.id);
      const streak = this.calcStreak(goal.id);

      return `
        <div class="nzd-goal-card ${checked ? 'checked-today' : ''}">
          <div class="nzd-goal-header">
            <span class="nzd-goal-name">${goal.name}</span>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="nzd-goal-streak"><span class="flame">🔥</span> ${streak}d</span>
              <button class="nzd-delete-btn" data-gi="${gi}" title="Delete">✕</button>
            </div>
          </div>
          <div class="nzd-goal-min">Min: "${goal.minAction}"</div>
          <div class="nzd-goal-action">
            <button class="nzd-check-btn ${checked ? 'checked' : ''}" data-gid="${goal.id}">
              ${checked ? '✓ Done today' : '○ Mark done'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Check button handlers
    list.querySelectorAll('.nzd-check-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const gid = parseInt(btn.dataset.gid);
        this.toggleCheck(gid);
      });
    });

    // Delete handlers
    list.querySelectorAll('.nzd-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.goals.splice(parseInt(btn.dataset.gi), 1);
        FF.save('ff_nzd_goals', this.goals);
        this.render();
        this.updateStats();
        this.renderHeatmap();
      });
    });
  },

  toggleCheck(goalId) {
    const today = FF.today();
    if (!this.history[today]) this.history[today] = [];

    const idx = this.history[today].indexOf(goalId);
    if (idx >= 0) {
      this.history[today].splice(idx, 1);
    } else {
      this.history[today].push(goalId);
    }

    FF.save('ff_nzd_history', this.history);
    this.render();
    this.renderHeatmap();
    this.updateStats();
    updateGlobalStreak();

    // Check if all goals done today
    const allDone = this.goals.every(g => this.history[today]?.includes(g.id));
    if (allDone && this.goals.length > 0) {
      FF.toast('All goals checked! No Zero Day! 🎉');
    }
  },

  calcStreak(goalId) {
    let streak = 0;
    const d = new Date();
    for (let i = 0; i < 365; i++) {
      const day = d.toISOString().slice(0, 10);
      if (this.history[day]?.includes(goalId)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else if (i === 0) {
        // Today not done yet; check yesterday streak
        d.setDate(d.getDate() - 1);
        continue;
      } else {
        break;
      }
    }
    return streak;
  },

  calcOverallStreak() {
    let streak = 0;
    const d = new Date();
    if (this.goals.length === 0) return 0;

    for (let i = 0; i < 365; i++) {
      const day = d.toISOString().slice(0, 10);
      const allDone = this.goals.every(g => this.history[day]?.includes(g.id));
      if (allDone) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else if (i === 0) {
        d.setDate(d.getDate() - 1);
        continue;
      } else {
        break;
      }
    }
    return streak;
  },

  renderHeatmap() {
    const canvas = document.getElementById('nzdHeatmap');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const days = 30;
    const cellSize = Math.floor((w - 10) / days) - 2;
    const totalGoals = this.goals.length || 1;

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);
      const checked = (this.history[day] || []).filter(gid =>
        this.goals.some(g => g.id === gid)
      ).length;
      const pct = checked / totalGoals;

      const x = 4 + (days - 1 - i) * (cellSize + 2);
      const y = (h - cellSize) / 2;

      if (pct === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
      } else if (pct < 0.5) {
        ctx.fillStyle = 'rgba(108,92,231,0.3)';
      } else if (pct < 1) {
        ctx.fillStyle = 'rgba(108,92,231,0.6)';
      } else {
        ctx.fillStyle = '#6c5ce7';
      }

      ctx.beginPath();
      ctx.roundRect(x, y, cellSize, cellSize, 3);
      ctx.fill();
    }
  },

  updateStats() {
    const today = FF.today();
    const checkedToday = (this.history[today] || []).filter(gid =>
      this.goals.some(g => g.id === gid)
    ).length;
    const pct = this.goals.length > 0 ? Math.round((checkedToday / this.goals.length) * 100) : 0;

    const currentStreak = this.calcOverallStreak();
    let longestStreak = currentStreak;

    // Save streaks
    FF.save('ff_nzd_streaks', { current: currentStreak, longest: longestStreak });

    document.getElementById('nzdCurrentStreak').textContent = currentStreak;
    document.getElementById('nzdLongestStreak').textContent = longestStreak;
    document.getElementById('nzdTodayPct').textContent = pct + '%';
  }
};
