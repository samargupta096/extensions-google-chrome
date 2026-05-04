// FlowForge Sync Utility for DevDash
// Dynamically discovers the FlowForge extension and proxies storage requests to it.

const FlowForgeSync = {
  extensionId: null,
  isInitialized: false,

  async init() {
    if (this.isInitialized) return this.extensionId;
    
    return new Promise((resolve) => {
      chrome.management.getAll((extensions) => {
        const ff = extensions.find(ext => ext.name === 'FlowForge — 5 Productivity Systems');
        if (ff && ff.enabled) {
          this.extensionId = ff.id;
        }
        this.isInitialized = true;
        resolve(this.extensionId);
      });
    });
  },

  async load(key) {
    await this.init();
    if (!this.extensionId) {
      // Fallback to local storage if FlowForge is not installed/enabled
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (res) => resolve(res[key]));
      });
    }

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(this.extensionId, { action: 'GET_STATE', key }, (response) => {
        if (chrome.runtime.lastError || !response || !response.success) {
          // Fallback to local storage if message fails
          chrome.storage.local.get([key], (res) => resolve(res[key]));
        } else {
          resolve(response.data);
        }
      });
    });
  },

  async save(key, data) {
    await this.init();
    
    // Always save locally as fallback
    chrome.storage.local.set({ [key]: data });

    if (this.extensionId) {
      chrome.runtime.sendMessage(this.extensionId, { action: 'UPDATE_STATE', key, data });
    }
  }
};
