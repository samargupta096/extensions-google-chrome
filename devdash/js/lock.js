/**
 * DevDash — Dashboard Lock / Freeze
 *
 * When locked:
 *  • All widget drag-and-drop is disabled
 *  • All resize handles are hidden / disabled
 *  • A subtle top banner indicates locked mode
 *  • Lock state is persisted across page reloads
 *
 * Other modules (drag.js, resize.js) listen for the
 * custom 'lockchange' event dispatched on document.
 */
(function () {
  const STORAGE_KEY = 'dashboardLocked';
  const BODY_CLASS  = 'dashboard-locked';

  let isLocked = false;

  /* ── DOM refs ─────────────────────────────────────────── */
  const btn             = document.getElementById('lock-toggle-btn');
  const iconEl          = document.getElementById('lock-btn-icon');
  const bannerEl        = document.getElementById('lock-banner');
  const bannerUnlockBtn = document.getElementById('lock-banner-unlock-btn');

  /* ── Apply state to UI ──────────────────────────────── */
  function applyLock(locked, animate) {
    isLocked = locked;
    document.body.classList.toggle(BODY_CLASS, locked);

    // Update FAB icon & tooltip with a scale-flip animation
    if (animate && iconEl) {
      iconEl.classList.add('lock-icon-flip');
      iconEl.addEventListener('animationend', () => {
        iconEl.classList.remove('lock-icon-flip');
      }, { once: true });
    }

    if (iconEl) {
      iconEl.textContent = locked ? '🔒 Locked' : '🔓 Unlock';
    }
    if (btn) {
      btn.title = locked ? 'Unlock Dashboard (enable drag & resize)' : 'Lock Dashboard (freeze layout)';
      btn.setAttribute('aria-pressed', locked ? 'true' : 'false');
      btn.classList.toggle('lock-btn-active', locked);
    }

    // Banner
    if (bannerEl) {
      if (locked && animate) {
        bannerEl.classList.add('lock-banner-visible');
        clearTimeout(bannerEl._hideTimer);
        bannerEl._hideTimer = setTimeout(() => {
          bannerEl.classList.remove('lock-banner-visible');
        }, 3000);
      } else {
        bannerEl.classList.remove('lock-banner-visible');
      }
    }

    // Broadcast so drag.js / resize.js can react
    document.dispatchEvent(new CustomEvent('lockchange', { detail: { locked } }));
  }

  /* ── Toggle handler ─────────────────────────────────── */
  function toggle() {
    const next = !isLocked;
    applyLock(next, true);
    chrome.storage.local.set({ [STORAGE_KEY]: next });

    showToast(next
      ? '🔒 Dashboard locked — layout is frozen'
      : '🔓 Dashboard unlocked — drag & resize enabled'
    );
  }

  /* ── Toast notification ─────────────────────────────── */
  function showToast(msg) {
    // Re-use or create a toast element
    let toast = document.getElementById('lock-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lock-toast';
      toast.className = 'lock-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.remove('lock-toast-hide');
    toast.classList.add('lock-toast-show');

    clearTimeout(toast._hideTimer);
    toast._hideTimer = setTimeout(() => {
      toast.classList.remove('lock-toast-show');
      toast.classList.add('lock-toast-hide');
    }, 2500);
  }

  /* ── Init ───────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {
    if (btn) btn.addEventListener('click', toggle);
    if (bannerUnlockBtn) bannerUnlockBtn.addEventListener('click', () => {
      if (isLocked) toggle();
    });

    // Restore persisted state
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const saved = result[STORAGE_KEY] === true;
      applyLock(saved, false);
    });
  });

  // Expose for other modules
  window.DevDashLock = {
    isLocked: () => isLocked,
  };
})();
