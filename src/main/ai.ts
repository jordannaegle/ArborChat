import { BrowserWindow } from 'electron'
import { GeminiProvider } from './providers/gemini'
import { OllamaProvider } from './providers/ollama'
import { AIProvider } from './providers/base'
import { ChatMessage, StreamParams } from './providers/types'

const DEFAULT_MODEL = 'gemini-2.5-flash'

// Initialize providers
const geminiProvider = new GeminiProvider()
const ollamaProvider = new OllamaProvider()

/**
 * Provider registry for routing requests
 */
const providers: AIProvider[] = [geminiProvider, ollamaProvider]

/**
 * Get the appropriate provider for a given model ID
 */
function getProviderForModel(modelId: string): AIProvider {
  const provider = providers.find((p) => p.canHandleModel(modelId))

  if (!provider) {
    console.warn(`[AI] No provider found for model: ${modelId}, falling back to Gemini`)
    return geminiProvider
  }

  return provider
}

/**
 * Validates API connection for a specific model
 * @param apiKey - API key (required for Gemini, optional for Ollama)
 * @param modelName - Model identifier
 */
export async function validateParams(
  apiKey: string,
  modelName: string = DEFAULT_MODEL
): Promise<boolean> {
  console.log('[AI] validateParams called')
  console.log('[AI] Using model:', modelName)

  const provider = getProviderForModel(modelName)
  console.log('[AI] Using provider:', provider.name)

  return provider.validateConnection(apiKey)
}

/**
 * Streams AI response using the appropriate provider
 * @param window - Electron BrowserWindow for sending events
 * @param apiKey - API key (required for Gemini, optional for Ollama)
 * @param messages - Conversation messages
 * @param modelName - Model identifier
 */
export async function streamResponse(
  window: BrowserWindow,
  apiKey: string,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  modelName: string = DEFAULT_MODEL
): Promise<void> {
  console.log('[AI] streamResponse called')
  console.log('[AI] Using model:', modelName)
  console.log('[AI] Total messages received:', messages.length)

  const provider = getProviderForModel(modelName)
  console.log('[AI] Using provider:', provider.name)

  // Convert messages to ChatMessage format
  const chatMessages: ChatMessage[] = messages.map((m) => ({
    role: m.role,
    content: m.content
  }))

  const params: StreamParams = {
    window,
    messages: chatMessages,
    modelId: modelName
  }

  try {
    await provider.streamResponse(params, apiKey)
  } catch (error) {
    console.error('[AI] Provider error:', error)
    throw error
  }
}

/**
 * Get the Ollama provider instance (for updating base URL)
 */
export function getOllamaProvider(): OllamaProvider {
  return ollamaProvider
}
