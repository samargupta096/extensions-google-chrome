document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const toggleBtn = document.getElementById('wallpaper-toggle-btn');
  const modal = document.getElementById('wallpaper-modal');
  const urlInput = document.getElementById('wallpaper-url-input');
  const setUrlBtn = document.getElementById('set-url-btn');
  const uploadInput = document.getElementById('wallpaper-upload');
  const resetBtn = document.getElementById('reset-wallpaper-btn');

  // Toggle modal
  toggleBtn.addEventListener('click', () => {
    modal.classList.toggle('active');
  });

  // Load wallpaper from storage
  chrome.storage.local.get(['customWallpaper'], (result) => {
    if (result.customWallpaper) {
      setBodyBackground(result.customWallpaper);
    }
  });

  function setBodyBackground(imgData) {
    body.style.backgroundImage = `url('${imgData}')`;
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
    body.style.backgroundImage = 'none';
    chrome.storage.local.remove(['customWallpaper']);
    modal.classList.remove('active');
    urlInput.value = '';
    uploadInput.value = '';
  });
});
