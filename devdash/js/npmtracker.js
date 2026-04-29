// NPM Package Tracker Widget
document.addEventListener('DOMContentLoaded', () => {
  const pkgInput = document.getElementById('npm-pkg-input');
  const addBtn = document.getElementById('npm-add-btn');
  const pkgList = document.getElementById('npm-pkg-list');
  const refreshBtn = document.getElementById('npm-refresh-btn');

  if (!pkgList) return;

  let trackedPackages = [];

  chrome.storage.local.get(['npmPackages'], (result) => {
    trackedPackages = result.npmPackages || ['react', 'express', 'tailwindcss'];
    renderList();
    fetchPackages();
  });

  addBtn && addBtn.addEventListener('click', () => {
    const pkg = pkgInput.value.trim().toLowerCase();
    if (!pkg || trackedPackages.includes(pkg)) return;
    trackedPackages.push(pkg);
    chrome.storage.local.set({ npmPackages: trackedPackages });
    pkgInput.value = '';
    renderList();
    fetchPackages();
  });

  pkgInput && pkgInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });

  refreshBtn && refreshBtn.addEventListener('click', fetchPackages);

  function renderList() {
    pkgList.innerHTML = '';
    if (trackedPackages.length === 0) {
      pkgList.innerHTML = '<li class="news-loading">No packages tracked.</li>';
      return;
    }
    trackedPackages.forEach((pkg, idx) => {
      const li = document.createElement('li');
      li.className = 'npm-item';
      li.innerHTML = `
        <div class="npm-item-info">
          <a href="https://www.npmjs.com/package/${pkg}" target="_blank" class="npm-pkg-name">${pkg}</a>
          <span class="npm-pkg-version" id="npm-ver-${idx}">...</span>
        </div>
        <button class="npm-remove-btn" data-idx="${idx}">✕</button>
      `;
      pkgList.appendChild(li);
    });

    document.querySelectorAll('.npm-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        trackedPackages.splice(idx, 1);
        chrome.storage.local.set({ npmPackages: trackedPackages });
        renderList();
        fetchPackages();
      });
    });
  }

  async function fetchPackages() {
    if (trackedPackages.length === 0) return;
    
    trackedPackages.forEach(async (pkg, idx) => {
      const verSpan = document.getElementById(`npm-ver-${idx}`);
      if (!verSpan) return;
      verSpan.textContent = '⏳';
      try {
        const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        verSpan.textContent = `v${data.version}`;
      } catch (e) {
        verSpan.textContent = 'Error';
      }
    });
  }
});
