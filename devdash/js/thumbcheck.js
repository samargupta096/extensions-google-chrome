// Thumbnail & Hook Checker Widget
document.addEventListener('DOMContentLoaded', () => {
  const thumbInput = document.getElementById('thumbcheck-text');
  const hookInput = document.getElementById('thumbcheck-hook');
  const checkBtn = document.getElementById('thumbcheck-btn');
  const resultsEl = document.getElementById('thumbcheck-results');

  if (!thumbInput || !resultsEl) return;

  checkBtn.addEventListener('click', async () => {
    const thumbText = thumbInput.value.trim();
    const hookText = hookInput.value.trim();
    
    if (!thumbText && !hookText) {
      thumbInput.classList.add('input-error');
      setTimeout(() => thumbInput.classList.remove('input-error'), 600);
      return;
    }

    checkBtn.textContent = '⏳ Analyzing...';
    checkBtn.disabled = true;

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: document.getElementById('ollama-model-select')?.value || 'llama3.2',
          prompt: `You are an expert YouTube strategist. Analyze this thumbnail text and video hook.
Thumbnail Text: "${thumbText}"
First Line/Hook: "${hookText}"

Provide concise feedback formatted EXACTLY like this:
THUMBNAIL SCORE: [1-10]
THUMBNAIL FEEDBACK: [1 brief sentence on readability/impact. Usually <=5 words is best]
HOOK SCORE: [1-10]
HOOK FEEDBACK: [1 brief sentence on retention/curiosity]
SYNERGY: [1 brief sentence on how well they work together to create a curiosity gap]`,
          stream: false,
          options: { temperature: 0.5, num_predict: 200 }
        }),
        signal: AbortSignal.timeout(15000)
      });

      const data = await res.json();
      if (data.response) {
        renderResults(data.response);
      }
    } catch (e) {
      console.warn('Thumb Check AI failed:', e);
      renderFallback(thumbText, hookText);
    }

    checkBtn.textContent = '🔍 Analyze';
    checkBtn.disabled = false;
  });

  function renderResults(response) {
    const lines = response.split('\n');
    let thumbScore = '', thumbFb = '', hookScore = '', hookFb = '', synergy = '';

    lines.forEach(line => {
      const t = line.trim().toUpperCase();
      if (t.startsWith('THUMBNAIL SCORE:')) thumbScore = line.replace(/.*SCORE:\s*/i, '');
      if (t.startsWith('THUMBNAIL FEEDBACK:')) thumbFb = line.replace(/.*FEEDBACK:\s*/i, '');
      if (t.startsWith('HOOK SCORE:')) hookScore = line.replace(/.*SCORE:\s*/i, '');
      if (t.startsWith('HOOK FEEDBACK:')) hookFb = line.replace(/.*FEEDBACK:\s*/i, '');
      if (t.startsWith('SYNERGY:')) synergy = line.replace(/.*SYNERGY:\s*/i, '');
    });

    const getScoreColor = (scoreStr) => {
      const s = parseInt(scoreStr);
      if (isNaN(s)) return '#fff';
      if (s >= 8) return '#00cec9';
      if (s >= 5) return '#f6d365';
      return '#ff6b6b';
    };

    resultsEl.innerHTML = `
      <div class="thumbcheck-metrics">
        <div class="thumbcheck-metric">
          <div class="thumbcheck-score" style="color:${getScoreColor(thumbScore)}">${escHtml(thumbScore)}</div>
          <div class="thumbcheck-label">Thumbnail</div>
          <div class="thumbcheck-desc">${escHtml(thumbFb)}</div>
        </div>
        <div class="thumbcheck-metric">
          <div class="thumbcheck-score" style="color:${getScoreColor(hookScore)}">${escHtml(hookScore)}</div>
          <div class="thumbcheck-label">Hook</div>
          <div class="thumbcheck-desc">${escHtml(hookFb)}</div>
        </div>
      </div>
      <div class="thumbcheck-synergy">
        <strong>Synergy:</strong> ${escHtml(synergy)}
      </div>
    `;
  }

  function renderFallback(thumb, hook) {
    const wordCount = thumb.split(' ').filter(Boolean).length;
    let thumbAdvice = wordCount > 5 ? '⚠️ Over 5 words. Make it punchier.' : '✅ Good length (<= 5 words).';
    if (!thumb) thumbAdvice = 'No thumbnail text provided.';

    resultsEl.innerHTML = `
      <div class="thumbcheck-fallback">
        <div class="thumbcheck-fb-item"><strong>Thumbnail:</strong> ${thumbAdvice} Ensure high contrast colors.</div>
        <div class="thumbcheck-fb-item"><strong>Hook:</strong> Does this line immediately establish the stakes or create a curiosity gap? Keep it under 5 seconds.</div>
        <div class="thumbcheck-fb-note">(Start Ollama for AI scoring)</div>
      </div>
    `;
  }

  function escHtml(str) { return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
});
