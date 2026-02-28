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
