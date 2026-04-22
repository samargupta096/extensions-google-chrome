let timerInterval;
let timeRemaining = 25 * 60; // default 25 minutes
let isRunning = false;

document.addEventListener('DOMContentLoaded', () => {
  const timerDisplay = document.getElementById('timer-display');
  const startBtn = document.getElementById('start-timer-btn');
  const pauseBtn = document.getElementById('pause-timer-btn');
  const resetBtn = document.getElementById('reset-timer-btn');
  const modeRadios = document.querySelectorAll('input[name="timer-mode"]');

  function updateDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes < 10 ? '0' : ''}${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  }

  function startTimer() {
    if (isRunning) return;
    isRunning = true;
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';

    timerInterval = setInterval(() => {
      timeRemaining--;
      updateDisplay();

      if (timeRemaining <= 0) {
        clearInterval(timerInterval);
        isRunning = false;
        alert("Time is up!");
        resetTimer();
      }
    }, 1000);
  }

  function pauseTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.style.display = 'inline-block';
    startBtn.textContent = 'Resume';
    pauseBtn.style.display = 'none';
  }

  function resetTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    startBtn.style.display = 'inline-block';
    startBtn.textContent = 'Start';
    pauseBtn.style.display = 'none';
    
    // Check mode
    const mode = document.querySelector('input[name="timer-mode"]:checked').value;
    if (mode === 'work') {
      timeRemaining = 25 * 60;
    } else {
      timeRemaining = 5 * 60;
    }
    updateDisplay();
  }

  startBtn.addEventListener('click', startTimer);
  pauseBtn.addEventListener('click', pauseTimer);
  resetBtn.addEventListener('click', resetTimer);

  modeRadios.forEach(radio => {
    radio.addEventListener('change', resetTimer);
  });

  updateDisplay(); // Init display
});
