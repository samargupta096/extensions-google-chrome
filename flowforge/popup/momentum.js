// FlowForge — Momentum System
const MomentumSystem = {
  tasks: [],
  CAT_ICONS: { email: '📧', chat: '💬', admin: '📋', review: '🔍', cleanup: '🧹', other: '⚡' },

  async init() {
    this.tasks = await FF.load('ff_momentum_queue') || [];
    this.bindUI();
    this.render();
    this.updateStats();
  },

  bindUI() {
    const addBtn = document.getElementById('addMomentumBtn');
    const form = document.getElementById('momentumForm');
    const saveBtn = document.getElementById('saveMomentumBtn');
    const cancelBtn = document.getElementById('cancelMomentumBtn');
    const catBtns = form.querySelectorAll('.mcat-btn');

    addBtn.addEventListener('click', () => {
      form.style.display = form.style.display === 'none' ? '' : 'none';
    });
    cancelBtn.addEventListener('click', () => { form.style.display = 'none'; });

    catBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        catBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    saveBtn.addEventListener('click', () => this.addTask());
  },

  addTask() {
    const text = document.getElementById('momentumTaskInput').value.trim();
    if (!text) return;
    const cat = document.querySelector('#momentumForm .mcat-btn.active')?.dataset.cat || 'other';

    this.tasks.push({
      id: Date.now(),
      text,
      cat,
      completed: false,
      completedDate: null,
      createdDate: FF.today()
    });

    FF.save('ff_momentum_queue', this.tasks);
    document.getElementById('momentumTaskInput').value = '';
    document.getElementById('momentumForm').style.display = 'none';
    this.render();
    this.updateStats();
    FF.toast('Task queued! 🚀');
  },

  render() {
    const list = document.getElementById('momentumList');
    const pending = this.tasks.filter(t => !t.completed);
    const doneToday = this.tasks.filter(t => t.completed && t.completedDate === FF.today());

    if (this.tasks.length === 0) {
      list.innerHTML = `
        <div class="card" style="text-align:center; padding:24px;">
          <div style="font-size:32px; margin-bottom:8px;">🚀</div>
          <div style="color:var(--text-secondary); font-size:12px;">No momentum tasks yet.<br>Add quick 5-10 min tasks to tackle after deep work!</div>
        </div>
      `;
      return;
    }

    const renderItem = (task, idx) => {
      const icon = this.CAT_ICONS[task.cat] || '⚡';
      return `
        <div class="momentum-item ${task.completed ? 'completed' : ''}" data-idx="${idx}">
          <span class="momentum-cat-icon">${icon}</span>
          <span class="momentum-text">${task.text}</span>
          <div class="momentum-check">${task.completed ? '✓' : ''}</div>
          <button class="momentum-delete" data-idx="${idx}" title="Remove">✕</button>
        </div>
      `;
    };

    let html = '';
    if (pending.length > 0) {
      html += '<div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin-bottom:6px;">Pending</div>';
      html += pending.map((t, i) => renderItem(t, this.tasks.indexOf(t))).join('');
    }
    if (doneToday.length > 0) {
      html += '<div style="font-size:10px;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;font-weight:600;margin:10px 0 6px;">Done Today ✓</div>';
      html += doneToday.map((t, i) => renderItem(t, this.tasks.indexOf(t))).join('');
    }
    list.innerHTML = html;

    // Toggle completion
    list.querySelectorAll('.momentum-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('momentum-delete')) return;
        const idx = parseInt(item.dataset.idx);
        this.tasks[idx].completed = !this.tasks[idx].completed;
        this.tasks[idx].completedDate = this.tasks[idx].completed ? FF.today() : null;
        FF.save('ff_momentum_queue', this.tasks);
        this.render();
        this.updateStats();
      });
    });

    // Delete
    list.querySelectorAll('.momentum-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.tasks.splice(parseInt(btn.dataset.idx), 1);
        FF.save('ff_momentum_queue', this.tasks);
        this.render();
        this.updateStats();
      });
    });
  },

  updateStats() {
    const today = FF.today();
    const pending = this.tasks.filter(t => !t.completed).length;
    const doneToday = this.tasks.filter(t => t.completed && t.completedDate === today).length;
    const score = doneToday * 10; // 10 points per task

    document.getElementById('momCompleted').textContent = doneToday;
    document.getElementById('momPending').textContent = pending;
    document.getElementById('momScore').textContent = score;
  }
};
