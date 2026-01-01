// src/renderer/src/lib/tokenizerService.ts
// Phase 4: Token Tracking - Accurate Token Counting Service
// Author: Alex Chen (Distinguished Software Architect)
//
// Uses js-tiktoken for accurate BPE-based token counting.
// Supports multiple encoding schemes for different AI providers.

import { encodingForModel, type TiktokenModel, type Tiktoken, getEncoding, type TiktokenEncoding } from 'js-tiktoken'

/**
 * Token count result with metadata
 */
export interface TokenCountResult {
  /** Total token count */
  count: number
  /** Encoding used */
  encoding: string
  /** Whether an approximation was used (if exact encoding unavailable) */
  isApproximate: boolean
}

/**
 * Message structure for token counting
 */
export interface MessageForCounting {
  role: string
  content: string
}

/**
 * Context overflow analysis result
 */
export interface ContextOverflowAnalysis {
  /** Total tokens in context */
  totalTokens: number
  /** Maximum allowed tokens */
  maxTokens: number
  /** Usage percentage (0-100) */
  usagePercent: number
  /** Whether truncation is needed */
  needsTruncation: boolean
  /** Tokens over the limit */
  tokensOverLimit: number
  /** Recommended messages to truncate (indices) */
  messagesToTruncate: number[]
  /** Estimated tokens after truncation */
  estimatedAfterTruncation: number
  /** Warning level */
  warningLevel: 'normal' | 'warning' | 'critical' | 'overflow'
}

/**
 * Model to tiktoken encoding mapping
 * 
 * Different models use different tokenization schemes:
 * - cl100k_base: Used by GPT-4, Claude (approximation)
 * - o200k_base: Used by GPT-4o series
 * - p50k_base: Legacy GPT-3 models
 */
const MODEL_ENCODINGS: Record<string, TiktokenEncoding | TiktokenModel> = {
  // OpenAI GPT-4o series (uses o200k_base)
  'gpt-4o': 'gpt-4o' as TiktokenModel,
  'gpt-4o-mini': 'gpt-4o-mini' as TiktokenModel,
  
  // OpenAI GPT-4 series (uses cl100k_base)
  'gpt-4': 'gpt-4' as TiktokenModel,
  'gpt-4-turbo': 'gpt-4-turbo' as TiktokenModel,
  'gpt-4-turbo-preview': 'gpt-4-turbo' as TiktokenModel,
  
  // Anthropic Claude (approximated with cl100k_base - similar tokenization)
  'claude-sonnet-4-20250514': 'cl100k_base' as TiktokenEncoding,
  'claude-3-5-sonnet-20241022': 'cl100k_base' as TiktokenEncoding,
  'claude-3-opus-20240229': 'cl100k_base' as TiktokenEncoding,
  'claude-3-haiku-20240307': 'cl100k_base' as TiktokenEncoding,
  
  // Google Gemini (approximated with cl100k_base)
  'gemini-2.5-pro-preview-05-06': 'cl100k_base' as TiktokenEncoding,
  'gemini-2.5-flash-preview-05-20': 'cl100k_base' as TiktokenEncoding,
  'gemini-2.0-flash': 'cl100k_base' as TiktokenEncoding,
  'gemini-1.5-pro': 'cl100k_base' as TiktokenEncoding,
  'gemini-1.5-flash': 'cl100k_base' as TiktokenEncoding,
  
  // DeepSeek (approximated with cl100k_base)
  'deepseek-r1': 'cl100k_base' as TiktokenEncoding,
  'deepseek-chat': 'cl100k_base' as TiktokenEncoding,
  
  // Mistral (approximated with cl100k_base)
  'mistral-large-latest': 'cl100k_base' as TiktokenEncoding,
  'mistral-medium-latest': 'cl100k_base' as TiktokenEncoding,
  'mistral-small-latest': 'cl100k_base' as TiktokenEncoding,
  
  // Ollama local models (use cl100k_base as general approximation)
  'llama3.2': 'cl100k_base' as TiktokenEncoding,
  'llama3.1': 'cl100k_base' as TiktokenEncoding,
  'llama3': 'cl100k_base' as TiktokenEncoding,
  'codellama': 'cl100k_base' as TiktokenEncoding,
  'mixtral': 'cl100k_base' as TiktokenEncoding,
  'qwen2.5': 'cl100k_base' as TiktokenEncoding,
}

/**
 * Models that should use the encodingForModel function
 * (These are exact tiktoken models)
 */
const TIKTOKEN_MODELS = new Set([
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4',
  'gpt-4-turbo',
  'gpt-4-turbo-preview'
])

/**
 * Overhead tokens per message (role, delimiters, etc.)
 * This accounts for message structure tokens added by most APIs:
 * <|start_header_id|>role<|end_header_id|>content<|eot_id|>
 */
const MESSAGE_OVERHEAD_TOKENS = 4

/**
 * TokenizerService - Singleton service for accurate token counting
 * 
 * Provides:
 * - Model-specific tokenization
 * - Message array token counting with overhead
 * - Context overflow analysis
 * - Truncation recommendations
 */
class TokenizerServiceImpl {
  /** Cache of encoders by encoding name */
  private encoderCache: Map<string, Tiktoken> = new Map()
  
  /** Default encoding for unknown models */
  private defaultEncoding: TiktokenEncoding = 'cl100k_base'
  
  /**
   * Get or create encoder for a model
   */
  private getEncoderForModel(modelId: string): { encoder: Tiktoken; isApproximate: boolean; encodingName: string } {
    const encodingSpec = MODEL_ENCODINGS[modelId]
    
    // Check if it's a tiktoken model name (exact encoding)
    if (encodingSpec && TIKTOKEN_MODELS.has(modelId)) {
      const cacheKey = modelId
      if (!this.encoderCache.has(cacheKey)) {
        try {
          const encoder = encodingForModel(encodingSpec as TiktokenModel)
          this.encoderCache.set(cacheKey, encoder)
        } catch {
          // Fall back to cl100k_base if model not found
          console.warn(`[TokenizerService] Model encoding not found for ${modelId}, using cl100k_base`)
          return this.getEncoderByEncoding(this.defaultEncoding)
        }
      }
      return {
        encoder: this.encoderCache.get(cacheKey)!,
        isApproximate: false,
        encodingName: modelId
      }
    }
    
    // Use specified encoding or default
    const encoding = (encodingSpec as TiktokenEncoding) || this.defaultEncoding
    return this.getEncoderByEncoding(encoding)
  }
  
  /**
   * Get or create encoder by encoding name
   */
  private getEncoderByEncoding(encoding: TiktokenEncoding): { encoder: Tiktoken; isApproximate: boolean; encodingName: string } {
    if (!this.encoderCache.has(encoding)) {
      try {
        const encoder = getEncoding(encoding)
        this.encoderCache.set(encoding, encoder)
      } catch (error) {
        console.error(`[TokenizerService] Failed to get encoding ${encoding}:`, error)
        // Last resort: use cl100k_base
        if (encoding !== 'cl100k_base') {
          return this.getEncoderByEncoding('cl100k_base')
        }
        throw error
      }
    }
    return {
      encoder: this.encoderCache.get(encoding)!,
      isApproximate: true,
      encodingName: encoding
    }
  }
  
  /**
   * Count tokens in a string for a specific model
   */
  countTokens(text: string, modelId: string): TokenCountResult {
    if (!text) {
      return { count: 0, encoding: 'none', isApproximate: false }
    }
    
    try {
      const { encoder, isApproximate, encodingName } = this.getEncoderForModel(modelId)
      const tokens = encoder.encode(text)
      
      return {
        count: tokens.length,
        encoding: encodingName,
        isApproximate
      }
    } catch (error) {
      console.error('[TokenizerService] Error counting tokens:', error)
      // Fallback to character-based estimation
      return {
        count: Math.ceil(text.length / 4),
        encoding: 'char-estimate',
        isApproximate: true
      }
    }
  }
  
  /**
   * Count tokens for an array of messages
   * Accounts for message structure overhead
   */
  countMessagesTokens(messages: MessageForCounting[], modelId: string): TokenCountResult {
    if (!messages.length) {
      return { count: 0, encoding: 'none', isApproximate: false }
    }
    
    let totalTokens = 0
    let encoding = ''
    let isApproximate = false
    
    for (const msg of messages) {
      const result = this.countTokens(msg.content, modelId)
      totalTokens += result.count + MESSAGE_OVERHEAD_TOKENS
      encoding = result.encoding
      isApproximate = isApproximate || result.isApproximate
    }
    
    // Add overhead for message array structure
    totalTokens += 3 // Start/end tokens
    
    return {
      count: totalTokens,
      encoding,
      isApproximate
    }
  }
  
  /**
   * Count tokens for individual messages (returns per-message counts)
   */
  countIndividualMessages(messages: MessageForCounting[], modelId: string): Array<{
    index: number
    role: string
    tokens: number
  }> {
    return messages.map((msg, index) => {
      const result = this.countTokens(msg.content, modelId)
      return {
        index,
        role: msg.role,
        tokens: result.count + MESSAGE_OVERHEAD_TOKENS
      }
    })
  }
  
  /**
   * Analyze context for overflow and provide recommendations
   * 
   * @param messages - Messages in context
   * @param modelId - Model ID for context limits
   * @param reserveTokens - Tokens to reserve for response (default 1000)
   * @returns Analysis with truncation recommendations
   */
  analyzeContextOverflow(
    messages: MessageForCounting[],
    modelId: string,
    maxTokens: number,
    reserveTokens: number = 1000
  ): ContextOverflowAnalysis {
    const effectiveMax = maxTokens - reserveTokens
    const individualCounts = this.countIndividualMessages(messages, modelId)
    const totalTokens = individualCounts.reduce((sum, m) => sum + m.tokens, 0) + 3
    
    const usagePercent = (totalTokens / maxTokens) * 100
    const tokensOverLimit = Math.max(0, totalTokens - effectiveMax)
    const needsTruncation = tokensOverLimit > 0
    
    // Determine warning level
    let warningLevel: ContextOverflowAnalysis['warningLevel']
    if (usagePercent >= 100) {
      warningLevel = 'overflow'
    } else if (usagePercent >= 90) {
      warningLevel = 'critical'
    } else if (usagePercent >= 70) {
      warningLevel = 'warning'
    } else {
      warningLevel = 'normal'
    }
    
    // Calculate which messages to truncate
    // Strategy: Preserve system prompt (index 0) and recent messages
    // Truncate from middle of conversation
    const messagesToTruncate: number[] = []
    let tokensToRemove = tokensOverLimit
    
    if (needsTruncation && messages.length > 2) {
      // Start from index 1 (after system prompt), work towards recent messages
      // but stop before the last 2 messages to preserve recent context
      const truncatableEnd = Math.max(1, messages.length - 2)
      
      for (let i = 1; i < truncatableEnd && tokensToRemove > 0; i++) {
        messagesToTruncate.push(i)
        tokensToRemove -= individualCounts[i].tokens
      }
    }
    
    const estimatedAfterTruncation = totalTokens - 
      messagesToTruncate.reduce((sum, idx) => sum + individualCounts[idx].tokens, 0)
    
    return {
      totalTokens,
      maxTokens,
      usagePercent,
      needsTruncation,
      tokensOverLimit,
      messagesToTruncate,
      estimatedAfterTruncation,
      warningLevel
    }
  }
  
  /**
   * Truncate messages to fit within context limit
   * Returns the truncated message array
   */
  truncateMessages(
    messages: MessageForCounting[],
    modelId: string,
    maxTokens: number,
    reserveTokens: number = 1000
  ): {
    messages: MessageForCounting[]
    truncatedCount: number
    notification: string | null
  } {
    const analysis = this.analyzeContextOverflow(messages, modelId, maxTokens, reserveTokens)
    
    if (!analysis.needsTruncation) {
      return { messages, truncatedCount: 0, notification: null }
    }
    
    // Create set of indices to remove
    const removeSet = new Set(analysis.messagesToTruncate)
    
    // Filter messages
    const truncatedMessages = messages.filter((_, index) => !removeSet.has(index))
    
    // Generate notification
    const notification = analysis.messagesToTruncate.length > 0
      ? `Context truncated: Removed ${analysis.messagesToTruncate.length} older messages to fit within ${Math.round(maxTokens / 1000)}k token limit. ` +
        `Context usage: ${analysis.usagePercent.toFixed(1)}% → ${((analysis.estimatedAfterTruncation / maxTokens) * 100).toFixed(1)}%`
      : null
    
    return {
      messages: truncatedMessages,
      truncatedCount: analysis.messagesToTruncate.length,
      notification
    }
  }
  
  /**
   * Get a quick estimate of tokens (faster but less accurate)
   * Uses character-based heuristic
   */
  quickEstimate(text: string): number {
    // Heuristic: ~4 characters per token for English text
    // Adjust for code (more tokens) vs prose (fewer tokens)
    const codePatterns = /[{}()\[\];:=<>]/g
    const codeMatches = text.match(codePatterns)?.length || 0
    
    // Code-heavy text uses more tokens
    const codeRatio = codeMatches / Math.max(text.length, 1)
    const charsPerToken = codeRatio > 0.05 ? 3.5 : 4
    
    return Math.ceil(text.length / charsPerToken)
  }
  
  /**
   * Format token count for display
   */
  formatTokenCount(count: number): string {
    if (count >= 1_000_000) {
      return `${(count / 1_000_000).toFixed(1)}M`
    } else if (count >= 1_000) {
      return `${(count / 1_000).toFixed(1)}k`
    }
    return count.toString()
  }
  
  /**
   * Clear encoder cache (for memory cleanup)
   */
  clearCache(): void {
    this.encoderCache.clear()
  }
}

// Export singleton instance
export const TokenizerService = new TokenizerServiceImpl()

// Export class for testing
export { TokenizerServiceImpl }

// Re-export types
export type { TiktokenEncoding, TiktokenModel }
