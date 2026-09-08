/**
 * Ollama Bridge — Local LLM Integration for Myca Hybrid Architecture
 * Routes to Ollama HTTP API (localhost:11434) for free-text generation.
 * Falls back gracefully to SpectralSLM if Ollama is unavailable.
 * 
 * Part of the "Spectral Brain + Local LLM Voice" hybrid engine.
 */

const OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen2.5:3b';
const TIMEOUT_MS = 30000;

const SYSTEM_PROMPT = `Sen Myca Otonom Endüstriyel Ajan'sın. Tamamen çevrimdışı çalışıyorsun.
Kuralların:
1. Her zaman Türkçe yanıt ver (kullanıcı İngilizce yazarsa bile Türkçe).
2. Kısa, net ve doğru yanıtlar ver. Gereksiz uzatma yapma.
3. Emin olmadığın bilgileri uydurma. "Bu konuda kesin bilgim yok" de.
4. Matematik soruları için hesap yap, tahmin etme.
5. Endüstriyel otomasyon, DePIN, IoT konularında uzmansın.
6. Saygılı ve profesyonel ol.`;

export class OllamaBridge {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || OLLAMA_BASE;
    this.model = options.model || DEFAULT_MODEL;
    this.timeoutMs = options.timeoutMs || TIMEOUT_MS;
    this.systemPrompt = options.systemPrompt || SYSTEM_PROMPT;
    this._available = null; // cached availability check
    this._lastCheck = 0;
  }

  /**
   * Check if Ollama is reachable and has the required model
   */
  async isAvailable() {
    const now = Date.now();
    // Cache check for 30 seconds
    if (this._available !== null && (now - this._lastCheck) < 30000) {
      return this._available;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      
      const resp = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        this._available = false;
        this._lastCheck = now;
        return false;
      }

      const data = await resp.json();
      const models = data.models || [];
      const hasModel = models.some(m => 
        m.name === this.model || 
        m.name.startsWith(this.model + ':') ||
        m.name === this.model + ':latest'
      );

      this._available = hasModel;
      this._lastCheck = now;
      return hasModel;
    } catch (e) {
      this._available = false;
      this._lastCheck = now;
      return false;
    }
  }

  /**
   * Generate a response from the local Ollama model
   * @param {string} prompt - User input
   * @param {object} options - Generation options
   * @returns {Promise<{text: string, model: string, totalDuration: number, tokensPerSec: number}>}
   */
  async generate(prompt, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = {
        model: this.model,
        prompt: prompt,
        system: this.systemPrompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2,
          repeat_penalty: 1.3,
          top_k: 40,
          top_p: 0.9,
          num_predict: options.maxTokens ?? 256,
          stop: ['\n\n\n', '```', '<|', 'User:', 'Human:']
        }
      };

      // If memory context is provided, prepend it to the system prompt
      if (options.memoryContext) {
        body.system = `${this.systemPrompt}\n\nHafızamdaki ilgili bilgi:\n${options.memoryContext}`;
      }

      const resp = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Ollama HTTP ${resp.status}: ${errText}`);
      }

      const data = await resp.json();

      // Calculate tokens per second
      const totalDurationSec = (data.total_duration || 0) / 1e9;
      const evalCount = data.eval_count || 0;
      const tokensPerSec = totalDurationSec > 0 ? evalCount / totalDurationSec : 0;

      return {
        text: (data.response || '').trim(),
        model: data.model || this.model,
        totalDuration: totalDurationSec,
        tokensPerSec: Math.round(tokensPerSec * 10) / 10,
        evalCount,
        promptEvalCount: data.prompt_eval_count || 0,
        source: 'ollama'
      };
    } catch (e) {
      clearTimeout(timeout);
      
      if (e.name === 'AbortError') {
        throw new Error(`Ollama timeout after ${this.timeoutMs}ms`);
      }
      throw e;
    }
  }

  /**
   * Chat completion format (multi-turn conversation)
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} options
   */
  async chat(messages, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: this.systemPrompt },
          ...messages
        ],
        stream: false,
        options: {
          temperature: options.temperature ?? 0.2,
          repeat_penalty: 1.3,
          top_k: 40,
          top_p: 0.9,
          num_predict: options.maxTokens ?? 256,
          stop: ['\n\n\n', '```', '<|', 'User:', 'Human:']
        }
      };

      const resp = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Ollama chat HTTP ${resp.status}: ${errText}`);
      }

      const data = await resp.json();
      const totalDurationSec = (data.total_duration || 0) / 1e9;
      const evalCount = data.eval_count || 0;
      const tokensPerSec = totalDurationSec > 0 ? evalCount / totalDurationSec : 0;

      return {
        text: (data.message?.content || '').trim(),
        model: data.model || this.model,
        totalDuration: totalDurationSec,
        tokensPerSec: Math.round(tokensPerSec * 10) / 10,
        evalCount,
        source: 'ollama'
      };
    } catch (e) {
      clearTimeout(timeout);
      if (e.name === 'AbortError') {
        throw new Error(`Ollama chat timeout after ${this.timeoutMs}ms`);
      }
      throw e;
    }
  }

  /**
   * Invalidate availability cache (e.g., after pulling a new model)
   */
  invalidateCache() {
    this._available = null;
    this._lastCheck = 0;
  }
}
