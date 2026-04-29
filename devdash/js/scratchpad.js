// Scratchpad Widget — Quick notes with auto-save and copy
document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('scratchpad-textarea');
  const copyBtn = document.getElementById('scratchpad-copy-btn');
  const clearBtn = document.getElementById('scratchpad-clear-btn');
  const charCount = document.getElementById('scratchpad-char-count');

  if (!textarea) return;

  // Load saved content
  chrome.storage.local.get(['scratchpadContent'], (result) => {
    if (result.scratchpadContent) {
      textarea.value = result.scratchpadContent;
      updateCharCount();
    }
  });

  // Auto-save with debounce
  let saveTimeout;
  textarea.addEventListener('input', () => {
    updateCharCount();
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      chrome.storage.local.set({ scratchpadContent: textarea.value });
    }, 500);
  });

  // Copy to clipboard
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (!textarea.value) return;
      try {
        await navigator.clipboard.writeText(textarea.value);
        copyBtn.textContent = '✅';
        setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
      } catch (e) {
        textarea.select();
        document.execCommand('copy');
        copyBtn.textContent = '✅';
        setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
      }
    });
  }

  // Clear
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (textarea.value && confirm('Clear all scratchpad content?')) {
        textarea.value = '';
        updateCharCount();
        chrome.storage.local.set({ scratchpadContent: '' });
      }
    });
  }

  function updateCharCount() {
    if (charCount) {
      charCount.textContent = `${textarea.value.length} chars`;
    }
  }
});
