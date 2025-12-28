import { BrowserWindow } from 'electron'
import { GeminiProvider } from './providers/gemini'
import { OllamaProvider } from './providers/ollama'
import { AnthropicProvider } from './providers/anthropic'
import { AIProvider } from './providers/base'
import { ChatMessage, StreamParams } from './providers/types'
import { credentialManager, ProviderId } from './credentials'

const DEFAULT_MODEL = 'gemini-2.5-flash'

// Initialize providers
const geminiProvider = new GeminiProvider()
const ollamaProvider = new OllamaProvider()
const anthropicProvider = new AnthropicProvider()

/**
 * Provider registry for routing requests
 * Order matters - Anthropic is checked first for claude- prefix
 */
const providers: AIProvider[] = [anthropicProvider, geminiProvider, ollamaProvider]

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
 * Get the provider ID for automatic key injection
 */
function getProviderIdFromModel(modelId: string): ProviderId | null {
  if (modelId.startsWith('claude-')) return 'anthropic'
  if (modelId.startsWith('gemini-')) return 'gemini'
  if (modelId.includes(':')) return 'ollama' // Ollama models use format: model:tag
  return 'gemini' // Default fallback
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
 * Automatically injects the correct API key based on the selected model
 * @param window - Electron BrowserWindow for sending events
 * @param _apiKey - Legacy parameter (ignored - keys now fetched from credential manager)
 * @param messages - Conversation messages
 * @param modelName - Model identifier
 */
export async function streamResponse(
  window: BrowserWindow,
  _apiKey: string | null,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  modelName: string = DEFAULT_MODEL
): Promise<void> {
  console.log('[AI] streamResponse called')
  console.log('[AI] Using model:', modelName)
  console.log('[AI] Total messages received:', messages.length)

  const provider = getProviderForModel(modelName)
  const providerId = getProviderIdFromModel(modelName)
  console.log('[AI] Using provider:', provider.name, `(${providerId})`)

  // Automatic API key injection from credential manager
  let apiKey: string | null = null
  if (providerId !== 'ollama') {
    apiKey = await credentialManager.getApiKey(providerId!)
    if (!apiKey) {
      const errorMsg = `No API key configured for ${providerId}. Please add your API key in Settings.`
      console.error('[AI]', errorMsg)
      window.webContents.send('ai:error', errorMsg)
      throw new Error(errorMsg)
    }
    console.log(`[AI] Injected ${providerId} API key from credential manager`)
  }

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
    await provider.streamResponse(params, apiKey || undefined)
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
