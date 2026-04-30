document.addEventListener('DOMContentLoaded', () => {
  const schemeInput = document.getElementById('intent-scheme');
  const hostInput = document.getElementById('intent-host');
  const pathInput = document.getElementById('intent-path');
  const pkgInput = document.getElementById('intent-package');
  const actionSelect = document.getElementById('intent-action');
  const output = document.getElementById('intent-output');
  const copyBtn = document.getElementById('intent-copy-btn');

  if (!schemeInput) return;

  function buildIntent() {
    const scheme = schemeInput.value.trim() || 'https';
    const host = hostInput.value.trim() || 'example.com';
    const path = pathInput.value.trim();
    const pkg = pkgInput.value.trim();
    const action = actionSelect.value;

    let uri = `intent://${host}`;
    if (path) uri += `/${path.replace(/^\//, '')}`;
    uri += `#Intent;scheme=${scheme}`;
    if (action) uri += `;action=${action}`;
    if (pkg) uri += `;package=${pkg}`;
    uri += ';end';

    output.textContent = uri;
  }

  [schemeInput, hostInput, pathInput, pkgInput, actionSelect].forEach(el => {
    el.addEventListener('input', buildIntent);
    el.addEventListener('change', buildIntent);
  });

  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(output.textContent);
    copyBtn.textContent = '✓';
    setTimeout(() => copyBtn.textContent = '📋', 1500);
  });

  buildIntent();
});
