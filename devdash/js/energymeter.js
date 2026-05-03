// Creator Energy Meter — Daily check-in with weekly sparkline
document.addEventListener('DOMContentLoaded', () => {
  const energySlider = document.getElementById('energy-slider');
  const motivSlider = document.getElementById('motiv-slider');
  const stressSlider = document.getElementById('stress-slider');
  const energyVal = document.getElementById('energy-val');
  const motivVal = document.getElementById('motiv-val');
  const stressVal = document.getElementById('stress-val');
  const saveBtn = document.getElementById('energy-save-btn');
  const summaryEl = document.getElementById('energy-summary');
  const chartCanvas = document.getElementById('energy-chart');

  if (!energySlider || !chartCanvas) return;

  const STORAGE_KEY = 'creator_energy';
  let energyData = {};

  function getToday() { return new Date().toISOString().slice(0, 10); }

  chrome.storage.local.get([STORAGE_KEY], (res) => {
    energyData = res[STORAGE_KEY] || {};
    const today = energyData[getToday()];
    if (today) {
      energySlider.value = today.energy;
      motivSlider.value = today.motivation;
      stressSlider.value = today.stress;
    }
    updateLabels();
    renderSummary();
    renderChart();
  });

  function updateLabels() {
    if (energyVal) energyVal.textContent = energySlider.value;
    if (motivVal) motivVal.textContent = motivSlider.value;
    if (stressVal) stressVal.textContent = stressSlider.value;
  }

  [energySlider, motivSlider, stressSlider].forEach(s => {
    s && s.addEventListener('input', updateLabels);
  });

  saveBtn && saveBtn.addEventListener('click', () => {
    energyData[getToday()] = {
      energy: parseInt(energySlider.value),
      motivation: parseInt(motivSlider.value),
      stress: parseInt(stressSlider.value)
    };
    chrome.storage.local.set({ [STORAGE_KEY]: energyData });
    renderSummary();
    renderChart();
    saveBtn.textContent = '✅ Saved';
    setTimeout(() => saveBtn.textContent = 'Save Check-in', 1500);
  });

  function renderSummary() {
    const today = energyData[getToday()];
    if (!today || !summaryEl) return;

    const avg = (today.energy + today.motivation) / 2;
    const stressAdj = avg - (today.stress * 0.3);
    let badge, advice;

    if (stressAdj >= 6) {
      badge = '🟢 High Energy';
      advice = 'Great day for deep creative work!';
    } else if (stressAdj >= 3.5) {
      badge = '🟡 Moderate';
      advice = 'Good for editing or lighter tasks';
    } else {
      badge = '🔴 Low Energy';
      advice = 'Plan lighter tasks — rest is productive too';
    }

    summaryEl.innerHTML = `<span class="energy-badge">${badge}</span><span class="energy-advice">${advice}</span>`;
  }

  function renderChart() {
    const ctx = chartCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const w = chartCanvas.clientWidth;
    const h = chartCanvas.clientHeight;
    chartCanvas.width = w * dpr;
    chartCanvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // Get last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }

    const barWidth = (w - 16) / 7;
    const maxH = h - 8;

    days.forEach((day, i) => {
      const entry = energyData[day];
      const val = entry ? ((entry.energy + entry.motivation) / 2 - entry.stress * 0.2) : 0;
      const normalized = Math.max(0, Math.min(10, val));
      const barH = (normalized / 10) * maxH;
      const x = 4 + i * barWidth + 2;
      const y = h - barH - 2;

      // Color based on value
      let color;
      if (normalized >= 6) color = '#00cec9';
      else if (normalized >= 3.5) color = '#f6d365';
      else color = '#ff6b6b';

      ctx.fillStyle = entry ? color : 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth - 4, barH, 3);
      ctx.fill();

      // Day label
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      const dateObj = new Date(day);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px Inter, sans-serif';
      ctx.textAlign = 'center';
    });
  }
});
