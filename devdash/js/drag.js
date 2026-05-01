document.addEventListener('DOMContentLoaded', () => {
  const grid = document.querySelector('.widgets-grid');
  const widgets = Array.from(grid.querySelectorAll('.widget'));
  const githubCard = document.querySelector('.github-card'); // Optional, if we want it draggable later

  let draggedItem = null;

  // Initialize Data Attributes and Drag Handlers
  widgets.forEach((widget, index) => {
    // Set a default ID based on the class if not present in HTML yet
    if (!widget.dataset.widgetId) {
      const widgetClass = Array.from(widget.classList).find(cls => cls.endsWith('-widget'));
      widget.dataset.widgetId = widgetClass ? widgetClass.replace('-widget', '') : `widget-${index}`;
    }

    // Add drag handle icon
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '⠿';
    widget.appendChild(dragHandle);
    
    // Make widget draggable ONLY from the header/drag-handle
    widget.setAttribute('draggable', 'true');

    // Drag Events
    widget.addEventListener('dragstart', handleDragStart);
    widget.addEventListener('dragend', handleDragEnd);
    widget.addEventListener('dragover', handleDragOver);
    widget.addEventListener('dragenter', handleDragEnter);
    widget.addEventListener('dragleave', handleDragLeave);
    widget.addEventListener('drop', handleDrop);
  });

  // Restore Order
  chrome.storage.local.get(['widgetOrder'], (result) => {
    if (result.widgetOrder && Array.isArray(result.widgetOrder)) {
      result.widgetOrder.forEach(id => {
        const widget = grid.querySelector(`[data-widget-id="${id}"]`);
        if (widget) {
          grid.appendChild(widget); // Re-append according to stored order
        }
      });
    }
  });

  function handleDragStart(e) {
    // Respect dashboard lock
    if (window.DevDashLock && window.DevDashLock.isLocked()) {
      e.preventDefault();
      return false;
    }
    
    draggedItem = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox requires dataTransfer data to be set
    e.dataTransfer.setData('text/plain', this.dataset.widgetId);
    
    setTimeout(() => {
      this.style.opacity = '0.5';
    }, 0);
  }

  function handleDragEnd(e) {
    draggedItem = null;
    this.classList.remove('dragging');
    this.style.opacity = '1';
    
    widgets.forEach(w => w.classList.remove('drag-over'));
    saveOrder();
  }

  function handleDragOver(e) {
    if (window.DevDashLock && window.DevDashLock.isLocked()) return false;
    if (e.preventDefault) {
      e.preventDefault(); // Necessary. Allows us to drop.
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    if (window.DevDashLock && window.DevDashLock.isLocked()) return;
    if (this !== draggedItem) {
      this.classList.add('drag-over');
    }
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
    if (window.DevDashLock && window.DevDashLock.isLocked()) return false;
    if (e.stopPropagation) {
      e.stopPropagation(); 
    }

    if (draggedItem !== this) {
      // Determine insertion point based on mouse position relative to center of target
      const targetRect = this.getBoundingClientRect();
      const targetCenter = targetRect.left + targetRect.width / 2;
      
      if (e.clientX < targetCenter) {
        this.parentNode.insertBefore(draggedItem, this);
      } else {
        this.parentNode.insertBefore(draggedItem, this.nextSibling);
      }
    }
    
    this.classList.remove('drag-over');
    return false;
  }

  function saveOrder() {
    const currentOrder = Array.from(grid.querySelectorAll('.widget')).map(w => w.dataset.widgetId);
    chrome.storage.local.set({ widgetOrder: currentOrder });
  }

  // ── React to lock/unlock events ─────────────────────────────────
  function applyDragLock(locked) {
    widgets.forEach(widget => {
      widget.setAttribute('draggable', locked ? 'false' : 'true');
      const handle = widget.querySelector('.drag-handle');
      if (handle) {
        handle.style.cursor = locked ? 'not-allowed' : 'grab';
        handle.style.opacity = locked ? '0.2' : '';
      }
    });
  }

  document.addEventListener('lockchange', (e) => {
    applyDragLock(e.detail.locked);
  });
});
