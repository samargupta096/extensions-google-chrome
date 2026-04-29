document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  
  // Theme definitions matching the plan
  const themes = {
    dark: 'linear-gradient(135deg, #0f0f1a 0%, #161628 100%)',
    aurora: 'linear-gradient(135deg, #0d1b2a 0%, #1b4332 100%)',
    sunset: 'linear-gradient(135deg, #1a0533 0%, #3d0b00 100%)',
    ocean: 'linear-gradient(135deg, #020818 0%, #0a3d62 100%)',
    midnight: 'linear-gradient(135deg, #0d0221 0%, #2d1b69 100%)',
    forest: 'linear-gradient(135deg, #0a1628 0%, #1a3a1a 100%)',
    rose: 'linear-gradient(135deg, #1a0a0a 0%, #3d1a2a 100%)',
    carbon: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%)'
  };

  // Inject Theme Panel UI
  const themeContainer = document.createElement('div');
  themeContainer.innerHTML = `
    <button id="theme-toggle-btn" class="theme-btn">🎨</button>
    <div id="theme-panel" class="theme-panel">
      <h3>Select Theme</h3>
      <div class="theme-swatches">
        ${Object.keys(themes).map(id => `
          <button class="theme-swatch" data-theme-id="${id}" style="background: ${themes[id]}" title="${id}"></button>
        `).join('')}
      </div>
    </div>
  `;
  document.body.appendChild(themeContainer);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  const panel = document.getElementById('theme-panel');
  const swatches = document.querySelectorAll('.theme-swatch');

  // Toggle Panel
  toggleBtn.addEventListener('click', () => {
    const isActive = panel.classList.contains('active');
    // Close all panels
    document.querySelectorAll('.theme-panel, .wallpaper-modal, .visibility-panel').forEach(p => p.classList.remove('active'));
    // If it wasn't active, open it
    if (!isActive) {
      panel.classList.add('active');
    }
  });

  // Apply Theme
  function applyTheme(themeId) {
    if (themes[themeId]) {
      // Set the CSS variable used by body, so wallpaper can override it if needed
      document.documentElement.style.setProperty('--bg-gradient', themes[themeId]);
      
      // We also update body background directly if no custom wallpaper exists
      chrome.storage.local.get(['customWallpaper'], (result) => {
        if (!result.customWallpaper) {
          body.style.background = themes[themeId];
        }
      });

      // Update Active State
      swatches.forEach(s => s.classList.remove('active'));
      const activeSwatch = document.querySelector(`.theme-swatch[data-theme-id="${themeId}"]`);
      if (activeSwatch) activeSwatch.classList.add('active');
    }
  }

  // Handle swatch click
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const themeId = swatch.dataset.themeId;
      applyTheme(themeId);
      chrome.storage.local.set({ bgTheme: themeId });
    });
  });

  // Load Saved Theme
  chrome.storage.local.get(['bgTheme'], (result) => {
    if (result.bgTheme && themes[result.bgTheme]) {
      applyTheme(result.bgTheme);
    } else {
      applyTheme('dark'); // Default
    }
  });
});
