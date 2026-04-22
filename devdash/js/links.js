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
      a.textContent = link.name;
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'delete-btn';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickLinks.splice(index, 1);
        saveLinks();
        renderLinks();
      });

      li.appendChild(a);
      li.appendChild(deleteBtn);
      linksList.appendChild(li);
    });
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
