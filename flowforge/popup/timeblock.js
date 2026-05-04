// FlowForge — Time Block System
const TimeBlockSystem = {
  blocks: [],
  START_HOUR: 6,
  END_HOUR: 23,

  async init() {
    this.blocks = await FF.load('ff_timeblocks') || [];
    this.cleanOldBlocks();
    this.bindUI();
    this.renderTimeline();
    this.updateStats();
    setInterval(() => this.updateNowIndicator(), 30000);
  },

  cleanOldBlocks() {
    const today = FF.today();
    this.blocks = this.blocks.filter(b => b.date === today);
  },

  bindUI() {
    const addBtn = document.getElementById('addBlockBtn');
    const form = document.getElementById('blockForm');
    const saveBtn = document.getElementById('saveBlockBtn');
    const cancelBtn = document.getElementById('cancelBlockBtn');
    const catBtns = form.querySelectorAll('.cat-btn');

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

    saveBtn.addEventListener('click', () => this.saveBlock());

    document.getElementById('tbTemplateBtn').addEventListener('click', () => {
      this.applyTemplate();
    });
  },

  saveBlock() {
    const label = document.getElementById('blockLabel').value.trim();
    const start = document.getElementById('blockStart').value;
    const end = document.getElementById('blockEnd').value;
    const cat = document.querySelector('#blockForm .cat-btn.active')?.dataset.cat || 'deepwork';

    if (!label || !start || !end) return FF.toast('Fill all fields', 'error');
    if (start >= end) return FF.toast('End must be after start', 'error');

    this.blocks.push({
      id: Date.now(), label, start, end, cat,
      date: FF.today(), completed: false
    });

    FF.save('ff_timeblocks', this.blocks);
    document.getElementById('blockForm').style.display = 'none';
    document.getElementById('blockLabel').value = '';
    this.renderTimeline();
    this.updateStats();
    FF.toast('Block added! 📅');
  },

  applyTemplate() {
    if (this.blocks.length > 0 && !confirm('Replace current blocks with template?')) return;
    this.blocks = [
      { id: 1, label: 'Morning Deep Work', start: '09:00', end: '11:00', cat: 'deepwork', date: FF.today(), completed: false },
      { id: 2, label: 'Admin & Email', start: '11:00', end: '12:00', cat: 'admin', date: FF.today(), completed: false },
      { id: 3, label: 'Learning Block', start: '14:00', end: '15:30', cat: 'learning', date: FF.today(), completed: false },
      { id: 4, label: 'Afternoon Deep Work', start: '15:30', end: '17:30', cat: 'deepwork', date: FF.today(), completed: false },
      { id: 5, label: 'Exercise', start: '18:00', end: '19:00', cat: 'health', date: FF.today(), completed: false },
    ];
    FF.save('ff_timeblocks', this.blocks);
    this.renderTimeline();
    this.updateStats();
    FF.toast('Template applied! 📋');
  },

  renderTimeline() {
    const container = document.getElementById('timelineSlots');
    container.innerHTML = '';

    for (let h = this.START_HOUR; h <= this.END_HOUR; h++) {
      const slot = document.createElement('div');
      slot.className = 'timeline-slot';
      slot.dataset.hour = h;
      const label = h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`;
      slot.innerHTML = `<span class="timeline-hour">${label}</span><div class="timeline-line"></div>`;
      container.appendChild(slot);
    }

    // Render blocks
    this.blocks.forEach((block, idx) => {
      const startH = parseInt(block.start.split(':')[0]);
      const startM = parseInt(block.start.split(':')[1]);
      const endH = parseInt(block.end.split(':')[0]);
      const endM = parseInt(block.end.split(':')[1]);

      const startSlot = startH - this.START_HOUR;
      const endSlot = endH - this.START_HOUR;
      const slotHeight = 28 + 2; // min-height + gap

      const top = startSlot * slotHeight + (startM / 60) * slotHeight;
      const height = ((endH * 60 + endM) - (startH * 60 + startM)) / 60 * slotHeight;

      const el = document.createElement('div');
      el.className = `timeline-block cat-${block.cat}`;
      el.style.top = `${top}px`;
      el.style.height = `${Math.max(24, height)}px`;
      el.innerHTML = `
        <span class="timeline-block-label">${block.label}</span>
        <span class="timeline-block-time">${block.start}–${block.end}</span>
        <button class="timeline-block-delete" data-idx="${idx}" title="Remove">✕</button>
      `;
      container.appendChild(el);
    });

    // Delete handlers
    container.querySelectorAll('.timeline-block-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.blocks.splice(parseInt(btn.dataset.idx), 1);
        FF.save('ff_timeblocks', this.blocks);
        this.renderTimeline();
        this.updateStats();
      });
    });

    this.updateNowIndicator();
  },

  updateNowIndicator() {
    const indicator = document.getElementById('nowIndicator');
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    if (h < this.START_HOUR || h > this.END_HOUR) {
      indicator.style.display = 'none';
      return;
    }
    const slotHeight = 30;
    const top = (h - this.START_HOUR) * slotHeight + (m / 60) * slotHeight + 12;
    indicator.style.top = `${top}px`;
    indicator.style.display = '';
  },

  updateStats() {
    const today = this.blocks.filter(b => b.date === FF.today());
    let totalMins = 0;
    today.forEach(b => {
      const [sh, sm] = b.start.split(':').map(Number);
      const [eh, em] = b.end.split(':').map(Number);
      totalMins += (eh * 60 + em) - (sh * 60 + sm);
    });

    document.getElementById('tbBlocksToday').textContent = today.length;
    document.getElementById('tbHoursPlanned').textContent = (totalMins / 60).toFixed(1) + 'h';

    const completed = today.filter(b => b.completed).length;
    const pct = today.length > 0 ? Math.round((completed / today.length) * 100) : 0;
    document.getElementById('tbAdherence').textContent = today.length > 0 ? pct + '%' : '--%';
  }
};
