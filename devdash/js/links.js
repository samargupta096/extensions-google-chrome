let quickLinks = [];

document.addEventListener('DOMContentLoaded', () => {
  const linkNameInput = document.getElementById('link-name-input');
  const linkUrlInput = document.getElementById('link-url-input');
  const addLinkBtn = document.getElementById('add-link-btn');
  const linksList = document.getElementById('links-list');

  // Default links
  const defaultLinks = [
    { name: "GitHub", url: "https://github.com" },
    { name: "Stack Overflow", url: "https://stackoverflow.com" },
    { name: "Localhost 3000", url: "http://localhost:3000" }
  ];

  chrome.storage.local.get(['quickLinks'], (result) => {
    if (result.quickLinks) {
      quickLinks = result.quickLinks;
    } else {
      quickLinks = defaultLinks;
      saveLinks();
    }
    renderLinks();
  });

  function saveLinks() {
    chrome.storage.local.set({ quickLinks: quickLinks });
  }

  function renderLinks() {
    linksList.innerHTML = '';
    quickLinks.forEach((link, index) => {
      const li = document.createElement('li');

      const a = document.createElement('a');
      a.className = 'link-item';
      a.href = link.url;
      a.target = '_blank';
      a.textContent = link.name;
      
      // Inline editing for name
      a.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'glass-input inline-edit-input';
        input.value = link.name;
        input.style.width = '100%';
        
        const saveEdit = () => {
          const newName = input.value.trim();
          if (newName && newName !== link.name) {
            quickLinks[index].name = newName;
            saveLinks();
          }
          renderLinks();
        };

        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') saveEdit();
          if (e.key === 'Escape') renderLinks();
        });

        input.addEventListener('blur', saveEdit);

        a.replaceWith(input);
        input.focus();
      });
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.title = 'Delete';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickLinks.splice(index, 1);
        saveLinks();
        renderLinks();
      });

      li.appendChild(a);
      li.appendChild(deleteBtn);

      // Add drag handle
      const dragHandle = document.createElement('div');
      dragHandle.className = 'list-item-handle';
      dragHandle.innerHTML = '⠿';
      li.insertBefore(dragHandle, li.firstChild);

      linksList.appendChild(li);
    });

    // Initialize Drag & Drop
    if (window.ListDrag) {
      ListDrag.init(linksList, quickLinks, () => {
        saveLinks();
        renderLinks();
      });
    }
  }

  function addLink() {
    const name = linkNameInput.value.trim();
    let url = linkUrlInput.value.trim();
    
    if (name && url) {
      if (!/^https?:\/\//i.test(url)) {
        url = 'http://' + url;
      }
      quickLinks.push({ name: name, url: url });
      linkNameInput.value = '';
      linkUrlInput.value = '';
      saveLinks();
      renderLinks();
    }
  }

  addLinkBtn.addEventListener('click', addLink);
  linkUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addLink();
  });
});
