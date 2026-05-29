// Extension Self-Monitor Widget — JS Heap, DOM, Storage metrics for DevDash itself
document.addEventListener('DOMContentLoaded', () => {
  const heapBar   = document.getElementById('extmon-heap-bar');
  const heapLabel = document.getElementById('extmon-heap-label');
  const domBar    = document.getElementById('extmon-dom-bar');
  const domLabel  = document.getElementById('extmon-dom-label');
  const storBar   = document.getElementById('extmon-storage-bar');
  const storLabel = document.getElementById('extmon-storage-label');
  const uptimeEl  = document.getElementById('extmon-uptime');
  const widgetsEl = document.getElementById('extmon-widgets');
  const heapLimitEl = document.getElementById('extmon-heap-limit');
  const scriptsEl = document.getElementById('extmon-scripts');
  const gcBtn     = document.getElementById('extmon-gc-btn');

  if (!heapBar || !domBar) return;

  const startTime = Date.now();

  // ── Shared bar helper (mirrors sysmonitor.js pattern) ──
  function setBar(barEl, value) {
    const clamped = Math.min(100, Math.max(0, value));
    barEl.style.width = clamped + '%';
    barEl.classList.remove('bar-low', 'bar-mid', 'bar-high');
    if (clamped < 40) barEl.classList.add('bar-low');
    else if (clamped < 75) barEl.classList.add('bar-mid');
    else barEl.classList.add('bar-high');
  }

  // ── Format bytes to human-readable ──
  function fmtBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  // ── Uptime formatter ──
  function fmtUptime(ms) {
    const totalSec = Math.floor(ms / 1000);
    if (totalSec < 60) return totalSec + 's';
    const mins = Math.floor(totalSec / 60);
    if (mins < 60) return mins + 'm';
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return hrs + 'h ' + remMins + 'm';
  }

  // ── CPU estimation via busy-time sampling ──
  let lastSampleTime = performance.now();
  let cpuEstimate = 0;

  function sampleCpuBusy() {
    // Measure how long a requestAnimationFrame callback takes
    // relative to wall-clock — gives a rough "page CPU busy" proxy
    const now = performance.now();
    const delta = now - lastSampleTime;
    lastSampleTime = now;

    // If delta >> 3000ms (our poll interval), the page was throttled/idle
    // If delta ≈ 3000ms, normal
    // We use PerformanceObserver longTask entries as a secondary signal
    return delta;
  }

  // ── Main poll ──
  function poll() {
    // JS Heap
    const mem = performance.memory;
    if (mem) {
      const usedMB  = (mem.usedJSHeapSize / 1048576).toFixed(1);
      const totalMB = (mem.totalJSHeapSize / 1048576).toFixed(1);
      const limitMB = (mem.jsHeapSizeLimit / 1048576).toFixed(0);
      const pct     = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
      setBar(heapBar, pct);
      heapLabel.textContent = `${usedMB} / ${totalMB} MB`;
      if (heapLimitEl) heapLimitEl.textContent = `${limitMB} MB`;
    } else {
      heapLabel.textContent = 'N/A';
    }

    // DOM Nodes
    const nodeCount = document.querySelectorAll('*').length;
    // Thresholds: < 1500 = green, < 3000 = yellow, 3000+ = red
    const domPct = Math.min(100, Math.round((nodeCount / 5000) * 100));
    setBar(domBar, domPct);
    domLabel.textContent = nodeCount.toLocaleString();

    // Storage
    if (chrome.storage && chrome.storage.local && chrome.storage.local.getBytesInUse) {
      chrome.storage.local.getBytesInUse(null, (bytes) => {
        // Max chrome.storage.local with unlimitedStorage is huge, 
        // but let's baseline at 10MB for the bar
        const pct = Math.min(100, Math.round((bytes / (10 * 1048576)) * 100));
        setBar(storBar, pct);
        storLabel.textContent = fmtBytes(bytes);
      });
    } else {
      storLabel.textContent = 'N/A';
    }

    // Active Widgets
    if (widgetsEl) {
      const visible = document.querySelectorAll('[data-widget-id]');
      let count = 0;
      visible.forEach(w => {
        if (w.style.display !== 'none') count++;
      });
      widgetsEl.textContent = count;
    }

    // Scripts loaded
    if (scriptsEl) {
      scriptsEl.textContent = document.querySelectorAll('script[src]').length;
    }

    // Uptime
    if (uptimeEl) {
      uptimeEl.textContent = '⏱ ' + fmtUptime(Date.now() - startTime);
    }
  }

  // ── GC hint button ──
  if (gcBtn) {
    gcBtn.addEventListener('click', () => {
      if (typeof gc === 'function') {
        gc();
        gcBtn.textContent = '✅';
      } else {
        gcBtn.textContent = '💤';
        gcBtn.title = 'GC is managed by the browser';
      }
      setTimeout(() => {
        gcBtn.textContent = '🗑️';
        gcBtn.title = 'Force GC Hint';
      }, 1500);
      // Immediately refresh stats
      poll();
    });
  }

  // Initial poll + interval
  poll();
  setTimeout(() => {
    poll();
    setInterval(poll, 3000);
  }, 1000);
});
