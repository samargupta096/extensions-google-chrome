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
    // We use a color that matches the theme: 4facfe (cyan-ish)
    graphContainer.innerHTML = `<img src="https://ghchart.rshah.org/4facfe/${username}" alt="${username}'s GitHub Chart" />`;
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
