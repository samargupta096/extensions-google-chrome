// Stack Overflow Tag Watcher
document.addEventListener('DOMContentLoaded', () => {
  const tagInput = document.getElementById('so-tag-input');
  const addTagBtn = document.getElementById('so-add-tag-btn');
  const tagsList = document.getElementById('so-active-tags');
  const questionsList = document.getElementById('so-questions-list');
  const refreshBtn = document.getElementById('so-refresh-btn');

  if (!questionsList) return;

  let watchedTags = [];

  chrome.storage.local.get(['soWatchedTags'], (result) => {
    watchedTags = result.soWatchedTags || ['javascript', 'python'];
    renderTags();
    fetchQuestions();
  });

  function renderTags() {
    if (!tagsList) return;
    tagsList.innerHTML = '';
    watchedTags.forEach((tag, idx) => {
      const span = document.createElement('span');
      span.className = 'so-tag-chip';
      span.innerHTML = `${tag} <button data-idx="${idx}" class="so-tag-remove">✕</button>`;
      tagsList.appendChild(span);
    });
    tagsList.querySelectorAll('.so-tag-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        watchedTags.splice(idx, 1);
        chrome.storage.local.set({ soWatchedTags: watchedTags });
        renderTags();
        fetchQuestions();
      });
    });
  }

  addTagBtn && addTagBtn.addEventListener('click', () => {
    const tag = tagInput.value.trim().toLowerCase().replace(/\s+/g, '-');
    if (!tag || watchedTags.includes(tag) || watchedTags.length >= 5) return;
    watchedTags.push(tag);
    chrome.storage.local.set({ soWatchedTags: watchedTags });
    tagInput.value = '';
    renderTags();
    fetchQuestions();
  });

  tagInput && tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTagBtn.click();
  });

  refreshBtn && refreshBtn.addEventListener('click', fetchQuestions);

  async function fetchQuestions() {
    if (watchedTags.length === 0) {
      questionsList.innerHTML = '<li class="news-loading">Add tags to watch questions.</li>';
      return;
    }
    questionsList.innerHTML = '<li class="news-loading">⏳ Fetching questions...</li>';
    try {
      const tagsParam = watchedTags.join(';');
      const url = `https://api.stackexchange.com/2.3/questions?order=desc&sort=activity&tagged=${encodeURIComponent(tagsParam)}&site=stackoverflow&filter=default&pagesize=8`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      renderQuestions(data.items || []);
    } catch (e) {
      questionsList.innerHTML = `<li class="news-loading news-error">⚠️ ${e.message}</li>`;
    }
  }

  function renderQuestions(items) {
    questionsList.innerHTML = '';
    if (!items.length) {
      questionsList.innerHTML = '<li class="news-loading">No recent questions found.</li>';
      return;
    }
    items.forEach(q => {
      const li = document.createElement('li');
      li.className = 'news-item';
      const answerBadge = q.is_answered
        ? `<span class="so-answered-badge">✅ ${q.answer_count}</span>`
        : `<span class="so-unanswered-badge">❓ ${q.answer_count}</span>`;
      li.innerHTML = `
        <a href="${q.link}" target="_blank" class="news-title">${q.title}</a>
        <div class="news-meta">
          <span>▲ ${q.score} · ${answerBadge}</span>
          <span class="so-tags">${q.tags.slice(0,3).map(t=>`<span class="so-tag-inline">${t}</span>`).join('')}</span>
        </div>
      `;
      questionsList.appendChild(li);
    });
  }
});
