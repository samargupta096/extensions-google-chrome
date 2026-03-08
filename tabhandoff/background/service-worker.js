importScripts('../shared/ollama-client.js');
importScripts('../shared/ai-client.js');
importScripts('../shared/detach-utils.js');
/**
 * Tab Handoff — Background Service Worker
 * WebSocket connection, tab monitoring, context menu, handoff history.
 */

/* ── State ── */
let ws = null;
let state = 'disconnected'; // disconnected | connecting | waiting | paired
let currentRoom = null;
let relayUrl = 'ws://localhost:9090';
let remoteTabs = [];
let reconnectTimer = null;
const RECONNECT_DELAY = 3000;

/* ── Init ── */
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['th_relay', 'th_history'], (data) => {
    if (data.th_relay) relayUrl = data.th_relay;
    if (!data.th_history) chrome.storage.local.set({ th_history: [] });
  });

  // Context menu
  chrome.contextMenus.create({
    id: 'th-send-tab',
    title: '📡 Send Tab to Paired Device',
    contexts: ['page', 'link']
  });
});

/* ── Context menu handler ── */
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'th-send-tab') return;

  if (state !== 'paired') {
    broadcastToPopup({ type: 'TOAST', text: 'Not paired — connect first.', variant: 'error' });
    return;
  }

  const url = info.linkUrl || tab?.url;
  const title = tab?.title || '';

  if (!url) return;
  sendTab(url, title);
});

/* ── Message handler from popup ── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'JOIN_ROOM': {
      if (msg.relay) relayUrl = msg.relay;
      currentRoom = msg.room;
      connectRelay(msg.room);
      sendResponse({ ok: true });
      break;
    }

    case 'DISCONNECT': {
      disconnect();
      sendResponse({ ok: true });
      break;
    }

    case 'SEND_CURRENT_TAB': {
      if (state !== 'paired') {
        sendResponse({ success: false, error: 'Not paired' });
        break;
      }
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          sendTab(tabs[0].url, tabs[0].title);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'No active tab' });
        }
      });
      return true; // async
    }

    case 'PULL_TAB': {
      if (msg.url) chrome.tabs.create({ url: msg.url, active: true });
      sendResponse({ ok: true });
      break;
    }

    case 'GET_STATE': {
      sendResponse({ state, room: currentRoom, remoteTabs });
      break;
    }

    case 'GET_HISTORY': {
      chrome.storage.local.get('th_history', (data) => {
        sendResponse({ history: data.th_history || [] });
      });
      return true; // async
    }

    default:
      sendResponse({ error: 'Unknown' });
  }
  return false;
});

/* ━━━━━━━━━━━━━━━━━━━━━━━ WebSocket ━━━━━━━━━━━━━━━━━━━━━━━ */

function connectRelay(room) {
  disconnect(true); // silent

  setState('connecting');

  try {
    ws = new WebSocket(relayUrl);
  } catch (e) {
    setState('disconnected');
    broadcastToPopup({ type: 'TOAST', text: 'Cannot connect to relay', variant: 'error' });
    return;
  }

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'join', room }));
  };

  ws.onmessage = (evt) => {
    let msg;
    try { msg = JSON.parse(evt.data); } catch { return; }

    switch (msg.type) {
      case 'joined':
        setState(msg.peers >= 2 ? 'paired' : 'waiting');
        break;

      case 'peer_joined':
        setState('paired');
        broadcastToPopup({ type: 'TOAST', text: 'Peer connected! 🎉', variant: 'success' });
        // Send our tab list immediately
        sendLocalTabs();
        break;

      case 'peer_left':
        setState('waiting');
        remoteTabs = [];
        broadcastToPopup({ type: 'REMOTE_TABS', tabs: [] });
        broadcastToPopup({ type: 'TOAST', text: 'Peer disconnected', variant: 'error' });
        break;

      case 'tab_push':
        // Received a tab from peer
        if (msg.url) {
          chrome.tabs.create({ url: msg.url, active: false });
          addHistory('received', msg.url, msg.title || '');
          broadcastToPopup({ type: 'TOAST', text: `📥 Received: ${truncate(msg.title || msg.url, 30)}`, variant: 'success' });
        }
        break;

      case 'tab_list':
        // Peer's tab list
        remoteTabs = msg.tabs || [];
        broadcastToPopup({ type: 'REMOTE_TABS', tabs: remoteTabs });
        break;

      case 'error':
        broadcastToPopup({ type: 'TOAST', text: msg.message || 'Relay error', variant: 'error' });
        setState('disconnected');
        break;
    }
  };

  ws.onclose = () => {
    if (state === 'paired' || state === 'waiting') {
      // Unexpected close — attempt reconnect
      setState('connecting');
      scheduleReconnect(room);
    } else {
      setState('disconnected');
    }
  };

  ws.onerror = () => {
    // onclose will fire after this
  };
}

function scheduleReconnect(room) {
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (state === 'connecting' && currentRoom === room) {
      connectRelay(room);
    }
  }, RECONNECT_DELAY);
}

function disconnect(silent) {
  clearTimeout(reconnectTimer);
  if (ws) {
    try {
      ws.send(JSON.stringify({ type: 'leave' }));
      ws.close();
    } catch {}
    ws = null;
  }
  currentRoom = null;
  remoteTabs = [];
  if (!silent) {
    setState('disconnected');
    broadcastToPopup({ type: 'REMOTE_TABS', tabs: [] });
  }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━ Tab Monitoring ━━━━━━━━━━━━━━━━━━━━━━━ */

// Debounce tab list broadcasts
let tabSendTimer = null;

function sendLocalTabs() {
  clearTimeout(tabSendTimer);
  tabSendTimer = setTimeout(() => {
    if (state !== 'paired' || !ws || ws.readyState !== WebSocket.OPEN) return;

    chrome.tabs.query({}, (tabs) => {
      const tabList = tabs.map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        favIconUrl: t.favIconUrl || '',
        active: t.active,
        windowId: t.windowId
      }));

      ws.send(JSON.stringify({ type: 'tab_list', tabs: tabList }));
    });
  }, 300);
}

// Listen for tab changes
chrome.tabs.onCreated.addListener(() => sendLocalTabs());
chrome.tabs.onRemoved.addListener(() => sendLocalTabs());
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.title || changeInfo.url || changeInfo.status === 'complete') {
    sendLocalTabs();
  }
});
chrome.tabs.onActivated.addListener(() => sendLocalTabs());

/* ━━━━━━━━━━━━━━━━━━━━━━━ Send Tab ━━━━━━━━━━━━━━━━━━━━━━━ */

function sendTab(url, title) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'tab_push', url, title }));
  addHistory('sent', url, title);
  broadcastToPopup({ type: 'TOAST', text: `📤 Sent: ${truncate(title || url, 30)}`, variant: 'success' });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━ History ━━━━━━━━━━━━━━━━━━━━━━━ */

function addHistory(direction, url, title) {
  chrome.storage.local.get('th_history', (data) => {
    const history = data.th_history || [];
    history.unshift({ direction, url, title, timestamp: Date.now() });
    if (history.length > 100) history.splice(100);
    chrome.storage.local.set({ th_history: history });
    broadcastToPopup({ type: 'HISTORY_UPDATE', history });
  });
}

/* ━━━━━━━━━━━━━━━━━━━━━━━ Helpers ━━━━━━━━━━━━━━━━━━━━━━━ */

function setState(newState) {
  state = newState;
  broadcastToPopup({ type: 'STATE_UPDATE', state, room: currentRoom });
}

function broadcastToPopup(msg) {
  chrome.runtime.sendMessage(msg).catch(() => {
    // Popup not open — that's fine
  });
}

function truncate(str, len) {
  if (!str) return '';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

// Initialize Detach Mode
if (typeof DetachUtils !== 'undefined') {
  DetachUtils.init();
}

// Initialize Shared Ollama Client Logic
if (typeof registerOllamaHandler !== 'undefined') {
  registerOllamaHandler();
}

// Register Multi-Provider AI Fetch Handler
if (typeof registerAIFetchHandler !== 'undefined') {
  registerAIFetchHandler();
}
