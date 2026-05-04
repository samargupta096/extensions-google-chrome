document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const engineSelector = document.getElementById('search-engine-selector');
  const engineDropdown = document.getElementById('search-engine-dropdown');
  const currentEngineIcon = document.getElementById('current-engine-icon');
  const engineOptions = document.querySelectorAll('.engine-option');

  let currentEngine = 'google';

  const engines = {
    google: {
      name: 'Google',
      url: 'https://www.google.com/search?q=',
      icon: `<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>`
    },
    bing: {
      name: 'Bing',
      url: 'https://www.bing.com/search?q=',
      icon: `<path d="M3.1 3L11 5.7v12.7l-7.9 4.3V3z" fill="#008373"/><path d="M11.1 5.8l7.8 2.8-5.3 2.1-2.5-1.9v-3z" fill="#00A1F1"/>`
    },
    duckduckgo: {
      name: 'DuckDuckGo',
      url: 'https://duckduckgo.com/?q=',
      icon: `<path d="M12 24c6.6 0 12-5.4 12-12S18.6 0 12 0 0 5.4 0 12s5.4 12 12 12z" fill="#DE5833"/><path d="M16.5 12c0 1.5-1.5 2.5-3 2.5s-3-1-3-2.5 1.5-2.5 3-2.5 3 1 3 2.5z" fill="#fff"/>`
    },
    yahoo: {
      name: 'Yahoo',
      url: 'https://search.yahoo.com/search?p=',
      icon: `<path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0z" fill="#6001D2"/><path d="M15.5 8h-2.5l-1 2.5-1-2.5h-2.5l2 4.5v3.5h2v-3.5l2-4.5z" fill="#fff"/>`
    }
  };

  function setEngine(engineKey) {
    currentEngine = engineKey;
    const engine = engines[engineKey];
    currentEngineIcon.innerHTML = engine.icon;
    searchInput.placeholder = `Search ${engine.name} or type a URL...`;
    
    engineOptions.forEach(opt => {
      const key = opt.dataset.engine;
      // Inject icon if not present
      if (!opt.querySelector('svg')) {
        const iconSvg = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">${engines[key].icon}</svg>`;
        opt.innerHTML = `${iconSvg} ${engines[key].name}`;
      }

      if (key === engineKey) {
        opt.classList.add('selected');
      } else {
        opt.classList.remove('selected');
      }
    });
    
    chrome.storage.local.set({ searchEngine: engineKey });
  }

  // Load saved engine (sets initial state)
  chrome.storage.local.get(['searchEngine'], (result) => {
    const savedEngine = result.searchEngine && engines[result.searchEngine] ? result.searchEngine : 'google';
    setEngine(savedEngine);
  });

  engineSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    engineDropdown.classList.toggle('active');
  });

  document.addEventListener('click', () => {
    engineDropdown.classList.remove('active');
  });

  engineOptions.forEach(opt => {
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      setEngine(opt.dataset.engine);
      engineDropdown.classList.remove('active');
    });
  });

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
        window.location.href = engines[currentEngine].url + encodeURIComponent(query);
      }
    }
  });
});
