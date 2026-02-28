// ApplyHawk Autofill Engine

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autofillForm') {
    // Request profile from background script
    chrome.runtime.sendMessage({ action: 'getProfile' }, (response) => {
      if (response && response.profile) {
        const success = fillForm(response.profile);
        sendResponse({ success: success });
      } else {
        sendResponse({ success: false, error: 'No profile found' });
      }
    });
    return true; // async response
  }
  
  if (request.action === 'extractJobDescription') {
      // Basic extraction of visible text from main body, trying to avoid nav/footers if possible,
      // but a simple document.body.innerText is a good fallback for local LLMs
      let text = document.body.innerText;
      
      // Basic cleanup to remove excessive whitespace to save token limits
      text = text.replace(/\s+/g, ' ').trim();
      
      // Limit to first ~10000 characters to prevent huge payloads
      text = text.substring(0, 10000);
      
      sendResponse({ success: true, text: text });
  }
});

function fillForm(profile) {
  let fieldsFilled = 0;
  const inputs = document.querySelectorAll('input, textarea, select');
  
  if (inputs.length === 0) return false;

  // Extremely basic heuristic mapping for common field names on platforms like Greenhouse, Lever, Workday
  const mappings = {
    firstName: ['first_name', 'firstname', 'fname', 'first name', 'given name'],
    lastName: ['last_name', 'lastname', 'lname', 'last name', 'family name'],
    email: ['email', 'e-mail', 'email address'],
    phone: ['phone', 'telephone', 'mobile', 'cell', 'contact number'],
    linkedin: ['linkedin', 'linked in', 'linkedin url', 'linkedin.com'],
    github: ['github', 'git hub', 'github url', 'github.com'],
    portfolio: ['portfolio', 'website', 'personal website', 'url'],
    currentCompany: ['current_company', 'company', 'employer', 'organization'],
    currentTitle: ['title', 'role', 'position', 'job title']
  };

  inputs.forEach(input => {
    // Skip hidden or disabled fields
    if (input.type === 'hidden' || input.disabled || input.style.display === 'none') {
      return;
    }

    const nameAttr = (input.name || '').toLowerCase();
    const idAttr = (input.id || '').toLowerCase();
    const labelText = getLabelText(input).toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();

    const textToMatch = `${nameAttr} ${idAttr} ${labelText} ${placeholder}`;

    let matched = false;

    // Iterate through our profile mappings
    for (const [profileKey, keywords] of Object.entries(mappings)) {
      if (matched || !profile[profileKey]) continue; // Skip if already filled or no data for this field

      for (const keyword of keywords) {
        if (textToMatch.includes(keyword)) {
          // Found a match!
          
          if (input.tagName === 'SELECT') {
             // Basic select matching (e.g. for Country codes or similar, not perfectly robust but illustrative)
             let options = Array.from(input.options);
             let valueToFind = profile[profileKey].toLowerCase();
             let option = options.find(opt => opt.text.toLowerCase().includes(valueToFind) || opt.value.toLowerCase().includes(valueToFind));
             if (option) {
                input.value = option.value;
                triggerEvents(input);
                fieldsFilled++;
                matched = true;
                break;
             }
          } else if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
             if (input.type === 'file') continue; // cannot natively autofill file inputs due to security

             input.value = profile[profileKey];
             triggerEvents(input);
             
             // Visual cue that ApplyHawk filled it
             input.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
             input.style.border = '1px solid #8b5cf6';
             input.title = "Autofilled by ApplyHawk";
             
             fieldsFilled++;
             matched = true;
             break;
          }
        }
      }
    }

    // Special fallback for resume text if a textarea seems to ask for a "Resume" or "Cover Letter" in plain text
    if (!matched && input.tagName === 'TEXTAREA' && textToMatch.includes('resume') && profile.resumeText) {
       input.value = profile.resumeText;
       triggerEvents(input);
       input.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
       input.style.border = '1px solid #8b5cf6';
       fieldsFilled++;
       matched = true;
    }

  });

  return fieldsFilled > 0;
}

// Utility to trigger events so React/Vue/Angular apps pick up the change
function triggerEvents(element) {
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

function getLabelText(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.innerText;
  }
  const parentLabel = input.closest('label');
  if (parentLabel) return parentLabel.innerText;
  
  // Custom check for div-based labels often used in modern frameworks
  const previousSibling = input.previousElementSibling;
  if (previousSibling && previousSibling.tagName === 'LABEL') {
    return previousSibling.innerText;
  }

  return '';
}
