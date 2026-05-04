/**
 * clipboard-monitor.js — Content script to capture copy events
 */
document.addEventListener('copy', () => {
  // Capture the current selection
  const selectedText = window.getSelection().toString();
  if (selectedText && selectedText.trim().length > 0) {
    chrome.runtime.sendMessage({
      type: 'CLIPBOARD_ADD',
      text: selectedText.trim()
    });
  }
});

// Also listen for cut events
document.addEventListener('cut', () => {
  const selectedText = window.getSelection().toString();
  if (selectedText && selectedText.trim().length > 0) {
    chrome.runtime.sendMessage({
      type: 'CLIPBOARD_ADD',
      text: selectedText.trim()
    });
  }
});
