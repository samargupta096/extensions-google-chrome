document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  
  // Theme definitions
  const themes = {
    dark: 'linear-gradient(135deg, #0f0f1a 0%, #161628 100%)',
    hiker: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)',
    volcano: 'linear-gradient(135deg, #430000 0%, #900000 100%)',
    cyber: 'linear-gradient(135deg, #000046 0%, #1cb5e0 100%)',
    nebula: 'linear-gradient(135deg, #614385 0%, #516395 100%)',
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
    <button id="theme-toggle-btn" class="fab-btn theme-btn">🎨</button>
    <div id="theme-panel" class="theme-panel">
      <h3>Personalize</h3>
      
      <div class="theme-section">
        <h4>Background Theme</h4>
        <div class="theme-swatches">
          ${Object.keys(themes).map(id => `
            <button class="theme-swatch" data-theme-id="${id}" style="background: ${themes[id]}" title="${id}"></button>
          `).join('')}
        </div>
      </div>

      <div class="theme-section" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1);">
        <h4>Widget Style</h4>
        <div class="widget-style-controls">
          <div class="control-group">
            <label>Corner Style</label>
            <select id="widget-radius-select" class="glass-select">
              <option value="0px">Sharp</option>
              <option value="8px">Soft</option>
              <option value="16px" selected>Rounded</option>
              <option value="32px">Extra Rounded</option>
              <option value="50%">Circular</option>
            </select>
          </div>
          <div class="control-group">
            <label>Glass Effect</label>
            <select id="widget-glass-select" class="glass-select">
              <option value="soft">Soft</option>
              <option value="medium" selected>Medium</option>
              <option value="strong">Strong</option>
            </select>
          </div>
          <div class="control-group">
            <label>Widget Tint</label>
            <select id="widget-tint-select" class="glass-select">
              <option value="clear" selected>Clear (Default)</option>
              <option value="midnight">Midnight</option>
              <option value="electric">Electric Blue</option>
              <option value="emerald">Emerald Green</option>
              <option value="amber">Amber</option>
            </select>
          </div>
          <div class="control-group">
            <label>Text Color</label>
            <select id="text-color-select" class="glass-select">
              <option value="white" selected>Default White</option>
              <option value="cyan">Cyber Cyan</option>
              <option value="gold">Golden</option>
              <option value="emerald">Emerald</option>
              <option value="rose">Rose</option>
            </select>
          </div>
          <div class="control-group">
            <label>Font Style</label>
            <select id="font-style-select" class="glass-select">
              <option value="'Inter', sans-serif" selected>Modern Sans</option>
              <option value="'Playfair Display', serif">Classic Serif</option>
              <option value="'JetBrains Mono', monospace">Tech Mono</option>
              <option value="'Outfit', sans-serif">Elegant Outfit</option>
              <option value="'Roboto', sans-serif">Clean Roboto</option>
            </select>
          </div>
          <div class="control-group">
            <label>Clock Size</label>
            <select id="clock-size-select" class="glass-select">
              <option value="4rem">Small</option>
              <option value="6rem">Medium</option>
              <option value="8rem" selected>Large</option>
              <option value="12rem">Extra Large</option>
            </select>
          </div>
          <div class="control-group">
            <label>Hero Position</label>
            <select id="hero-pos-select" class="glass-select">
              <option value="left">Left</option>
              <option value="center" selected>Center</option>
              <option value="right">Right</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(themeContainer);

  const toggleBtn = document.getElementById('theme-toggle-btn');
  const panel = document.getElementById('theme-panel');
  const swatches = document.querySelectorAll('.theme-swatch');
  const radiusSelect = document.getElementById('widget-radius-select');
  const glassSelect = document.getElementById('widget-glass-select');
  const tintSelect = document.getElementById('widget-tint-select');
  const textColorSelect = document.getElementById('text-color-select');
  const fontStyleSelect = document.getElementById('font-style-select');
  const clockSizeSelect = document.getElementById('clock-size-select');
  const heroPosSelect = document.getElementById('hero-pos-select');
  const heroSection = document.getElementById('hero-section');

  // Toggle Panel
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = panel.classList.contains('active');
    document.querySelectorAll('.theme-panel, .wallpaper-modal, .visibility-panel').forEach(p => p.classList.remove('active'));
    if (!isActive) panel.classList.add('active');
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('active')) {
      if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
        panel.classList.remove('active');
      }
    }
  });

  // Apply Theme
  function applyTheme(themeId, isManual = false) {
    if (themes[themeId]) {
      document.documentElement.style.setProperty('--bg-gradient', themes[themeId]);
      
      chrome.storage.local.get(['customWallpaper'], (result) => {
        // If manual click, clear wallpaper
        if (isManual) {
          chrome.storage.local.remove(['customWallpaper']);
          body.style.backgroundImage = '';
          body.style.background = themes[themeId];
          body.style.backgroundAttachment = 'fixed';
          body.style.backgroundSize = 'cover';
        } 
        // If on load, only apply theme if NO wallpaper exists
        else if (!result.customWallpaper) {
          body.style.background = themes[themeId];
          body.style.backgroundAttachment = 'fixed';
          body.style.backgroundSize = 'cover';
        }
      });

      swatches.forEach(s => s.classList.remove('active'));
      const activeSwatch = document.querySelector(`.theme-swatch[data-theme-id="${themeId}"]`);
      if (activeSwatch) activeSwatch.classList.add('active');
    }
  }

  // Apply All Styles
  function applyStyles(settings) {
    const { radius, glass, tint, textColor, fontStyle, clockSize, heroPos } = settings;
    
    // 1. Widget Radius
    document.documentElement.style.setProperty('--widget-radius', radius);
    
    // 2. Text Color
    let textMain, textDim;
    switch(textColor) {
      case 'cyan': textMain = '#00ffff'; textDim = 'rgba(0, 255, 255, 0.7)'; break;
      case 'gold': textMain = '#ffd700'; textDim = 'rgba(255, 215, 0, 0.7)'; break;
      case 'emerald': textMain = '#00ffaa'; textDim = 'rgba(0, 255, 170, 0.7)'; break;
      case 'rose': textMain = '#ff0077'; textDim = 'rgba(255, 0, 119, 0.7)'; break;
      case 'white':
      default: textMain = '#ffffff'; textDim = 'rgba(255, 255, 255, 0.7)'; break;
    }
    document.documentElement.style.setProperty('--text-main', textMain);
    document.documentElement.style.setProperty('--text-dim', textDim);

    // 3. Font Style
    document.documentElement.style.setProperty('--font-main', fontStyle);

    // 4. Widget Tint & Glass
    let tintColor;
    switch(tint) {
      case 'midnight': tintColor = '0, 0, 0'; break;
      case 'electric': tintColor = '0, 100, 255'; break;
      case 'emerald': tintColor = '0, 255, 120'; break;
      case 'amber': tintColor = '255, 150, 0'; break;
      case 'clear':
      default: tintColor = '255, 255, 255'; break;
    }

    let opacity, blur, borderOpacity;
    switch(glass) {
      case 'soft': opacity = 0.02; blur = '5px'; borderOpacity = 0.03; break;
      case 'strong': opacity = 0.1; blur = '25px'; borderOpacity = 0.15; break;
      case 'medium':
      default: opacity = 0.05; blur = '12px'; borderOpacity = 0.08; break;
    }
    
    document.documentElement.style.setProperty('--widget-bg', `rgba(${tintColor}, ${opacity})`);
    document.documentElement.style.setProperty('--widget-blur', blur);
    document.documentElement.style.setProperty('--widget-border', `rgba(${tintColor}, ${borderOpacity})`);

    // 5. Hero Section (Clock & Position)
    document.documentElement.style.setProperty('--clock-size', clockSize);
    if (heroSection) {
      heroSection.setAttribute('data-align', heroPos);
    }
  }

  function getSettings() {
    return {
      radius: radiusSelect.value,
      glass: glassSelect.value,
      tint: tintSelect.value,
      textColor: textColorSelect.value,
      fontStyle: fontStyleSelect.value,
      clockSize: clockSizeSelect.value,
      heroPos: heroPosSelect.value
    };
  }

  // Handle swatch click
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      const themeId = swatch.dataset.themeId;
      applyTheme(themeId, true); // true for manual
      chrome.storage.local.set({ bgTheme: themeId });
    });
  });

  // Handle widget style changes
  [radiusSelect, glassSelect, tintSelect, textColorSelect, fontStyleSelect, clockSizeSelect, heroPosSelect].forEach(select => {
    select.addEventListener('change', () => {
      const settings = getSettings();
      chrome.storage.local.set({
        widgetRadius: settings.radius,
        widgetGlass: settings.glass,
        widgetTint: settings.tint,
        widgetTextColor: settings.textColor,
        fontStyle: settings.fontStyle,
        clockSize: settings.clockSize,
        heroPos: settings.heroPos
      });
      applyStyles(settings);
    });
  });

  // Load Saved Settings
  chrome.storage.local.get(['bgTheme', 'widgetRadius', 'widgetGlass', 'widgetTint', 'widgetTextColor', 'fontStyle', 'clockSize', 'heroPos'], (result) => {
    if (result.bgTheme && themes[result.bgTheme]) {
      applyTheme(result.bgTheme, false); // false for load
    } else {
      applyTheme('dark', false);
    }

    const settings = {
      radius: result.widgetRadius || '16px',
      glass: result.widgetGlass || 'medium',
      tint: result.widgetTint || 'clear',
      textColor: result.widgetTextColor || 'white',
      fontStyle: result.fontStyle || "'Inter', sans-serif",
      clockSize: result.clockSize || '8rem',
      heroPos: result.heroPos || 'center'
    };
    
    radiusSelect.value = settings.radius;
    glassSelect.value = settings.glass;
    tintSelect.value = settings.tint;
    textColorSelect.value = settings.textColor;
    fontStyleSelect.value = settings.fontStyle;
    clockSizeSelect.value = settings.clockSize;
    heroPosSelect.value = settings.heroPos;

    applyStyles(settings);
  });
});
