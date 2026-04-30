document.addEventListener('DOMContentLoaded', () => {
  const containerList = document.getElementById('docker-container-list');
  const refreshBtn = document.getElementById('docker-refresh-btn');
  const statusEl = document.getElementById('docker-status');

  if (!containerList) return;

  // Default demo containers for when Docker API isn't available
  const demoContainers = [
    { name: 'postgres-db', state: 'running', status: 'Up 2 hours', image: 'postgres:15' },
    { name: 'redis-cache', state: 'running', status: 'Up 2 hours', image: 'redis:7-alpine' },
    { name: 'api-server', state: 'running', status: 'Up 45 mins', image: 'node:20-slim' },
    { name: 'worker-queue', state: 'exited', status: 'Exited (1) 10 mins ago', image: 'python:3.12' },
    { name: 'nginx-proxy', state: 'running', status: 'Up 2 hours', image: 'nginx:alpine' }
  ];

  function renderContainers(containers) {
    containerList.innerHTML = containers.map(c => {
      const stateIcon = c.state === 'running' ? '🟢' : c.state === 'exited' ? '🔴' : '🟡';
      const stateColor = c.state === 'running' ? '#4ade80' : c.state === 'exited' ? '#f87171' : '#fbbf24';
      return `
        <div class="docker-item">
          <span class="docker-icon">${stateIcon}</span>
          <div class="docker-info">
            <span class="docker-name">${c.name}</span>
            <span class="docker-image">${c.image}</span>
          </div>
          <span class="docker-state" style="color:${stateColor}">${c.status}</span>
        </div>
      `;
    }).join('');
  }

  async function fetchContainers() {
    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '...';
    }
    if (statusEl) statusEl.textContent = 'Refreshing...';

    try {
      // Try local Docker API (requires companion service on port 2375)
      const resp = await fetch('http://localhost:2375/containers/json?all=true', { signal: AbortSignal.timeout(2000) });
      const data = await resp.json();
      const containers = data.map(c => ({
        name: (c.Names[0] || '').replace(/^\//, ''),
        state: c.State,
        status: c.Status,
        image: c.Image
      }));
      renderContainers(containers);
      if (statusEl) statusEl.textContent = `${containers.length} containers`;
    } catch {
      // Fallback to demo data
      renderContainers(demoContainers);
      if (statusEl) statusEl.textContent = 'Demo mode';
    }

    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = '↻';
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', fetchContainers);
  fetchContainers();
});
