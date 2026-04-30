document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('http-code-search');
  const tabBtns = document.querySelectorAll('.http-tab-btn');
  const listEl = document.getElementById('http-code-list');

  if (!searchInput || !listEl) return;

  const codes = [
    // 1xx Informational
    { code: 100, name: 'Continue', desc: 'Server received headers, client should send body.', cat: '1xx' },
    { code: 101, name: 'Switching Protocols', desc: 'Server switching to protocol requested by client (e.g. WebSocket).', cat: '1xx' },
    { code: 102, name: 'Processing', desc: 'Server has received the request but has not yet completed it.', cat: '1xx' },

    // 2xx Success
    { code: 200, name: 'OK', desc: 'Standard success response. Use for GET, PUT, PATCH, DELETE.', cat: '2xx' },
    { code: 201, name: 'Created', desc: 'Resource successfully created. Use after POST that creates a resource.', cat: '2xx' },
    { code: 202, name: 'Accepted', desc: 'Request accepted for async processing. Result not yet available.', cat: '2xx' },
    { code: 204, name: 'No Content', desc: 'Success with no body. Common for DELETE responses.', cat: '2xx' },
    { code: 206, name: 'Partial Content', desc: 'Range request fulfilled. Used for resumable downloads.', cat: '2xx' },

    // 3xx Redirection
    { code: 301, name: 'Moved Permanently', desc: 'Resource permanently moved. Update bookmarks/links.', cat: '3xx' },
    { code: 302, name: 'Found', desc: 'Temporary redirect. Client should use original URL next time.', cat: '3xx' },
    { code: 304, name: 'Not Modified', desc: 'Cached version is still fresh. Saves bandwidth (ETag/If-Modified-Since).', cat: '3xx' },
    { code: 307, name: 'Temporary Redirect', desc: 'Like 302 but preserves the HTTP method. Safer redirect.', cat: '3xx' },
    { code: 308, name: 'Permanent Redirect', desc: 'Like 301 but preserves the HTTP method.', cat: '3xx' },

    // 4xx Client Error
    { code: 400, name: 'Bad Request', desc: 'Malformed syntax, invalid request. Check your payload format.', cat: '4xx' },
    { code: 401, name: 'Unauthorized', desc: 'Authentication required. "Who are you?" — send a valid token.', cat: '4xx' },
    { code: 403, name: 'Forbidden', desc: 'Authenticated but no permission. "I know you, but no."', cat: '4xx' },
    { code: 404, name: 'Not Found', desc: 'Resource does not exist at this URL.', cat: '4xx' },
    { code: 405, name: 'Method Not Allowed', desc: 'HTTP method not supported on this endpoint (e.g. POST on a GET-only).', cat: '4xx' },
    { code: 408, name: 'Request Timeout', desc: 'Server timed out waiting for the request. Client was too slow.', cat: '4xx' },
    { code: 409, name: 'Conflict', desc: 'Request conflicts with current state (e.g. duplicate resource, version mismatch).', cat: '4xx' },
    { code: 410, name: 'Gone', desc: 'Resource permanently deleted. Unlike 404, it existed before.', cat: '4xx' },
    { code: 413, name: 'Payload Too Large', desc: 'Request body exceeds server limit. Compress or paginate.', cat: '4xx' },
    { code: 415, name: 'Unsupported Media Type', desc: 'Content-Type header not supported. Check your Accept/Content-Type.', cat: '4xx' },
    { code: 422, name: 'Unprocessable Entity', desc: 'Syntax OK but semantically invalid. Use for validation errors.', cat: '4xx' },
    { code: 429, name: 'Too Many Requests', desc: 'Rate limited. Slow down and check Retry-After header.', cat: '4xx' },

    // 5xx Server Error
    { code: 500, name: 'Internal Server Error', desc: 'Generic server crash. Check server logs for the root cause.', cat: '5xx' },
    { code: 502, name: 'Bad Gateway', desc: 'Upstream server sent an invalid response. Proxy/LB issue.', cat: '5xx' },
    { code: 503, name: 'Service Unavailable', desc: 'Server overloaded or in maintenance. Retry later.', cat: '5xx' },
    { code: 504, name: 'Gateway Timeout', desc: 'Upstream server did not respond in time. Backend is too slow.', cat: '5xx' }
  ];

  let activeTab = 'all';

  function renderCodes() {
    const query = searchInput.value.trim().toLowerCase();
    const filtered = codes.filter(c => {
      const matchTab = activeTab === 'all' || c.cat === activeTab;
      const matchSearch = !query ||
        c.code.toString().includes(query) ||
        c.name.toLowerCase().includes(query) ||
        c.desc.toLowerCase().includes(query);
      return matchTab && matchSearch;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:1rem;">No matching codes found.</div>';
      return;
    }

    listEl.innerHTML = filtered.map(c => {
      const catColor = {
        '1xx': '#a78bfa', '2xx': '#4ade80', '3xx': '#60a5fa',
        '4xx': '#fbbf24', '5xx': '#f87171'
      }[c.cat];

      return `
        <div class="http-code-item">
          <span class="http-code-badge" style="background:${catColor}20;color:${catColor};border:1px solid ${catColor}40">${c.code}</span>
          <div class="http-code-info">
            <span class="http-code-name">${c.name}</span>
            <span class="http-code-desc">${c.desc}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  searchInput.addEventListener('input', renderCodes);

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.cat;
      renderCodes();
    });
  });

  renderCodes();
});
