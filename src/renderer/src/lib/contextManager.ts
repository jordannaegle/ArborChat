// src/renderer/src/lib/contextManager.ts
// Token-aware context management for AI conversations
// Author: Alex Chen (Distinguished Software Architect)
// Phase 1: Coding Capability Improvements

/**
 * Simple token estimation (roughly 4 chars per token)
 * For production, consider using tiktoken or gpt-tokenizer
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

interface ContextBudget {
  maxTokens: number
  reservedForOutput: number
  reservedForTools: number
}

const MODEL_LIMITS: Record<string, ContextBudget> = {
  // Gemini models
  'gemini-2.0-flash': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-flash': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-flash-lite': { maxTokens: 1000000, reservedForOutput: 8192, reservedForTools: 50000 },
  'gemini-2.5-pro': { maxTokens: 2000000, reservedForOutput: 8192, reservedForTools: 100000 },
  // Anthropic models
  'claude-opus-4-5-20251101': { maxTokens: 200000, reservedForOutput: 8192, reservedForTools: 50000 },
  'claude-sonnet-4-5-20250929': { maxTokens: 200000, reservedForOutput: 8192, reservedForTools: 50000 },
  // OpenAI models
  'gpt-4-turbo': { maxTokens: 128000, reservedForOutput: 4096, reservedForTools: 30000 },
  'gpt-4o': { maxTokens: 128000, reservedForOutput: 4096, reservedForTools: 30000 },
  // Local/Ollama models (conservative defaults)
  'llama3': { maxTokens: 8192, reservedForOutput: 2048, reservedForTools: 2000 },
  'mistral': { maxTokens: 32000, reservedForOutput: 4096, reservedForTools: 8000 },
  'codellama': { maxTokens: 16000, reservedForOutput: 4096, reservedForTools: 4000 },
  // Default fallback
  'default': { maxTokens: 100000, reservedForOutput: 4096, reservedForTools: 20000 },
}

export interface Message {
  role: string
  content: string
}

/**
 * Build an optimized context that fits within the model's token limits
 */
export function buildOptimizedContext(
  messages: Message[],
  modelId: string
): Message[] {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools

  // Always keep the system prompt
  const systemPrompt = messages.find(m => m.role === 'system')
  const conversationMessages = messages.filter(m => m.role !== 'system')

  let currentTokens = systemPrompt ? estimateTokens(systemPrompt.content) : 0
  const result: Message[] = systemPrompt ? [systemPrompt] : []

  // Add messages from newest to oldest until we hit the budget
  const messagesToAdd: Message[] = []
  
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i]
    const msgTokens = estimateTokens(msg.content)

    if (currentTokens + msgTokens < availableTokens) {
      messagesToAdd.unshift(msg)
      currentTokens += msgTokens
    } else {
      // Try to truncate if it's a tool result
      if (msg.content.includes('<tool_result') || msg.content.includes('Tool execution result')) {
        const truncated = truncateToolResult(msg.content, availableTokens - currentTokens)
        if (truncated) {
          messagesToAdd.unshift({ ...msg, content: truncated })
        }
      }
      // Stop adding more messages
      console.log(`[ContextManager] Truncating context at message ${i}, used ${currentTokens} tokens`)
      break
    }
  }

  result.push(...messagesToAdd)
  
  console.log(`[ContextManager] Built context with ${result.length} messages, ~${currentTokens} tokens`)
  return result
}

/**
 * Truncate a tool result to fit within a token budget
 */
function truncateToolResult(content: string, maxTokens: number): string | null {
  const maxChars = maxTokens * 4 // Rough estimate
  
  if (content.length <= maxChars) {
    return content
  }

  if (maxChars < 200) {
    return null // Not enough space for meaningful truncation
  }

  // Keep the first part and add truncation notice
  const truncated = content.substring(0, maxChars - 100)
  return `${truncated}\n\n[... content truncated to fit context window ...]`
}

/**
 * Get the context budget for a specific model
 */
export function getContextBudget(modelId: string): ContextBudget {
  return MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
}

/**
 * Check if context is approaching the limit
 */
export function isContextNearLimit(
  messages: Message[],
  modelId: string,
  threshold: number = 0.9
): boolean {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools
  
  const currentTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  )
  
  return currentTokens > availableTokens * threshold
}

/**
 * Get token usage statistics for current context
 */
export function getContextStats(
  messages: Message[],
  modelId: string
): {
  currentTokens: number
  availableTokens: number
  usagePercent: number
  messagesCount: number
} {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default']
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools
  
  const currentTokens = messages.reduce(
    (sum, msg) => sum + estimateTokens(msg.content),
    0
  )
  
  return {
    currentTokens,
    availableTokens,
    usagePercent: (currentTokens / availableTokens) * 100,
    messagesCount: messages.length
  }
}

/**
 * Estimate tokens for a single string
 */
export function estimateTokenCount(text: string): number {
  return estimateTokens(text)
}

/**
 * Format large outputs with smart truncation
 * Preserves beginning and end for context, truncates middle
 */
export function smartTruncate(
  content: string,
  maxTokens: number = 2500
): string {
  const currentTokens = estimateTokens(content)
  
  if (currentTokens <= maxTokens) {
    return content
  }
  
  const maxChars = maxTokens * 4
  const keepStart = Math.floor(maxChars * 0.6)  // 60% from start
  const keepEnd = Math.floor(maxChars * 0.3)    // 30% from end
  
  const start = content.substring(0, keepStart)
  const end = content.substring(content.length - keepEnd)
  
  return `${start}\n\n[... ${currentTokens - maxTokens} tokens truncated ...]\n\n${end}`
}
