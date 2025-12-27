import { AIProvider } from './base'
import {
  AIModel,
  StreamParams,
  OllamaTagsResponse,
  OllamaChatRequest,
  OllamaStreamChunk
} from './types'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const CONNECTION_TIMEOUT = 5000 // 5 seconds

/**
 * Ollama AI Provider implementation for local LLMs
 */
export class OllamaProvider implements AIProvider {
  readonly name = 'ollama'
  private baseUrl: string

  constructor(baseUrl: string = DEFAULT_OLLAMA_URL) {
    this.baseUrl = baseUrl
  }

  canHandleModel(modelId: string): boolean {
    // Ollama model IDs typically contain colons (e.g., llama3.2:latest)
    // or are common Ollama model names
    return modelId.includes(':') || this.isKnownOllamaModel(modelId)
  }

  private isKnownOllamaModel(modelId: string): boolean {
    const knownPrefixes = ['llama', 'mistral', 'phi', 'gemma', 'qwen', 'codellama', 'vicuna']
    return knownPrefixes.some((prefix) => modelId.toLowerCase().startsWith(prefix))
  }

  async validateConnection(_apiKey?: string): Promise<boolean> {
    console.log('[Ollama] Validating connection to:', this.baseUrl)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT)

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        console.log('[Ollama] Connection successful')
        return true
      } else {
        console.error('[Ollama] Connection failed with status:', response.status)
        return false
      }
    } catch (error) {
      console.error('[Ollama] Connection error:', error)
      return false
    }
  }

  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    console.log('[Ollama] Fetching available models from:', this.baseUrl)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT)

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        console.error('[Ollama] Failed to fetch models, status:', response.status)
        return []
      }

      const data: OllamaTagsResponse = await response.json()
      console.log('[Ollama] Found', data.models.length, 'models')

      return data.models.map((model) => ({
        id: model.name,
        name: this.formatModelName(model.name),
        description: this.formatModelDescription(model),
        provider: 'ollama' as const,
        isLocal: true
      }))
    } catch (error) {
      console.error('[Ollama] Error fetching models:', error)
      return []
    }
  }

  private formatModelName(name: string): string {
    // Convert "llama3.2:latest" to "Llama 3.2 (latest)"
    const parts = name.split(':')
    const modelName = parts[0]
    const tag = parts[1] || 'latest'

    // Capitalize and add spaces
    const formatted = modelName
      .replace(/([a-z])([0-9])/g, '$1 $2')
      .replace(/^./, (str) => str.toUpperCase())

    return `${formatted} (${tag})`
  }

  private formatModelDescription(model: OllamaTagsResponse['models'][0]): string {
    const sizeGB = (model.size / 1024 / 1024 / 1024).toFixed(1)
    const paramSize = model.details?.parameter_size || 'unknown'
    return `Local model • ${sizeGB}GB • ${paramSize}`
  }

  async streamResponse(params: StreamParams, _apiKey?: string): Promise<void> {
    const { window, messages, modelId } = params

    console.log('[Ollama] streamResponse called')
    console.log('[Ollama] Using model:', modelId)
    console.log('[Ollama] Total messages received:', messages.length)

    try {
      const requestBody: OllamaChatRequest = {
        model: modelId,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content
        })),
        stream: true
      }

      console.log('[Ollama] Sending request to:', `${this.baseUrl}/api/chat`)

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`Ollama request failed with status ${response.status}`)
      }

      if (!response.body) {
        throw new Error('Response body is null')
      }

      console.log('[Ollama] Stream started, processing chunks...')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let chunkCount = 0

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log('[Ollama] Stream complete. Total chunks:', chunkCount)
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.trim())

        for (const line of lines) {
          try {
            const data: OllamaStreamChunk = JSON.parse(line)

            if (data.message?.content) {
              chunkCount++
              window.webContents.send('ai:token', data.message.content)
            }

            if (data.done) {
              console.log('[Ollama] Received done signal')
            }
          } catch (parseError) {
            console.error('[Ollama] Failed to parse chunk:', parseError)
          }
        }
      }

      window.webContents.send('ai:done')
    } catch (e: unknown) {
      console.error('[Ollama] streamResponse ERROR:', e)
      window.webContents.send('ai:error', e instanceof Error ? e.message : 'Unknown error')
      throw e
    }
  }

  /**
   * Updates the base URL for the Ollama server
   */
  setBaseUrl(url: string): void {
    this.baseUrl = url
    console.log('[Ollama] Base URL updated to:', url)
  }

  /**
   * Gets the current base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }
}
