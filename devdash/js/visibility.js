document.addEventListener('DOMContentLoaded', () => {
  const defaultVisible = ['quote', 'weather', 'goals', 'todo', 'links', 'timer', 'scratchpad'];
  let visibleWidgets = [...defaultVisible];

  const templates = {
    all: ['quote', 'weather', 'goals', 'todo', 'links', 'timer', 'scratchpad', 'github', 'githubstats', 'news', 'ghmonitor', 'sysmonitor', 'ollama', 'stackoverflow', 'worldclock', 'regex', 'epoch', 'npmtracker', 'bundlesize', 'jsonformatter', 'jwt', 'base64', 'uuid', 'apitester', 'colorutility', 'traceviewer', 'cronsentinel', 'httpref', 'dppxconverter', 'cmdcheat', 'regioncompass', 'envvault', 'intentbuilder', 'dockermon', 'iamdecoder', 'materialpalette', 'postprompt', 'ideabacklog', 'contentcal', 'hooklab', 'energymeter', 'monetracker', 'exptracker', 'thumbcheck', 'sponsorcrm', 'platformradar', 'backupcheck', 'habitchain', 'timeblocks', 'deepworksession', 'momentumqueue', 'nozeroday', 'clipboard'],
    dev: ['github', 'githubstats', 'ghmonitor', 'sysmonitor', 'regex', 'epoch', 'npmtracker', 'bundlesize', 'jsonformatter', 'jwt', 'base64', 'uuid', 'stackoverflow', 'ollama', 'apitester', 'colorutility', 'traceviewer', 'cronsentinel', 'httpref', 'dppxconverter', 'cmdcheat', 'regioncompass', 'envvault', 'intentbuilder', 'dockermon', 'iamdecoder', 'materialpalette', 'clipboard'],
    productivity: ['quote', 'weather', 'goals', 'todo', 'links', 'timer', 'scratchpad', 'habitchain', 'timeblocks', 'deepworksession', 'momentumqueue', 'nozeroday', 'clipboard'],
    info: ['news', 'stackoverflow', 'worldclock', 'weather', 'github', 'githubstats', 'clipboard'],
    creator: ['postprompt', 'ideabacklog', 'contentcal', 'hooklab', 'energymeter', 'monetracker', 'exptracker', 'thumbcheck', 'sponsorcrm', 'platformradar', 'backupcheck', 'quote', 'timer', 'ollama', 'clipboard'],
    custom: [] // Customized/Personalized
  };

  // UI Setup
  const visibilityContainer = document.createElement('div');
  visibilityContainer.innerHTML = `
    <button id="visibility-toggle-btn" class="fab-btn visibility-btn" title="Manage Widgets">🧩</button>
    <div id="visibility-panel" class="visibility-panel">
      <h3>🧩 Manage Widgets</h3>
      
      <div class="template-section" style="margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
        <label style="font-size: 0.8rem; color: var(--text-dim); display: block; margin-bottom: 0.5rem;">Select Template</label>
        <select id="widget-template-select" class="glass-select" style="width: 100%;">
          <option value="" disabled selected>Choose a Preset...</option>
          <option value="all">Full Dashboard (All)</option>
          <option value="productivity">Daily Focus</option>
          <option value="dev">Developer Suite</option>
          <option value="info">Information Hub</option>
          <option value="creator">Creator Mode</option>
          <option value="custom">Customized / Personalized</option>
        </select>
      </div>

      <div class="input-group" style="margin-bottom: 1rem;">
        <input type="text" id="widget-search-input" placeholder="Search widgets..." class="glass-input" style="width: 100%;">
      </div>

      <button id="reset-layout-btn" class="glass-btn btn-danger" style="width: 100%; margin-bottom: 1rem;">Reset Arrangement</button>

      <div class="visibility-list">
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="clipboard" checked> Clipboard History</label>
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
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="httpref" checked> HTTP Codes</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="dppxconverter" checked> DP/PX/SP</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="cmdcheat" checked> Cmd CheatSheet</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="regioncompass" checked> Region Compass</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="envvault" checked> Env Vault</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="intentbuilder" checked> Intent Builder</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="dockermon" checked> Docker Monitor</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="iamdecoder" checked> IAM Decoder</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="materialpalette" checked> Material Palette</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="postprompt" checked> What to Post</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="ideabacklog" checked> Idea Backlog</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="contentcal" checked> Content Calendar</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="hooklab" checked> Hook Lab</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="energymeter" checked> Creator Energy</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="monetracker" checked> Monetization</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="exptracker" checked> Experiments</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="thumbcheck" checked> Thumbnail Check</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="sponsorcrm" checked> Sponsor CRM</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="platformradar" checked> Platform Radar</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="backupcheck" checked> Security Backup</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="habitchain" checked> Habit Chains</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="timeblocks" checked> Time Blocks</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="deepworksession" checked> Deep Work</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="momentumqueue" checked> Momentum</label>
        <label draggable="true"><span class="list-drag-handle">⠿</span><input type="checkbox" value="nozeroday" checked> No Zero Days</label>
      </div>
    </div>
  `;
  document.body.appendChild(visibilityContainer);

  const toggleBtn = document.getElementById('visibility-toggle-btn');
  const panel = document.getElementById('visibility-panel');
  const checkboxes = panel.querySelectorAll('input[type="checkbox"]');
  const templateSelect = document.getElementById('widget-template-select');
  const trayButtons = document.querySelectorAll('.tray-btn');
  const resetLayoutBtn = document.getElementById('reset-layout-btn');
  const widgetSearchInput = document.getElementById('widget-search-input');

  // Widget Search Logic
  if (widgetSearchInput) {
    widgetSearchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const labels = panel.querySelectorAll('.visibility-list label');
      labels.forEach(label => {
        if (label.textContent.toLowerCase().includes(term)) {
          label.style.display = 'flex';
        } else {
          label.style.display = 'none';
        }
      });
    });
  }

  // Widget Delete Logic
  function setupDeleteButtons() {
    document.querySelectorAll('.widget').forEach(widget => {
      if (!widget.querySelector('.widget-delete-btn')) {
        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'widget-delete-btn';
        deleteBtn.innerHTML = '✕';
        deleteBtn.title = 'Remove widget';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = widget.dataset.widgetId;
          visibleWidgets = visibleWidgets.filter(w => w !== id);
          applyVisibility();
          chrome.storage.local.set({ 
            visibleWidgets, 
            activeTemplate: 'custom',
            customWidgets: visibleWidgets
          });
          if (templateSelect) templateSelect.value = 'custom';
          updateTrayActive('custom');
        });
        widget.appendChild(deleteBtn);
      }
    });
  }
  setupDeleteButtons();

  // Reset Layout Logic
  resetLayoutBtn.addEventListener('click', () => {
    if (confirm('Reset widget arrangement and visibility to default?')) {
      chrome.storage.local.remove(['widgetOrder', 'visibleWidgets', 'activeTemplate', 'customWidgets'], () => {
        window.location.reload();
      });
    }
  });

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
      if (templateKey === 'custom') {
        chrome.storage.local.get(['customWidgets', 'widgetOrder'], (res) => {
          visibleWidgets = res.customWidgets || [...templates.productivity];
          applyVisibility();
          if (res.widgetOrder) applyOrder(res.widgetOrder);
          updateTrayActive('custom');
          if (templateSelect) templateSelect.value = 'custom';
          chrome.storage.local.set({ visibleWidgets, activeTemplate: 'custom' });
        });
      } else if (templates[templateKey]) {
        visibleWidgets = [...templates[templateKey]];
        applyVisibility();
        applyOrder(visibleWidgets);
        updateTrayActive(templateKey);
        if (templateSelect) templateSelect.value = templateKey;
        chrome.storage.local.set({ 
          visibleWidgets, 
          activeTemplate: templateKey,
          widgetOrder: visibleWidgets
        });
      }
    });
  });

  // Template Selection Logic (Panel)
  templateSelect.addEventListener('change', (e) => {
    const templateKey = e.target.value;
    if (templateKey === 'custom') {
      chrome.storage.local.get(['customWidgets', 'widgetOrder'], (res) => {
        visibleWidgets = res.customWidgets || [...templates.productivity];
        applyVisibility();
        if (res.widgetOrder) applyOrder(res.widgetOrder);
        updateTrayActive('custom');
        chrome.storage.local.set({ visibleWidgets, activeTemplate: 'custom' });
      });
    } else if (templates[templateKey]) {
      visibleWidgets = [...templates[templateKey]];
      applyVisibility();
      applyOrder(visibleWidgets);
      updateTrayActive(templateKey);
      chrome.storage.local.set({ 
        visibleWidgets, 
        activeTemplate: templateKey,
        widgetOrder: visibleWidgets
      });
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

  function applyOrder(order) {
    const grid = document.querySelector('.widgets-grid');
    if (grid && order && Array.isArray(order)) {
      order.forEach(id => {
        const widget = grid.querySelector(`[data-widget-id="${id}"]`);
        if (widget) {
          grid.appendChild(widget);
        }
      });
      
      // Also reorder the labels in the visibility panel to match
      const listContainer = panel.querySelector('.visibility-list');
      if (listContainer) {
        order.forEach(id => {
          const labelInput = listContainer.querySelector(`input[value="${id}"]`);
          if (labelInput && labelInput.parentElement) {
            listContainer.appendChild(labelInput.parentElement);
          }
        });
      }
    }
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
      chrome.storage.local.set({ 
        visibleWidgets, 
        activeTemplate: 'custom',
        customWidgets: visibleWidgets 
      });
    });
  });

  // Load Saved Visibility
  chrome.storage.local.get(['visibleWidgets', 'activeTemplate', 'migratedClipboard'], (result) => {
    if (result.visibleWidgets) {
      visibleWidgets = result.visibleWidgets;
    } else {
      visibleWidgets = [...templates.productivity];
      chrome.storage.local.set({ visibleWidgets, activeTemplate: 'productivity' });
    }

    // Migration: force add clipboard if it's the first time running this version
    if (!result.migratedClipboard) {
      if (!visibleWidgets.includes('clipboard')) {
        visibleWidgets.push('clipboard');
      }
      chrome.storage.local.set({ migratedClipboard: true, visibleWidgets });
    }
    
    const activeTemplate = result.activeTemplate || 'productivity';
    updateTrayActive(activeTemplate);
    if (templateSelect) templateSelect.value = activeTemplate;

    // Load saved order
    chrome.storage.local.get(['widgetOrder'], (orderRes) => {
      let order = orderRes.widgetOrder;
      if (order) {
        if (!result.migratedClipboard && !order.includes('clipboard')) {
           order.unshift('clipboard'); // Put it at the top!
           chrome.storage.local.set({ widgetOrder: order });
        }
        applyOrder(order);
      } else if (!result.migratedClipboard) {
        // If no order but migrating, ensure it's at the top
        const defaultOrder = [...visibleWidgets];
        const clipIdx = defaultOrder.indexOf('clipboard');
        if (clipIdx > -1) {
            defaultOrder.splice(clipIdx, 1);
            defaultOrder.unshift('clipboard');
            chrome.storage.local.set({ widgetOrder: defaultOrder });
            applyOrder(defaultOrder);
        }
      }
      setTimeout(applyVisibility, 50); 
    });
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
    applyOrder(newOrder);
  }


});
