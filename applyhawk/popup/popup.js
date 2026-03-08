document.addEventListener('DOMContentLoaded', () => {
  const optionsBtn = document.getElementById('options-btn');
  const autofillBtn = document.getElementById('autofill-btn');
  const statusValue = document.getElementById('profile-status');
  const progressFill = document.getElementById('progress-fill');

  // Open options page
  optionsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Check profile completion
  chrome.storage.local.get(['userProfile'], (result) => {
    const profile = result.userProfile;
    if (profile) {
      const fields = ['firstName', 'lastName', 'email', 'phone', 'linkedin', 'resumeText'];
      let filled = 0;
      fields.forEach(field => {
        if (profile[field] && profile[field].trim() !== '') {
          filled++;
        }
      });
      
      const percentage = Math.round((filled / fields.length) * 100);
      progressFill.style.width = `${percentage}%`;
      
      if (percentage === 100) {
        statusValue.textContent = 'Excellent';
        statusValue.style.color = 'var(--accent)';
      } else if (percentage > 50) {
        statusValue.textContent = 'Good';
        statusValue.style.color = '#fbbf24'; // Yellow
      } else {
        statusValue.textContent = 'Incomplete';
        statusValue.style.color = '#ef4444'; // Red
      }
    } else {
      progressFill.style.width = '0%';
      statusValue.textContent = 'Not Setup';
      statusValue.style.color = '#ef4444'; // Red
    }
  });

  // Action for autofill button
  autofillBtn.addEventListener('click', async () => {
    const originalText = autofillBtn.innerHTML;
    autofillBtn.innerHTML = '<span class="icon">🔄</span> Working...';
    autofillBtn.disabled = true;

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) throw new Error("No active tab found");

      // Attempt to communicate with content script
      const response = await chrome.tabs.sendMessage(tab.id, { action: "autofillForm" });
      
      if (response && response.success) {
        autofillBtn.innerHTML = '<span class="icon">✅</span> Autofilled!';
        autofillBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)'; // Green success
      } else {
        throw new Error("Autofill failed or unsupported form");
      }
    } catch (e) {
      console.error(e);
      // fallback message if content script fails or isn't injected
      autofillBtn.innerHTML = '<span class="icon">⚠️</span> Failed/No Form';
      autofillBtn.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)'; // Red error
    }

    setTimeout(() => {
      autofillBtn.innerHTML = originalText;
      autofillBtn.disabled = false;
      autofillBtn.style.background = ''; // reset to default
    }, 2000);
  });

  // Action for generating cover letter
  const coverLetterBtn = document.getElementById('cover-letter-btn');
  const resultCard = document.getElementById('cover-letter-result');
  const resultText = document.getElementById('cover-letter-text');
  const copyBtn = document.getElementById('copy-btn');

  coverLetterBtn.addEventListener('click', async () => {
    const originalText = coverLetterBtn.innerHTML;
    coverLetterBtn.innerHTML = '<span class="icon">⏳</span> Generating... (May take 10-30s)';
    coverLetterBtn.disabled = true;

    try {
      // 1. Get Resume Text from Storage
      const storageResult = await new Promise(resolve => chrome.storage.local.get(['userProfile'], resolve));
      const resumeText = storageResult.userProfile?.resumeText;
      
      if (!resumeText || resumeText.length < 50) {
         throw new Error("No resume saved. Please add your resume text in Manage Profile.");
      }

      // 2. Get Job Description from Content Script
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error("No active tab found");
      
      const response = await chrome.tabs.sendMessage(tab.id, { action: "extractJobDescription" });
      if (!response || !response.success || !response.text) {
         throw new Error("Could not extract job description from page.");
      }

      // 3. Send to Background Script for Ollama Processing
      const ollamaResponse = await new Promise((resolve, reject) => {
         chrome.runtime.sendMessage({
            action: 'generateCoverLetter',
            jobDescription: response.text,
            resumeText: resumeText
         }, (res) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!res || !res.success) {
               return reject(new Error(res?.error || "Ollama generation failed"));
            }
            resolve(res);
         });
      });

      // 4. Display Result
      resultText.value = ollamaResponse.coverLetter.trim();
      resultCard.classList.remove('hidden');

    } catch (e) {
      console.error(e);
      alert("Error: " + e.message + "\n\nMake sure Ollama is running at localhost:11434 and OLLAMA_ORIGINS=\"*\" is set if you face CORS issues.");
    }

    coverLetterBtn.innerHTML = originalText;
    coverLetterBtn.disabled = false;
  });

  // Copy to clipboard logic
  copyBtn.addEventListener('click', () => {
     resultText.select();
     document.execCommand('copy');
     const oldText = copyBtn.innerText;
     copyBtn.innerText = "Copied!";
     setTimeout(() => copyBtn.innerText = oldText, 2000);
  });
});


// --- Global Model Selector ---
async function initGlobalModelSelector() {
  const select = document.getElementById('globalModelSelect');
  if (!select) return;

  try {
    const models = await ollama.listModels();
    if (!models || models.length === 0) {
      select.style.display = 'none';
      return;
    }
    
    select.style.display = ''; // show it
    const local = await chrome.storage.local.get('settings');
    const settings = local.settings || {};
    const savedModel = settings.defaultModel || ollama.defaultModel || 'llama3.2';

    select.innerHTML = models.map(m => `<option value="${m.name}">${m.name}</option>`).join('');
    
    if (models.some(m => m.name === savedModel)) {
      select.value = savedModel;
    } else {
      select.value = models[0].name;
      await chrome.storage.local.set({ settings: { ...settings, defaultModel: select.value } });
    }

    select.addEventListener('change', async (e) => {
      const current = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...(current.settings || {}), defaultModel: e.target.value } });
    });
  } catch(e) { console.error('Failed to init model selector', e); }
}

// Auto-run after DOM load and status check
setTimeout(initGlobalModelSelector, 500);


// ============ Multi-Provider AI Setup ============
(function initMultiProviderAI() {
  const aiClient = typeof window._aiClient !== 'undefined' ? window._aiClient : (typeof AIClient !== 'undefined' ? new AIClient() : null);
  if (!aiClient) return;

  const providerSelect = document.getElementById('provider-select');
  const modelSelect = document.getElementById('model-select');
  const btnApiKey = document.getElementById('btn-api-key');
  const apiKeyWrap = document.getElementById('api-key-wrap');
  const apiKeyInput = document.getElementById('api-key-input');
  const btnSaveKey = document.getElementById('btn-save-key');
  const aiStatus = document.getElementById('ai-status');

  if (!providerSelect || !modelSelect) return;

  async function initAI() {
    const providerId = await aiClient.getProvider();
    providerSelect.value = providerId;
    updateApiKeyButton(providerId);
    await checkAIStatus();
    await loadAIModels();
  }

  async function checkAIStatus() {
    if (!aiStatus) return;
    const providerId = await aiClient.getProvider();
    const provider = typeof AI_PROVIDERS !== 'undefined' ? AI_PROVIDERS[providerId] : null;
    const providerName = provider?.name || providerId;
    const available = await aiClient.isAvailable();
    if (available) {
      aiStatus.className = 'ollama-status connected';
      aiStatus.innerHTML = '<span class="status-dot online"></span><span>' + providerName + '</span>';
    } else {
      aiStatus.className = 'ollama-status disconnected';
      const hint = provider?.requiresKey ? 'No Key' : 'Offline';
      aiStatus.innerHTML = '<span class="status-dot offline"></span><span>' + hint + '</span>';
    }
  }

  async function loadAIModels() {
    modelSelect.innerHTML = '<option value="">Loading...</option>';
    try {
      const models = await aiClient.listModels();
      const savedModel = await aiClient.getModel();
      if (models.length === 0) {
        const pid = await aiClient.getProvider();
        modelSelect.innerHTML = '<option value="">' + (pid === 'ollama' ? 'Ollama offline' : 'No models') + '</option>';
        return;
      }
      modelSelect.innerHTML = models.map(function(m) {
        const label = m.size ? m.name + ' (' + m.size + ')' : m.name;
        return '<option value="' + m.id + '"' + (m.id === savedModel ? ' selected' : '') + '>' + label + '</option>';
      }).join('');
      if (!models.some(function(m) { return m.id === savedModel; })) {
        modelSelect.selectedIndex = 0;
        await aiClient.setModel(models[0].id);
      }
    } catch(e) {
      modelSelect.innerHTML = '<option value="">Error</option>';
    }
  }

  function updateApiKeyButton(providerId) {
    if (!btnApiKey) return;
    const provider = typeof AI_PROVIDERS !== 'undefined' ? AI_PROVIDERS[providerId] : null;
    btnApiKey.style.display = (provider && provider.requiresKey) ? '' : 'none';
    if (apiKeyWrap) apiKeyWrap.style.display = 'none';
  }

  providerSelect.addEventListener('change', async function() {
    const pid = providerSelect.value;
    await aiClient.setProvider(pid);
    updateApiKeyButton(pid);
    if (apiKeyWrap) apiKeyWrap.style.display = 'none';
    await checkAIStatus();
    await loadAIModels();
  });

  modelSelect.addEventListener('change', async function() {
    if (modelSelect.value) await aiClient.setModel(modelSelect.value);
  });

  if (btnApiKey) {
    btnApiKey.addEventListener('click', function() {
      if (apiKeyWrap) {
        apiKeyWrap.style.display = apiKeyWrap.style.display === 'none' ? 'flex' : 'none';
        if (apiKeyInput && apiKeyWrap.style.display === 'flex') apiKeyInput.focus();
      }
    });
  }

  if (btnSaveKey) {
    btnSaveKey.addEventListener('click', async function() {
      const pid = providerSelect.value;
      const key = apiKeyInput ? apiKeyInput.value.trim() : '';
      if (!key) return;
      await aiClient.setApiKey(pid, key);
      if (apiKeyWrap) apiKeyWrap.style.display = 'none';
      if (apiKeyInput) apiKeyInput.value = '';
      await checkAIStatus();
    });
  }

  // Initialize after a short delay to ensure DOM is ready
  setTimeout(initAI, 100);
})();
