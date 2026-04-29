// UUID v4 Generator Widget
document.addEventListener('DOMContentLoaded', () => {
  const generateBtn = document.getElementById('uuid-generate-btn');
  const uuidList = document.getElementById('uuid-list');
  const clearBtn = document.getElementById('uuid-clear-btn');
  const bulkBtn = document.getElementById('uuid-bulk-btn');

  if (!generateBtn || !uuidList) return;

  function generateUUIDv4() {
    // Use crypto.randomUUID if available (Chrome 92+), else polyfill
    if (crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback polyfill
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function addUUID(uuid) {
    const li = document.createElement('li');
    li.className = 'uuid-item';
    li.innerHTML = `
      <span class="uuid-value">${uuid}</span>
      <button class="uuid-copy-btn" title="Copy">📋</button>
    `;
    li.querySelector('.uuid-copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(uuid).then(() => {
        const btn = li.querySelector('.uuid-copy-btn');
        btn.textContent = '✓';
        setTimeout(() => { btn.textContent = '📋'; }, 1200);
      });
    });
    uuidList.prepend(li); // newest first

    // Keep list max at 10
    while (uuidList.children.length > 10) {
      uuidList.removeChild(uuidList.lastChild);
    }
  }

  generateBtn.addEventListener('click', () => {
    addUUID(generateUUIDv4());
  });

  bulkBtn && bulkBtn.addEventListener('click', () => {
    for (let i = 0; i < 5; i++) addUUID(generateUUIDv4());
  });

  clearBtn && clearBtn.addEventListener('click', () => {
    uuidList.innerHTML = '';
  });

  // Generate one on load
  addUUID(generateUUIDv4());
});
