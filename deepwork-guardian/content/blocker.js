/**
 * DeepWork Guardian — Content Script (Distraction Blocker)
 * Blocks access to distracting sites during focus sessions
 */

(async function () {
  // Check if this site should be blocked
  const response = await chrome.runtime.sendMessage({
    type: 'CHECK_BLOCKED',
    url: window.location.href
  });

  if (response && response.blocked) {
    // Create block overlay
    document.documentElement.innerHTML = '';
    document.documentElement.style.cssText = 'margin:0;padding:0;height:100vh;overflow:hidden;';

    const overlay = document.createElement('div');
    overlay.id = 'deepwork-block-overlay';
    overlay.innerHTML = `
      <div class="dw-block-container">
        <div class="dw-block-icon">🛡️</div>
        <h1 class="dw-block-title">Stay Focused!</h1>
        <p class="dw-block-text">
          <strong>${window.location.hostname}</strong> is blocked during your focus session.
        </p>
        <p class="dw-block-subtext">
          You're doing great — keep the momentum going! 💪
        </p>
        <div class="dw-block-timer" id="dw-timer">--:--</div>
        <p class="dw-block-label">remaining in session</p>
        <div class="dw-block-quotes">
          <p id="dw-quote">"The secret of getting ahead is getting started." — Mark Twain</p>
        </div>
        <button class="dw-block-btn" id="dw-close-btn">Go Back</button>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #deepwork-block-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: #0f0f1a;
        background-image:
          radial-gradient(ellipse at 30% 20%, rgba(108, 92, 231, 0.12) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 80%, rgba(0, 206, 201, 0.08) 0%, transparent 60%);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        color: white;
      }
      .dw-block-container {
        text-align: center;
        max-width: 480px;
        padding: 40px;
        animation: dw-fade-in 0.4s ease;
      }
      .dw-block-icon {
        font-size: 64px;
        margin-bottom: 20px;
        filter: drop-shadow(0 0 20px rgba(108, 92, 231, 0.4));
      }
      .dw-block-title {
        font-size: 32px;
        font-weight: 800;
        margin-bottom: 12px;
        background: linear-gradient(135deg, #fff, #a29bfe);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .dw-block-text {
        font-size: 16px;
        color: rgba(255,255,255,0.7);
        margin-bottom: 8px;
        line-height: 1.5;
      }
      .dw-block-text strong {
        color: #fd79a8;
      }
      .dw-block-subtext {
        font-size: 14px;
        color: rgba(255,255,255,0.5);
        margin-bottom: 32px;
      }
      .dw-block-timer {
        font-size: 56px;
        font-weight: 800;
        letter-spacing: 2px;
        color: #6C5CE7;
        text-shadow: 0 0 30px rgba(108, 92, 231, 0.3);
        margin-bottom: 4px;
        font-variant-numeric: tabular-nums;
      }
      .dw-block-label {
        font-size: 12px;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 32px;
      }
      .dw-block-quotes {
        padding: 16px 24px;
        background: rgba(255,255,255,0.04);
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,0.06);
        margin-bottom: 28px;
      }
      .dw-block-quotes p {
        font-size: 14px;
        color: rgba(255,255,255,0.5);
        font-style: italic;
        line-height: 1.5;
      }
      .dw-block-btn {
        padding: 12px 32px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 10px;
        color: rgba(255,255,255,0.6);
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;
      }
      .dw-block-btn:hover {
        background: rgba(255,255,255,0.12);
        color: white;
      }
      @keyframes dw-fade-in {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Go back button
    document.getElementById('dw-close-btn').addEventListener('click', () => {
      history.back();
    });

    // Motivational quotes
    const quotes = [
      '"The secret of getting ahead is getting started." — Mark Twain',
      '"Focus is a matter of deciding what things you\'re not going to do." — John Carmack',
      '"It\'s not that I\'m so smart, it\'s just that I stay with problems longer." — Einstein',
      '"Deep work is the ability to focus without distraction." — Cal Newport',
      '"The only way to do great work is to love what you do." — Steve Jobs',
      '"Starve your distractions. Feed your focus."',
      '"Almost everything will work again if you unplug it for a few minutes— including you."',
      '"You will never reach your destination if you stop to throw stones at every dog that barks."',
      '"The successful warrior is the average person with laser-like focus." — Bruce Lee',
      '"Lack of direction, not lack of time, is the problem." — Zig Ziglar'
    ];
    document.getElementById('dw-quote').textContent = quotes[Math.floor(Math.random() * quotes.length)];

    // Timer update
    async function updateTimer() {
      try {
        const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
        if (state.focusSession && !state.focusSession.isBreak) {
          const elapsed = (Date.now() - state.focusSession.startTime) / 1000;
          const remaining = Math.max(0, state.focusSession.duration - elapsed);
          const mins = Math.floor(remaining / 60);
          const secs = Math.floor(remaining % 60);
          document.getElementById('dw-timer').textContent =
            `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        }
      } catch {}
    }
    updateTimer();
    setInterval(updateTimer, 1000);
  }
})();
