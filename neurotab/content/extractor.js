/**
 * NeuroTab — Content Script (Page Extractor)
 */

// Extract main content from page
function extractPageContent() {
  // Try article/main first
  const article = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]');
  
  let text = '';
  if (article) {
    text = article.innerText;
  } else {
    // Fallback: get major content blocks
    const selectors = ['p', 'h1', 'h2', 'h3', 'h4', 'li', 'td', 'pre', 'code', 'blockquote'];
    const elements = document.querySelectorAll(selectors.join(','));
    const contents = [];
    for (const el of elements) {
      const t = el.innerText?.trim();
      if (t && t.length > 20) contents.push(t);
    }
    text = contents.join('\n');
  }

  return text.slice(0, 10000); // Cap at 10k chars
}

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'EXTRACT_CONTENT') {
    sendResponse({
      text: extractPageContent(),
      title: document.title,
      url: window.location.href
    });
  }

  if (message.type === 'SHOW_SUMMARY') {
    showSummaryPopup(message.summary);
  }
  return true;
});

// Show floating summary popup
function showSummaryPopup(text) {
  const existing = document.getElementById('neurotab-popup');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = 'neurotab-popup';
  popup.innerHTML = `
    <div class="nt-popup-header">
      <span>🧠 NeuroTab Summary</span>
      <button class="nt-popup-close" onclick="this.closest('#neurotab-popup').remove()">✕</button>
    </div>
    <div class="nt-popup-body">${text}</div>
  `;

  const style = document.createElement('style');
  style.textContent = `
    #neurotab-popup {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 360px;
      max-height: 300px;
      background: #1a1a2e;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      z-index: 2147483647;
      font-family: Inter, system-ui, sans-serif;
      color: white;
      overflow: hidden;
      animation: ntSlideIn 0.3s ease;
    }
    .nt-popup-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: rgba(108,92,231,0.15);
      font-size: 13px;
      font-weight: 600;
    }
    .nt-popup-close {
      background: none;
      border: none;
      color: rgba(255,255,255,0.5);
      cursor: pointer;
      font-size: 16px;
      padding: 0;
    }
    .nt-popup-body {
      padding: 16px;
      font-size: 13px;
      line-height: 1.6;
      color: rgba(255,255,255,0.8);
      max-height: 240px;
      overflow-y: auto;
    }
    @keyframes ntSlideIn {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 15000);
}
