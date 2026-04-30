document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const toggleBtn = document.getElementById('wallpaper-toggle-btn');
  const modal = document.getElementById('wallpaper-modal');
  const urlInput = document.getElementById('wallpaper-url-input');
  const setUrlBtn = document.getElementById('set-url-btn');
  const uploadInput = document.getElementById('wallpaper-upload');
  const resetBtn = document.getElementById('reset-wallpaper-btn');

  // Toggle modal
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = modal.classList.contains('active');
    // Close all panels
    document.querySelectorAll('.theme-panel, .wallpaper-modal, .visibility-panel').forEach(p => p.classList.remove('active'));
    // If it wasn't active, open it
    if (!isActive) {
      modal.classList.add('active');
    }
  });

  // Close modal when clicking outside
  document.addEventListener('click', (e) => {
    if (modal.classList.contains('active')) {
      if (!modal.contains(e.target) && !toggleBtn.contains(e.target)) {
        modal.classList.remove('active');
      }
    }
  });

  // Load wallpaper from storage
  chrome.storage.local.get(['customWallpaper'], (result) => {
    if (result.customWallpaper) {
      setBodyBackground(result.customWallpaper);
    }
  });

  function setBodyBackground(imgData) {
    body.style.backgroundImage = `url('${imgData}')`;
    body.style.backgroundAttachment = 'fixed';
    body.style.backgroundSize = 'cover';
    
    // Clear active theme swatch visual state
    document.querySelectorAll('.theme-swatch').forEach(s => s.classList.remove('active'));
  }

  // Set from URL
  setUrlBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (url) {
      setBodyBackground(url);
      chrome.storage.local.set({ customWallpaper: url });
      modal.classList.remove('active');
    }
  });

  // Set from file upload
  uploadInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(event) {
        const base64String = event.target.result;
        setBodyBackground(base64String);
        chrome.storage.local.set({ customWallpaper: base64String });
        modal.classList.remove('active');
      };
      reader.readAsDataURL(file);
    }
  });

  // Reset
  resetBtn.addEventListener('click', () => {
    body.style.backgroundImage = '';
    chrome.storage.local.remove(['customWallpaper']);
    modal.classList.remove('active');
    urlInput.value = '';
    uploadInput.value = '';
  });
});
