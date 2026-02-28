/**
 * Ollama Client — Unified API client for local Ollama instance
 * Used by all extensions for AI features
 */
class OllamaClient {
  constructor(baseUrl = "http://localhost:11434") {
    this.baseUrl = baseUrl;
    this.defaultModel = "qwen3:latest";
  }

  /**
   * Set the active model
   */
  setModel(modelName) {
    this.defaultModel = modelName;
  }

  /**
   * Get the active model name
   */
  getModel() {
    return this.defaultModel;
  }

  /**
   * Check if Ollama is running
   */
  async isAvailable() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List available models
   */
  async listModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = await response.json();
      return data.models || [];
    } catch {
      return [];
    }
  }

  /**
   * Generate a completion (non-streaming)
   */
  async generate(prompt, options = {}) {
    const {
      model = this.defaultModel,
      system = "",
      temperature = 0.7,
      maxTokens = 1024,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt,
          system,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        text: data.response,
        model: data.model,
        totalDuration: data.total_duration,
      };
    } catch (error) {
      return {
        success: false,
        text: "",
        error: error.message,
      };
    }
  }

  /**
   * Generate a completion (streaming)
   */
  async *generateStream(prompt, options = {}) {
    const {
      model = this.defaultModel,
      system = "",
      temperature = 0.7,
      maxTokens = 1024,
    } = options;

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        system,
        stream: true,
        options: {
          temperature,
          num_predict: maxTokens,
        },
      }),
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((l) => l.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          if (data.response) {
            yield data.response;
          }
        } catch {}
      }
    }
  }

  /**
   * Chat completion
   */
  async chat(messages, options = {}) {
    const {
      model = this.defaultModel,
      temperature = 0.7,
      maxTokens = 1024,
    } = options;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages,
          stream: false,
          options: {
            temperature,
            num_predict: maxTokens,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      return {
        success: true,
        text: data.message?.content || "",
        model: data.model,
      };
    } catch (error) {
      return {
        success: false,
        text: "",
        error: error.message,
      };
    }
  }

  /**
   * Summarize text
   */
  async summarize(text, maxLength = 200) {
    return this.generate(
      `Summarize the following text in ${maxLength} characters or less. Return ONLY the summary, no extra text:\n\n${text}`,
      { temperature: 0.3 },
    );
  }

  /**
   * Categorize/tag content
   */
  async categorize(text, categories = []) {
    const catList =
      categories.length > 0
        ? `Choose from: ${categories.join(", ")}`
        : "Choose appropriate categories";

    return this.generate(
      `Categorize this content. ${catList}. Return ONLY comma-separated tags, nothing else:\n\n${text}`,
      { temperature: 0.2, maxTokens: 100 },
    );
  }

  /**
   * Analyze and generate insights
   */
  async analyzeInsights(data, context = "") {
    return this.generate(
      `Analyze this data and provide 3-5 actionable insights. Be concise and specific.\n\nContext: ${context}\n\nData:\n${JSON.stringify(data, null, 2)}`,
      { temperature: 0.5, maxTokens: 512 },
    );
  }
}

// Export for use in different contexts
if (typeof module !== "undefined" && module.exports) {
  module.exports = OllamaClient;
}
