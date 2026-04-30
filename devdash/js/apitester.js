document.addEventListener('DOMContentLoaded', () => {
  const methodSelect = document.getElementById('api-tester-method');
  const urlInput = document.getElementById('api-tester-url');
  const bodyInput = document.getElementById('api-tester-body');
  const sendBtn = document.getElementById('api-tester-send-btn');
  const output = document.getElementById('api-tester-output');
  const statusText = document.getElementById('api-tester-status');

  if (!methodSelect || !sendBtn) return;

  // Toggle body input based on method
  methodSelect.addEventListener('change', () => {
    if (methodSelect.value === 'GET' || methodSelect.value === 'DELETE') {
      bodyInput.style.display = 'none';
    } else {
      bodyInput.style.display = 'block';
    }
  });

  sendBtn.addEventListener('click', async () => {
    const url = urlInput.value.trim();
    if (!url) {
      output.textContent = 'Please enter a URL';
      return;
    }

    const method = methodSelect.value;
    let body = null;
    let headers = {};

    if (method === 'POST' || method === 'PUT') {
      const rawBody = bodyInput.value.trim();
      if (rawBody) {
        try {
          // Verify it's valid JSON if it looks like it
          if (rawBody.startsWith('{') || rawBody.startsWith('[')) {
            JSON.parse(rawBody);
            headers['Content-Type'] = 'application/json';
          }
          body = rawBody;
        } catch (e) {
          output.textContent = 'Invalid JSON body: ' + e.message;
          return;
        }
      }
    }

    sendBtn.disabled = true;
    sendBtn.textContent = '...';
    output.textContent = 'Loading...';
    statusText.textContent = '';

    const startTime = performance.now();

    try {
      const options = { method, headers };
      if (body) options.body = body;

      const response = await fetch(url, options);
      const endTime = performance.now();
      const timeMs = Math.round(endTime - startTime);

      statusText.textContent = `${response.status} ${response.statusText} (${timeMs}ms)`;
      statusText.style.color = response.ok ? '#4ade80' : '#f87171';

      const contentType = response.headers.get('content-type');
      let dataText;

      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        dataText = JSON.stringify(data, null, 2);
      } else {
        dataText = await response.text();
      }

      output.textContent = dataText;
    } catch (err) {
      statusText.textContent = 'Error';
      statusText.style.color = '#f87171';
      output.textContent = `Failed to fetch:\n${err.message}\n\nMake sure the URL is correct and the server supports CORS for browser extensions.`;
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send';
    }
  });

  // Handle Enter key in URL input
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendBtn.click();
    }
  });
});
