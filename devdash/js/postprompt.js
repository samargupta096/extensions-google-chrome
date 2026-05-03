// What to Post Today — Daily prompt cards from pillars & unused ideas
document.addEventListener('DOMContentLoaded', () => {
  const promptList = document.getElementById('postprompt-list');
  const refreshBtn = document.getElementById('postprompt-refresh-btn');
  const settingsBtn = document.getElementById('postprompt-settings-btn');

  if (!promptList) return;

  const DEFAULT_PILLARS = ['Tips', 'BTS', 'Story', 'Promo', 'Tutorial'];
  const GENERIC_PROMPTS = [
    { text: 'Share a mistake you made this week and what you learned', pillar: 'Story' },
    { text: 'Quick tip about your favorite tool or workflow', pillar: 'Tips' },
    { text: 'Show your workspace or setup — behind the scenes', pillar: 'BTS' },
    { text: 'Answer a question your audience frequently asks', pillar: 'Tips' },
    { text: 'Share a resource that changed how you work', pillar: 'Tips' },
    { text: 'Document your creative process for today\'s project', pillar: 'BTS' },
    { text: 'Tell the story of how you got started in your niche', pillar: 'Story' },
    { text: 'Share something you\'re currently learning or struggling with', pillar: 'Story' },
    { text: 'Give a hot take or unpopular opinion about your industry', pillar: 'Story' },
    { text: 'Promote a recent piece of content with a fresh angle', pillar: 'Promo' },
    { text: 'Create a "before and after" comparison from your work', pillar: 'BTS' },
    { text: 'Share 3 tools you can\'t live without', pillar: 'Tips' },
    { text: 'Respond to a trending topic with your unique perspective', pillar: 'Story' },
    { text: 'Teach one small thing in 60 seconds', pillar: 'Tutorial' },
    { text: 'Share your content creation routine or schedule', pillar: 'BTS' },
  ];

  const PILLAR_COLORS = {
    'Tips': '#4facfe', 'BTS': '#f6d365', 'Story': '#a29bfe',
    'Promo': '#ff6b6b', 'Tutorial': '#00cec9', 'Q&A': '#fd79a8'
  };

  let pillars = [...DEFAULT_PILLARS];
  let todayPrompts = [];
  let usedToday = [];

  function getToday() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadData() {
    chrome.storage.local.get(['creator_pillars', 'creator_daily_prompts', 'creator_ideas'], (res) => {
      pillars = res.creator_pillars || DEFAULT_PILLARS;
      const saved = res.creator_daily_prompts || {};
      const today = getToday();

      if (saved.date === today && saved.prompts) {
        todayPrompts = saved.prompts;
        usedToday = saved.used || [];
      } else {
        todayPrompts = generatePrompts(res.creator_ideas || []);
        usedToday = [];
        saveDailyPrompts();
      }
      render();
    });
  }

  function generatePrompts(ideas) {
    const pool = [];

    // Add unused ideas from backlog
    const unusedIdeas = ideas.filter(i => i.status === 'new');
    unusedIdeas.forEach(idea => {
      pool.push({ text: idea.title, pillar: idea.pillar, fromBacklog: true, ideaId: idea.id });
    });

    // Add generic prompts matching user's pillars
    GENERIC_PROMPTS.forEach(p => {
      if (pillars.includes(p.pillar)) {
        pool.push({ ...p, fromBacklog: false });
      }
    });

    // Shuffle and pick 3-5
    const shuffled = pool.sort(() => Math.random() - 0.5);
    // Prefer backlog ideas (first 2 if available), fill rest with generic
    const fromBacklog = shuffled.filter(p => p.fromBacklog).slice(0, 2);
    const fromGeneric = shuffled.filter(p => !p.fromBacklog).slice(0, 5 - fromBacklog.length);
    return [...fromBacklog, ...fromGeneric].slice(0, 5);
  }

  function saveDailyPrompts() {
    chrome.storage.local.set({
      creator_daily_prompts: { date: getToday(), prompts: todayPrompts, used: usedToday }
    });
  }

  function render() {
    if (todayPrompts.length === 0) {
      promptList.innerHTML = '<div class="prompt-empty">Set your content pillars with ⚙️ to get started!</div>';
      return;
    }

    promptList.innerHTML = todayPrompts.map((p, i) => {
      const isUsed = usedToday.includes(i);
      const color = PILLAR_COLORS[p.pillar] || '#4facfe';
      return `
        <div class="prompt-card ${isUsed ? 'prompt-used' : ''}" style="border-left-color:${color}">
          <div class="prompt-card-header">
            <span class="idea-pillar-badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${p.pillar}</span>
            ${p.fromBacklog ? '<span class="prompt-backlog-tag">from backlog</span>' : ''}
          </div>
          <p class="prompt-text">${escHtml(p.text)}</p>
          <div class="prompt-card-actions">
            <button class="idea-action-btn prompt-use-btn" data-idx="${i}" ${isUsed ? 'disabled' : ''}>${isUsed ? '✅' : 'Use'}</button>
          </div>
        </div>`;
    }).join('');

    promptList.querySelectorAll('.prompt-use-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        if (!usedToday.includes(idx)) {
          usedToday.push(idx);
          // Mark idea as inprogress in backlog if from backlog
          const prompt = todayPrompts[idx];
          if (prompt.fromBacklog && prompt.ideaId) {
            chrome.storage.local.get(['creator_ideas'], (res) => {
              const ideas = res.creator_ideas || [];
              const found = ideas.find(i => i.id === prompt.ideaId);
              if (found) { found.status = 'inprogress'; }
              chrome.storage.local.set({ creator_ideas: ideas });
            });
          }
          saveDailyPrompts();
          render();
        }
      });
    });
  }

  refreshBtn && refreshBtn.addEventListener('click', () => {
    chrome.storage.local.get(['creator_ideas'], (res) => {
      todayPrompts = generatePrompts(res.creator_ideas || []);
      usedToday = [];
      saveDailyPrompts();
      render();
    });
  });

  settingsBtn && settingsBtn.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'env-modal-overlay';
    overlay.innerHTML = `
      <div class="env-modal glass-card" style="width:320px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
        <h3 style="margin:0 0 1rem 0;">⚙️ Content Pillars</h3>
        <p style="font-size:0.8rem;color:var(--text-dim);margin:0 0 0.75rem 0;">One pillar per line. These shape your daily prompts.</p>
        <textarea id="pillars-edit" class="glass-input" style="width:100%;box-sizing:border-box;min-height:120px;resize:vertical;font-size:0.9rem;">${pillars.join('\n')}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
          <button id="pillars-cancel" class="glass-btn">Cancel</button>
          <button id="pillars-save" class="glass-btn btn-primary">Save</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#pillars-cancel').addEventListener('click', () => document.body.removeChild(overlay));
    overlay.querySelector('#pillars-save').addEventListener('click', () => {
      pillars = overlay.querySelector('#pillars-edit').value.split('\n').map(s => s.trim()).filter(Boolean);
      chrome.storage.local.set({ creator_pillars: pillars });
      document.body.removeChild(overlay);
      // Regenerate prompts with new pillars
      chrome.storage.local.get(['creator_ideas'], (res) => {
        todayPrompts = generatePrompts(res.creator_ideas || []);
        usedToday = [];
        saveDailyPrompts();
        render();
      });
    });
  });

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  loadData();
});
