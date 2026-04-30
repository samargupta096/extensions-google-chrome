document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('color-utility-picker');
  const hexOut = document.getElementById('color-hex-out');
  const rgbOut = document.getElementById('color-rgb-out');
  const hslOut = document.getElementById('color-hsl-out');
  const copyBtn = document.getElementById('color-copy-btn');
  
  const scoreWhite = document.getElementById('contrast-score-white');
  const scoreBlack = document.getElementById('contrast-score-black');
  const boxWhite = document.getElementById('contrast-white');
  const boxBlack = document.getElementById('contrast-black');

  if (!picker) return;

  function hexToRgb(hex) {
    let r = 0, g = 0, b = 0;
    if (hex.length == 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length == 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return { r, g, b };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max == min) {
      h = s = 0; // achromatic
    } else {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { 
      h: Math.round(h * 360), 
      s: Math.round(s * 100), 
      l: Math.round(l * 100) 
    };
  }

  function getLuminance(r, g, b) {
    let a = [r, g, b].map(function (v) {
        v /= 255;
        return v <= 0.03928
            ? v / 12.92
            : Math.pow( (v + 0.055) / 1.055, 2.4 );
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrast(rgb1, rgb2) {
    let lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    let lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    let brightest = Math.max(lum1, lum2);
    let darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function updateColorInfo() {
    const hex = picker.value;
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    hexOut.textContent = hex;
    rgbOut.textContent = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    hslOut.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

    // Contrast logic
    boxWhite.style.backgroundColor = hex;
    boxBlack.style.backgroundColor = hex;

    const contrastWhite = getContrast(rgb, {r:255, g:255, b:255});
    const contrastBlack = getContrast(rgb, {r:0, g:0, b:0});

    scoreWhite.textContent = contrastWhite >= 4.5 ? 'Pass (AA)' : 'Fail';
    scoreBlack.textContent = contrastBlack >= 4.5 ? 'Pass (AA)' : 'Fail';
  }

  picker.addEventListener('input', updateColorInfo);

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(picker.value).then(() => {
      const original = copyBtn.textContent;
      copyBtn.textContent = '✓';
      setTimeout(() => copyBtn.textContent = original, 2000);
    });
  });

  // Initial update
  updateColorInfo();
});
