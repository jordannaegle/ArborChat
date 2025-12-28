import { BrowserWindow } from 'electron'

/**
 * Represents a message in the conversation
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Parameters for streaming a response
 */
export interface StreamParams {
  window: BrowserWindow
  messages: ChatMessage[]
  modelId: string
}

/**
 * Represents an AI model from any provider
 */
export interface AIModel {
  id: string
  name: string
  description: string
  provider: 'gemini' | 'ollama' | 'anthropic'
  isLocal: boolean
}

/**
 * Response from Ollama's /api/tags endpoint
 */
export interface OllamaTagsResponse {
  models: Array<{
    name: string
    modified_at: string
    size: number
    digest?: string
    details?: {
      format?: string
      family?: string
      families?: string[]
      parameter_size?: string
      quantization_level?: string
    }
  }>
}

/**
 * Ollama chat message format
 */
export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Ollama chat request
 */
export interface OllamaChatRequest {
  model: string
  messages: OllamaChatMessage[]
  stream: boolean
}

/**
 * Ollama streaming response chunk
 */
export interface OllamaStreamChunk {
  model?: string
  created_at?: string
  message?: {
    role: string
    content: string
  }
  done: boolean
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  eval_count?: number
  eval_duration?: number
}
