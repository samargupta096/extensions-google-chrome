// Widget Resize — each widget starts at 350×350 and can be freely resized.
// Sizes are persisted in chrome.storage.local under `widgetSizes`.
document.addEventListener('DOMContentLoaded', () => {
  const DEFAULT_W = 300;
  const DEFAULT_H = 300;
  const MIN_W = 200;
  const MIN_H = 150;
  const MAX_W = 1400;
  const MAX_H = 1000;

  const widgets = document.querySelectorAll('.widget, .github-container');

  widgets.forEach((widget) => {
    // Ensure position:relative so handles position correctly
    widget.style.position = 'relative';

    // ---------- Resize handle (bottom-right corner) ----------
    const handle = document.createElement('div');
    handle.className = 'resize-handle resize-d';
    handle.title = 'Drag to resize';
    widget.appendChild(handle);

    let startX, startY, startW, startH;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();           // don't trigger drag-and-drop
      startX = e.clientX;
      startY = e.clientY;
      startW = widget.offsetWidth;
      startH = widget.offsetHeight;

      const onMove = (me) => {
        let newW = startW + (me.clientX - startX);
        let newH = startH + (me.clientY - startY);
        newW = Math.min(MAX_W, Math.max(MIN_W, newW));
        newH = Math.min(MAX_H, Math.max(MIN_H, newH));
        widget.style.width  = newW + 'px';
        widget.style.height = newH + 'px';
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        saveSize(widget);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ---------- Double-click corner → reset to default ----------
    handle.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      widget.style.width  = DEFAULT_W + 'px';
      widget.style.height = DEFAULT_H + 'px';
      saveSize(widget);
    });
  });

  // ---------- Restore saved sizes ----------
  chrome.storage.local.get(['widgetSizes'], (result) => {
    if (!result.widgetSizes) return;
    widgets.forEach((widget) => {
      const id = getWidgetId(widget);
      if (id && result.widgetSizes[id]) {
        const { w, h } = result.widgetSizes[id];
        if (w) widget.style.width  = w + 'px';
        if (h) widget.style.height = h + 'px';
      }
    });
  });

  // ---------- Helpers ----------
  function getWidgetId(widget) {
    if (widget.dataset.widgetId) return widget.dataset.widgetId;
    const match = Array.from(widget.classList).find(c => c.endsWith('-widget') || c === 'github-container');
    if (match) return match.replace('-widget', '');
    return null;
  }

  function saveSize(widget) {
    const id = getWidgetId(widget);
    if (!id) return;
    chrome.storage.local.get(['widgetSizes'], (result) => {
      const sizes = result.widgetSizes || {};
      sizes[id] = { w: widget.offsetWidth, h: widget.offsetHeight };
      chrome.storage.local.set({ widgetSizes: sizes });
    });
  }
});
