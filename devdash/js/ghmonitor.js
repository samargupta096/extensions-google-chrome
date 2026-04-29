// GitHub PR & Issue Monitor Widget
document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('gh-token-input');
  const saveTokenBtn = document.getElementById('gh-save-token-btn');
  const refreshPrBtn = document.getElementById('gh-refresh-btn');
  const prList = document.getElementById('gh-pr-list');
  const tokenSection = document.getElementById('gh-token-section');
  const statusEl = document.getElementById('gh-status');

  if (!prList) return;

  // Load token and fetch if present
  chrome.storage.local.get(['ghPatToken'], (result) => {
    if (result.ghPatToken) {
      if (tokenSection) tokenSection.style.display = 'none';
      fetchPRs(result.ghPatToken);
    } else {
      if (tokenSection) tokenSection.style.display = 'flex';
      prList.innerHTML = '<li class="news-loading">Enter a GitHub PAT to load your PRs.</li>';
    }
  });

  if (saveTokenBtn) {
    saveTokenBtn.addEventListener('click', () => {
      const token = tokenInput.value.trim();
      if (!token) return;
      chrome.storage.local.set({ ghPatToken: token }, () => {
        if (tokenSection) tokenSection.style.display = 'none';
        tokenInput.value = '';
        fetchPRs(token);
      });
    });
  }

  if (refreshPrBtn) {
    refreshPrBtn.addEventListener('click', () => {
      chrome.storage.local.get(['ghPatToken'], (result) => {
        if (result.ghPatToken) fetchPRs(result.ghPatToken);
      });
    });
  }

  async function fetchPRs(token) {
    prList.innerHTML = '<li class="news-loading">⏳ Fetching your PRs...</li>';
    if (statusEl) statusEl.textContent = '';
    try {
      // Fetch PRs assigned to or authored by the user
      const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      };

      const [reviewRes, authoredRes] = await Promise.all([
        fetch('https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me&per_page=5', { headers }),
        fetch('https://api.github.com/search/issues?q=is:pr+is:open+author:@me&per_page=5', { headers }),
      ]);

      if (!reviewRes.ok || !authoredRes.ok) {
        throw new Error('GitHub API error. Check your PAT permissions.');
      }

      const reviewData = await reviewRes.json();
      const authoredData = await authoredRes.json();

      const all = [
        ...reviewData.items.map(i => ({ ...i, role: 'review' })),
        ...authoredData.items.map(i => ({ ...i, role: 'author' })),
      ];

      // Deduplicate
      const seen = new Set();
      const unique = all.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; });

      renderPRs(unique);
      if (statusEl) statusEl.textContent = `Updated ${new Date().toLocaleTimeString()}`;
    } catch (e) {
      prList.innerHTML = `<li class="news-loading news-error">⚠️ ${e.message}</li>`;
      // If invalid token, show the input again
      if (e.message.includes('API error') || e.message.includes('401')) {
        chrome.storage.local.remove(['ghPatToken']);
        if (tokenSection) tokenSection.style.display = 'flex';
      }
    }
  }

  function renderPRs(items) {
    prList.innerHTML = '';
    if (!items || items.length === 0) {
      prList.innerHTML = '<li class="news-loading">🎉 No open PRs. You\'re all caught up!</li>';
      return;
    }
    items.forEach(item => {
      const li = document.createElement('li');
      li.className = 'news-item';
      const badgeClass = item.role === 'review' ? 'badge-review' : 'badge-author';
      const badgeText = item.role === 'review' ? '👀 Review' : '✍️ Author';
      li.innerHTML = `
        <a href="${item.html_url}" target="_blank" class="news-title" title="${item.title}">${item.title}</a>
        <div class="news-meta">
          <span class="pr-badge ${badgeClass}">${badgeText}</span>
          <span>${item.repository_url.split('/').slice(-2).join('/')}</span>
        </div>
      `;
      prList.appendChild(li);
    });
  }
});
