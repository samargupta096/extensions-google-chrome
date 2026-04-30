document.addEventListener('DOMContentLoaded', () => {
  const defaultVisible = ['quote', 'goals', 'timer', 'todo', 'links', 'github', 'githubstats', 'news', 'ghmonitor', 'scratchpad', 'sysmonitor', 'ollama', 'stackoverflow', 'worldclock', 'weather', 'regex', 'epoch', 'npmtracker', 'bundlesize', 'jsonformatter', 'jwt', 'base64', 'uuid', 'apitester', 'colorutility', 'traceviewer', 'cronsentinel'];
  let visibleWidgets = [...defaultVisible];

  const templates = {
    all: defaultVisible,
    dev: ['github', 'githubstats', 'ghmonitor', 'sysmonitor', 'regex', 'epoch', 'npmtracker', 'bundlesize', 'jsonformatter', 'jwt', 'base64', 'uuid', 'stackoverflow', 'ollama', 'apitester', 'colorutility', 'traceviewer', 'cronsentinel'],
    productivity: ['quote', 'goals', 'timer', 'todo', 'links', 'scratchpad', 'weather'],
    info: ['news', 'stackoverflow', 'worldclock', 'weather', 'github', 'githubstats']
  };

  // UI Setup
  const visibilityContainer = document.createElement('div');
  visibilityContainer.innerHTML = `
    <button id="visibility-toggle-btn" class="fab-btn visibility-btn" title="Manage Widgets">🧩</button>
    <div id="visibility-panel" class="visibility-panel">
      <h3>Manage Widgets</h3>
      
      <div class="template-section" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <label style="font-size: 0.8rem; color: var(--text-dim); display: block; margin-bottom: 0.5rem;">Select Template</label>
        <select id="widget-template-select" class="glass-select" style="width: 100%;">
          <option value="" disabled selected>Choose a Preset...</option>
          <option value="all">Full Dashboard (All)</option>
          <option value="dev">Developer Suite</option>
          <option value="productivity">Daily Focus</option>
          <option value="info">Information Hub</option>
          <option value="custom">Custom (Current)</option>
        </select>
      </div>

      <div class="visibility-list">
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="quote" checked> Quote</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="goals" checked> Active Goals</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="timer" checked> Focus Timer</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="todo" checked> Today's Tasks</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="links" checked> Quick Links</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="github" checked> GitHub Graph</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="githubstats" checked> GitHub Stats</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="news" checked> Tech News</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="ghmonitor" checked> PR Monitor</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="scratchpad" checked> Scratchpad</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="sysmonitor" checked> System Monitor</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="ollama" checked> AI Chat</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="stackoverflow" checked> Stack Overflow</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="worldclock" checked> World Clock</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="weather" checked> Weather</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="regex" checked> Regex Tester</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="epoch" checked> Epoch Time</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="npmtracker" checked> NPM Tracker</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="bundlesize" checked> Bundle Size</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="jsonformatter" checked> JSON Formatter</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="jwt" checked> JWT Decoder</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="base64" checked> Base64</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="uuid" checked> UUID Generator</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="apitester" checked> API PingBox</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="colorutility" checked> ColorBox</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="traceviewer" checked> OTel TraceBox</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="cronsentinel" checked> Cron Sentinel</label>
      </div>
    </div>
  `;
  document.body.appendChild(visibilityContainer);

  const toggleBtn = document.getElementById('visibility-toggle-btn');
  const panel = document.getElementById('visibility-panel');
  const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
  const templateSelect = document.getElementById('widget-template-select');
  const trayButtons = document.querySelectorAll('.tray-btn');

  function updateTrayActive(templateKey) {
    trayButtons.forEach(btn => {
      if (btn.dataset.template === templateKey) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // Template Tray Logic
  trayButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const templateKey = btn.dataset.template;
      if (templates[templateKey]) {
        visibleWidgets = [...templates[templateKey]];
        applyVisibility();
        updateTrayActive(templateKey);
        if (templateSelect) templateSelect.value = templateKey;
        chrome.storage.local.set({ visibleWidgets, activeTemplate: templateKey });
      }
    });
  });

  // Template Selection Logic (Panel)
  templateSelect.addEventListener('change', (e) => {
    const templateKey = e.target.value;
    if (templates[templateKey]) {
      visibleWidgets = [...templates[templateKey]];
      applyVisibility();
      updateTrayActive(templateKey);
      chrome.storage.local.set({ visibleWidgets, activeTemplate: templateKey });
    }
  });

  // Toggle Panel
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isActive = panel.classList.contains('active');
    // Close all panels
    document.querySelectorAll('.theme-panel, .wallpaper-modal, .visibility-panel').forEach(p => p.classList.remove('active'));
    // If it wasn't active, open it
    if (!isActive) {
      panel.classList.add('active');
    }
  });

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('active')) {
      if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
        panel.classList.remove('active');
      }
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
      
      // Set select to "custom" if manual change
      if (templateSelect) templateSelect.value = 'custom';
      updateTrayActive('custom');
      
      applyVisibility();
      chrome.storage.local.set({ visibleWidgets, activeTemplate: 'custom' });
    });
  });

  // Load Saved Visibility
  chrome.storage.local.get(['visibleWidgets', 'activeTemplate'], (result) => {
    if (result.visibleWidgets) {
      visibleWidgets = result.visibleWidgets;
    } else {
      visibleWidgets = [...defaultVisible];
    }
    
    if (result.activeTemplate) {
      updateTrayActive(result.activeTemplate);
      if (templateSelect) templateSelect.value = result.activeTemplate;
    }

    // We need a slight delay or to ensure other scripts have initialized their data-widget-ids
    setTimeout(applyVisibility, 50); 
  });

  // Reorder Logic for Visibility Panel
  const listContainer = panel.querySelector('.visibility-list');
  let draggedLabel = null;

  const labels = listContainer.querySelectorAll('label');
  labels.forEach(label => {
    label.addEventListener('dragstart', function(e) {
      // Don't drag if clicking checkbox
      if (e.target.tagName === 'INPUT') {
        e.preventDefault();
        return;
      }
      draggedLabel = this;
      this.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', this.querySelector('input').value);
    });

    label.addEventListener('dragend', function() {
      this.style.opacity = '1';
      draggedLabel = null;
      syncOrderToDashboard();
    });

    label.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      return false;
    });

    label.addEventListener('drop', function(e) {
      e.stopPropagation();
      if (draggedLabel !== this) {
        const rect = this.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        if (e.clientY < center) {
          listContainer.insertBefore(draggedLabel, this);
        } else {
          listContainer.insertBefore(draggedLabel, this.nextSibling);
        }
      }
      return false;
    });
  });

  function syncOrderToDashboard() {
    // Get new order from labels
    const newOrder = Array.from(listContainer.querySelectorAll('input')).map(inp => inp.value);
    
    // Save order globally
    chrome.storage.local.set({ widgetOrder: newOrder });

    // Physically reorder DOM elements immediately
    const grid = document.querySelector('.widgets-grid');
    if (grid) {
      newOrder.forEach(id => {
        const widget = grid.querySelector(`[data-widget-id="${id}"]`);
        if (widget) {
          grid.appendChild(widget);
        }
      });
    }
  }

  // Restore label order based on saved widgetOrder
  chrome.storage.local.get(['widgetOrder'], (result) => {
    if (result.widgetOrder && Array.isArray(result.widgetOrder)) {
      result.widgetOrder.forEach(id => {
        const labelInput = listContainer.querySelector(`input[value="${id}"]`);
        if (labelInput && labelInput.parentElement) {
          listContainer.appendChild(labelInput.parentElement);
        }
      });
    }
  });

});
