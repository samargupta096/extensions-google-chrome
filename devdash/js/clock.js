function updateClock() {
  const now = new Date();
  
  // Format Time
  let hours = now.getHours();
  let minutes = now.getMinutes();
  hours = hours < 10 ? '0' + hours : hours;
  minutes = minutes < 10 ? '0' + minutes : minutes;
  document.getElementById('clock').textContent = `${hours}:${minutes}`;

  // Format Date
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('date').textContent = now.toLocaleDateString(undefined, options);
}

setInterval(updateClock, 1000);
updateClock();
