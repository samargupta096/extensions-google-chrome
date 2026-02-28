document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('profile-form');
  const saveBtn = document.getElementById('save-btn');
  const toast = document.getElementById('toast');
  const navItems = document.querySelectorAll('.nav-item');

  // Load existing profile data
  chrome.storage.local.get(['userProfile'], (result) => {
    if (result.userProfile) {
      const p = result.userProfile;
      const ids = [
        'firstName', 'lastName', 'email', 'phone', 'location',
        'linkedin', 'github', 'portfolio', 
        'currentCompany', 'currentTitle', 'resumeText'
      ];
      ids.forEach(id => {
        if (document.getElementById(id) && p[id]) {
          document.getElementById(id).value = p[id];
        }
      });
    }
  });

  // Load application history
  chrome.storage.local.get(['applicationHistory'], (result) => {
    const list = document.getElementById('historyList');
    if (result.applicationHistory && result.applicationHistory.length > 0) {
      // Sort newest first
      const sortedHistory = result.applicationHistory.sort((a,b) => new Date(b.date) - new Date(a.date));
      
      sortedHistory.forEach(item => {
        const dDate = new Date(item.date).toLocaleDateString();
        
        const el = document.createElement('div');
        el.className = 'history-item';
        el.innerHTML = `
          <div class="history-item-main">
            <span class="history-item-title">${item.title}</span>
            <span class="history-item-company">${item.company}</span>
          </div>
          <div class="history-item-date">${dDate}</div>
        `;
        list.appendChild(el);
      });
    } else {
      list.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 0;">No applications tracked yet.</div>`;
    }
  });

  // Save profile data
  saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    saveBtn.innerHTML = '<span>Saving...</span>';

    const updatedProfile = {
      firstName: document.getElementById('firstName').value,
      lastName: document.getElementById('lastName').value,
      email: document.getElementById('email').value,
      phone: document.getElementById('phone').value,
      location: document.getElementById('location').value,
      linkedin: document.getElementById('linkedin').value,
      github: document.getElementById('github').value,
      portfolio: document.getElementById('portfolio').value,
      currentCompany: document.getElementById('currentCompany').value,
      currentTitle: document.getElementById('currentTitle').value,
      resumeText: document.getElementById('resumeText').value
    };

    chrome.storage.local.set({ userProfile: updatedProfile }, () => {
      // Simulate network request delay for UX
      setTimeout(() => {
        saveBtn.innerHTML = '<span>Saved!</span>';
        saveBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)'; // Green
        
        showToast('Profile saved successfully!');
        
        setTimeout(() => {
          saveBtn.innerHTML = '<span>Save Changes</span>';
          saveBtn.style.background = ''; // reset
        }, 2000);
      }, 500);
    });
  });

  // Navigation Highlighting
  const sections = document.querySelectorAll('section.card');
  const observerOptions = { root: null, rootMargin: '0px', threshold: 0.5 };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('id');
        navItems.forEach(nav => {
          nav.classList.remove('active');
          if (nav.getAttribute('href') === `#${id}`) {
            nav.classList.add('active');
          }
        });
      }
    });
  }, observerOptions);

  sections.forEach(section => observer.observe(section));

  // Smooth scroll
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = item.getAttribute('href').substring(1);
      const targetElement = document.getElementById(targetId);
      targetElement.scrollIntoView({ behavior: 'smooth' });
    });
  });

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }
});
