// Background service worker for ApplyHawk

chrome.runtime.onInstalled.addListener(() => {
  console.log('ApplyHawk installed successfully.');
  
  // Initialize default empty profile if none exists
  chrome.storage.local.get(['userProfile'], (result) => {
    if (!result.userProfile) {
      chrome.storage.local.set({
        userProfile: {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          linkedin: '',
          github: '',
          portfolio: '',
          resumeText: ''
        }
      });
      console.log('Initialized default user profile.');
    }
  });

  // Initialize empty application history
  chrome.storage.local.get(['applicationHistory'], (result) => {
    if (!result.applicationHistory) {
      chrome.storage.local.set({ applicationHistory: [] });
    }
  });
});

// Listener for messages from popup or content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getProfile') {
    chrome.storage.local.get(['userProfile'], (result) => {
      sendResponse({ profile: result.userProfile });
    });
    return true; // Indicates async response
  }
  
  if (request.action === 'generateCoverLetter') {
    handleCoverLetterGeneration(request.jobDescription, request.resumeText, sendResponse);
    return true; // Indicates async response
  }
});

async function handleCoverLetterGeneration(jobDescription, resumeText, sendResponse) {
  try {
    const prompt = `
You are an expert career coach and resume writer.
Task: Write a professional, concise, and highly tailored cover letter for the following job description, based entirely on the provided resume.
Do not invent facts. Highlight relevant experience. Keep it under 300 words.

RESUME:
${resumeText}

---

JOB DESCRIPTION:
${jobDescription}

Cover Letter:
`;

    // Assuming a default local Ollama setup using llama3
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama3', // User can change this in a real app, hardcoding a popular default
        prompt: prompt,
        stream: false
      })
    });

    if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    sendResponse({ success: true, coverLetter: data.response });

  } catch (error) {
    console.error("Error generating cover letter:", error);
    sendResponse({ success: false, error: error.message });
  }
}
