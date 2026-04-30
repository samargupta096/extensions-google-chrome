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
    // Using github-readme-activity-graph with transparent background (bg_color=00000000)
    graphContainer.innerHTML = `<img src="https://github-readme-activity-graph.vercel.app/graph?username=${username}&bg_color=00000000&color=4facfe&line=4facfe&point=fff&hide_border=true&area=true" alt="${username}'s GitHub Activity Graph" style="width: 100%; border-radius: 8px;"/>`;
  }

  saveBtn.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
      chrome.storage.local.set({ githubUsername: username });
      renderGraph(username);
    }
  });

  usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      saveBtn.click();
    }
  });
});
