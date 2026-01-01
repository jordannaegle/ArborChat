/**
 * TokenizerService
 * 
 * Centralized token counting service with provider-specific tokenizers.
 * Uses js-tiktoken for accurate token counting across different AI models.
 * 
 * Design principles:
 * - Provider-aware tokenization (different models use different encodings)
 * - Cached tokenizer instances for performance
 * - Graceful fallback if tokenization fails
 * - Singleton pattern for efficiency
 * 
 * @module main/services/TokenizerService
 */

import { Tiktoken, getEncoding } from 'js-tiktoken';

// ============================================================================
// Types
// ============================================================================

export type TokenizerEncoding = 'cl100k_base' | 'o200k_base' | 'p50k_base';

export interface TokenCountResult {
  tokens: number;
  encoding: TokenizerEncoding;
  cached: boolean;
}

export interface TokenCountOptions {
  /** Override the encoding to use */
  encoding?: TokenizerEncoding;
  /** Model ID to determine encoding automatically */
  modelId?: string;
}

// ============================================================================
// Model-to-Encoding Mapping
// ============================================================================

/**
 * Maps model IDs to their tokenizer encodings.
 * 
 * Encoding reference:
 * - cl100k_base: GPT-4, GPT-3.5-turbo, Claude (approximate), text-embedding-ada-002
 * - o200k_base: GPT-4o, GPT-4o-mini (newer OpenAI models)
 * - p50k_base: Codex models, older GPT-3 models
 */
const MODEL_ENCODINGS: Record<string, TokenizerEncoding> = {
  // OpenAI models
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4-turbo-preview': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'text-embedding-ada-002': 'cl100k_base',
  
  // Anthropic models (cl100k_base is a reasonable approximation)
  // Note: Anthropic doesn't publish their exact tokenizer, but cl100k_base
  // provides a good approximation for context management purposes
  'claude-opus-4-5-20251101': 'cl100k_base',
  'claude-sonnet-4-5-20250929': 'cl100k_base',
  'claude-3-opus': 'cl100k_base',
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  
  // Gemini models (use cl100k_base as approximation)
  // Google also doesn't publish their exact tokenizer
  'gemini-2.0-flash': 'cl100k_base',
  'gemini-2.5-flash': 'cl100k_base',
  'gemini-2.5-flash-lite': 'cl100k_base',
  'gemini-2.5-pro': 'cl100k_base',
  'gemini-pro': 'cl100k_base',
  'gemini-1.5-pro': 'cl100k_base',
  'gemini-1.5-flash': 'cl100k_base',
  
  // Mistral models (cl100k_base approximation)
  'mistral-large': 'cl100k_base',
  'mistral-medium': 'cl100k_base',
  'mistral-small': 'cl100k_base',
  'mistral': 'cl100k_base',
  
  // Local models (cl100k_base is a reasonable default)
  'llama3': 'cl100k_base',
  'llama2': 'cl100k_base',
  'codellama': 'cl100k_base',
  
  // Default fallback
  'default': 'cl100k_base',
};

// ============================================================================
// TokenizerService Class
// ============================================================================

export class TokenizerService {
  private static instance: TokenizerService;
  private encodings: Map<TokenizerEncoding, Tiktoken> = new Map();
  private initialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenizerService {
    if (!TokenizerService.instance) {
      TokenizerService.instance = new TokenizerService();
    }
    return TokenizerService.instance;
  }

  /**
   * Initialize the service (lazy loads encodings on first use)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[Tokenizer] Initializing TokenizerService...');
    
    // Pre-load the most commonly used encoding
    try {
      await this.getOrCreateEncoding('cl100k_base');
      this.initialized = true;
      console.log('[Tokenizer] Initialized successfully');
    } catch (error) {
      console.error('[Tokenizer] Failed to initialize:', error);
      // Continue anyway - we'll use fallback estimation
    }
  }

  /**
   * Get or create a tokenizer for the specified encoding
   */
  private async getOrCreateEncoding(encoding: TokenizerEncoding): Promise<Tiktoken> {
    if (this.encodings.has(encoding)) {
      return this.encodings.get(encoding)!;
    }

    console.log(`[Tokenizer] Loading encoding: ${encoding}`);
    const tokenizer = getEncoding(encoding);
    this.encodings.set(encoding, tokenizer);
    return tokenizer;
  }

  /**
   * Get the appropriate encoding for a model ID
   */
  getEncodingForModel(modelId: string): TokenizerEncoding {
    // Check for exact match
    if (MODEL_ENCODINGS[modelId]) {
      return MODEL_ENCODINGS[modelId];
    }

    // Check for partial matches (e.g., 'gpt-4-0613' matches 'gpt-4')
    for (const [key, encoding] of Object.entries(MODEL_ENCODINGS)) {
      if (modelId.startsWith(key)) {
        return encoding;
      }
    }

    return MODEL_ENCODINGS['default'];
  }

  /**
   * Count tokens in text
   * 
   * @param text - Text to count tokens for
   * @param options - Optional model ID or encoding override
   * @returns Token count result with encoding info
   */
  async countTokens(text: string, options?: TokenCountOptions): Promise<TokenCountResult> {
    if (!text) {
      return { tokens: 0, encoding: 'cl100k_base', cached: true };
    }

    // Determine encoding
    const encoding = options?.encoding ?? 
      (options?.modelId ? this.getEncodingForModel(options.modelId) : 'cl100k_base');

    try {
      const tokenizer = await this.getOrCreateEncoding(encoding);
      const tokens = tokenizer.encode(text);
      
      return {
        tokens: tokens.length,
        encoding,
        cached: this.encodings.has(encoding),
      };
    } catch (error) {
      console.warn(`[Tokenizer] Error counting tokens, using fallback:`, error);
      return {
        tokens: this.fallbackEstimate(text),
        encoding,
        cached: false,
      };
    }
  }

  /**
   * Count tokens synchronously (uses cached tokenizer or fallback)
   * Prefer countTokens() for accuracy, use this for hot paths
   */
  countTokensSync(text: string, modelId?: string): number {
    if (!text) return 0;

    const encoding = modelId ? this.getEncodingForModel(modelId) : 'cl100k_base';
    
    if (this.encodings.has(encoding)) {
      try {
        const tokenizer = this.encodings.get(encoding)!;
        return tokenizer.encode(text).length;
      } catch {
        return this.fallbackEstimate(text);
      }
    }

    return this.fallbackEstimate(text);
  }

  /**
   * Fallback estimation when tokenizer is unavailable
   * Uses improved heuristics beyond simple length/4
   */
  private fallbackEstimate(text: string): number {
    if (!text) return 0;

    // Improved estimation:
    // - Average English word is ~4-5 characters
    // - Average token is ~4 characters for English prose
    // - Code and special characters tend to produce more tokens
    
    // Count different character types
    const codeChars = (text.match(/[{}[\]()<>:;,."'`=+\-*/%&|^~!?@#$\\]/g) || []).length;
    const newlines = (text.match(/\n/g) || []).length;
    
    // Base estimation from character count
    let tokens = Math.ceil(text.length / 4);
    
    // Adjust for code-heavy content (adds more tokens)
    if (codeChars > text.length * 0.1) {
      tokens = Math.ceil(tokens * 1.3);
    }
    
    // Each newline typically adds at least one token
    tokens += Math.ceil(newlines * 0.3);
    
    return tokens;
  }

  /**
   * Decode tokens back to text (useful for truncation)
   */
  async decodeTokens(tokens: number[], encoding?: TokenizerEncoding): Promise<string> {
    const enc = encoding ?? 'cl100k_base';
    const tokenizer = await this.getOrCreateEncoding(enc);
    return tokenizer.decode(tokens);
  }

  /**
   * Truncate text to fit within a token limit
   */
  async truncateToTokenLimit(
    text: string, 
    maxTokens: number, 
    options?: TokenCountOptions & { suffix?: string }
  ): Promise<string> {
    const encoding = options?.encoding ?? 
      (options?.modelId ? this.getEncodingForModel(options.modelId) : 'cl100k_base');
    
    try {
      const tokenizer = await this.getOrCreateEncoding(encoding);
      const tokens = tokenizer.encode(text);
      
      if (tokens.length <= maxTokens) {
        return text;
      }

      const suffix = options?.suffix ?? '\n\n[... truncated ...]';
      const suffixTokens = tokenizer.encode(suffix).length;
      const targetTokens = maxTokens - suffixTokens;
      
      if (targetTokens <= 0) {
        return suffix;
      }

      const truncatedTokens = tokens.slice(0, targetTokens);
      return tokenizer.decode(truncatedTokens) + suffix;
    } catch {
      // Fallback to character-based truncation
      const approxChars = maxTokens * 4;
      if (text.length <= approxChars) return text;
      return text.slice(0, approxChars - 20) + '\n\n[... truncated ...]';
    }
  }

  /**
   * Get statistics about tokenizer cache
   */
  getStats(): { loadedEncodings: string[]; initialized: boolean } {
    return {
      loadedEncodings: Array.from(this.encodings.keys()),
      initialized: this.initialized,
    };
  }

  /**
   * Clear cached tokenizers (for memory management)
   */
  clearCache(): void {
    this.encodings.clear();
    this.initialized = false;
  }
}

// Export singleton accessor
export const tokenizer = TokenizerService.getInstance();

// Export convenience functions for direct use
export async function countTokens(text: string, modelId?: string): Promise<number> {
  const result = await tokenizer.countTokens(text, { modelId });
  return result.tokens;
}

export function countTokensSync(text: string, modelId?: string): number {
  return tokenizer.countTokensSync(text, modelId);
}

export async function truncateToTokens(text: string, maxTokens: number, modelId?: string): Promise<string> {
  return tokenizer.truncateToTokenLimit(text, maxTokens, { modelId });
}
