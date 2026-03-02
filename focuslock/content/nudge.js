/**
 * FocusLock — Nudge Content Script
 * Shows a gentle overlay instead of hard-blocking distraction sites during focus sessions
 */

(async () => {
  // Check if this domain is blocked
  const domain = window.location.hostname.replace('www.', '');
  chrome.runtime.sendMessage({ action: 'isBlocked', domain }, (r) => {
    if (!r || !r.blocked) return;

    if (r.nudgeMode) {
      showNudge(r.flowScore || 0);
    } else {
      showHardBlock(r.flowScore || 0);
    }
  });
})();

function showNudge(flowScore) {
  // Don't show if nudge already exists
  if (document.getElementById('focuslock-nudge')) return;

  const nudge = document.createElement('div');
  nudge.id = 'focuslock-nudge';
  nudge.innerHTML = `
    <div class="fl-nudge-backdrop">
      <div class="fl-nudge-box">
        <div class="fl-ring">
          <svg viewBox="0 0 64 64" class="fl-svg">
            <circle class="fl-bg" cx="32" cy="32" r="26"/>
            <circle class="fl-fg" cx="32" cy="32" r="26" style="--pct:${flowScore}"/>
          </svg>
          <div class="fl-score">${flowScore}</div>
        </div>
        <div class="fl-content">
          <div class="fl-title">🔒 You're in Focus Mode</div>
          <div class="fl-flow">Flow Score: <strong>${flowScore}/100</strong></div>
          <div class="fl-message">${getFlowMessage(flowScore)}</div>
        </div>
        <div class="fl-actions">
          <button class="fl-btn-continue" id="fl-go-back">← Go Back</button>
          <button class="fl-btn-break" id="fl-take-break">Take a Break</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(nudge);
  document.getElementById('fl-go-back').addEventListener('click', () => {
    nudge.remove();
    window.history.back();
  });
  document.getElementById('fl-take-break').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'getAllowedBreak', domain: window.location.hostname });
    nudge.remove();
  });

  // Auto-dismiss after 5s if no interaction
  setTimeout(() => { if (nudge.isConnected) nudge.remove(); }, 8000);
}

function showHardBlock(flowScore) {
  if (document.getElementById('focuslock-block')) return;
  const block = document.createElement('div');
  block.id = 'focuslock-block';
  block.innerHTML = `
    <div class="fl-block-page">
      <div class="fl-block-icon">🔒</div>
      <div class="fl-block-title">FocusLock Active</div>
      <div class="fl-block-score">Flow Score: ${flowScore}/100</div>
      <div class="fl-block-msg">${getFlowMessage(flowScore)}</div>
      <div class="fl-block-site">${window.location.hostname} is blocked during your focus session.</div>
      <div class="fl-block-timer" id="fl-unblock-timer">Session active</div>
    </div>
  `;
  document.body.innerHTML = '';
  document.body.appendChild(block);
}

function getFlowMessage(score) {
  if (score >= 80) return "You're in an excellent flow state! This interruption will cost 23 minutes to recover.";
  if (score >= 60) return "You're building momentum. Stay focused — you're doing great!";
  if (score >= 40) return "You're getting into focus mode. Keep going — flow is within reach.";
  if (score >= 20) return "Just getting started. Push through the friction for deep work.";
  return "Start your focus session to build productive momentum.";
}
