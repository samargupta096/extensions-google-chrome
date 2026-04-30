document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('trace-json-input');
  const vizBtn = document.getElementById('trace-visualize-btn');
  const clearBtn = document.getElementById('trace-clear-btn');
  const waterfall = document.getElementById('trace-waterfall');

  if (!vizBtn) return;

  function visualizeTrace(spans) {
    if (!Array.isArray(spans)) {
      waterfall.innerHTML = '<div class="trace-error">Invalid trace format. Expected an array of spans.</div>';
      return;
    }

    waterfall.innerHTML = '';

    // Calculate global range
    let minTime = Infinity;
    let maxTime = -Infinity;

    spans.forEach(s => {
      const start = Number(s.startTimeUnixNano || s.start_time_unix_nano || 0);
      const end = Number(s.endTimeUnixNano || s.end_time_unix_nano || 0);
      if (start < minTime) minTime = start;
      if (end > maxTime) maxTime = end;
    });

    const totalDuration = maxTime - minTime;

    spans.forEach(s => {
      const start = Number(s.startTimeUnixNano || s.start_time_unix_nano || 0);
      const end = Number(s.endTimeUnixNano || s.end_time_unix_nano || 0);
      const duration = end - start;
      
      const leftPercent = ((start - minTime) / totalDuration) * 100;
      const widthPercent = (duration / totalDuration) * 100;

      const row = document.createElement('div');
      row.className = 'span-row';
      
      const isError = s.status?.code === 2 || s.status?.code === 'ERROR' || s.attributes?.['error'] === true;

      row.innerHTML = `
        <div class="span-bar-container">
          <div class="span-bar ${isError ? 'error' : ''}" style="left: ${leftPercent}%; width: ${Math.max(widthPercent, 1)}%">
            <div class="span-label">${s.name || 'unnamed-span'} (${(duration / 1000000).toFixed(2)}ms)</div>
          </div>
        </div>
      `;
      waterfall.appendChild(row);
    });
  }

  vizBtn.addEventListener('click', () => {
    try {
      const raw = input.value.trim();
      if (!raw) return;
      const data = JSON.parse(raw);
      // Handle OTel collector wrapper if present
      const spans = data.resourceSpans ? data.resourceSpans[0]?.scopeSpans[0]?.spans : (Array.isArray(data) ? data : null);
      
      if (spans) {
        visualizeTrace(spans);
      } else {
        throw new Error('Could not find spans in JSON');
      }
    } catch (e) {
      waterfall.innerHTML = `<div class="trace-error" style="color: #ff6b6b; font-size: 0.8rem; padding: 1rem;">Failed to parse JSON: ${e.message}</div>`;
    }
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    waterfall.innerHTML = '<div class="trace-empty-state">Paste a list of OTel spans to see the waterfall...</div>';
  });
});
