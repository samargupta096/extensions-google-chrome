// News Feed Widget — Hacker News & Reddit
document.addEventListener('DOMContentLoaded', () => {
  const sourceSelect = document.getElementById('news-source-select');
  const newsList = document.getElementById('news-list');
  const refreshBtn = document.getElementById('news-refresh-btn');

  if (!sourceSelect || !newsList) return;

  const SOURCES = {
    hn: { label: 'Hacker News', fetch: fetchHN },
    webdev: { label: 'r/webdev', fetch: () => fetchReddit('webdev') },
    programming: { label: 'r/programming', fetch: () => fetchReddit('programming') },
    javascript: { label: 'r/javascript', fetch: () => fetchReddit('javascript') },
  };

  // Load saved source preference
  chrome.storage.local.get(['newsSource'], (result) => {
    const saved = result.newsSource || 'hn';
    sourceSelect.value = saved;
    loadNews(saved);
  });

  sourceSelect.addEventListener('change', () => {
    const source = sourceSelect.value;
    chrome.storage.local.set({ newsSource: source });
    loadNews(source);
  });

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadNews(sourceSelect.value));
  }

  async function loadNews(source) {
    newsList.innerHTML = '<li class="news-loading">⏳ Fetching stories...</li>';
    try {
      const items = await SOURCES[source].fetch();
      renderNews(items);
    } catch (e) {
      newsList.innerHTML = '<li class="news-loading news-error">⚠️ Failed to load. Check network.</li>';
    }
  }

  async function fetchHN() {
    const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
    const ids = await topRes.json();
    const top8 = ids.slice(0, 8);
    const stories = await Promise.all(
      top8.map(id =>
        fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).then(r => r.json())
      )
    );
    return stories.map(s => ({
      title: s.title,
      url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
      meta: `▲ ${s.score || 0} · 💬 ${s.descendants || 0}`,
      commentsUrl: `https://news.ycombinator.com/item?id=${s.id}`,
    }));
  }

  async function fetchReddit(subreddit) {
    const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json?limit=8`, {
      headers: { 'Accept': 'application/json' }
    });
    const data = await res.json();
    return data.data.children.map(c => ({
      title: c.data.title,
      url: c.data.url,
      meta: `▲ ${c.data.ups.toLocaleString()} · 💬 ${c.data.num_comments.toLocaleString()}`,
      commentsUrl: `https://reddit.com${c.data.permalink}`,
    }));
  }

  function renderNews(items) {
    newsList.innerHTML = '';
    if (!items || items.length === 0) {
      newsList.innerHTML = '<li class="news-loading">No stories found.</li>';
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'news-item';
      li.innerHTML = `
        <a href="${item.url}" target="_blank" class="news-title" title="${item.title}">${item.title}</a>
        <div class="news-meta">
          <span>${item.meta}</span>
          <a href="${item.commentsUrl}" target="_blank" class="news-comments-link">comments →</a>
        </div>
      `;
      newsList.appendChild(li);
    });
  }
});
