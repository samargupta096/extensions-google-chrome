document.addEventListener('DOMContentLoaded', () => {
  const widgets = document.querySelectorAll('.widget, .github-card');

  widgets.forEach((widget) => {
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    widget.appendChild(resizeHandle);

    let startY, startHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent text selection
      startY = e.clientY;
      startHeight = parseInt(document.defaultView.getComputedStyle(widget).height, 10);
      
      // Temporarily disable max-height from CSS if it interferes
      widget.style.maxHeight = 'none';

      document.documentElement.addEventListener('mousemove', doDrag);
      document.documentElement.addEventListener('mouseup', stopDrag);
    });

    function doDrag(e) {
      let newHeight = startHeight + e.clientY - startY;
      // Enforce bounds
      if (newHeight < 150) newHeight = 150;
      if (newHeight > 800) newHeight = 800;
      
      widget.style.height = newHeight + 'px';
    }

    function stopDrag(e) {
      document.documentElement.removeEventListener('mousemove', doDrag);
      document.documentElement.removeEventListener('mouseup', stopDrag);
      saveSize(widget);
    }
  });

  // Restore sizes
  chrome.storage.local.get(['widgetSizes'], (result) => {
    if (result.widgetSizes) {
      widgets.forEach((widget, index) => {
        let id = widget.dataset.widgetId;
        if (!id) {
          // Fallback if dataset isn't set yet
          if (widget.classList.contains('github-card')) id = 'github';
          else {
            const match = Array.from(widget.classList).find(c => c.endsWith('-widget'));
            if (match) id = match.replace('-widget', '');
          }
        }
        if (id && result.widgetSizes[id]) {
           widget.style.height = result.widgetSizes[id] + 'px';
           widget.style.maxHeight = 'none'; // Ensure CSS doesn't override restored height
        }
      });
    }
  });

  function saveSize(widget) {
    let id = widget.dataset.widgetId;
    if (!id) {
      if (widget.classList.contains('github-card')) id = 'github';
      else {
        const match = Array.from(widget.classList).find(c => c.endsWith('-widget'));
        if (match) id = match.replace('-widget', '');
      }
    }
    
    if (id) {
      chrome.storage.local.get(['widgetSizes'], (result) => {
        const sizes = result.widgetSizes || {};
        sizes[id] = parseInt(widget.style.height, 10);
        chrome.storage.local.set({ widgetSizes: sizes });
      });
    }
  }
});
