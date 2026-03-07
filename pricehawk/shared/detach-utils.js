/**
 * Detach Utilities — Manages "Detach Mode" for Chrome Extensions
 * Allows popups to open in a separate window instead of a toolbar bubble.
 */
class DetachUtils {
  static async init() {
    // Listen for settings changes to update popup state
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.settings?.newValue?.detachMode !== undefined) {
        this.updatePopupBehavior(changes.settings.newValue.detachMode);
      }
    });

    // Handle clicks when popup is disabled (Detach Mode is ON)
    chrome.action.onClicked.addListener(async () => {
      const { settings } = await chrome.storage.local.get('settings');
      if (settings?.detachMode) {
        this.openDetachedWindow();
      }
    });

    // Initial sync
    const { settings } = await chrome.storage.local.get('settings');
    await this.updatePopupBehavior(settings?.detachMode);
  }

  static async updatePopupBehavior(detachMode) {
    if (detachMode) {
      // Disable the default bubble popup so onClicked fires
      await chrome.action.setPopup({ popup: '' });
    } else {
      // Restore the default bubble popup
      const manifest = chrome.runtime.getManifest();
      const defaultPopup = manifest.action?.default_popup || 'popup/popup.html';
      await chrome.action.setPopup({ popup: defaultPopup });
    }
  }

  static async openDetachedWindow() {
    const manifest = chrome.runtime.getManifest();
    const url = manifest.action?.default_popup || 'popup/popup.html';
    
    // Check if a window is already open
    const windows = await chrome.windows.getAll({ populate: false });
    const existing = windows.find(w => w.type === 'popup' && w.tabs?.[0]?.url?.includes(url));
    
    if (existing) {
      chrome.windows.update(existing.id, { focused: true });
    } else {
      chrome.windows.create({
        url: url,
        type: 'popup',
        width: 420,
        height: 600
      });
    }
  }
}

// Export for background scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DetachUtils };
}
