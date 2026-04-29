// JWT Decoder Widget — fully local, no network
document.addEventListener('DOMContentLoaded', () => {
  const jwtInput = document.getElementById('jwt-input');
  const headerOut = document.getElementById('jwt-header-out');
  const payloadOut = document.getElementById('jwt-payload-out');
  const expiryEl = document.getElementById('jwt-expiry');
  const clearBtn = document.getElementById('jwt-clear-btn');

  if (!jwtInput) return;

  function decodeJwt(token) {
    const parts = token.split('.');
    if (parts.length !== 3) {
      if (headerOut) headerOut.textContent = 'Invalid JWT (must have 3 parts)';
      if (payloadOut) payloadOut.textContent = '';
      if (expiryEl) expiryEl.textContent = '';
      return;
    }
    try {
      const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

      if (headerOut) headerOut.textContent = JSON.stringify(header, null, 2);
      if (payloadOut) payloadOut.textContent = JSON.stringify(payload, null, 2);

      if (expiryEl && payload.exp) {
        const expDate = new Date(payload.exp * 1000);
        const now = new Date();
        const expired = expDate < now;
        expiryEl.textContent = expired
          ? `⚠️ Expired: ${expDate.toLocaleString()}`
          : `✓ Expires: ${expDate.toLocaleString()}`;
        expiryEl.style.color = expired ? '#ff6b6b' : '#00e676';
      } else if (expiryEl) {
        expiryEl.textContent = 'No expiry (exp) claim found';
        expiryEl.style.color = '#888';
      }
    } catch (e) {
      if (headerOut) headerOut.textContent = `Decode error: ${e.message}`;
      if (payloadOut) payloadOut.textContent = '';
    }
  }

  jwtInput.addEventListener('input', () => {
    const val = jwtInput.value.trim();
    if (val) decodeJwt(val);
    else {
      if (headerOut) headerOut.textContent = '';
      if (payloadOut) payloadOut.textContent = '';
      if (expiryEl) expiryEl.textContent = '';
    }
  });

  clearBtn && clearBtn.addEventListener('click', () => {
    jwtInput.value = '';
    if (headerOut) headerOut.textContent = '';
    if (payloadOut) payloadOut.textContent = '';
    if (expiryEl) expiryEl.textContent = '';
  });
});
