/**
 * Tab Handoff — Popup Script
 * Handles pairing UI, remote tab list, and handoff history.
 */

(function () {
  'use strict';

  /* ── DOM refs ── */
  const $ = (s) => document.getElementById(s);
  const connDot = $('conn-dot');
  const connLabel = $('conn-label');
  const connStatus = $('conn-status');

  const unpairedUI = $('unpaired-ui');
  const pairedUI = $('paired-ui');
  const pairingCard = $('pairing-card');
  const pairingTitle = $('pairing-title');
  const pairingSubtitle = $('pairing-subtitle');
  const roomCodeValue = $('room-code-value');
  const peerStatus = $('peer-status');

  const btnGenerate = $('btn-generate');
  const btnJoin = $('btn-join');
  const inputRoom = $('input-room');
  const btnSendTab = $('btn-send-tab');
  const btnDisconnect = $('btn-disconnect');

  const inputRelay = $('input-relay');
  const btnSaveRelay = $('btn-save-relay');

  const remoteList = $('remote-tabs-list');
  const remoteEmpty = $('remote-empty');
  const historyList = $('history-list');
  const historyEmpty = $('history-empty');

  /* ── Tab switching ── */
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach((c) => (c.style.display = 'none'));
      btn.classList.add('active');
      const target = $('tab-' + btn.dataset.tab);
      if (target) target.style.display = '';
    });
  });

  /* ── Load saved relay URL ── */
  chrome.storage.local.get('th_relay', (data) => {
    if (data.th_relay) inputRelay.value = data.th_relay;
  });

  btnSaveRelay.addEventListener('click', () => {
    chrome.storage.local.set({ th_relay: inputRelay.value.trim() });
    showToast('Relay URL saved', 'success');
  });

  /* ── Generate room code ── */
  btnGenerate.addEventListener('click', () => {
    const code = generateCode();
    inputRoom.value = code;
    joinRoom(code);
  });

  /* ── Join room ── */
  btnJoin.addEventListener('click', () => {
    const code = inputRoom.value.trim().toUpperCase();
    if (code.length < 4) return showToast('Enter a valid room code', 'error');
    joinRoom(code);
  });

  inputRoom.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoin.click();
  });

  /* ── Send current tab ── */
  btnSendTab.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'SEND_CURRENT_TAB' }, (resp) => {
      if (resp?.success) showToast('Tab sent! 📤', 'success');
      else showToast(resp?.error || 'Failed to send', 'error');
    });
  });

  /* ── Disconnect ── */
  btnDisconnect.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT' }, () => {
      setUIState('disconnected');
      showToast('Disconnected', 'success');
    });
  });

  /* ━━━━━━━━━━━━━━━━━━━━━━━ Functions ━━━━━━━━━━━━━━━━━━━━━━━ */

  function joinRoom(code) {
    setUIState('connecting', code);
    chrome.runtime.sendMessage({ type: 'JOIN_ROOM', room: code, relay: inputRelay.value.trim() }, (resp) => {
      if (resp?.error) {
        showToast(resp.error, 'error');
        setUIState('disconnected');
      }
    });
  }

  function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for clarity
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
  }

  function setUIState(state, roomCode) {
    switch (state) {
      case 'connecting':
        connDot.className = 'status-dot offline';
        connLabel.textContent = 'Connecting…';
        connStatus.className = 'connection-status connecting';
        pairingCard.classList.add('connecting-anim');
        pairingTitle.textContent = 'Connecting…';
        pairingSubtitle.textContent = 'Waiting for relay server…';
        unpairedUI.style.display = 'none';
        pairedUI.style.display = 'none';
        if (roomCode) roomCodeValue.textContent = roomCode;
        break;

      case 'waiting':
        connDot.className = 'status-dot offline';
        connLabel.textContent = 'Waiting';
        connStatus.className = 'connection-status connecting';
        pairingCard.classList.remove('connecting-anim');
        pairingTitle.textContent = 'Waiting for Peer';
        pairingSubtitle.textContent = 'Share this room code with the other device.';
        unpairedUI.style.display = 'none';
        pairedUI.style.display = '';
        peerStatus.className = 'peer-status waiting';
        peerStatus.innerHTML = '<span class="status-dot offline" style="background:var(--accent-yellow);box-shadow:0 0 8px rgba(253,203,110,0.5);animation:pulse-glow 2s infinite;"></span><span>Waiting for peer…</span>';
        btnSendTab.disabled = true;
        btnSendTab.style.opacity = '0.5';
        if (roomCode) roomCodeValue.textContent = roomCode;
        break;

      case 'paired':
        connDot.className = 'status-dot online';
        connLabel.textContent = 'Paired';
        connStatus.className = 'connection-status connected';
        pairingCard.classList.remove('connecting-anim');
        pairingTitle.textContent = 'Connected! 🎉';
        pairingSubtitle.textContent = 'You can now send and receive tabs.';
        unpairedUI.style.display = 'none';
        pairedUI.style.display = '';
        peerStatus.className = 'peer-status connected';
        peerStatus.innerHTML = '<span class="status-dot online"></span><span>Peer connected</span>';
        btnSendTab.disabled = false;
        btnSendTab.style.opacity = '1';
        if (roomCode) roomCodeValue.textContent = roomCode;
        break;

      case 'disconnected':
      default:
        connDot.className = 'status-dot offline';
        connLabel.textContent = 'Offline';
        connStatus.className = 'connection-status disconnected';
        pairingCard.classList.remove('connecting-anim');
        pairingTitle.textContent = 'Pair a Device';
        pairingSubtitle.textContent = 'Generate a room code or enter one from another device.';
        unpairedUI.style.display = '';
        pairedUI.style.display = 'none';
        clearRemoteTabs();
        break;
    }
  }

  /* ── Remote tabs ── */
  function renderRemoteTabs(tabs) {
    if (!tabs || tabs.length === 0) {
      remoteList.innerHTML = '';
      remoteList.appendChild(remoteEmpty.cloneNode(true));
      const badge = document.querySelector('.remote-count');
      if (badge) badge.textContent = '0';
      return;
    }

    remoteEmpty.style.display = 'none';

    // Build header
    let html = `<div class="remote-header">
      <div class="card-title">🖥️ Remote Tabs <span class="remote-count">${tabs.length}</span></div>
    </div>`;

    tabs.forEach((t) => {
      const domain = getDomain(t.url);
      const favicon = t.favIconUrl || '';
      const faviconHTML = favicon
        ? `<img src="${escapeHTML(favicon)}" alt="">`
        : `<span>🌐</span>`;

      html += `
        <div class="remote-tab slide-up" data-url="${escapeHTML(t.url)}" title="Click to open: ${escapeHTML(t.title)}">
          <div class="remote-tab-favicon">${faviconHTML}</div>
          <div class="remote-tab-info">
            <div class="remote-tab-title">${escapeHTML(t.title || 'Untitled')}</div>
            <div class="remote-tab-url">${escapeHTML(domain)}</div>
          </div>
          <div class="remote-tab-pull">↗</div>
        </div>`;
    });

    remoteList.innerHTML = html;

    // Click to pull
    remoteList.querySelectorAll('.remote-tab').forEach((el) => {
      el.addEventListener('click', () => {
        const url = el.dataset.url;
        chrome.runtime.sendMessage({ type: 'PULL_TAB', url }, () => {
          showToast('Tab opened! ↗️', 'success');
        });
      });
    });
  }

  function clearRemoteTabs() {
    remoteList.innerHTML = '';
    remoteList.appendChild(createEmptyState('🖥️', 'No Remote Tabs', 'Connect to a paired device to see their open tabs here.'));
  }

  /* ── History ── */
  function renderHistory(history) {
    if (!history || history.length === 0) {
      historyList.innerHTML = '';
      historyList.appendChild(createEmptyState('📜', 'No Handoffs Yet', 'Sent and received tabs will appear here.'));
      return;
    }

    let html = '';
    history.slice(0, 50).forEach((h) => {
      const isSent = h.direction === 'sent';
      const icon = isSent ? '📤' : '📥';
      const iconClass = isSent ? 'sent' : 'received';
      const timeAgo = formatTimeAgo(h.timestamp);

      html += `
        <div class="history-item">
          <div class="history-icon ${iconClass}">${icon}</div>
          <div class="history-info">
            <div class="history-title">${escapeHTML(h.title || 'Untitled')}</div>
            <div class="history-url">${escapeHTML(getDomain(h.url))}</div>
          </div>
          <div class="history-time">${timeAgo}</div>
        </div>`;
    });

    historyList.innerHTML = html;
  }

  /* ── Listen for state changes from background ── */
  chrome.runtime.onMessage.addListener((msg) => {
    switch (msg.type) {
      case 'STATE_UPDATE':
        setUIState(msg.state, msg.room);
        break;
      case 'REMOTE_TABS':
        renderRemoteTabs(msg.tabs);
        break;
      case 'HISTORY_UPDATE':
        renderHistory(msg.history);
        break;
      case 'TOAST':
        showToast(msg.text, msg.variant || 'success');
        break;
    }
  });

  /* ── On popup open: fetch current state ── */
  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (resp) => {
    if (!resp) return;
    setUIState(resp.state, resp.room);
    if (resp.remoteTabs) renderRemoteTabs(resp.remoteTabs);
  });

  chrome.runtime.sendMessage({ type: 'GET_HISTORY' }, (resp) => {
    if (resp?.history) renderHistory(resp.history);
  });

  /* ── Helpers ── */
  function showToast(text, variant) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.className = `toast ${variant}`;
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  function createEmptyState(icon, title, text) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `<div class="empty-state-icon">${icon}</div><div class="empty-state-title">${title}</div><div class="empty-state-text">${text}</div>`;
    return div;
  }

  function getDomain(url) {
    try { return new URL(url).hostname; } catch { return url; }
  }

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function formatTimeAgo(ts) {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }
})();
