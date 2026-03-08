// src/main/providers/openai.ts
// Phase 2: Native Function Calling Implementation  
// Author: Alex Chen (Distinguished Software Architect)

import OpenAI from 'openai'
import { AIProvider } from './base'
import { AIModel, ModelProbeResult, ProviderValidationResult, StreamParams } from './types'
import { toOpenAIFunctions } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

const OPENAI_MODEL_LABELS: Record<string, { name: string; description: string }> = {
  'gpt-4.1': {
    name: 'GPT-4.1',
    description: 'Latest flagship model with superior reasoning'
  },
  'gpt-4.1-mini': {
    name: 'GPT-4.1 Mini',
    description: 'Fast and cost-effective for most tasks'
  },
  'gpt-4.1-nano': {
    name: 'GPT-4.1 Nano',
    description: 'Fastest and most affordable model'
  },
  o3: {
    name: 'o3',
    description: 'Most advanced reasoning model'
  },
  'o3-mini': {
    name: 'o3 Mini',
    description: 'Fast reasoning model'
  },
  'o4-mini': {
    name: 'o4 Mini',
    description: 'Latest efficient reasoning model'
  },
  'gpt-5.1': {
    name: 'GPT-5.1',
    description: 'Latest high-capability OpenAI model'
  }
}

function formatOpenAIModelName(modelId: string): string {
  const labelled = OPENAI_MODEL_LABELS[modelId]
  if (labelled) return labelled.name

  return modelId
    .replace(/^gpt-/, 'GPT-')
    .replace(/^o(\d)/, 'o$1')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function formatOpenAIModelDescription(modelId: string): string {
  return OPENAI_MODEL_LABELS[modelId]?.description || 'OpenAI chat-capable model'
}

function isCandidateOpenAIModelId(modelId: string): boolean {
  if (!modelId) return false
  return (
    modelId.startsWith('gpt-') ||
    modelId.startsWith('o1') ||
    modelId.startsWith('o3') ||
    modelId.startsWith('o4') ||
    modelId.startsWith('o5')
  )
}

function toOpenAIModel(modelId: string): AIModel {
  return {
    id: modelId,
    name: formatOpenAIModelName(modelId),
    description: formatOpenAIModelDescription(modelId),
    provider: 'openai',
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
 * OpenAI Direct API Provider implementation
 * Phase 2: Native function calling support
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai'

  /**
   * Check if this provider can handle the given model
   * Matches gpt-*, o1*, o3*, o4* patterns but NOT github: prefixed models
   */
  canHandleModel(modelId: string): boolean {
    // Don't handle GitHub-proxied models
    if (modelId.startsWith('github:')) {
      return false
    }
    
    // Match OpenAI model patterns
    return (
      isCandidateOpenAIModelId(modelId)
    )
  }

  /**
   * Validate connection with OpenAI API
   */
  async validateConnection(apiKey?: string): Promise<ProviderValidationResult> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return { status: 'invalid_key', message: 'No API key provided' }
    }

    console.log('[OpenAI] validateConnection called')

    try {
      const client = new OpenAI({ apiKey: trimmedKey })

      // Validate credentials with a lightweight auth check that does not rely
      // on access to any specific model.
      await client.models.list()

      console.log('[OpenAI] Validation successful!')
      return { status: 'ok' }
    } catch (error: unknown) {
      console.error('[OpenAI] validateConnection ERROR:', error)
      const status = getErrorStatus(error)
      if (status === 401) {
        return { status: 'invalid_key', message: 'OpenAI API key is invalid or expired' }
      }
      if (status === 403) {
        return { status: 'insufficient_scope', message: 'OpenAI account lacks required model access' }
      }
      if (status === 429) {
        return { status: 'rate_limited', message: 'OpenAI validation hit rate limits' }
      }
      return { status: 'network_error', message: 'Unable to reach OpenAI right now' }
    }
  }

  /**
   * Backward-compatible model list hook.
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
      const client = new OpenAI({ apiKey })
      const response = await client.models.list()
      return response.data
        .map((model) => model.id)
        .filter((id): id is string => typeof id === 'string' && isCandidateOpenAIModelId(id))
        .map((id) => toOpenAIModel(id))
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 401 || status === 403) {
        return []
      }
      console.error('[OpenAI] getAvailableModels ERROR:', error)
      return []
    }
  }

  async probeModelAccess(model: AIModel, apiKey: string): Promise<ModelProbeResult> {
    try {
      const client = new OpenAI({ apiKey })
      await client.chat.completions.create({
        model: model.id,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })
      return { status: 'verified' }
    } catch (error: unknown) {
      const status = getErrorStatus(error)
      if (status === 401) {
        return { status: 'denied', code: 'invalid_key', message: 'Invalid OpenAI API key' }
      }
      if (status === 403) {
        return { status: 'denied', code: 'insufficient_scope', message: `No access to ${model.id}` }
      }
      if (status === 429) {
        return { status: 'transient_error', code: 'rate_limited', message: 'Rate limited probing model access' }
      }
      if (status && status >= 500) {
        return { status: 'transient_error', code: 'provider_error', message: 'OpenAI service unavailable' }
      }
      if (status === 400 || status === 404) {
        return { status: 'denied', code: 'unsupported', message: `Model ${model.id} is not usable for chat completions` }
      }
      return { status: 'transient_error', code: 'network_error', message: 'Network error probing model access' }
    }
  }

  /**
   * Stream response from OpenAI API with native function calling
   * 
   * OpenAI's function calling format:
   * - Functions are passed in the tools parameter
   * - Response includes tool_calls array with id, function name, arguments
   * - Arguments come as JSON string that may be streamed in chunks
   */
  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for OpenAI provider')
    }

    const { window, messages, modelId, enableTools = true } = params

    console.log('[OpenAI] streamResponse called')
    console.log('[OpenAI] Using model:', modelId)
    console.log('[OpenAI] Total messages received:', messages.length)
    console.log('[OpenAI] Native tools enabled:', enableTools)

    try {
      const client = new OpenAI({ apiKey })

      // Extract system message for logging
      const systemMessage = messages.find((m) => m.role === 'system')
      if (systemMessage) {
        console.log('[OpenAI] System instruction: Present')
        console.log('[OpenAI] System instruction length:', systemMessage.content.length)
      }

      // Get available tools if enabled
      let tools: OpenAI.ChatCompletionTool[] | undefined
      if (enableTools) {
        const mcpTools = mcpManager.getAvailableTools()
        if (mcpTools.length > 0) {
          tools = toOpenAIFunctions(mcpTools) as OpenAI.ChatCompletionTool[]
          console.log(`[OpenAI] ✅ Configured ${tools.length} native functions`)
          console.log(`[OpenAI] Tools: ${mcpTools.map(t => t.name).slice(0, 10).join(', ')}${mcpTools.length > 10 ? '...' : ''}`)
        } else {
          console.log('[OpenAI] ⚠️ No MCP tools available for native function calling')
        }
      }

      // Convert messages to OpenAI format
      const openaiMessages: OpenAI.ChatCompletionMessageParam[] = messages.map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content
      }))

      console.log('[OpenAI] Conversation messages:', openaiMessages.length)

      // Stream the response with native function calling
      const stream = await client.chat.completions.create({
        model: modelId,
        max_tokens: 8192,
        messages: openaiMessages,
        tools: tools,
        stream: true
      })

      console.log('[OpenAI] Stream started, awaiting chunks...')
      let chunkCount = 0
      let fullResponse = ''
      
      // Track tool calls being built (OpenAI streams arguments incrementally)
      const activeToolCalls: Map<number, {
        id: string
        name: string
        arguments: string
      }> = new Map()

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta

        // Handle text content
        if (delta?.content) {
          chunkCount++
          fullResponse += delta.content
          window.webContents.send('ai:token', delta.content)
        }

        // Handle tool calls (function calling)
        if (delta?.tool_calls) {
          for (const toolCallDelta of delta.tool_calls) {
            const index = toolCallDelta.index
            
            // New tool call starting
            if (toolCallDelta.id) {
              activeToolCalls.set(index, {
                id: toolCallDelta.id,
                name: toolCallDelta.function?.name || '',
                arguments: toolCallDelta.function?.arguments || ''
              })
              console.log(`[OpenAI] Tool call started [${index}]:`, toolCallDelta.function?.name)
            } else {
              // Continuing to build arguments for existing tool call
              const existing = activeToolCalls.get(index)
              if (existing) {
                if (toolCallDelta.function?.name) {
                  existing.name = toolCallDelta.function.name
                }
                if (toolCallDelta.function?.arguments) {
                  existing.arguments += toolCallDelta.function.arguments
                }
              }
            }
          }
        }

        // Check for finish reason indicating tool calls are complete
        const finishReason = chunk.choices[0]?.finish_reason
        if (finishReason === 'tool_calls' || finishReason === 'stop') {
          // Emit all completed tool calls
          for (const [index, toolCall] of activeToolCalls) {
            if (toolCall.name && toolCall.arguments) {
              try {
                const args = JSON.parse(toolCall.arguments)
                console.log(`[OpenAI] ✅ Emitting function call [${index}]:`, toolCall.name)
                console.log(`[OpenAI] Tool args:`, JSON.stringify(args).substring(0, 200))
                
                window.webContents.send('ai:function_call', {
                  name: toolCall.name,
                  args: args,
                  toolCallId: toolCall.id  // OpenAI needs this for tool response
                })
              } catch (parseError) {
                console.error(`[OpenAI] Failed to parse tool arguments for ${toolCall.name}:`, parseError)
                console.error('[OpenAI] Raw arguments:', toolCall.arguments)
              }
            }
          }
          activeToolCalls.clear()
        }
      }

      console.log('[OpenAI] Stream complete. Total chunks:', chunkCount)
      console.log('[OpenAI] Full response preview:', fullResponse.substring(0, 300))

      window.webContents.send('ai:done')
    } catch (error: unknown) {
      console.error('[OpenAI] streamResponse ERROR:', error)
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
 * @param apiKey - OpenAI API key
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
  const client = new OpenAI({ apiKey })
  const model = options?.model || 'gpt-4.1-mini'

  console.log(`[OpenAI] generateCompletion with model: ${model}`)

  try {
    const response = await client.chat.completions.create({
      model,
      max_tokens: options?.maxTokens || 1000,
      temperature: options?.temperature ?? 0.3,
      messages: [{ role: 'user', content: prompt }]
    })

    const text = response.choices[0]?.message?.content || ''

    console.log(`[OpenAI] Completion generated, length: ${text.length}`)
    return text

  } catch (error) {
    console.error('[OpenAI] generateCompletion ERROR:', error)
    throw error
  }
}
