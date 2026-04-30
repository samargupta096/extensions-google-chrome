document.addEventListener('DOMContentLoaded', () => {
  const paletteGrid = document.getElementById('material-palette-grid');

  if (!paletteGrid) return;

  const palettes = {
    'Primary': ['#6750A4', '#7965AF', '#8C7BBB', '#9F91C7', '#B3A7D3', '#C7BDDF', '#DBD3EB', '#EFE9F7'],
    'Secondary': ['#625B71', '#746D81', '#867F91', '#9891A1', '#AAA3B1', '#BCB5C1', '#CEC7D1', '#E0D9E1'],
    'Tertiary': ['#7D5260', '#8D6472', '#9D7684', '#AD8896', '#BD9AA8', '#CDACBA', '#DDBECC', '#EDD0DE'],
    'Error': ['#B3261E', '#C23C35', '#D1534C', '#E06A63', '#EF817A', '#FE9891', '#FFAFA8', '#FFC6BF'],
    'Blue': ['#1565C0', '#1976D2', '#1E88E5', '#2196F3', '#42A5F5', '#64B5F6', '#90CAF9', '#BBDEFB'],
    'Green': ['#2E7D32', '#388E3C', '#43A047', '#4CAF50', '#66BB6A', '#81C784', '#A5D6A7', '#C8E6C9'],
    'Amber': ['#FF6F00', '#FF8F00', '#FFA000', '#FFB300', '#FFC107', '#FFCA28', '#FFD54F', '#FFE082'],
    'Teal': ['#00695C', '#00796B', '#00897B', '#009688', '#26A69A', '#4DB6AC', '#80CBC4', '#B2DFDB']
  };

  let html = '';
  for (const [name, colors] of Object.entries(palettes)) {
    html += `<div class="mat-palette-row">
      <span class="mat-palette-name">${name}</span>
      <div class="mat-swatches">
        ${colors.map(c => `<div class="mat-swatch" style="background:${c}" data-color="${c}" title="${c}"></div>`).join('')}
      </div>
    </div>`;
  }
  paletteGrid.innerHTML = html;

  paletteGrid.addEventListener('click', (e) => {
    const swatch = e.target.closest('.mat-swatch');
    if (!swatch) return;
    const color = swatch.dataset.color;
    navigator.clipboard.writeText(color);

    // Visual feedback
    const original = swatch.style.outline;
    swatch.style.outline = '2px solid #fff';
    setTimeout(() => swatch.style.outline = original, 800);
  });
});
