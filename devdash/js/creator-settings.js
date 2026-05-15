// Creator Settings — Centralized management for Creator Mode API keys
window.CreatorSettings = {
  STORAGE_KEY: 'creator_api_config',
  
  async getConfig() {
    return new Promise(resolve => {
      chrome.storage.local.get([this.STORAGE_KEY], (res) => {
        resolve(res[this.STORAGE_KEY] || {
          youtubeApiKey: '',
          youtubeChannelId: '',
          platforms: {}
        });
      });
    });
  },

  async saveConfig(config) {
    return new Promise(resolve => {
      chrome.storage.local.set({ [this.STORAGE_KEY]: config }, () => {
        resolve();
      });
    });
  },

  showModal() {
    this.getConfig().then(config => {
      const overlay = document.createElement('div');
      overlay.className = 'env-modal-overlay';
      overlay.style.zIndex = '10000';
      
      overlay.innerHTML = `
        <div class="env-modal glass-card" style="width:360px;padding:1.5rem;border-radius:var(--widget-radius);animation:modalScaleIn 0.2s ease-out;">
          <h3 style="margin:0 0 1rem 0;">⚙️ Creator API Settings</h3>
          
          <div class="input-group" style="flex-direction:column;align-items:flex-start;gap:0.5rem;margin-bottom:1rem;">
            <label style="font-size:0.8rem;color:var(--text-dim);">YouTube API Key</label>
            <input type="password" id="yt-api-key" class="glass-input" style="width:100%;" value="${config.youtubeApiKey || ''}" placeholder="AIzaSy...">
          </div>

          <div class="input-group" style="flex-direction:column;align-items:flex-start;gap:0.5rem;margin-bottom:1rem;">
            <label style="font-size:0.8rem;color:var(--text-dim);">YouTube Channel ID</label>
            <input type="text" id="yt-channel-id" class="glass-input" style="width:100%;" value="${config.youtubeChannelId || ''}" placeholder="UC...">
            <p style="font-size:0.7rem;color:var(--text-tertiary);margin:0;">Used for Monetization & Radar widgets.</p>
          </div>

          <div style="display:flex;justify-content:flex-end;gap:0.5rem;margin-top:1rem;">
            <button id="creator-settings-cancel" class="glass-btn">Cancel</button>
            <button id="creator-settings-save" class="glass-btn btn-primary">Save Config</button>
          </div>
        </div>`;
      
      document.body.appendChild(overlay);
      
      overlay.querySelector('#creator-settings-cancel').addEventListener('click', () => document.body.removeChild(overlay));
      overlay.querySelector('#creator-settings-save').addEventListener('click', () => {
        const newConfig = {
          ...config,
          youtubeApiKey: document.getElementById('yt-api-key').value.trim(),
          youtubeChannelId: document.getElementById('yt-channel-id').value.trim()
        };
        this.saveConfig(newConfig).then(() => {
          document.body.removeChild(overlay);
          // Dispatch event to notify widgets
          window.dispatchEvent(new CustomEvent('creator-config-updated', { detail: newConfig }));
        });
      });
    });
  }
};
