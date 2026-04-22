document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const query = searchInput.value.trim();
    if (query) {
      // Check if it's a URL
      const isUrl = /^https?:\/\//i.test(query) || /^[\w.-]+\.[a-z]{2,}/i.test(query) || /^localhost:\d+/i.test(query);
      if (isUrl) {
        let url = query;
        if (!/^https?:\/\//i.test(url)) {
          url = 'http://' + url;
        }
        window.location.href = url;
      } else {
        window.location.href = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
      }
    }
  });
});
