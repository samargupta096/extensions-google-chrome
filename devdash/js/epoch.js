// Unix Epoch Converter Widget
document.addEventListener('DOMContentLoaded', () => {
  const currentEpochDisplay = document.getElementById('epoch-current');
  const inputField = document.getElementById('epoch-input');
  const convertBtn = document.getElementById('epoch-convert-btn');
  const resultDisplay = document.getElementById('epoch-result');

  if (!currentEpochDisplay) return;

  // Live current epoch
  setInterval(() => {
    currentEpochDisplay.textContent = Math.floor(Date.now() / 1000);
  }, 1000);

  currentEpochDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(currentEpochDisplay.textContent);
    const original = currentEpochDisplay.textContent;
    currentEpochDisplay.textContent = 'Copied!';
    setTimeout(() => {
      currentEpochDisplay.textContent = original;
    }, 1000);
  });

  function convertTime() {
    const val = inputField.value.trim();
    if (!val) {
      resultDisplay.textContent = '';
      return;
    }

    // Check if it's a number (timestamp)
    if (/^\d+$/.test(val)) {
      let num = parseInt(val, 10);
      // Heuristic: if it's typical seconds (e.g. < 3000000000), multiply by 1000 for JS Date
      if (num < 3000000000) num *= 1000;
      
      const d = new Date(num);
      if (!isNaN(d.getTime())) {
        resultDisplay.innerHTML = `
          <div class="epoch-result-row"><span>Local:</span> ${d.toLocaleString()}</div>
          <div class="epoch-result-row"><span>UTC:</span> ${d.toUTCString()}</div>
        `;
      } else {
        resultDisplay.textContent = 'Invalid timestamp';
      }
    } else {
      // Try to parse as date string
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        resultDisplay.innerHTML = `
          <div class="epoch-result-row"><span>Seconds:</span> ${Math.floor(d.getTime() / 1000)}</div>
          <div class="epoch-result-row"><span>Millis:</span> ${d.getTime()}</div>
        `;
      } else {
        resultDisplay.textContent = 'Invalid date string';
      }
    }
  }

  convertBtn && convertBtn.addEventListener('click', convertTime);
  inputField && inputField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') convertTime();
  });
});
