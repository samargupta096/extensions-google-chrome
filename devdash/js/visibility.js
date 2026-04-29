document.addEventListener('DOMContentLoaded', () => {
  const defaultVisible = ['quote', 'goals', 'timer', 'todo', 'links', 'github'];
  let visibleWidgets = [...defaultVisible];

  // UI Setup
  const visibilityContainer = document.createElement('div');
  visibilityContainer.innerHTML = `
    <button id="visibility-toggle-btn" class="fab-btn visibility-btn" title="Manage Widgets">🧩</button>
    <div id="visibility-panel" class="visibility-panel">
      <h3>Manage Widgets</h3>
      <div class="visibility-list">
        <label><input type="checkbox" value="quote" checked> Quote</label>
        <label><input type="checkbox" value="goals" checked> Active Goals</label>
        <label><input type="checkbox" value="timer" checked> Focus Timer</label>
        <label><input type="checkbox" value="todo" checked> Today's Tasks</label>
        <label><input type="checkbox" value="links" checked> Quick Links</label>
        <label><input type="checkbox" value="github" checked> GitHub</label>
      </div>
    </div>
  `;
  document.body.appendChild(visibilityContainer);

  const toggleBtn = document.getElementById('visibility-toggle-btn');
  const panel = document.getElementById('visibility-panel');
  const checkboxes = panel.querySelectorAll('input[type="checkbox"]');

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

  // Apply Visibility
  function applyVisibility() {
    // We expect widgets to have data-widget-id
    const allWidgets = document.querySelectorAll('[data-widget-id]');
    allWidgets.forEach(widget => {
      const id = widget.dataset.widgetId;
      if (visibleWidgets.includes(id)) {
        widget.style.display = ''; // revert to default (flex/block)
      } else {
        widget.style.display = 'none';
      }
    });

    // Update Checkboxes
    checkboxes.forEach(cb => {
      cb.checked = visibleWidgets.includes(cb.value);
    });
  }

  // Handle Checkbox changes
  checkboxes.forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.value;
      if (e.target.checked) {
        if (!visibleWidgets.includes(id)) visibleWidgets.push(id);
      } else {
        visibleWidgets = visibleWidgets.filter(w => w !== id);
      }
      applyVisibility();
      chrome.storage.local.set({ visibleWidgets });
    });
  });

  // Load Saved Visibility
  chrome.storage.local.get(['visibleWidgets'], (result) => {
    if (result.visibleWidgets) {
      visibleWidgets = result.visibleWidgets;
    } else {
      visibleWidgets = [...defaultVisible];
    }
    // We need a slight delay or to ensure other scripts have initialized their data-widget-ids
    setTimeout(applyVisibility, 50); 
  });
});
