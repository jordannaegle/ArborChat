// src/main/providers/anthropic.ts
// Phase 2: Native Tool Calling Implementation
// Author: Alex Chen (Distinguished Software Architect)

import Anthropic from '@anthropic-ai/sdk'
import { AIProvider } from './base'
import { AIModel, ModelProbeResult, ProviderValidationResult, StreamParams } from './types'
import { toAnthropicTools } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

/**
 * Available Anthropic Claude models
 */
const ANTHROPIC_MODEL_LABELS: Record<string, { name: string; description: string }> = {
  'claude-opus-4-5-20251101': {
    name: 'Claude Opus 4.5',
    description: 'Most intelligent for complex reasoning'
  },
  'claude-sonnet-4-5-20250929': {
    name: 'Claude Sonnet 4.5',
    description: 'Balanced speed and quality'
  },
  'claude-haiku-4-5-20251001': {
    name: 'Claude Haiku 4.5',
    description: 'Fast and efficient'
  }
}

function toAnthropicModel(modelId: string): AIModel {
  const known = ANTHROPIC_MODEL_LABELS[modelId]
  return {
    id: modelId,
    name: known?.name || modelId.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
    description: known?.description || 'Anthropic Claude model',
    provider: 'anthropic',
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
 * Anthropic Claude AI Provider implementation
 * Phase 2: Native tool_use support
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic'

  /**
   * Check if this provider can handle the given model
   */
  canHandleModel(modelId: string): boolean {
    return modelId.startsWith('claude-')
  }

  /**
   * Validate connection with Anthropic API
   */
  async validateConnection(apiKey?: string): Promise<ProviderValidationResult> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return { status: 'invalid_key', message: 'No API key provided' }
    }

    console.log('[Anthropic] validateConnection called')
    try {
      const client = new Anthropic({ apiKey: trimmedKey })

      // Validate credentials with a lightweight auth check that does not depend
      // on access to any specific Claude model.
      await client.models.list({ limit: 1 })

      console.log('[Anthropic] Validation successful!')
      return { status: 'ok' }
    } catch (error: unknown) {
      console.error('[Anthropic] validateConnection ERROR:', error)
      const status = getErrorStatus(error)
      if (status === 401) {
        return { status: 'invalid_key', message: 'Anthropic API key is invalid or expired' }
      }
      if (status === 403) {
        return { status: 'insufficient_scope', message: 'Anthropic account lacks required access' }
      }
      if (status === 429) {
        return { status: 'rate_limited', message: 'Anthropic validation hit rate limits' }
      }
      return { status: 'network_error', message: 'Unable to reach Anthropic right now' }
    }
  }

  /**
   * Get available Anthropic models
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
      const client = new Anthropic({ apiKey })
      const response = await client.models.list({ limit: 100 })
      return response.data
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string' && id.startsWith('claude-'))
        .map((id) => toAnthropicModel(id))
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 401 || status === 403) {
        return []
      }
      console.error('[Anthropic] getAvailableModels ERROR:', error)
      return []
    }
  }

  async probeModelAccess(model: AIModel, apiKey: string): Promise<ModelProbeResult> {
    try {
      const client = new Anthropic({ apiKey })
      await client.messages.create({
        model: model.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { status: 'verified' }
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 401) {
        return { status: 'denied', code: 'invalid_key', message: 'Invalid Anthropic API key' }
      }
      if (status === 403) {
        return { status: 'denied', code: 'insufficient_scope', message: `No access to ${model.id}` }
      }
      if (status === 429) {
        return { status: 'transient_error', code: 'rate_limited', message: 'Rate limited probing model access' }
      }
      if (status && status >= 500) {
        return { status: 'transient_error', code: 'provider_error', message: 'Anthropic service unavailable' }
      }
      if (status === 400 || status === 404) {
        return { status: 'denied', code: 'unsupported', message: `${model.id} is not usable for chat` }
      }
      return { status: 'transient_error', code: 'network_error', message: 'Network error probing model access' }
    }
  }

  /**
   * Stream response from Anthropic Claude with native tool_use support
   * 
   * Anthropic's tool_use format:
   * - Tools are passed in the tools parameter
   * - Response includes content blocks of type 'tool_use' with id, name, input
   * - Tool results are passed back with tool_result content blocks
   */
  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Anthropic provider')
    }

    const { window, messages, modelId, enableTools = true } = params

    console.log('[Anthropic] streamResponse called')
    console.log('[Anthropic] Using model:', modelId)
    console.log('[Anthropic] Total messages received:', messages.length)
    console.log('[Anthropic] Native tools enabled:', enableTools)

    try {
      const client = new Anthropic({ apiKey })

      // Extract system message
      const systemMessage = messages.find((m) => m.role === 'system')
      if (systemMessage) {
        console.log('[Anthropic] System instruction: Present')
        console.log('[Anthropic] System instruction length:', systemMessage.content.length)
      }

      // Get available tools if enabled
      let tools: Anthropic.Tool[] | undefined
      if (enableTools) {
        const mcpTools = mcpManager.getAvailableTools()
        if (mcpTools.length > 0) {
          tools = toAnthropicTools(mcpTools) as Anthropic.Tool[]
          console.log(`[Anthropic] ✅ Configured ${tools.length} native tools`)
          console.log(`[Anthropic] Tools: ${mcpTools.map(t => t.name).slice(0, 10).join(', ')}${mcpTools.length > 10 ? '...' : ''}`)
        } else {
          console.log('[Anthropic] ⚠️ No MCP tools available for native tool calling')
        }
      }

      // Convert messages to Anthropic format (exclude system messages)
      const anthropicMessages: Anthropic.MessageParam[] = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))

      console.log('[Anthropic] Conversation messages:', anthropicMessages.length)

      // Stream the response with native tool support
      const stream = client.messages.stream({
        model: modelId,
        max_tokens: 8192,
        system: systemMessage?.content,
        messages: anthropicMessages,
        tools: tools
      })

      console.log('[Anthropic] Stream started, awaiting chunks...')
      let chunkCount = 0
      let fullResponse = ''
      let currentToolUse: {
        id: string
        name: string
        inputJson: string
      } | null = null

      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          // Check if this is a tool_use block starting
          if (event.content_block.type === 'tool_use') {
            console.log('[Anthropic] ✅ Tool use block started:', event.content_block.name)
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
              inputJson: ''
            }
          }
        } else if (event.type === 'content_block_delta') {
          const delta = event.delta as { 
            type: string
            text?: string
            partial_json?: string 
          }
          
          // Handle text content
          if (delta.type === 'text_delta' && delta.text) {
            chunkCount++
            fullResponse += delta.text
            window.webContents.send('ai:token', delta.text)
          }
          
          // Handle tool input JSON accumulation
          if (delta.type === 'input_json_delta' && delta.partial_json && currentToolUse) {
            currentToolUse.inputJson += delta.partial_json
          }
        } else if (event.type === 'content_block_stop') {
          // If we were building a tool_use block, emit it now
          if (currentToolUse) {
            try {
              const args = currentToolUse.inputJson 
                ? JSON.parse(currentToolUse.inputJson) 
                : {}
              
              console.log('[Anthropic] ✅ Emitting function call:', currentToolUse.name)
              console.log('[Anthropic] Tool args:', JSON.stringify(args).substring(0, 200))
              
              window.webContents.send('ai:function_call', {
                name: currentToolUse.name,
                args: args,
                toolUseId: currentToolUse.id  // Anthropic needs this for tool_result
              })
            } catch (parseError) {
              console.error('[Anthropic] Failed to parse tool input JSON:', parseError)
              console.error('[Anthropic] Raw JSON:', currentToolUse.inputJson)
            }
            currentToolUse = null
          }
        }
      }

      console.log('[Anthropic] Stream complete. Total chunks:', chunkCount)
      console.log('[Anthropic] Full response preview:', fullResponse.substring(0, 300))

      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[Anthropic] streamResponse ERROR:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      window.webContents.send('ai:error', errorMessage)
      throw error
    }
  }
}


// ============================================================================
// Non-Streaming Completion (for summarization)
// ============================================================================

/**
 * Generate a non-streaming completion for summarization
 * More efficient than streaming for short, structured outputs
 * 
 * @param apiKey - Anthropic API key
 * @param prompt - The prompt to send
 * @param options - Generation options
 * @returns The generated text response
 */
export async function generateCompletion(
  apiKey: string,
  prompt: string,
  options?: {
    model?: string
    maxTokens?: number
    temperature?: number
  }
): Promise<string> {
  const client = new Anthropic({ apiKey })
  const model = options?.model || 'claude-haiku-4-5-20251001'

  console.log(`[Anthropic] generateCompletion with model: ${model}`)

  try {
    const response = await client.messages.create({
      model,
      max_tokens: options?.maxTokens || 1000,
      messages: [{ role: 'user', content: prompt }]
    })

    // Extract text from response
    const textContent = response.content.find(block => block.type === 'text')
    const text = textContent?.type === 'text' ? textContent.text : ''

    console.log(`[Anthropic] Completion generated, length: ${text.length}`)
    return text

  } catch (error) {
    console.error('[Anthropic] generateCompletion ERROR:', error)
    throw error
  }
}
