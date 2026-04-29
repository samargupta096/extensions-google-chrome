// System Monitor Widget — CPU & RAM via Chrome Extension APIs
document.addEventListener('DOMContentLoaded', () => {
  const cpuBar = document.getElementById('cpu-bar-fill');
  const cpuLabel = document.getElementById('cpu-label');
  const ramBar = document.getElementById('ram-bar-fill');
  const ramLabel = document.getElementById('ram-label');
  const ramUsedEl = document.getElementById('ram-used');
  const ramTotalEl = document.getElementById('ram-total');

  if (!cpuBar || !ramBar) return;

  // For CPU we need to track delta between poll intervals
  let lastCpuInfo = null;

  function calculateCpuUsage(current, previous) {
    if (!previous) return 0;
    let totalIdle = 0, totalUsed = 0;
    current.processors.forEach((proc, i) => {
      const curr = proc.usage;
      const prev = previous.processors[i]?.usage;
      if (!prev) return;
      const idle = curr.idle - prev.idle;
      const user = curr.user - prev.user;
      const kernel = curr.kernel - prev.kernel;
      const total = idle + user + kernel;
      totalIdle += idle;
      totalUsed += (total - idle);
    });
    const grand = totalIdle + totalUsed;
    return grand > 0 ? Math.round((totalUsed / grand) * 100) : 0;
  }

  function setBar(barEl, labelEl, value, unit = '%') {
    const clamped = Math.min(100, Math.max(0, value));
    barEl.style.width = clamped + '%';
    labelEl.textContent = `${clamped}${unit}`;
    barEl.classList.remove('bar-low', 'bar-mid', 'bar-high');
    if (clamped < 40) barEl.classList.add('bar-low');
    else if (clamped < 75) barEl.classList.add('bar-mid');
    else barEl.classList.add('bar-high');
  }

  async function pollStats() {
    // CPU
    if (chrome.system && chrome.system.cpu) {
      chrome.system.cpu.getInfo((info) => {
        const usage = calculateCpuUsage(info, lastCpuInfo);
        lastCpuInfo = info;
        if (lastCpuInfo) {
          setBar(cpuBar, cpuLabel, usage);
        }
      });
    } else {
      cpuLabel.textContent = 'N/A';
    }

    // RAM
    if (chrome.system && chrome.system.memory) {
      chrome.system.memory.getInfo((info) => {
        const totalGb = (info.capacity / 1e9).toFixed(1);
        const usedGb = ((info.capacity - info.availableCapacity) / 1e9).toFixed(1);
        const pct = Math.round(((info.capacity - info.availableCapacity) / info.capacity) * 100);
        setBar(ramBar, ramLabel, pct);
        if (ramUsedEl) ramUsedEl.textContent = `${usedGb} GB`;
        if (ramTotalEl) ramTotalEl.textContent = `${totalGb} GB`;
      });
    } else {
      ramLabel.textContent = 'N/A';
    }
  }

  // Initial + poll every 2 seconds
  pollStats();
  // First tick after 1s to get CPU delta
  setTimeout(() => {
    pollStats();
    setInterval(pollStats, 2000);
  }, 1000);
});
