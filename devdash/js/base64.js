// Base64 Encoder / Decoder Widget
document.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('b64-input');
  const outputEl = document.getElementById('b64-output');
  const encodeBtn = document.getElementById('b64-encode-btn');
  const decodeBtn = document.getElementById('b64-decode-btn');
  const copyBtn = document.getElementById('b64-copy-btn');
  const statusEl = document.getElementById('b64-status');

  if (!inputEl || !outputEl) return;

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#ff6b6b' : '#00e676';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
  }

  encodeBtn && encodeBtn.addEventListener('click', () => {
    const val = inputEl.value;
    if (!val) return;
    try {
      // Handle unicode safely
      outputEl.value = btoa(unescape(encodeURIComponent(val)));
      setStatus('✓ Encoded');
    } catch (e) {
      setStatus(`✗ ${e.message}`, true);
    }
  });

  decodeBtn && decodeBtn.addEventListener('click', () => {
    const val = inputEl.value.trim();
    if (!val) return;
    try {
      outputEl.value = decodeURIComponent(escape(atob(val)));
      setStatus('✓ Decoded');
    } catch (e) {
      setStatus('✗ Invalid Base64 string', true);
    }
  });

  copyBtn && copyBtn.addEventListener('click', () => {
    if (!outputEl.value) return;
    navigator.clipboard.writeText(outputEl.value).then(() => setStatus('Copied!'));
  });
});
