import { GoogleGenerativeAI, type Tool } from '@google/generative-ai'
import { AIProvider } from './base'
import { AIModel, ModelProbeResult, ProviderValidationResult, StreamParams } from './types'
import { toGeminiFunctions } from './toolFormatter'
import { mcpManager } from '../mcp/manager'

const GEMINI_MODELS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'
const GEMINI_VALIDATION_TIMEOUT = 10000

/**
 * Available Gemini models
 */
const GEMINI_MODEL_LABELS: Record<string, { name: string; description: string }> = {
  'gemini-2.0-flash': {
    name: 'Gemini 2.0 Flash',
    description: 'Fast and cost-effective'
  },
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    description: 'Balanced speed and capability'
  },
  'gemini-2.5-flash-lite': {
    name: 'Gemini 2.5 Flash Lite',
    description: 'Lowest latency Gemini option'
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning model'
  }
}

interface GeminiModelListItem {
  name?: string
  supportedGenerationMethods?: string[]
}

function formatGeminiModelName(modelId: string): string {
  const known = GEMINI_MODEL_LABELS[modelId]
  if (known) return known.name
  return modelId.replace(/-/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function formatGeminiDescription(modelId: string): string {
  return GEMINI_MODEL_LABELS[modelId]?.description || 'Google Gemini model'
}

function isChatCapableGeminiModel(model: GeminiModelListItem): boolean {
  const id = model.name?.replace(/^models\//, '') || ''
  if (!id.startsWith('gemini-')) return false
  const methods = model.supportedGenerationMethods || []
  return methods.includes('generateContent')
}

function toGeminiModel(modelId: string): AIModel {
  return {
    id: modelId,
    name: formatGeminiModelName(modelId),
    description: formatGeminiDescription(modelId),
    provider: 'gemini',
    isLocal: false
  }
}

/**
 * Helper for exponential backoff retry logic
 */
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    const isRateLimit =
      error.message?.includes('429') ||
      error.status === 429 ||
      error.message?.includes('Too Many Requests')

    if (isRateLimit && retries > 0) {
      console.warn(`[Gemini] Rate limit hit. Retrying in ${delay}ms... (Retries left: ${retries})`)
      await new Promise((resolve) => setTimeout(resolve, delay))
      return retryWithBackoff(operation, retries - 1, delay * 2)
    }
    throw error
  }
}

/**
 * Gemini AI Provider implementation
 */
export class GeminiProvider implements AIProvider {
  readonly name = 'gemini'

  canHandleModel(modelId: string): boolean {
    return modelId.startsWith('gemini-')
  }

  async validateConnection(apiKey?: string): Promise<ProviderValidationResult> {
    const trimmedKey = apiKey?.trim()
    if (!trimmedKey) {
      return { status: 'invalid_key', message: 'No API key provided' }
    }

    console.log('[Gemini] validateConnection called')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_VALIDATION_TIMEOUT)

    try {
      const response = await fetch(
        `${GEMINI_MODELS_ENDPOINT}?pageSize=1&key=${encodeURIComponent(trimmedKey)}`,
        { signal: controller.signal }
      )

      if (!response.ok) {
        console.error('[Gemini] Validation failed with status:', response.status)
        if (response.status === 401) {
          return { status: 'invalid_key', message: 'Gemini API key is invalid or expired' }
        }
        if (response.status === 403) {
          return { status: 'insufficient_scope', message: 'Gemini API key lacks required access' }
        }
        if (response.status === 429) {
          return { status: 'rate_limited', message: 'Gemini validation hit rate limits' }
        }
        return { status: 'network_error', message: 'Gemini validation request failed' }
      }

      console.log('[Gemini] Validation successful!')
      return { status: 'ok' }
    } catch (e) {
      console.error('[Gemini] validateConnection ERROR:', e)
      return { status: 'network_error', message: 'Unable to reach Gemini right now' }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    const trimmedKey = _apiKey?.trim()
    if (!trimmedKey) {
      return []
    }
    return this.listCandidateModels(trimmedKey)
  }

  async listCandidateModels(apiKey: string): Promise<AIModel[]> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), GEMINI_VALIDATION_TIMEOUT)

    try {
      const response = await fetch(
        `${GEMINI_MODELS_ENDPOINT}?key=${encodeURIComponent(apiKey)}`,
        { signal: controller.signal }
      )

      if (response.status === 401 || response.status === 403) {
        return []
      }
      if (!response.ok) {
        console.error('[Gemini] getAvailableModels failed with status:', response.status)
        return []
      }

      const payload = (await response.json()) as {
        models?: GeminiModelListItem[]
      }
      return (payload.models || [])
        .filter((model) => isChatCapableGeminiModel(model))
        .map((model) => model.name?.replace(/^models\//, ''))
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .map((id) => toGeminiModel(id))
    } catch (error: unknown) {
      console.error('[Gemini] getAvailableModels ERROR:', error)
      return []
    } finally {
      clearTimeout(timeoutId)
    }
  }

  async probeModelAccess(model: AIModel, apiKey: string): Promise<ModelProbeResult> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const geminiModel = genAI.getGenerativeModel({ model: model.id }, { apiVersion: 'v1beta' })
      await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'ping' }] }],
        generationConfig: { maxOutputTokens: 1, temperature: 0 }
      })
      return { status: 'verified' }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      if (message.includes('401') || message.includes('API key not valid')) {
        return { status: 'denied', code: 'invalid_key', message: 'Invalid Gemini API key' }
      }
      if (message.includes('403') || message.includes('PERMISSION_DENIED')) {
        return { status: 'denied', code: 'insufficient_scope', message: `No access to ${model.id}` }
      }
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        return { status: 'transient_error', code: 'rate_limited', message: 'Rate limited probing model access' }
      }
      if (message.includes('500') || message.includes('503') || message.includes('UNAVAILABLE')) {
        return { status: 'transient_error', code: 'provider_error', message: 'Gemini service unavailable' }
      }
      if (message.includes('400') || message.includes('404')) {
        return { status: 'denied', code: 'unsupported', message: `${model.id} is not usable for chat` }
      }
      return { status: 'transient_error', code: 'network_error', message: 'Network error probing model access' }
    }
  }

  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Gemini provider')
    }

    const { window, messages, modelId, enableTools = true } = params

    console.log('[Gemini] streamResponse called')
    console.log('[Gemini] Using model:', modelId)
    console.log('[Gemini] Total messages received:', messages.length)
    console.log('[Gemini] Native tools enabled:', enableTools)

    try {
      const genAI = new GoogleGenerativeAI(apiKey)
      const systemMessage = messages.find((m) => m.role === 'system')

      console.log('[Gemini] System instruction:', systemMessage ? 'Present' : 'None')
      if (systemMessage) {
        console.log('[Gemini] System instruction length:', systemMessage.content.length)
      }

      // Get available tools if enabled
      let tools: Tool[] | undefined
      if (enableTools) {
        const mcpTools = mcpManager.getAvailableTools()
        if (mcpTools.length > 0) {
          const functionDeclarations = toGeminiFunctions(mcpTools)
          tools = [{
            functionDeclarations
          }]
          console.log(`[Gemini] ✅ Configured ${functionDeclarations.length} native functions`)
          console.log(`[Gemini] Tools: ${mcpTools.map(t => t.name).slice(0, 10).join(', ')}${mcpTools.length > 10 ? '...' : ''}`)
        } else {
          console.log('[Gemini] ⚠️ No MCP tools available for native function calling')
        }
      }

      // Create model with system instruction AND tools
      const model = genAI.getGenerativeModel(
        {
          model: modelId,
          systemInstruction: systemMessage?.content,
          tools
        },
        { apiVersion: 'v1beta' }
      )

      // Convert to Gemini format (exclude system messages)
      let history = messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }]
        }))

      console.log('[Gemini] History length (excluding system):', history.length)

      const lastMessage = history.pop()
      if (!lastMessage) throw new Error('No user message found')

      console.log('[Gemini] Last message role:', lastMessage.role)
      console.log(
        '[Gemini] Last message content preview:',
        lastMessage.parts[0].text.substring(0, 100)
      )
      console.log('[Gemini] Remaining history for chat:', history.length, 'messages')

      // Log each history message role
      history.forEach((h, i) => {
        console.log(
          `[Gemini] History[${i}]: role=${h.role}, content_length=${h.parts[0].text.length}`
        )
      })

      console.log('[Gemini] Starting chat with history...')

      // Try streaming chat first
      try {
        const chat = model.startChat({ history })
        console.log('[Gemini] Sending message stream...')

        const result = await retryWithBackoff(async () => {
          return await chat.sendMessageStream(lastMessage.parts[0].text)
        })

        console.log('[Gemini] Stream started, awaiting chunks...')
        let chunkCount = 0
        let fullResponse = ''
        
        for await (const chunk of result.stream) {
          const candidate = chunk.candidates?.[0]
          if (!candidate?.content?.parts) continue
          
          for (const part of candidate.content.parts) {
            // Handle text content
            if ('text' in part && part.text) {
              chunkCount++
              fullResponse += part.text
              window.webContents.send('ai:token', part.text)
            }
            
            // Handle native function calls
            if ('functionCall' in part && part.functionCall) {
              console.log('[Gemini] ✅ Native function call detected:', part.functionCall.name)
              window.webContents.send('ai:function_call', {
                name: part.functionCall.name,
                args: part.functionCall.args || {}
              })
            }
          }
        }
        
        console.log('[Gemini] Stream complete. Total chunks:', chunkCount)
        console.log('[Gemini] Full response preview:', fullResponse.substring(0, 500))

        window.webContents.send('ai:done')
      } catch (streamErr) {
        // If streaming is not supported, fall back to simple generateContent
        console.warn('[Gemini] Streaming failed, falling back to generateContent:', streamErr)
        try {
          const response = await model.generateContent(lastMessage.parts[0].text)
          const text = response.response?.candidates?.[0]?.content?.parts?.[0]?.text
          if (text) {
            window.webContents.send('ai:token', text)
          }
          window.webContents.send('ai:done')
        } catch (fallbackErr) {
          console.error('[Gemini] Fallback generateContent error:', fallbackErr)
          throw fallbackErr
        }
      }
    } catch (e: unknown) {
      console.error('[Gemini] streamResponse ERROR:', e)
      window.webContents.send('ai:error', e instanceof Error ? e.message : 'Unknown error')
      throw e
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
 * @param apiKey - Gemini API key
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
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel(
    { model: options?.model || 'gemini-2.5-flash' },
    { apiVersion: 'v1beta' }
  )

  console.log(`[Gemini] generateCompletion with model: ${options?.model || 'gemini-2.5-flash'}`)

  try {
    const result = await retryWithBackoff(async () => {
      return await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: options?.maxTokens || 1000,
          temperature: options?.temperature ?? 0.3 // Lower for more consistent summaries
        }
      })
    })

    const text = result.response.text()
    console.log(`[Gemini] Completion generated, length: ${text.length}`)
    return text

  } catch (error) {
    console.error('[Gemini] generateCompletion ERROR:', error)
    throw error
  }
}
