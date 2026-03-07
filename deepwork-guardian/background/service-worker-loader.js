importScripts('../shared/detach-utils.js', '../shared/ollama-client.js', 'service-worker.js');

// Initialize Detach Mode
if (typeof DetachUtils !== 'undefined') {
  DetachUtils.init();
}

// Initialize Shared Ollama Client Logic
if (typeof registerOllamaHandler !== 'undefined') {
  registerOllamaHandler();
}
