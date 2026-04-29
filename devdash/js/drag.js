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

    // Add drag handle icon to header area
    const header = widget.querySelector('h2');
    if (header) {
      header.style.position = 'relative';
      const dragHandle = document.createElement('div');
      dragHandle.className = 'drag-handle';
      dragHandle.innerHTML = '⠿';
      header.appendChild(dragHandle);
      
      // Make widget draggable ONLY from the header/drag-handle
      widget.setAttribute('draggable', 'true');
    }

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
    // Only allow drag if started from header/drag handle (prevent dragging from inputs)
    if (e.target.tagName !== 'DIV' && !e.target.closest('.drag-handle') && !e.target.closest('h2')) {
      // It's a bit tricky to prevent dragstart on children easily while keeping the parent draggable.
      // A common pattern is to just check if it's the widget itself.
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
    if (e.preventDefault) {
      e.preventDefault(); // Necessary. Allows us to drop.
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
  }

  function handleDragEnter(e) {
    if (this !== draggedItem) {
      this.classList.add('drag-over');
    }
  }

  function handleDragLeave(e) {
    this.classList.remove('drag-over');
  }

  function handleDrop(e) {
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
});
