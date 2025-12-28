// src/main/providers/anthropic.ts

import Anthropic from '@anthropic-ai/sdk'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'

/**
 * Available Anthropic Claude models
 */
const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most intelligent - Complex reasoning & analysis',
    provider: 'anthropic',
    isLocal: false
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced - Fast & capable',
    provider: 'anthropic',
    isLocal: false
  }
]

/**
 * Anthropic Claude AI Provider implementation
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'

  /**
   * Check if this provider can handle the given model
   */
  canHandleModel(modelId: string): boolean {
    return ANTHROPIC_MODELS.some((m) => m.id === modelId) || modelId.startsWith('claude-')
  }

  /**
   * Validate connection with Anthropic API
   */
  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) {
      console.error('[Anthropic] No API key provided')
      return false
    }

    console.log('[Anthropic] validateConnection called')
    try {
      const client = new Anthropic({ apiKey })
      // Use a minimal API call to validate
      await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
      console.log('[Anthropic] Validation successful!')
      return true
    } catch (error: unknown) {
      console.error('[Anthropic] validateConnection ERROR:', error)
      return false
    }
  }

  /**
   * Get available Anthropic models
   */
  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    // Anthropic models are static
    return ANTHROPIC_MODELS
  }

  /**
   * Stream response from Anthropic Claude
   */
  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Anthropic provider')
    }

    const { window, messages, modelId } = params

    console.log('[Anthropic] streamResponse called')
    console.log('[Anthropic] Using model:', modelId)
    console.log('[Anthropic] Total messages received:', messages.length)

    try {
      const client = new Anthropic({ apiKey })

      // Extract system message
      const systemMessage = messages.find((m) => m.role === 'system')
      if (systemMessage) {
        console.log('[Anthropic] System instruction: Present')
        console.log('[Anthropic] System instruction length:', systemMessage.content.length)
      }

      // Convert messages to Anthropic format (exclude system messages)
      const anthropicMessages = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

      console.log('[Anthropic] Conversation messages:', anthropicMessages.length)

      // Stream the response
      const stream = client.messages.stream({
        model: modelId,
        max_tokens: 8192,
        system: systemMessage?.content,
        messages: anthropicMessages
      })

      console.log('[Anthropic] Stream started, awaiting chunks...')
      let chunkCount = 0
      let fullResponse = ''

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as { type: string; text?: string }
          if (delta.type === 'text_delta' && delta.text) {
            chunkCount++
            fullResponse += delta.text
            window.webContents.send('ai:token', delta.text)
          }
        }
      }

      console.log('[Anthropic] Stream complete. Total chunks:', chunkCount)
      console.log('[Anthropic] Full response preview:', fullResponse.substring(0, 500))

      // Check for tool_use pattern
      if (fullResponse.includes('```tool_use')) {
        console.log('[Anthropic] ✅ Tool use block detected in response!')
      } else {
        console.log('[Anthropic] ❌ No tool_use block in response')
      }

      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[Anthropic] streamResponse ERROR:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}
