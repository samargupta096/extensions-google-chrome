document.addEventListener('DOMContentLoaded', () => {
  const valueInput = document.getElementById('dppx-value');
  const unitSelect = document.getElementById('dppx-unit');
  const resultContainer = document.getElementById('dppx-results');

  if (!valueInput || !unitSelect) return;

  const densities = [
    { name: 'LDPI', dpi: 120, scale: 0.75 },
    { name: 'MDPI', dpi: 160, scale: 1 },
    { name: 'HDPI', dpi: 240, scale: 1.5 },
    { name: 'XHDPI', dpi: 320, scale: 2 },
    { name: 'XXHDPI', dpi: 480, scale: 3 },
    { name: 'XXXHDPI', dpi: 640, scale: 4 }
  ];

  function convert() {
    const val = parseFloat(valueInput.value);
    if (isNaN(val) || val <= 0) {
      resultContainer.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:1rem;font-size:0.8rem;">Enter a value above to see conversions.</div>';
      return;
    }

    const unit = unitSelect.value;

    const rows = densities.map(d => {
      let dp, px, sp;

      if (unit === 'dp') {
        dp = val;
        px = Math.round(val * d.scale * 100) / 100;
        sp = val; // sp == dp when user font scale is 1x
      } else if (unit === 'px') {
        dp = Math.round((val / d.scale) * 100) / 100;
        px = val;
        sp = dp;
      } else { // sp
        sp = val;
        dp = val;
        px = Math.round(val * d.scale * 100) / 100;
      }

      const isBase = d.name === 'MDPI';

      return `
        <div class="dppx-row ${isBase ? 'dppx-base' : ''}">
          <span class="dppx-density">${d.name}</span>
          <span class="dppx-val">${dp} dp</span>
          <span class="dppx-val">${px} px</span>
          <span class="dppx-val">${sp} sp</span>
        </div>
      `;
    }).join('');

    resultContainer.innerHTML = `
      <div class="dppx-header-row">
        <span>Bucket</span><span>dp</span><span>px</span><span>sp</span>
      </div>
      ${rows}
      <div class="dppx-formula">Formula: px = dp × (dpi / 160)</div>
    `;
  }

  valueInput.addEventListener('input', convert);
  unitSelect.addEventListener('change', convert);

  // initial render
  convert();
});
