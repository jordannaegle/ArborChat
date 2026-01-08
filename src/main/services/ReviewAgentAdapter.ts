/**
 * Review Agent AI Adapter
 * 
 * Bridges the ReviewAgentService to the Gemini AI provider.
 * Provides a simple interface for non-streaming completions.
 * 
 * @module main/services/ReviewAgentAdapter
 */

import { credentialManager } from '../credentials'
import { generateCompletion } from '../providers/gemini'


// ============================================================================
// AI Provider Interface (as expected by ReviewAgentService)
// ============================================================================

export interface AIProviderInterface {
  generateResponse(options: {
    model: string
    systemPrompt: string
    messages: Array<{ role: string; content: string }>
    temperature: number
    maxTokens: number
  }): Promise<string>
}


// ============================================================================
// Gemini Adapter Implementation
// ============================================================================

/**
 * Adapter that wraps Gemini for use by the ReviewAgentService
 */
export class GeminiReviewAdapter implements AIProviderInterface {
  /**
   * Generate a response using Gemini
   * Combines system prompt and messages into a single prompt
   */
  async generateResponse(options: {
    model: string
    systemPrompt: string
    messages: Array<{ role: string; content: string }>
    temperature: number
    maxTokens: number
  }): Promise<string> {
    // Get Gemini API key from credential manager
    const apiKey = await credentialManager.getApiKey('gemini')
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please set it in settings.')
    }

    // Build the complete prompt
    // System prompt goes first, then conversation history
    const parts: string[] = [options.systemPrompt]
    
    for (const msg of options.messages) {
      if (msg.role === 'user') {
        parts.push(`\n\n${msg.content}`)
      } else if (msg.role === 'assistant') {
        parts.push(`\n\nAssistant: ${msg.content}`)
      }
    }

    const fullPrompt = parts.join('')

    console.log('[ReviewAgentAdapter] Generating response with model:', options.model)
    console.log('[ReviewAgentAdapter] Prompt length:', fullPrompt.length)

    try {
      const response = await generateCompletion(apiKey, fullPrompt, {
        model: options.model,
        maxTokens: options.maxTokens,
        temperature: options.temperature
      })

      console.log('[ReviewAgentAdapter] Response received, length:', response.length)
      return response
    } catch (error) {
      console.error('[ReviewAgentAdapter] Error generating response:', error)
      throw error
    }
  }
}


// ============================================================================
// Singleton Factory
// ============================================================================

let adapterInstance: GeminiReviewAdapter | null = null

/**
 * Get the singleton adapter instance
 */
export function getReviewAgentAdapter(): GeminiReviewAdapter {
  if (!adapterInstance) {
    adapterInstance = new GeminiReviewAdapter()
  }
  return adapterInstance
}
