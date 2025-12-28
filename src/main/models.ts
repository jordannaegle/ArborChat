import { AIModel } from './providers/types'
import { GeminiProvider } from './providers/gemini'
import { OllamaProvider } from './providers/ollama'
import { AnthropicProvider } from './providers/anthropic'

/**
 * Model discovery and management service
 */

let cachedOllamaModels: AIModel[] = []
let lastOllamaFetch = 0
const CACHE_DURATION = 30000 // 30 seconds

/**
 * Get all Gemini models (static list)
 */
export async function getGeminiModels(apiKey?: string): Promise<AIModel[]> {
  const geminiProvider = new GeminiProvider()
  return geminiProvider.getAvailableModels(apiKey)
}

/**
 * Get all Anthropic Claude models (static list)
 */
export async function getAnthropicModels(): Promise<AIModel[]> {
  const anthropicProvider = new AnthropicProvider()
  return anthropicProvider.getAvailableModels()
}

/**
 * Get all Ollama models (dynamic, with caching)
 */
export async function getOllamaModels(ollamaUrl?: string): Promise<AIModel[]> {
  const now = Date.now()

  // Return cached models if still fresh
  if (cachedOllamaModels.length > 0 && now - lastOllamaFetch < CACHE_DURATION) {
    console.log('[Models] Returning cached Ollama models')
    return cachedOllamaModels
  }

  const ollamaProvider = new OllamaProvider(ollamaUrl)

  try {
    const models = await ollamaProvider.getAvailableModels()
    cachedOllamaModels = models
    lastOllamaFetch = now
    return models
  } catch (error) {
    console.error('[Models] Failed to fetch Ollama models:', error)
    return []
  }
}

/**
 * Get all available models from all providers
 */
export async function getAllAvailableModels(
  apiKey?: string,
  ollamaUrl?: string
): Promise<AIModel[]> {
  console.log('[Models] Fetching all available models')

  const [anthropicModels, geminiModels, ollamaModels] = await Promise.all([
    getAnthropicModels(),
    getGeminiModels(apiKey),
    getOllamaModels(ollamaUrl)
  ])

  console.log('[Models] Found', anthropicModels.length, 'Anthropic models')
  console.log('[Models] Found', geminiModels.length, 'Gemini models')
  console.log('[Models] Found', ollamaModels.length, 'Ollama models')

  // Anthropic first to prioritize in model selector
  return [...anthropicModels, ...geminiModels, ...ollamaModels]
}

/**
 * Clear the Ollama model cache (force refresh on next fetch)
 */
export function clearOllamaCache(): void {
  cachedOllamaModels = []
  lastOllamaFetch = 0
  console.log('[Models] Ollama cache cleared')
}
