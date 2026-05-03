// FlowForge — Deep Work System
const DeepWorkSystem = {
  sessions: [],
  blockList: [],
  activeSession: null,
  timerInterval: null,
  CIRCUMFERENCE: 2 * Math.PI * 88,

  async init() {
    this.sessions = await FF.load('ff_deepwork_sessions') || [];
    this.blockList = await FF.load('ff_deepwork_blocklist') || ['twitter.com', 'reddit.com', 'youtube.com', 'instagram.com', 'facebook.com'];
    this.activeSession = await FF.load('ff_deepwork_active') || null;
    this.bindUI();
    this.renderBlocklist();
    this.renderHistory();
    this.updateStats();

    if (this.activeSession) this.resumeSession();
  },

  bindUI() {
    const presets = document.querySelectorAll('#dwPresets .dur-btn');
    presets.forEach(btn => {
      btn.addEventListener('click', () => {
        presets.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const mins = btn.dataset.mins;
        if (mins === 'custom') {
          document.getElementById('dwCustomRow').style.display = '';
        } else {
          document.getElementById('dwCustomRow').style.display = 'none';
          this.setTimerDisplay(parseInt(mins) * 60);
        }
      });
    });

    document.getElementById('dwStartBtn').addEventListener('click', () => this.startSession());
    document.getElementById('dwEndBtn').addEventListener('click', () => this.endSession(true));
    document.getElementById('dwAddBlockBtn').addEventListener('click', () => this.addBlockDomain());
  },

  setTimerDisplay(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    document.getElementById('dwTimerTime').textContent =
      `${h > 0 ? h.toString().padStart(2, '0') + ':' : ''}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  },

  startSession() {
    const activePreset = document.querySelector('#dwPresets .dur-btn.active');
    let totalMins;
    if (activePreset.dataset.mins === 'custom') {
      totalMins = parseInt(document.getElementById('dwCustomMin').value);
      if (!totalMins || totalMins < 1) return FF.toast('Enter valid minutes', 'error');
    } else {
      totalMins = parseInt(activePreset.dataset.mins);
    }

    const tag = document.getElementById('dwTagInput').value.trim() || 'Untitled';
    const totalSeconds = totalMins * 60;

    this.activeSession = {
      startTime: Date.now(),
      totalSeconds,
      remaining: totalSeconds,
      tag,
      distractions: 0
    };

    FF.save('ff_deepwork_active', this.activeSession);

    // Notify background to start blocking
    chrome.runtime.sendMessage({ type: 'DW_START', blockList: this.blockList, duration: totalMins });

    // UI updates
    document.getElementById('dwStartBtn').style.display = 'none';
    document.getElementById('dwEndBtn').style.display = '';
    document.getElementById('dwPresets').style.opacity = '0.4';
    document.getElementById('dwPresets').style.pointerEvents = 'none';
    document.getElementById('dwTagRow').style.display = 'none';
    document.getElementById('dwPhoneRemind').style.display = '';
    document.getElementById('dwTimerLabel').textContent = '🔥 Deep Work Active';

    this.startTimer();
  },

  resumeSession() {
    const elapsed = Math.floor((Date.now() - this.activeSession.startTime) / 1000);
    this.activeSession.remaining = Math.max(0, this.activeSession.totalSeconds - elapsed);

    if (this.activeSession.remaining <= 0) {
      this.completeSession();
      return;
    }

    document.getElementById('dwStartBtn').style.display = 'none';
    document.getElementById('dwEndBtn').style.display = '';
    document.getElementById('dwPresets').style.opacity = '0.4';
    document.getElementById('dwPresets').style.pointerEvents = 'none';
    document.getElementById('dwTagRow').style.display = 'none';
    document.getElementById('dwTimerLabel').textContent = '🔥 Deep Work Active';

    this.startTimer();
  },

  startTimer() {
    this.updateTimerUI();
    this.timerInterval = setInterval(() => {
      this.activeSession.remaining--;
      if (this.activeSession.remaining <= 0) {
        this.completeSession();
      } else {
        this.updateTimerUI();
        if (this.activeSession.remaining % 30 === 0) {
          FF.save('ff_deepwork_active', this.activeSession);
        }
      }
    }, 1000);
  },

  updateTimerUI() {
    const { remaining, totalSeconds } = this.activeSession;
    this.setTimerDisplay(remaining);

    const circle = document.getElementById('dwTimerCircle');
    const progress = remaining / totalSeconds;
    circle.style.strokeDasharray = this.CIRCUMFERENCE;
    circle.style.strokeDashoffset = this.CIRCUMFERENCE * progress;
  },

  completeSession() {
    clearInterval(this.timerInterval);
    const session = this.activeSession;
    const duration = Math.round((session.totalSeconds - session.remaining) / 60);
    const quality = this.calcQuality(session);

    this.sessions.push({
      date: FF.today(),
      tag: session.tag,
      duration,
      quality,
      distractions: session.distractions,
      timestamp: Date.now()
    });

    FF.save('ff_deepwork_sessions', this.sessions);
    FF.save('ff_deepwork_active', null);
    this.activeSession = null;

    chrome.runtime.sendMessage({ type: 'DW_END' });
    this.resetUI();
    this.renderHistory();
    this.updateStats();

    FF.toast(`Session complete! Quality: ${quality}/100 🎯`);

    // Trigger momentum mode
    chrome.runtime.sendMessage({
      type: 'DW_COMPLETE_NOTIFY',
      duration,
      quality,
      tag: session.tag
    });
  },

  endSession(manual) {
    if (manual && !confirm('End deep work session early?')) return;
    this.completeSession();
  },

  calcQuality(session) {
    let score = 100;
    const pctCompleted = (session.totalSeconds - session.remaining) / session.totalSeconds;
    score *= pctCompleted;
    score -= session.distractions * 5;
    if (session.remaining > 0) score -= 10; // early exit penalty
    return Math.max(0, Math.min(100, Math.round(score)));
  },

  resetUI() {
    document.getElementById('dwStartBtn').style.display = '';
    document.getElementById('dwEndBtn').style.display = 'none';
    document.getElementById('dwPresets').style.opacity = '1';
    document.getElementById('dwPresets').style.pointerEvents = '';
    document.getElementById('dwTagRow').style.display = '';
    document.getElementById('dwPhoneRemind').style.display = 'none';
    document.getElementById('dwTimerLabel').textContent = 'Ready for Deep Work';

    const circle = document.getElementById('dwTimerCircle');
    circle.style.strokeDashoffset = 0;

    const activePreset = document.querySelector('#dwPresets .dur-btn.active');
    if (activePreset && activePreset.dataset.mins !== 'custom') {
      this.setTimerDisplay(parseInt(activePreset.dataset.mins) * 60);
    }
  },

  addBlockDomain() {
    const input = document.getElementById('dwBlockInput');
    const domain = input.value.trim().toLowerCase();
    if (!domain || !domain.includes('.')) return FF.toast('Enter valid domain', 'error');
    if (!this.blockList.includes(domain)) {
      this.blockList.push(domain);
      FF.save('ff_deepwork_blocklist', this.blockList);
      this.renderBlocklist();
    }
    input.value = '';
  },

  renderBlocklist() {
    const container = document.getElementById('dwBlockList');
    container.innerHTML = this.blockList.map((d, i) => `
      <div class="dw-block-tag">
        ${d}
        <button class="dw-block-tag-remove" data-idx="${i}">✕</button>
      </div>
    `).join('');

    container.querySelectorAll('.dw-block-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        this.blockList.splice(parseInt(btn.dataset.idx), 1);
        FF.save('ff_deepwork_blocklist', this.blockList);
        this.renderBlocklist();
      });
    });
  },

  renderHistory() {
    const container = document.getElementById('dwSessionHistory');
    const recent = this.sessions.filter(s => s.date === FF.today()).reverse().slice(0, 10);

    if (recent.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:16px; color:var(--text-tertiary); font-size:12px;">No sessions today yet</div>';
      return;
    }

    container.innerHTML = recent.map(s => {
      const qClass = s.quality >= 80 ? 'quality-high' : s.quality >= 50 ? 'quality-mid' : 'quality-low';
      return `
        <div class="dw-session-item">
          <div class="dw-session-info">
            <span>${s.tag}</span>
            <span style="color:var(--text-tertiary); font-size:11px;">${s.duration}m</span>
          </div>
          <span class="dw-session-quality ${qClass}">${s.quality}/100</span>
        </div>
      `;
    }).join('');
  },

  updateStats() {
    const today = this.sessions.filter(s => s.date === FF.today());
    const totalMins = today.reduce((sum, s) => sum + s.duration, 0);
    const avgQ = today.length > 0 ? Math.round(today.reduce((sum, s) => sum + s.quality, 0) / today.length) : 0;

    document.getElementById('dwTotalTime').textContent = (totalMins / 60).toFixed(1) + 'h';
    document.getElementById('dwSessionCount').textContent = today.length;
    document.getElementById('dwAvgQuality').textContent = today.length > 0 ? avgQ : '--';
  }
};
