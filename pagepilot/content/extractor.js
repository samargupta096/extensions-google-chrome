/**
 * PagePilot — Content Script
 */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'EXTRACT_CONTENT') {
    const article = document.querySelector('article') || document.querySelector('main') || document.body;
    sendResponse({
      title: document.title,
      url: window.location.href,
      text: (article.innerText || '').slice(0, 8000)
    });
  }
  if (msg.type === 'SHOW_RESULT') {
    showPopup(msg.text);
  }
  return true;
});

function showPopup(text) {
  const existing = document.getElementById('pp-popup');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'pp-popup';
  el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong>🔍 PagePilot</strong><button id="pp-close-btn" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">✕</button></div><div style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.8);">${text}</div>`;
  setTimeout(() => {
    document.getElementById('pp-close-btn')?.addEventListener('click', function() {
      this.closest('#pp-popup').remove();
    });
  }, 0);
  el.style.cssText = 'position:fixed;top:20px;right:20px;width:380px;max-height:400px;overflow-y:auto;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:16px;box-shadow:0 8px 40px rgba(0,0,0,0.6);z-index:2147483647;font-family:Inter,system-ui,sans-serif;color:#fff;animation:ppFadeIn 0.3s ease;';
  const style = document.createElement('style');
  style.textContent = '@keyframes ppFadeIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}';
  document.head.appendChild(style);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 20000);
}
