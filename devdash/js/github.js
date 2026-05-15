document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('github-username-input');
  const saveBtn = document.getElementById('save-github-btn');
  const graphContainer = document.getElementById('github-graph-container');

  // Check storage
  chrome.storage.local.get(['githubUsername'], (result) => {
    // If we have it stored, use it. Otherwise, default to empty or the user's name
    if (result.githubUsername) {
      usernameInput.value = result.githubUsername;
      renderGraph(result.githubUsername);
    } else {
      // Set a default for presentation, or leave blank
      const defaultUser = "samargupta096";
      usernameInput.value = defaultUser;
      renderGraph(defaultUser);
    }
  });

  function renderGraph(username) {
    if (!username) return;
    
    const graphContainer = document.getElementById('github-graph-container');
    const statsContainer = document.getElementById('github-stats-card');

    if (graphContainer) {
      graphContainer.innerHTML = `<div class="news-loading">⏳ Loading activity graph...</div>`;
      const img = new Image();
      img.src = `https://github-readme-activity-graph.vercel.app/graph?username=${username}&bg_color=00000000&color=4facfe&line=4facfe&point=fff&hide_border=true&area=true`;
      img.alt = `${username}'s GitHub Activity`;
      img.style.width = '100%';
      img.style.borderRadius = '8px';
      img.onload = () => {
        graphContainer.innerHTML = '';
        graphContainer.appendChild(img);
      };
      img.onerror = () => {
        graphContainer.innerHTML = `<p class="placeholder-text" style="color:#ff6b6b;">⚠️ Failed to load activity graph.</p>`;
      };
    }

    if (statsContainer) {
      statsContainer.innerHTML = `<div class="news-loading">⏳ Loading stats...</div>`;
      const statsUrl = `https://github-readme-stats.vercel.app/api?username=${username}&show_icons=true&theme=transparent&hide_border=true&title_color=4facfe&icon_color=4facfe&text_color=ffffff&bg_color=00000000`;
      const img = new Image();
      img.src = statsUrl;
      img.alt = `${username}'s Stats`;
      img.style.width = '100%';
      img.style.borderRadius = '8px';
      img.onload = () => {
        statsContainer.innerHTML = '';
        statsContainer.appendChild(img);
      };
      img.onerror = () => {
        statsContainer.innerHTML = `<p class="placeholder-text" style="color:#ff6b6b;">⚠️ Failed to load stats card.</p>`;
      };
    }
  }

  saveBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
      saveBtn.textContent = '...';
      saveBtn.disabled = true;
      chrome.storage.local.set({ githubUsername: username }, () => {
        renderGraph(username);
        setTimeout(() => {
          saveBtn.textContent = 'Set';
          saveBtn.disabled = false;
        }, 1000);
      });
    }
  });

  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });
});
