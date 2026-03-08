importScripts('../shared/detach-utils.js', '../shared/ollama-client.js', '../shared/ai-client.js', 'service-worker.js');

// Initialize Detach Mode
if (typeof DetachUtils !== 'undefined') {
  DetachUtils.init();
}

// Initialize Shared Ollama Client Logic (legacy)
if (typeof registerOllamaHandler !== 'undefined') {
  registerOllamaHandler();
}

// Initialize Multi-Provider AI Fetch Handler
if (typeof registerAIFetchHandler !== 'undefined') {
  registerAIFetchHandler();
}
