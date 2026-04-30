document.addEventListener('DOMContentLoaded', () => {
  const regionList = document.getElementById('region-list');
  const pingBtn = document.getElementById('region-ping-btn');

  if (!regionList) return;

  const regions = [
    { name: 'US East (N. Virginia)', code: 'us-east-1', provider: 'AWS', endpoint: 'https://dynamodb.us-east-1.amazonaws.com' },
    { name: 'US West (Oregon)', code: 'us-west-2', provider: 'AWS', endpoint: 'https://dynamodb.us-west-2.amazonaws.com' },
    { name: 'EU (Ireland)', code: 'eu-west-1', provider: 'AWS', endpoint: 'https://dynamodb.eu-west-1.amazonaws.com' },
    { name: 'EU (Frankfurt)', code: 'eu-central-1', provider: 'AWS', endpoint: 'https://dynamodb.eu-central-1.amazonaws.com' },
    { name: 'Asia (Mumbai)', code: 'ap-south-1', provider: 'AWS', endpoint: 'https://dynamodb.ap-south-1.amazonaws.com' },
    { name: 'Asia (Singapore)', code: 'ap-southeast-1', provider: 'AWS', endpoint: 'https://dynamodb.ap-southeast-1.amazonaws.com' },
    { name: 'Asia (Tokyo)', code: 'ap-northeast-1', provider: 'AWS', endpoint: 'https://dynamodb.ap-northeast-1.amazonaws.com' },
    { name: 'South America (São Paulo)', code: 'sa-east-1', provider: 'AWS', endpoint: 'https://dynamodb.sa-east-1.amazonaws.com' }
  ];

  function renderRegions(latencies = {}) {
    regionList.innerHTML = regions.map(r => {
      const lat = latencies[r.code];
      let latText = '--';
      let latColor = 'var(--text-dim)';
      if (lat !== undefined) {
        latText = lat + 'ms';
        latColor = lat < 150 ? '#4ade80' : lat < 300 ? '#fbbf24' : '#f87171';
      }
      return `
        <div class="region-item">
          <div class="region-info">
            <span class="region-name">${r.name}</span>
            <span class="region-code">${r.code}</span>
          </div>
          <span class="region-latency" style="color:${latColor}">${latText}</span>
        </div>
      `;
    }).join('');
  }

  async function pingRegions() {
    if (pingBtn) {
      pingBtn.disabled = true;
      pingBtn.textContent = '...';
    }
    const latencies = {};

    for (const r of regions) {
      try {
        const start = performance.now();
        await fetch(r.endpoint, { method: 'HEAD', mode: 'no-cors' });
        const end = performance.now();
        latencies[r.code] = Math.round(end - start);
      } catch {
        latencies[r.code] = -1;
      }
      renderRegions(latencies);
    }

    if (pingBtn) {
      pingBtn.disabled = false;
      pingBtn.textContent = 'Ping';
    }
  }

  renderRegions();
  if (pingBtn) pingBtn.addEventListener('click', pingRegions);
});
