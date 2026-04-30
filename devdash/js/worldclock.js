// World Clock Widget — Multiple timezone display
document.addEventListener('DOMContentLoaded', () => {
  const clockContainer = document.getElementById('world-clocks');
  const addTzInput = document.getElementById('worldclock-tz-input');
  const addTzBtn = document.getElementById('worldclock-add-btn');

  if (!clockContainer) return;

  const DEFAULT_ZONES = [
    { label: 'New York', tz: 'America/New_York' },
    { label: 'London', tz: 'Europe/London' },
    { label: 'Tokyo', tz: 'Asia/Tokyo' },
    { label: 'India', tz: 'Asia/Kolkata' },
  ];

  let zones = [];

  chrome.storage.local.get(['worldClockZones'], (result) => {
    zones = result.worldClockZones || DEFAULT_ZONES;
    populateDatalist();
    render();
    tick();
  });

  function populateDatalist() {
    const datalist = document.getElementById('worldclock-zones');
    if (!datalist) return;

    // Popular cities first
    const popular = [
      "London - Europe/London",
      "New York - America/New_York",
      "San Francisco - America/Los_Angeles",
      "Tokyo - Asia/Tokyo",
      "Sydney - Australia/Sydney",
      "Singapore - Asia/Singapore",
      "Dubai - Asia/Dubai",
      "Mumbai - Asia/Kolkata",
      "Paris - Europe/Paris",
      "Berlin - Europe/Berlin",
      "Moscow - Europe/Moscow",
      "Hong Kong - Asia/Hong_Kong"
    ];

    // Get all supported zones
    const allZones = Intl.supportedValuesOf('timeZone');
    
    // Merge popular and all (avoid duplicates)
    const suggestions = [...popular];
    allZones.forEach(tz => {
      if (!popular.some(p => p.endsWith(tz))) {
        suggestions.push(tz);
      }
    });

    datalist.innerHTML = suggestions.map(s => `<option value="${s}">`).join('');
  }

  function getOffset(tz) {
    try {
      const now = new Date();
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const offset = (tzDate - new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))) / 3600000;
      return (offset >= 0 ? '+' : '') + offset.toFixed(1).replace('.0', '');
    } catch { return ''; }
  }

  function getTime(tz) {
    try {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch { return '--:--'; }
  }

  function getDay(tz) {
    try {
      return new Date().toLocaleDateString('en-US', {
        timeZone: tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    } catch { return ''; }
  }

  function render() {
    clockContainer.innerHTML = '';
    zones.forEach((zone, idx) => {
      const div = document.createElement('div');
      div.className = 'wc-item';
      div.innerHTML = `
        <div class="wc-info">
          <span class="wc-label">${zone.label}</span>
          <span class="wc-offset">UTC${getOffset(zone.tz)}</span>
        </div>
        <div class="wc-time" id="wc-time-${idx}">${getTime(zone.tz)}</div>
        <div class="wc-date" id="wc-date-${idx}">${getDay(zone.tz)}</div>
        <button class="wc-remove-btn" data-idx="${idx}" title="Remove">✕</button>
      `;
      clockContainer.appendChild(div);
    });

    // Bind remove buttons
    clockContainer.querySelectorAll('.wc-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        zones.splice(idx, 1);
        chrome.storage.local.set({ worldClockZones: zones });
        render();
      });
    });
  }

  function tick() {
    zones.forEach((zone, idx) => {
      const timeEl = document.getElementById(`wc-time-${idx}`);
      const dateEl = document.getElementById(`wc-date-${idx}`);
      if (timeEl) timeEl.textContent = getTime(zone.tz);
      if (dateEl) dateEl.textContent = getDay(zone.tz);
    });
    setTimeout(tick, 1000);
  }

  // Add new timezone
  addTzBtn && addTzBtn.addEventListener('click', () => {
    const val = addTzInput.value.trim();
    if (!val) return;
    
    let label, tz;
    if (val.includes(' - ')) {
      // Handle format "City - Timezone"
      const parts = val.split(' - ');
      label = parts[0].trim();
      tz = parts[1].trim();
    } else {
      // Try as IANA tz directly
      tz = val;
      // Derive label from the timezone string (e.g. "Europe/Berlin" -> "Berlin")
      label = val.split('/').pop().replace(/_/g, ' ');
    }

    // Validate
    try {
      new Date().toLocaleTimeString('en-US', { timeZone: tz });
    } catch {
      addTzInput.classList.add('input-error');
      setTimeout(() => { addTzInput.classList.remove('input-error'); }, 1500);
      return;
    }
    
    // Check if already exists
    if (zones.some(z => z.tz === tz)) {
      addTzInput.value = '';
      return;
    }

    zones.push({ label, tz });
    chrome.storage.local.set({ worldClockZones: zones });
    addTzInput.value = '';
    render();
  });

  addTzInput && addTzInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTzBtn.click();
  });
});
