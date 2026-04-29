document.addEventListener('DOMContentLoaded', () => {
  const widgets = document.querySelectorAll('.widget, .github-container');

  widgets.forEach((widget) => {
    // Create resize handles
    const handles = [
      { class: 'resize-v', dir: 'v' },
      { class: 'resize-h', dir: 'h' },
      { class: 'resize-d', dir: 'd' }
    ];

    handles.forEach(h => {
      const handle = document.createElement('div');
      handle.className = `resize-handle ${h.class}`;
      widget.appendChild(handle);

      let startX, startY, startWidth, startHeight;

      handle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        startWidth = parseInt(document.defaultView.getComputedStyle(widget).width, 10);
        startHeight = parseInt(document.defaultView.getComputedStyle(widget).height, 10);
        
        widget.style.maxHeight = 'none';
        widget.style.maxWidth = 'none';

        const doDrag = (me) => {
          if (h.dir === 'v' || h.dir === 'd') {
            let newHeight = startHeight + me.clientY - startY;
            if (newHeight < 150) newHeight = 150;
            if (newHeight > 1000) newHeight = 1000;
            widget.style.height = newHeight + 'px';
          }
          if (h.dir === 'h' || h.dir === 'd') {
            let newWidth = startWidth + me.clientX - startX;
            if (newWidth < 200) newWidth = 200;
            if (newWidth > 1400) newWidth = 1400;
            widget.style.width = newWidth + 'px';
          }
        };

        const stopDrag = () => {
          document.documentElement.removeEventListener('mousemove', doDrag);
          document.documentElement.removeEventListener('mouseup', stopDrag);
          saveSize(widget);
        };

        document.documentElement.addEventListener('mousemove', doDrag);
        document.documentElement.addEventListener('mouseup', stopDrag);
      });
    });
  });

  // Restore sizes
  chrome.storage.local.get(['widgetSizes'], (result) => {
    if (result.widgetSizes) {
      widgets.forEach((widget) => {
        let id = widget.dataset.widgetId;
        if (!id) {
          const match = Array.from(widget.classList).find(c => c.endsWith('-widget'));
          if (match) id = match.replace('-widget', '');
        }
        if (id && result.widgetSizes[id]) {
           const size = result.widgetSizes[id];
           if (size.height) widget.style.height = size.height + 'px';
           if (size.width) widget.style.width = size.width + 'px';
           widget.style.maxHeight = 'none';
           widget.style.maxWidth = 'none';
        }
      });
    }
  });

  function saveSize(widget) {
    let id = widget.dataset.widgetId;
    if (!id) {
      const match = Array.from(widget.classList).find(c => c.endsWith('-widget'));
      if (match) id = match.replace('-widget', '');
    }
    
    if (id) {
      chrome.storage.local.get(['widgetSizes'], (result) => {
        const sizes = result.widgetSizes || {};
        sizes[id] = {
          height: parseInt(widget.style.height, 10),
          width: parseInt(widget.style.width, 10)
        };
        chrome.storage.local.set({ widgetSizes: sizes });
      });
    }
  }
});
