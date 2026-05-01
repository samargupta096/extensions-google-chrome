(function() {
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  
  let clockFormat = '24h'; // default

  // Load preference
  chrome.storage.local.get(['clockFormat'], (result) => {
    if (result.clockFormat) {
      clockFormat = result.clockFormat;
      updateClock();
    }
  });

  function updateClock() {
    const now = new Date();
    
    // Format Time
    let hours = now.getHours();
    let minutes = now.getMinutes();
    let ampm = '';

    if (clockFormat === '12h') {
      ampm = hours >= 12 ? ' PM' : ' AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
    } else {
      hours = hours < 10 ? '0' + hours : hours;
    }
    
    minutes = minutes < 10 ? '0' + minutes : minutes;
    
    if (clockEl) {
      clockEl.textContent = `${hours}:${minutes}${ampm}`;
    }

    // Format Date
    if (dateEl) {
      const options = { weekday: 'long', month: 'long', day: 'numeric' };
      dateEl.textContent = now.toLocaleDateString(undefined, options);
    }
  }

  // Toggle Format on click
  if (clockEl) {
    clockEl.addEventListener('click', () => {
      clockFormat = (clockFormat === '24h') ? '12h' : '24h';
      chrome.storage.local.set({ clockFormat: clockFormat });
      updateClock();
      
      // Simple feedback: momentary scale
      clockEl.style.transform = 'scale(0.95)';
      setTimeout(() => clockEl.style.transform = '', 100);
    });
  }

  setInterval(updateClock, 1000);
  updateClock();
})();
