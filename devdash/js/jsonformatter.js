// JSON Formatter & Validator Widget
document.addEventListener('DOMContentLoaded', () => {
  const inputArea = document.getElementById('json-input');
  const outputArea = document.getElementById('json-output');
  const formatBtn = document.getElementById('json-format-btn');
  const minifyBtn = document.getElementById('json-minify-btn');
  const copyBtn = document.getElementById('json-copy-btn');
  const statusEl = document.getElementById('json-status');

  if (!inputArea || !outputArea) return;

  function setStatus(msg, isError = false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.style.color = isError ? '#ff6b6b' : '#00e676';
  }

  function formatJson() {
    const raw = inputArea.value.trim();
    if (!raw) { setStatus('Paste JSON to format.', false); return; }
    try {
      const parsed = JSON.parse(raw);
      outputArea.textContent = JSON.stringify(parsed, null, 2);
      setStatus(`✓ Valid JSON`, false);
    } catch (e) {
      outputArea.textContent = '';
      setStatus(`✗ ${e.message}`, true);
    }
  }

  function minifyJson() {
    const raw = inputArea.value.trim();
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      outputArea.textContent = JSON.stringify(parsed);
      setStatus(`✓ Minified`, false);
    } catch (e) {
      setStatus(`✗ ${e.message}`, true);
    }
  }

  formatBtn && formatBtn.addEventListener('click', formatJson);
  minifyBtn && minifyBtn.addEventListener('click', minifyJson);

  // Auto-format on paste
  inputArea.addEventListener('paste', () => setTimeout(formatJson, 50));

  copyBtn && copyBtn.addEventListener('click', () => {
    const text = outputArea.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setStatus('Copied!', false);
      setTimeout(() => setStatus(''), 1500);
    });
  });
});
