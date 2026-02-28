// ApplyHawk Tracker
// Simply intercepts submission events to save the job to history.

// This is a very rudimentary tracker for demonstration purposes.
// In a true 2026 production app, this would use MutationObservers on known success pages.

document.addEventListener('submit', (e) => {
  const form = e.target;
  
  // Very rough heuristic to guess if it's a job application form
  const formText = form.innerText.toLowerCase();
  if (formText.includes('apply') || formText.includes('application') || formText.includes('submit application')) {
    
    // Attempt to guess Job Title and Company from page title
    // E.g., "Software Engineer at Google - Lever"
    const pageTitle = document.title;
    let jobTitle = "Unknown Application";
    let company = "Unknown Company";

    if (pageTitle) {
      const parts = pageTitle.split(/at|-|\|/i).map(p => p.trim());
      if (parts.length >= 2) {
        jobTitle = parts[0];
        company = parts[1];
      } else {
         jobTitle = pageTitle;
      }
    }

    const applicationRecord = {
      title: jobTitle,
      company: company,
      date: new Date().toISOString(),
      url: window.location.href,
      status: 'Applied'
    };

    chrome.storage.local.get(['applicationHistory'], (result) => {
      const history = result.applicationHistory || [];
      history.push(applicationRecord);
      chrome.storage.local.set({ applicationHistory: history });
      console.log('ApplyHawk: Saved application to history', applicationRecord);
    });
  }
}, true); // Use capture phase to ensure we catch it before default prevention
