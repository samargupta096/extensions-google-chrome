document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('bundle-input');
  const btn = document.getElementById('bundle-search-btn');
  const resultContainer = document.getElementById('bundle-result');
  const minifiedEl = document.getElementById('bundle-minified');
  const gzipEl = document.getElementById('bundle-gzip');
  const extraInfoEl = document.getElementById('bundle-extra-info');
  const statusEl = document.getElementById('bundle-status');

  if (!input || !btn) return;

  function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  async function checkBundleSize() {
    const pkg = input.value.trim().toLowerCase();
    if (!pkg) return;

    btn.disabled = true;
    btn.textContent = '...';
    statusEl.textContent = 'Fetching...';
    resultContainer.style.display = 'none';

    try {
      // Use Bundlephobia API
      const response = await fetch(`https://bundlephobia.com/api/size?package=${pkg}`);
      
      if (!response.ok) {
        throw new Error('Package not found');
      }

      const data = await response.json();
      
      minifiedEl.textContent = formatBytes(data.size);
      gzipEl.textContent = formatBytes(data.gzip);
      
      extraInfoEl.innerHTML = `
        <div><strong>Version:</strong> ${data.version}</div>
        <div><strong>Dependencies:</strong> ${data.dependencyCount}</div>
        <div><strong>Description:</strong> ${data.description || 'No description available.'}</div>
      `;

      resultContainer.style.display = 'flex';
      statusEl.textContent = '';
    } catch (err) {
      statusEl.textContent = 'Error';
      statusEl.style.color = '#ff6b6b';
      alert(`Could not find bundle size for "${pkg}". Ensure the package name is correct.`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Check';
    }
  }

  btn.addEventListener('click', checkBundleSize);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      checkBundleSize();
    }
  });
});
