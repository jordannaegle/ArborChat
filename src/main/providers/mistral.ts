// src/main/providers/mistral.ts

import { Mistral } from '@mistralai/mistralai'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'

/**
 * Available Mistral AI models
 * Ordered by capability: flagship first, then specialized models
 */
const MISTRAL_MODELS: AIModel[] = [
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    description: 'Flagship model - Complex reasoning & analysis',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium',
    description: 'Balanced - Cost-effective reasoning',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    description: 'Fast & efficient for simple tasks',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'codestral-latest',
    name: 'Codestral',
    description: 'Specialized for code generation & understanding',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'ministral-8b-latest',
    name: 'Ministral 8B',
    description: 'Compact model for edge deployment',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'ministral-3b-latest',
    name: 'Ministral 3B',
    description: 'Smallest model - Ultra-fast responses',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'pixtral-large-latest',
    name: 'Pixtral Large',
    description: 'Multimodal - Vision & text understanding',
    provider: 'mistral',
    isLocal: false
  }
]

/**
 * Mistral AI Provider implementation
 * Provides access to Mistral models via their official API
 */
export class MistralProvider implements AIProvider {
  readonly name = 'mistral'

  /**
   * Check if this provider can handle the given model
   * Matches mistral-*, codestral-*, ministral-*, pixtral-* patterns
   */
  canHandleModel(modelId: string): boolean {
    return (
      MISTRAL_MODELS.some((m) => m.id === modelId) ||
      modelId.startsWith('mistral-') ||
      modelId.startsWith('codestral-') ||
      modelId.startsWith('ministral-') ||
      modelId.startsWith('pixtral-')
    )
  }

  /**
   * Validate connection with Mistral API
   */
  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) {
      console.error('[Mistral] No API key provided')
      return false
    }

    console.log('[Mistral] validateConnection called')
    console.log('[Mistral] API key length:', apiKey.length)

    try {
      const client = new Mistral({ apiKey })

      // Use models.list() for lighter validation instead of chat.complete()
      const models = await client.models.list()
      console.log('[Mistral] Validation successful! Available models:', models.data?.length || 0)
      return true
    } catch (error: unknown) {
      // Log detailed error information
      console.error('[Mistral] validateConnection ERROR:', error)
      
      if (error instanceof Error) {
        console.error('[Mistral] Error name:', error.name)
        console.error('[Mistral] Error message:', error.message)
        
        // Check for common Mistral API errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error('[Mistral] Authentication failed - check API key and ensure payments are activated')
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          console.error('[Mistral] Access forbidden - API key may not have required permissions')
        } else if (error.message.includes('payment') || error.message.includes('billing')) {
          console.error('[Mistral] Payment/billing issue - activate payments at console.mistral.ai')
        }
      }
      
      return false
    }
  }

  /**
   * Get available Mistral models
   */
  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    // Return static list of models
    // Mistral models are well-defined and don't require dynamic fetching
    return MISTRAL_MODELS
  }

  /**
   * Stream response from Mistral API
   */
  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Mistral provider')
    }

    const { window, messages, modelId } = params

    console.log('[Mistral] streamResponse called')
    console.log('[Mistral] Using model:', modelId)
    console.log('[Mistral] Total messages received:', messages.length)

    try {
      const client = new Mistral({ apiKey })

      // Extract system message for logging
      const systemMessage = messages.find((m) => m.role === 'system')
      if (systemMessage) {
        console.log('[Mistral] System instruction: Present')
        console.log('[Mistral] System instruction length:', systemMessage.content.length)
      }

      // Convert messages to Mistral format
      const mistralMessages = messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }))

      console.log('[Mistral] Conversation messages:', mistralMessages.length)

      // Stream the response using Mistral's streaming API
      const stream = await client.chat.stream({
        model: modelId,
        messages: mistralMessages
      })

      console.log('[Mistral] Stream started, awaiting chunks...')
      let chunkCount = 0
      let fullResponse = ''

      for await (const event of stream) {
        const delta = event.data?.choices?.[0]?.delta?.content
        if (delta) {
          chunkCount++
          fullResponse += delta
          window.webContents.send('ai:token', delta)
        }
      }

      console.log('[Mistral] Stream complete. Total chunks:', chunkCount)
      console.log('[Mistral] Full response preview:', fullResponse.substring(0, 500))

      // Check for tool_use pattern
      if (fullResponse.includes('```tool_use')) {
        console.log('[Mistral] ✅ Tool use block detected in response!')
      } else {
        console.log('[Mistral] ❌ No tool_use block in response')
      }

      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[Mistral] streamResponse ERROR:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}
