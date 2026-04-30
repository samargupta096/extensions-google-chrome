document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('cheat-search');
  const catBtns = document.querySelectorAll('.cheat-cat-btn');
  const listEl = document.getElementById('cheat-list');

  if (!searchInput || !listEl) return;

  const commands = [
    // Files
    { cmd: 'ls -la', desc: 'List all files with details and hidden files', cat: 'files' },
    { cmd: 'find . -name "*.log"', desc: 'Find files by name pattern recursively', cat: 'files' },
    { cmd: 'du -sh *', desc: 'Show disk usage of each item in current dir', cat: 'files' },
    { cmd: 'df -h', desc: 'Show free disk space on all mounted filesystems', cat: 'files' },
    { cmd: 'tail -f file.log', desc: 'Follow a file in real-time (live log tail)', cat: 'files' },
    { cmd: 'wc -l file.txt', desc: 'Count lines in a file', cat: 'files' },
    { cmd: 'cp -r src/ dest/', desc: 'Copy directory recursively', cat: 'files' },
    { cmd: 'mv old new', desc: 'Move or rename a file/directory', cat: 'files' },

    // Network
    { cmd: 'curl -I https://example.com', desc: 'Fetch HTTP headers only (HEAD request)', cat: 'network' },
    { cmd: 'curl -X POST -d \'{"key":"val"}\' -H "Content-Type: application/json" URL', desc: 'Send JSON POST request', cat: 'network' },
    { cmd: 'netstat -tlnp', desc: 'Show listening TCP ports with process info', cat: 'network' },
    { cmd: 'ss -tlnp', desc: 'Modern alternative to netstat — show listening ports', cat: 'network' },
    { cmd: 'dig example.com', desc: 'DNS lookup for a domain', cat: 'network' },
    { cmd: 'wget -O file.zip URL', desc: 'Download file and save with specific name', cat: 'network' },
    { cmd: 'scp file.txt user@host:/path', desc: 'Securely copy file to remote server', cat: 'network' },

    // Processes
    { cmd: 'ps aux | grep node', desc: 'Find running processes by name', cat: 'process' },
    { cmd: 'kill -9 PID', desc: 'Force kill a process by PID', cat: 'process' },
    { cmd: 'top', desc: 'Interactive real-time process monitor', cat: 'process' },
    { cmd: 'htop', desc: 'Better process monitor (install separately)', cat: 'process' },
    { cmd: 'nohup ./script.sh &', desc: 'Run process in background, survives logout', cat: 'process' },
    { cmd: 'lsof -i :3000', desc: 'Find which process is using port 3000', cat: 'process' },

    // Permissions
    { cmd: 'chmod 755 script.sh', desc: 'Owner: rwx, Group/Others: r-x', cat: 'perms' },
    { cmd: 'chmod +x script.sh', desc: 'Make a file executable', cat: 'perms' },
    { cmd: 'chown user:group file', desc: 'Change file owner and group', cat: 'perms' },
    { cmd: 'sudo !!', desc: 'Re-run last command with sudo', cat: 'perms' },

    // Archives
    { cmd: 'tar -czf archive.tar.gz dir/', desc: 'Create gzipped tar archive', cat: 'archive' },
    { cmd: 'tar -xzf archive.tar.gz', desc: 'Extract gzipped tar archive', cat: 'archive' },
    { cmd: 'tar -tf archive.tar.gz', desc: 'List contents of tar archive without extracting', cat: 'archive' },
    { cmd: 'zip -r archive.zip dir/', desc: 'Create zip archive recursively', cat: 'archive' },
    { cmd: 'unzip archive.zip', desc: 'Extract zip archive', cat: 'archive' },

    // Git
    { cmd: 'git log --oneline -10', desc: 'Show last 10 commits in compact format', cat: 'git' },
    { cmd: 'git diff --staged', desc: 'Show changes staged for next commit', cat: 'git' },
    { cmd: 'git stash && git stash pop', desc: 'Temporarily shelve changes, then restore', cat: 'git' },
    { cmd: 'git reset --soft HEAD~1', desc: 'Undo last commit but keep changes staged', cat: 'git' },
    { cmd: 'git cherry-pick HASH', desc: 'Apply a specific commit from another branch', cat: 'git' },
    { cmd: 'git reflog', desc: 'Show history of all HEAD changes (recovery tool)', cat: 'git' },
    { cmd: 'git bisect start', desc: 'Binary search to find which commit introduced a bug', cat: 'git' },

    // Docker
    { cmd: 'docker ps -a', desc: 'List all containers (including stopped)', cat: 'docker' },
    { cmd: 'docker logs -f CONTAINER', desc: 'Follow container logs in real-time', cat: 'docker' },
    { cmd: 'docker exec -it CONTAINER bash', desc: 'Open interactive shell inside a running container', cat: 'docker' },
    { cmd: 'docker system prune -a', desc: 'Remove all unused images, containers, networks', cat: 'docker' },
    { cmd: 'docker compose up -d', desc: 'Start services in detached mode', cat: 'docker' },
    { cmd: 'docker stats', desc: 'Live CPU/memory/network stats for all containers', cat: 'docker' }
  ];

  let activeCat = 'all';

  function renderCommands() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = commands.filter(c => {
      const matchCat = activeCat === 'all' || c.cat === activeCat;
      const matchSearch = !query ||
        c.cmd.toLowerCase().includes(query) ||
        c.desc.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:1rem;">No matching commands.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(c => `
      <div class="cheat-item">
        <code class="cheat-cmd">${c.cmd}</code>
        <span class="cheat-desc">${c.desc}</span>
        <button class="cheat-copy-btn" data-cmd="${c.cmd.replace(/"/g, '&quot;')}" title="Copy">📋</button>
      </div>
    `).join('');

    // Attach copy listeners
    listEl.querySelectorAll('.cheat-copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.cmd).then(() => {
          btn.textContent = '✓';
          setTimeout(() => btn.textContent = '📋', 1500);
        });
      });
    });
  }

  searchInput.addEventListener('input', renderCommands);

  catBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      catBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCat = btn.dataset.cat;
      renderCommands();
    });
  });

  renderCommands();
});
