
// Bypass Ollama CORS
if (chrome.declarativeNetRequest) {
  chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [11434],
    addRules: [{
      id: 11434,
      condition: { urlFilter: 'http://localhost:11434/*' },
      action: {
        type: 'modifyHeaders',
        requestHeaders: [{ header: 'origin', operation: 'set', value: 'http://localhost' }]
      }
    }]
  }).catch(e => console.error(e));
}

/**
 * PromptChain — Background Service Worker
 * Chain execution engine, storage, Ollama relay
 */

// ─── Default Chain Templates ───
const DEFAULT_CHAINS = [
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    icon: '🔍',
    description: 'Review code on any page — find bugs, suggest fixes, summarize',
    steps: [
      { id: 's1', name: 'Extract Code', prompt: 'Extract all code snippets from the following page content. Return ONLY the code, preserving language and formatting:\n\n{{page}}', model: 'auto' },
      { id: 's2', name: 'Analyze Bugs', prompt: 'Analyze the following code for bugs, security issues, and bad practices. List each issue with severity (critical/high/medium/low):\n\n{{previous}}', model: 'auto' },
      { id: 's3', name: 'Suggest Fixes', prompt: 'For each issue found below, suggest a concrete fix with corrected code:\n\n{{previous}}', model: 'auto' },
      { id: 's4', name: 'Summary', prompt: 'Create a concise code review summary with: total issues found, top 3 critical items, and an overall quality score (1-10):\n\n{{previous}}', model: 'auto' }
    ],
    isBuiltIn: true
  },
  {
    id: 'page-summarizer',
    name: 'Page Summarizer',
    icon: '📄',
    description: 'Summarize any page into key points and action items',
    steps: [
      { id: 's1', name: 'Extract Content', prompt: 'Extract the main content from this page, removing navigation, ads, and boilerplate. Return clean text:\n\n{{page}}', model: 'auto' },
      { id: 's2', name: 'Summarize', prompt: 'Summarize the following in 3-5 bullet points. Be specific and technical:\n\n{{previous}}', model: 'auto' },
      { id: 's3', name: 'Action Items', prompt: 'From this summary, generate 2-4 actionable next steps a developer should take:\n\n{{previous}}', model: 'auto' }
    ],
    isBuiltIn: true
  },
  {
    id: 'bug-analyzer',
    name: 'Bug Analyzer',
    icon: '🐛',
    description: 'Analyze error messages and Stack Overflow pages for solutions',
    steps: [
      { id: 's1', name: 'Extract Error', prompt: 'Extract the error message, stack trace, or bug description from this page:\n\n{{page}}', model: 'auto' },
      { id: 's2', name: 'Root Cause', prompt: 'Analyze this error and identify the most likely root cause. Explain WHY it happens:\n\n{{previous}}', model: 'auto' },
      { id: 's3', name: 'Fix Suggestions', prompt: 'Provide 3 concrete fix options for this issue, ordered by likelihood of success. Include code examples:\n\n{{previous}}', model: 'auto' },
      { id: 's4', name: 'Test Plan', prompt: 'Create a brief test plan to verify the fix works and prevent regression:\n\n{{previous}}', model: 'auto' }
    ],
    isBuiltIn: true
  },
  {
    id: 'api-doc-gen',
    name: 'API Doc Generator',
    icon: '📡',
    description: 'Generate API documentation from any API reference page',
    steps: [
      { id: 's1', name: 'Extract Endpoints', prompt: 'Extract all API endpoints from this page. List method, path, and description for each:\n\n{{page}}', model: 'auto' },
      { id: 's2', name: 'Document Each', prompt: 'For each API endpoint below, generate detailed documentation including: parameters, request/response examples, and common errors:\n\n{{previous}}', model: 'auto' },
      { id: 's3', name: 'Generate Markdown', prompt: 'Format the following API documentation as clean Markdown with proper headers, code blocks, and tables:\n\n{{previous}}', model: 'auto' }
    ],
    isBuiltIn: true
  },
  {
    id: 'content-rewriter',
    name: 'Content Rewriter',
    icon: '✍️',
    description: 'Rewrite page content for different audiences or purposes',
    steps: [
      { id: 's1', name: 'Analyze Tone', prompt: 'Analyze the writing style and tone of this content. Identify the target audience and key message:\n\n{{page}}', model: 'auto' },
      { id: 's2', name: 'Rewrite', prompt: 'Rewrite the original content to be more concise, technical, and developer-friendly. Keep the core message but improve clarity:\n\nOriginal analysis: {{previous}}\n\nOriginal content: {{page}}', model: 'auto' },
      { id: 's3', name: 'SEO Keywords', prompt: 'From the rewritten content below, suggest 5-8 SEO keywords and a compelling meta description (under 160 chars):\n\n{{previous}}', model: 'auto' }
    ],
    isBuiltIn: true
  }
];

// ─── Initialization ───
chrome.runtime.onInstalled.addListener(async () => {
  const { chains } = await chrome.storage.local.get('chains');
  if (!chains) {
    await chrome.storage.local.set({
      chains: DEFAULT_CHAINS,
      chatHistory: [],
      executionHistory: [],
      settings: { defaultModel: 'llama3.2', temperature: 0.7, maxTokens: 1024 }
    });
  }
  console.log('[PromptChain] Installed with', DEFAULT_CHAINS.length, 'built-in chains');
});

// ─── Message Handler ───
chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg.action === 'getChains') handleGetChains(send);
  else if (msg.action === 'saveChain') handleSaveChain(msg.chain, send);
  else if (msg.action === 'deleteChain') handleDeleteChain(msg.chainId, send);
  else if (msg.action === 'executeChain') handleExecuteChain(msg.chainId, msg.context, send);
  else if (msg.action === 'executeStep') handleExecuteStep(msg.step, msg.context, send);
  else if (msg.action === 'chatMessage') handleChatMessage(msg.message, msg.context, msg.history, send);
  else if (msg.action === 'getChatHistory') handleGetChatHistory(send);
  else if (msg.action === 'clearChatHistory') handleClearChatHistory(send);
  else if (msg.action === 'getExecutionHistory') handleGetExecutionHistory(send);
  else if (msg.action === 'getPageContent') handleGetPageContent(send);
  else if (msg.action === 'getSettings') handleGetSettings(send);
  else if (msg.action === 'updateSettings') handleUpdateSettings(msg.settings, send);
  else if (msg.action === 'ollamaFetch') {
    const { url, options = {} } = msg;
    if (!url || !url.startsWith('http://localhost:11434')) {
      send({ ok: false, error: 'Disallowed URL', data: null });
    } else {
      fetch(url, {
        method: options.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        body: options.body || undefined,
      })
        .then(async (res) => {
          let data = null;
          try { data = await res.json(); } catch (_) {}
          send({ ok: res.ok, status: res.status, data });
        })
        .catch((err) => send({ ok: false, error: err.message, data: null }));
    }
  } else {
    return false;
  }
  return true;
});

// ─── Chain CRUD ───
async function handleGetChains(send) {
  const { chains = [] } = await chrome.storage.local.get('chains');
  send({ success: true, chains });
}

async function handleSaveChain(chain, send) {
  const { chains = [] } = await chrome.storage.local.get('chains');
  if (!chain.id) chain.id = 'chain_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  chain.updatedAt = Date.now();
  const idx = chains.findIndex(c => c.id === chain.id);
  if (idx >= 0) chains[idx] = { ...chains[idx], ...chain };
  else chains.push(chain);
  await chrome.storage.local.set({ chains });
  send({ success: true, chain });
}

async function handleDeleteChain(chainId, send) {
  const { chains = [] } = await chrome.storage.local.get('chains');
  const chain = chains.find(c => c.id === chainId);
  if (chain?.isBuiltIn) { send({ success: false, error: 'Cannot delete built-in chain' }); return; }
  await chrome.storage.local.set({ chains: chains.filter(c => c.id !== chainId) });
  send({ success: true });
}

// ─── Chain Execution Engine ───
async function handleExecuteChain(chainId, context, send) {
  const { chains = [], settings = {} } = await chrome.storage.local.get(['chains', 'settings']);
  const chain = chains.find(c => c.id === chainId);
  if (!chain) { send({ success: false, error: 'Chain not found' }); return; }

  const results = [];
  let previousOutput = '';
  const startTime = Date.now();

  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    const prompt = substituteVariables(step.prompt, { ...context, previous: previousOutput });
    const model = step.model === 'auto' ? (settings.defaultModel || 'llama3.2') : step.model;

    try {
      const response = await ollamaGenerate(prompt, {
        model,
        temperature: settings.temperature || 0.7,
        maxTokens: settings.maxTokens || 1024
      });

      if (response.ok && response.data?.response) {
        previousOutput = response.data.response;
        results.push({
          stepId: step.id,
          stepName: step.name,
          status: 'success',
          output: previousOutput,
          model: response.data.model,
          duration: response.data.total_duration
        });
      } else {
        results.push({
          stepId: step.id,
          stepName: step.name,
          status: 'error',
          error: response.error || 'Failed to generate',
          output: ''
        });
        break; // Stop chain on error
      }
    } catch (err) {
      results.push({
        stepId: step.id,
        stepName: step.name,
        status: 'error',
        error: err.message,
        output: ''
      });
      break;
    }
  }

  // Save to execution history
  const execution = {
    id: 'exec_' + Date.now().toString(36),
    chainId: chain.id,
    chainName: chain.name,
    results,
    startTime,
    endTime: Date.now(),
    success: results.every(r => r.status === 'success'),
    pageUrl: context.url || ''
  };

  const { executionHistory = [] } = await chrome.storage.local.get('executionHistory');
  executionHistory.unshift(execution);
  if (executionHistory.length > 50) executionHistory.splice(50);
  await chrome.storage.local.set({ executionHistory });

  send({ success: true, results, execution });
}

async function handleExecuteStep(step, context, send) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const prompt = substituteVariables(step.prompt, context);
  const model = step.model === 'auto' ? (settings.defaultModel || 'llama3.2') : step.model;

  try {
    const response = await ollamaGenerate(prompt, {
      model,
      temperature: settings.temperature || 0.7,
      maxTokens: settings.maxTokens || 1024
    });

    if (response.ok && response.data?.response) {
      send({ success: true, output: response.data.response, model: response.data.model });
    } else {
      send({ success: false, error: response.error || 'Generation failed' });
    }
  } catch (err) {
    send({ success: false, error: err.message });
  }
}

// ─── Variable Substitution ───
function substituteVariables(template, context) {
  return template
    .replace(/\{\{page\}\}/g, context.page || '(no page content)')
    .replace(/\{\{selection\}\}/g, context.selection || '')
    .replace(/\{\{url\}\}/g, context.url || '')
    .replace(/\{\{title\}\}/g, context.title || '')
    .replace(/\{\{previous\}\}/g, context.previous || '');
}

// ─── Direct Ollama Call (from SW context) ───
async function ollamaGenerate(prompt, options = {}) {
  const { model = 'llama3.2', temperature = 0.7, maxTokens = 1024 } = options;
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { temperature, num_predict: maxTokens }
      })
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, error: err.message, data: null };
  }
}

// ─── Chat ───
async function handleChatMessage(message, context, history, send) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const model = settings.defaultModel || 'llama3.2';

  // Build messages array for chat
  const systemPrompt = context.page
    ? `You are a helpful AI assistant. The user is browsing: ${context.url || 'a web page'}.\n\nPage content (first 3000 chars):\n${(context.page || '').slice(0, 3000)}\n\nAnswer questions using this context when relevant.`
    : 'You are a helpful AI assistant.';

  const messages = [
    { role: 'system', content: systemPrompt },
    ...(history || []).slice(-10),
    { role: 'user', content: message }
  ];

  try {
    const res = await fetch('http://localhost:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: { temperature: settings.temperature || 0.7, num_predict: settings.maxTokens || 1024 }
      })
    });
    let text = '';
    let data = null;
    try {
      text = await res.text();
      data = JSON.parse(text);
    } catch (e) {
      send({ success: false, error: `Invalid response from AI (Status: ${res.status}): ${text}` });
      return;
    }

    if (res.ok && data && data.message?.content) {
      // Save to chat history
      const { chatHistory = [] } = await chrome.storage.local.get('chatHistory');
      chatHistory.push({ role: 'user', content: message, timestamp: Date.now() });
      chatHistory.push({ role: 'assistant', content: data.message.content, timestamp: Date.now() });
      if (chatHistory.length > 100) chatHistory.splice(0, chatHistory.length - 100);
      await chrome.storage.local.set({ chatHistory });

      send({ success: true, text: data.message.content, model: data.model });
    } else {
      send({ success: false, error: data?.error || 'Chat failed' });
    }
  } catch (err) {
    send({ success: false, error: err.message });
  }
}

async function handleGetChatHistory(send) {
  const { chatHistory = [] } = await chrome.storage.local.get('chatHistory');
  send({ success: true, history: chatHistory });
}

async function handleClearChatHistory(send) {
  await chrome.storage.local.set({ chatHistory: [] });
  send({ success: true });
}

// ─── Execution History ───
async function handleGetExecutionHistory(send) {
  const { executionHistory = [] } = await chrome.storage.local.get('executionHistory');
  send({ success: true, history: executionHistory });
}

// ─── Page Content Extraction ───
async function handleGetPageContent(send) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id || tab.url?.startsWith('chrome://')) {
      send({ success: true, page: '', url: tab?.url || '', title: tab?.title || '', selection: '' });
      return;
    }
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({
        text: document.body?.innerText?.slice(0, 8000) || '',
        selection: window.getSelection()?.toString() || ''
      })
    });
    send({
      success: true,
      page: result?.result?.text || '',
      selection: result?.result?.selection || '',
      url: tab.url || '',
      title: tab.title || ''
    });
  } catch (err) {
    send({ success: true, page: '', url: '', title: '', selection: '', error: err.message });
  }
}

// ─── Settings ───
async function handleGetSettings(send) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  send({ success: true, settings });
}

async function handleUpdateSettings(newSettings, send) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, ...newSettings } });
  send({ success: true });
}
