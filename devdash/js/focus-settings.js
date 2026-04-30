// focus-settings.js — Logic for managing the website blocklist
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('focus-settings-modal');
  const openBtn = document.getElementById('focus-settings-btn');
  const closeBtn = document.getElementById('close-focus-settings');
  const input = document.getElementById('blocklist-input');
  const addBtn = document.getElementById('add-block-btn');
  const listContainer = document.getElementById('blocklist-items');

  let blockList = [];

  // Open/Close
  openBtn.addEventListener('click', () => {
    modal.classList.add('active');
    loadBlockList();
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
  });

  // Load from background/storage
  function loadBlockList() {
    chrome.runtime.sendMessage({ type: 'GET_TIMER_STATE' }, (state) => {
      if (state && state.blockList) {
        blockList = state.blockList;
        renderList();
      }
    });
  }

  function renderList() {
    listContainer.innerHTML = '';
    blockList.forEach((domain, idx) => {
      const li = document.createElement('li');
      li.className = 'item-row';
      li.innerHTML = `
        <span>${domain}</span>
        <button class="remove-btn" data-idx="${idx}">✕</button>
      `;
      listContainer.appendChild(li);
    });

    // Bind remove buttons
    listContainer.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        blockList.splice(idx, 1);
        saveBlockList();
      });
    });
  }

  function saveBlockList() {
    chrome.runtime.sendMessage({ type: 'UPDATE_BLOCKLIST', list: blockList }, () => {
      renderList();
    });
  }

  addBtn.addEventListener('click', () => {
    const domain = input.value.trim().toLowerCase();
    if (!domain) return;
    
    // Simple validation (should be a domain-like string)
    if (!domain.includes('.') || domain.length < 4) {
      input.classList.add('input-error');
      setTimeout(() => input.classList.remove('input-error'), 1500);
      return;
    }

    if (!blockList.includes(domain)) {
      blockList.push(domain);
      saveBlockList();
    }
    input.value = '';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBtn.click();
  });
});
