/**
 * Split Screen — Full-Tab Mode Controller
 * Chrome Extensions Suite
 *
 * Usage: include this script in both popup.html and fullpage.html.
 * - In popup: wires up the expand button to open fullpage.html
 * - In fullpage: initialises the draggable divider and right-panel controls
 */

(function () {
  'use strict';

  /* ═══════════════ Expand Button (works in popup) ═══════════════ */
  const expandBtn = document.getElementById('expandBtn');
  if (expandBtn) {
    expandBtn.addEventListener('click', () => {
      if (typeof chrome !== 'undefined' && chrome.sidePanel && chrome.sidePanel.open) {
        chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
        window.close();
      } else if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.create({ url: chrome.runtime.getURL('fullpage.html') });
        window.close();
      } else {
        // Fallback: open in new window
        window.open('popup.html', '_blank');
      }
    });
  }

  /* ═══════════════ Split Container Logic (fullpage only) ═══════════════ */
  const container = document.querySelector('.split-container');
  if (!container) return;   // not in split mode — stop here (popup)

  document.documentElement.classList.add('split-mode');

  const STORAGE_KEY = 'splitScreenRatio';
  const MIN_PX = 320;
  const MAX_RATIO = 0.8;

  const left    = container.querySelector('.split-left');
  const divider = container.querySelector('.split-divider');
  const right   = container.querySelector('.split-right');
  const urlBar  = container.querySelector('.url-bar');
  const goBtn   = container.querySelector('#splitGoBtn');
  const iframe  = container.querySelector('#splitIframe');
  const emptyEl = container.querySelector('.split-empty');
  const iframeWrap = container.querySelector('.split-iframe-wrap');
  const notesPanel = container.querySelector('.split-notes');
  const notesArea  = container.querySelector('#splitNotes');
  const tabBtns    = container.querySelectorAll('.split-tab-group .split-btn');

  /* ── Restore saved ratio ── */
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(STORAGE_KEY, (d) => {
      const ratio = d[STORAGE_KEY];
      if (ratio && ratio > 0.15 && ratio < MAX_RATIO) {
        left.style.flex = `0 0 ${ratio * 100}%`;
      }
    });
  }

  /* ═══════════════ Draggable Divider ═══════════════ */
  let isDragging = false;

  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    divider.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    if (iframeWrap) iframeWrap.style.pointerEvents = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const totalW = container.offsetWidth;
    let newLeft = e.clientX;
    if (newLeft < MIN_PX) newLeft = MIN_PX;
    if (newLeft > totalW * MAX_RATIO) newLeft = totalW * MAX_RATIO;
    left.style.flex = `0 0 ${newLeft}px`;
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (iframeWrap) iframeWrap.style.pointerEvents = '';

    const ratio = left.offsetWidth / container.offsetWidth;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: ratio });
    }
  });

  /* Double-click to reset 50/50 */
  divider.addEventListener('dblclick', () => {
    left.style.flex = '0 0 50%';
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: 0.5 });
    }
  });

  /* ═══════════════ URL Navigation ═══════════════ */
  function navigateTo(raw) {
    if (!raw) return;
    let url = raw.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    if (iframe) {
      iframe.src = url;
      if (emptyEl) emptyEl.style.display = 'none';
      iframe.style.display = '';
    }
  }

  if (goBtn) goBtn.addEventListener('click', () => navigateTo(urlBar?.value));
  if (urlBar) urlBar.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') navigateTo(urlBar.value);
  });

  /* ═══════════════ Tab Switching (Browse / Notes) ═══════════════ */
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.dataset.splitTab;

      if (mode === 'browse') {
        if (iframeWrap) iframeWrap.style.display = '';
        if (notesPanel) notesPanel.classList.remove('active');
        if (urlBar) urlBar.style.display = '';
        if (goBtn) goBtn.style.display = '';
      } else if (mode === 'notes') {
        if (iframeWrap) iframeWrap.style.display = 'none';
        if (notesPanel) notesPanel.classList.add('active');
        if (urlBar) urlBar.style.display = 'none';
        if (goBtn) goBtn.style.display = 'none';
      }
    });
  });

  /* ── Persist notes ── */
  if (notesArea) {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get('splitNotes', (d) => {
        if (d.splitNotes) notesArea.value = d.splitNotes;
      });
    }
    let saveTimer;
    notesArea.addEventListener('input', () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.set({ splitNotes: notesArea.value });
        }
      }, 500);
    });
  }

})();

