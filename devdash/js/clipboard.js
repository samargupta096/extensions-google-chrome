/**
 * clipboard.js — Clipboard History Widget Logic
 */
document.addEventListener('DOMContentLoaded', () => {
  const clipboardList = document.getElementById('clipboard-list');
  const clearBtn = document.getElementById('clear-clipboard-btn');

  function renderClipboard(history) {
    if (!history || history.length === 0) {
      clipboardList.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--text-tertiary);font-size:0.9rem;">
          Copy something on any page to see it here!
        </div>`;
      return;
    }

    clipboardList.innerHTML = '';
    history.forEach((text, index) => {
      const item = document.createElement('div');
      item.className = 'clipboard-item';
      
      const textContent = document.createElement('div');
      textContent.className = 'clipboard-text';
      textContent.textContent = text;
      
      const copyBadge = document.createElement('span');
      copyBadge.className = 'copy-badge';
      copyBadge.textContent = 'Click to Copy';
      
      item.appendChild(textContent);
      item.appendChild(copyBadge);
      
      item.addEventListener('click', () => {
        navigator.clipboard.writeText(text).then(() => {
          copyBadge.textContent = 'Copied!';
          copyBadge.classList.add('success');
          setTimeout(() => {
            copyBadge.textContent = 'Click to Copy';
            copyBadge.classList.remove('success');
          }, 2000);
        });
      });
      
      clipboardList.appendChild(item);
    });
  }

  function fetchClipboard() {
    chrome.runtime.sendMessage({ type: 'GET_CLIPBOARD' }, (response) => {
      if (response && response.history) {
        renderClipboard(response.history);
      }
    });
  }

  clearBtn.addEventListener('click', () => {
    if (confirm('Clear clipboard history?')) {
      chrome.storage.local.set({ clipboardHistory: [] }, () => {
        renderClipboard([]);
      });
    }
  });

  // Listen for updates from background
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'CLIPBOARD_UPDATED') {
      renderClipboard(msg.history);
    }
  });

  fetchClipboard();
});
