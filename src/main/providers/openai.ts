// src/main/providers/openai.ts
// Phase 2: Native Function Calling Implementation  
// Author: Alex Chen (Distinguished Software Architect)

import OpenAI from 'openai'
import { AIProvider } from './base'
import { AIModel, StreamParams } from './types'
import { toOpenAIFunctions } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

/**
 * Available OpenAI models (direct API)
 * These are the primary models users would want access to
 */
const OPENAI_MODELS: AIModel[] = [
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'Latest flagship model with superior reasoning',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Fast & cost-effective for most tasks',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1 Nano',
    description: 'Fastest and most affordable model',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'o3',
    name: 'o3',
    description: 'Most advanced reasoning model',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    description: 'Fast reasoning model',
    provider: 'openai',
    isLocal: false
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    description: 'Latest efficient reasoning model',
    provider: 'openai',
    isLocal: false
  }
]

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
      OPENAI_MODELS.some((m) => m.id === modelId) ||
      modelId.startsWith('gpt-') ||
      modelId.startsWith('o1') ||
      modelId.startsWith('o3') ||
      modelId.startsWith('o4')
    )
  }

  /**
   * Validate connection with OpenAI API
   */
  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) {
      console.error('[OpenAI] No API key provided')
      return false
    }

    console.log('[OpenAI] validateConnection called')

    try {
      const client = new OpenAI({ apiKey })

      // Use a minimal API call to validate
      await client.chat.completions.create({
        model: 'gpt-4.1-nano',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })

      console.log('[OpenAI] Validation successful!')
      return true
    } catch (error: unknown) {
      console.error('[OpenAI] validateConnection ERROR:', error)
      return false
    }
  }

  /**
   * Get available OpenAI models
   */
  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    return OPENAI_MODELS
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
