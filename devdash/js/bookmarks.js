document.addEventListener('DOMContentLoaded', () => {
  const tabBtns = document.querySelectorAll('.bm-tab-btn');
  const bookmarksView = document.getElementById('bookmarks-view');
  const extensionsView = document.getElementById('extensions-view');
  const bookmarksList = document.getElementById('bookmarks-list');
  const extensionsList = document.getElementById('extensions-list');
  const bookmarkSearch = document.getElementById('bookmark-search');

  let allBookmarks = [];

  // Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Reset active state
      tabBtns.forEach(b => {
        b.classList.remove('active');
        b.style.color = 'rgba(255,255,255,0.6)';
      });
      btn.classList.add('active');
      btn.style.color = 'white';

      // Switch views
      if (btn.dataset.tab === 'bookmarks-list') {
        bookmarksView.style.display = 'flex';
        bookmarksView.style.flexDirection = 'column';
        extensionsView.style.display = 'none';
      } else {
        bookmarksView.style.display = 'none';
        extensionsView.style.display = 'block';
        if (extensionsList.children.length === 0) {
          loadExtensions();
        }
      }
    });
  });

  // Load Bookmarks
  function extractBookmarks(nodes) {
    let result = [];
    nodes.forEach(node => {
      if (node.url) {
        result.push(node);
      }
      if (node.children) {
        result = result.concat(extractBookmarks(node.children));
      }
    });
    return result;
  }

  function renderBookmarks(bookmarks) {
    bookmarksList.innerHTML = '';
    
    if (bookmarks.length === 0) {
      bookmarksList.innerHTML = '<li class="placeholder-text" style="padding:1rem;">No bookmarks found.</li>';
      return;
    }

    // Render up to 50 items to keep DOM light
    bookmarks.slice(0, 50).forEach(bm => {
      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.gap = '0.5rem';
      
      const favicon = document.createElement('img');
      favicon.src = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(bm.url)}&size=16`;
      // Fallback if the favicon permission or setup isn't exact
      favicon.onerror = () => { favicon.src = 'icons/icon16.png'; };
      favicon.style.width = '16px';
      favicon.style.height = '16px';

      const a = document.createElement('a');
      a.href = bm.url;
      a.textContent = bm.title || bm.url;
      a.className = 'item-text';
      a.style.textDecoration = 'none';
      a.style.color = 'var(--text-main)';
      a.style.whiteSpace = 'nowrap';
      a.style.overflow = 'hidden';
      a.style.textOverflow = 'ellipsis';
      a.style.flexGrow = '1';

      li.appendChild(favicon);
      li.appendChild(a);
      bookmarksList.appendChild(li);
    });
  }

  if (chrome.bookmarks) {
    chrome.bookmarks.getTree((tree) => {
      allBookmarks = extractBookmarks(tree);
      renderBookmarks(allBookmarks);
    });
  } else {
    bookmarksList.innerHTML = '<li class="placeholder-text" style="padding:1rem;">Bookmarks permission not granted.</li>';
  }

  // Bookmark Search
  if (bookmarkSearch) {
    bookmarkSearch.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase();
      if (!q) {
        renderBookmarks(allBookmarks);
        return;
      }
      const filtered = allBookmarks.filter(bm => 
        (bm.title && bm.title.toLowerCase().includes(q)) || 
        (bm.url && bm.url.toLowerCase().includes(q))
      );
      renderBookmarks(filtered);
    });
  }

  // Load Extensions
  function loadExtensions() {
    extensionsList.innerHTML = '<li class="news-loading">Loading...</li>';
    if (chrome.management) {
      chrome.management.getAll((extInfoArray) => {
        extensionsList.innerHTML = '';
        
        // Sort by enabled first, then name
        extInfoArray.sort((a, b) => {
          if (a.enabled === b.enabled) return a.name.localeCompare(b.name);
          return a.enabled ? -1 : 1;
        });

        extInfoArray.forEach(ext => {
          // Skip self
          if (ext.id === chrome.runtime.id) return;

          const li = document.createElement('li');
          li.style.display = 'flex';
          li.style.alignItems = 'center';
          li.style.justifyContent = 'space-between';
          li.style.gap = '0.5rem';
          li.style.opacity = ext.enabled ? '1' : '0.5';

          const leftBox = document.createElement('div');
          leftBox.style.display = 'flex';
          leftBox.style.alignItems = 'center';
          leftBox.style.gap = '0.5rem';
          leftBox.style.overflow = 'hidden';

          const icon = document.createElement('img');
          icon.style.width = '16px';
          icon.style.height = '16px';
          if (ext.icons && ext.icons.length > 0) {
            icon.src = ext.icons[0].url;
          } else {
            icon.src = 'icons/icon16.png'; // Fallback
          }

          const span = document.createElement('span');
          span.textContent = ext.name;
          span.className = 'item-text';
          span.style.whiteSpace = 'nowrap';
          span.style.overflow = 'hidden';
          span.style.textOverflow = 'ellipsis';
          span.title = ext.description;

          leftBox.appendChild(icon);
          leftBox.appendChild(span);

          const toggleBtn = document.createElement('button');
          toggleBtn.textContent = ext.enabled ? 'Off' : 'On';
          toggleBtn.className = 'glass-btn btn-small';
          toggleBtn.style.minWidth = '45px';
          toggleBtn.style.padding = '0.2rem 0.5rem';
          
          toggleBtn.addEventListener('click', () => {
            chrome.management.setEnabled(ext.id, !ext.enabled, () => {
              loadExtensions(); // Refresh list
            });
          });

          li.appendChild(leftBox);
          li.appendChild(toggleBtn);
          extensionsList.appendChild(li);
        });
      });
    } else {
      extensionsList.innerHTML = '<li class="placeholder-text" style="padding:1rem;">Management permission not granted.</li>';
    }
  }
});
