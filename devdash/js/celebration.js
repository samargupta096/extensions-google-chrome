/**
 * celebration.js — Visual & Audio celebration for session completion
 */
const Celebration = {
  // Synthesize a premium success sound using Web Audio API
  playSuccessSound(mode = 'work') {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      
      const playNote = (freq, startTime, duration, vol = 0.1) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(vol, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      if (mode === 'work') {
        // Success Chord: C5, E5, G5, C6 (Arpeggio)
        playNote(523.25, ctx.currentTime, 0.8);        // C5
        playNote(659.25, ctx.currentTime + 0.1, 0.8);  // E5
        playNote(783.99, ctx.currentTime + 0.2, 0.8);  // G5
        playNote(1046.50, ctx.currentTime + 0.3, 1.2, 0.15); // C6
      } else {
        // Soft Break Sound: G4, B4, D5
        playNote(392.00, ctx.currentTime, 1.0);        // G4
        playNote(493.88, ctx.currentTime + 0.1, 1.0);  // B4
        playNote(587.33, ctx.currentTime + 0.2, 1.0, 0.05); // D5
      }
    } catch (e) {
      console.warn('Audio celebration failed:', e);
    }
  },

  // Simple CSS/Canvas confetti effect
  triggerConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const width = canvas.width = window.innerWidth;
    const height = canvas.height = window.innerHeight;

    const particles = [];
    const colors = ['#4facfe', '#00f2fe', '#6C5CE7', '#00CEC9', '#feca57', '#ff6b6b'];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * width,
        y: height + Math.random() * 100,
        vx: (Math.random() - 0.5) * 10,
        vy: -Math.random() * 15 - 10,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rSpeed: Math.random() * 10 - 5
      });
    }

    let frames = 0;
    function animate() {
      ctx.clearRect(0, 0, width, height);
      
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.4; // gravity
        p.rotation += p.rSpeed;

        if (p.y < height + 50) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation * Math.PI / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
          ctx.restore();
        }
      });

      frames++;
      if (alive && frames < 200) {
        requestAnimationFrame(animate);
      } else {
        canvas.remove();
      }
    }

    animate();
  },

  showBanner(mode) {
    const banner = document.createElement('div');
    banner.className = 'glass-card celebration-banner slide-up';
    banner.innerHTML = `
      <div style="font-size: 2rem; margin-bottom: 0.5rem;">${mode === 'work' ? '🎉' : '☕'}</div>
      <div style="font-size: 1.2rem; font-weight: 800; color: white;">${mode === 'work' ? 'Deep Work Complete!' : 'Break Time Over!'}</div>
      <div style="font-size: 0.9rem; color: rgba(255,255,255,0.7); margin-top: 0.25rem;">${mode === 'work' ? 'Great focus session. Take a well-deserved rest.' : 'Ready to start your next focus session?'}</div>
    `;
    
    Object.assign(banner.style, {
      position: 'fixed',
      bottom: '2rem',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '1.5rem 2.5rem',
      textAlign: 'center',
      zIndex: '10000',
      border: '1px solid rgba(79, 172, 254, 0.4)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      backdropFilter: 'blur(20px)'
    });

    document.body.appendChild(banner);

    const timerWidget = document.querySelector('.timer-widget');
    if (timerWidget) timerWidget.classList.add('complete-celebration');

    setTimeout(() => {
      banner.style.opacity = '0';
      banner.style.transform = 'translateX(-50%) translateY(20px)';
      banner.style.transition = 'all 0.5s ease';
      setTimeout(() => {
        banner.remove();
        if (timerWidget) timerWidget.classList.remove('complete-celebration');
      }, 500);
    }, 5000);
  }
};

// Listen for completion message
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'TIMER_COMPLETE') {
    Celebration.playSuccessSound(msg.mode);
    Celebration.showBanner(msg.mode);
    if (msg.mode === 'work') {
      Celebration.triggerConfetti();
    }
  }
});
