// src/main/providers/mistral.ts

import { Mistral } from '@mistralai/mistralai'
import { AIProvider } from './base'
import { AIModel, ModelProbeResult, ProviderValidationResult, StreamParams } from './types'

/**
 * Available Mistral AI models
 * Ordered by capability: flagship first, then specialized models
 */
const MISTRAL_MODEL_LABELS: Record<string, { name: string; description: string }> = {
  'mistral-large-latest': {
    name: 'Mistral Large',
    description: 'Flagship model for complex reasoning'
  },
  'mistral-medium-latest': {
    name: 'Mistral Medium',
    description: 'Balanced and cost-effective'
  },
  'mistral-small-latest': {
    name: 'Mistral Small',
    description: 'Fast and efficient'
  },
  'codestral-latest': {
    name: 'Codestral',
    description: 'Specialized for code generation'
  },
  'ministral-8b-latest': {
    name: 'Ministral 8B',
    description: 'Compact model option'
  },
  'ministral-3b-latest': {
    name: 'Ministral 3B',
    description: 'Small, low-latency model'
  },
  'pixtral-large-latest': {
    name: 'Pixtral Large',
    description: 'Vision and text multimodal model'
  }
}

function isCandidateMistralModelId(modelId: string): boolean {
  return (
    modelId.startsWith('mistral-') ||
    modelId.startsWith('codestral-') ||
    modelId.startsWith('ministral-') ||
    modelId.startsWith('pixtral-')
  )
}

function toMistralModel(modelId: string): AIModel {
  const known = MISTRAL_MODEL_LABELS[modelId]
  return {
    id: modelId,
    name: known?.name || modelId.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
    description: known?.description || 'Mistral chat-capable model',
    provider: 'mistral',
    isLocal: false
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = (error as { status?: unknown }).status
    return typeof status === 'number' ? status : undefined
  }
  return undefined
}

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
    return isCandidateMistralModelId(modelId)
  }

  /**
   * Validate connection with Mistral API
   */
  async validateConnection(apiKey?: string): Promise<ProviderValidationResult> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return { status: 'invalid_key', message: 'No API key provided' }
    }

    console.log('[Mistral] validateConnection called')

    try {
      const client = new Mistral({ apiKey: trimmedKey })

      // Use models.list() for lighter validation instead of chat.complete()
      const models = await client.models.list()
      console.log('[Mistral] Validation successful! Available models:', models.data?.length || 0)
      return { status: 'ok' }
    } catch (error: unknown) {
      // Log detailed error information
      console.error('[Mistral] validateConnection ERROR:', error)
      
      if (error instanceof Error) {
        console.error('[Mistral] Error name:', error.name)
        console.error('[Mistral] Error message:', error.message)
        
        // Check for common Mistral API errors
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
          console.error('[Mistral] Authentication failed - check API key and ensure payments are activated')
          return { status: 'invalid_key', message: 'Mistral API key is invalid or expired' }
        } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
          console.error('[Mistral] Access forbidden - API key may not have required permissions')
          return { status: 'insufficient_scope', message: 'Mistral API key lacks required access' }
        } else if (error.message.includes('429') || error.message.includes('Too Many Requests')) {
          return { status: 'rate_limited', message: 'Mistral validation hit rate limits' }
        } else if (error.message.includes('payment') || error.message.includes('billing')) {
          console.error('[Mistral] Payment/billing issue - activate payments at console.mistral.ai')
          return { status: 'insufficient_scope', message: 'Mistral billing is not enabled for this key' }
        }
      }
      
      const status = getErrorStatus(error)
      if (status === 401) {
        return { status: 'invalid_key', message: 'Mistral API key is invalid or expired' }
      }
      if (status === 403) {
        return { status: 'insufficient_scope', message: 'Mistral API key lacks required access' }
      }
      if (status === 429) {
        return { status: 'rate_limited', message: 'Mistral validation hit rate limits' }
      }
      return { status: 'network_error', message: 'Unable to reach Mistral right now' }
    }
  }

  /**
   * Get available Mistral models
   */
  async getAvailableModels(apiKey?: string): Promise<AIModel[]> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return []
    }
    return this.listCandidateModels(trimmedKey)
  }

  async listCandidateModels(apiKey: string): Promise<AIModel[]> {
    try {
      const client = new Mistral({ apiKey })
      const response = await client.models.list()
      return (response.data || [])
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string' && isCandidateMistralModelId(id))
        .map((id) => toMistralModel(id))
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 401 || status === 403) {
        return []
      }
      console.error('[Mistral] getAvailableModels ERROR:', error)
      return []
    }
  }

  async probeModelAccess(model: AIModel, apiKey: string): Promise<ModelProbeResult> {
    try {
      const client = new Mistral({ apiKey })
      await client.chat.complete({
        model: model.id,
        maxTokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { status: 'verified' }
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 401) {
        return { status: 'denied', code: 'invalid_key', message: 'Invalid Mistral API key' }
      }
      if (status === 403) {
        return { status: 'denied', code: 'insufficient_scope', message: `No access to ${model.id}` }
      }
      if (status === 429) {
        return { status: 'transient_error', code: 'rate_limited', message: 'Rate limited probing model access' }
      }
      if (status && status >= 500) {
        return { status: 'transient_error', code: 'provider_error', message: 'Mistral service unavailable' }
      }
      if (status === 400 || status === 404) {
        return { status: 'denied', code: 'unsupported', message: `${model.id} is not usable for chat` }
      }
      return { status: 'transient_error', code: 'network_error', message: 'Network error probing model access' }
    }
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
