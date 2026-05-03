// Title & Hook Lab — AI-powered title rewriting and hook generation
document.addEventListener('DOMContentLoaded', () => {
  const titleInput = document.getElementById('hooklab-title');
  const descInput = document.getElementById('hooklab-desc');
  const toneSelect = document.getElementById('hooklab-tone');
  const platformSelect = document.getElementById('hooklab-platform');
  const generateBtn = document.getElementById('hooklab-generate-btn');
  const resultsEl = document.getElementById('hooklab-results');

  if (!titleInput || !resultsEl) return;

  const TIPS_FALLBACK = [
    '✅ Use numbers: "7 Ways to..." performs better than vague titles',
    '✅ Front-load the benefit: What does the viewer GET?',
    '✅ Create a curiosity gap: hint at something without revealing it',
    '✅ Match your thumbnail: title + thumbnail should tell one clear story',
    '✅ Keep it under 60 characters for YouTube, under 100 for articles',
    '✅ Use power words: "Ultimate", "Secret", "Proven", "Easy"',
    '✅ Ask a question: "Are You Making These 5 Mistakes?"',
    '✅ Add urgency or timeliness when relevant: "in 2026", "Right Now"',
  ];

  generateBtn && generateBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const desc = descInput.value.trim();
    if (!title) { titleInput.classList.add('input-error'); setTimeout(() => titleInput.classList.remove('input-error'), 600); return; }

    const tone = toneSelect ? toneSelect.value : 'beginner';
    const platform = platformSelect ? platformSelect.value : 'youtube';

    generateBtn.textContent = '⏳ Generating...';
    generateBtn.disabled = true;

    try {
      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: document.getElementById('ollama-model-select')?.value || 'llama3.2',
          prompt: `You are a content packaging expert specializing in ${platform} content. Given a working title and description, generate EXACTLY this format:

TITLES:
1. [title 1]
2. [title 2]
3. [title 3]
4. [title 4]
5. [title 5]

HOOK: [A single compelling first line for short-form content (Reels/X/Shorts)]

PROMISE MATCH: [Score 1-10] — [Brief explanation of whether the title accurately represents the content]

Rules: Tone should be "${tone}". Titles should be optimized for ${platform}. Each title should take a different angle.

Working Title: ${title}
Description: ${desc || 'No description provided'}`,
          stream: false,
          options: { temperature: 0.8, num_predict: 500 }
        }),
        signal: AbortSignal.timeout(20000)
      });

      const data = await res.json();
      if (data.response) {
        renderAIResults(data.response, title);
        saveToHistory(title, desc, tone, platform, data.response);
      }
    } catch (e) {
      console.warn('Hook Lab AI failed:', e);
      renderFallbackTips();
    }

    generateBtn.textContent = '⚡ Generate';
    generateBtn.disabled = false;
  });

  function renderAIResults(response, originalTitle) {
    // Parse the response
    const lines = response.split('\n').filter(l => l.trim());
    let titlesHtml = '';
    let hookHtml = '';
    let matchHtml = '';

    let section = '';
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith('TITLES:') || trimmed.toUpperCase().startsWith('TITLES')) {
        section = 'titles';
        return;
      }
      if (trimmed.toUpperCase().startsWith('HOOK:')) {
        section = 'hook';
        hookHtml = `<div class="hooklab-hook"><strong>🪝 Hook:</strong> ${escHtml(trimmed.replace(/^HOOK:\s*/i, ''))}</div>`;
        return;
      }
      if (trimmed.toUpperCase().startsWith('PROMISE MATCH:')) {
        section = 'match';
        matchHtml = `<div class="hooklab-match"><strong>🎯 Promise Match:</strong> ${escHtml(trimmed.replace(/^PROMISE MATCH:\s*/i, ''))}</div>`;
        return;
      }

      if (section === 'titles' && /^\d/.test(trimmed)) {
        const titleText = trimmed.replace(/^\d+[\.\)]\s*/, '');
        titlesHtml += `<div class="hooklab-title-item">
          <span>${escHtml(titleText)}</span>
          <button class="hooklab-copy-btn" data-text="${escAttr(titleText)}" title="Copy">📋</button>
        </div>`;
      } else if (section === 'hook' && trimmed) {
        hookHtml += `<div class="hooklab-hook-extra">${escHtml(trimmed)}</div>`;
      }
    });

    resultsEl.innerHTML = `
      <div class="hooklab-section">
        <div class="hooklab-section-label">📝 Alternative Titles</div>
        ${titlesHtml || '<div class="hooklab-no-data">Could not parse titles</div>'}
      </div>
      ${hookHtml}
      ${matchHtml}
    `;

    resultsEl.querySelectorAll('.hooklab-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.text);
        btn.textContent = '✅';
        setTimeout(() => btn.textContent = '📋', 1500);
      });
    });
  }

  function renderFallbackTips() {
    resultsEl.innerHTML = `
      <div class="hooklab-fallback">
        <div class="hooklab-section-label">💡 Title Writing Tips (Ollama offline)</div>
        ${TIPS_FALLBACK.map(t => `<div class="hooklab-tip">${t}</div>`).join('')}
      </div>`;
  }

  function saveToHistory(title, desc, tone, platform, result) {
    chrome.storage.local.get(['creator_hooklab_history'], (res) => {
      const history = res.creator_hooklab_history || [];
      history.unshift({ title, desc, tone, platform, result: result.substring(0, 500), date: Date.now() });
      chrome.storage.local.set({ creator_hooklab_history: history.slice(0, 5) });
    });
  }

  function escHtml(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escAttr(str) {
    return escHtml(str).replace(/"/g, '&quot;');
  }
});
