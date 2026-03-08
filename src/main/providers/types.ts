import { BrowserWindow } from 'electron'
import type { ProviderId } from '../credentials'

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
  enableTools?: boolean  // Enable native tool calling (if provider supports it)
}

/**
 * Represents an AI model from any provider
 */
export interface AIModel {
  id: string
  name: string
  description: string
  provider: 'gemini' | 'ollama' | 'anthropic' | 'github' | 'openai' | 'mistral'
  isLocal: boolean
}

export type ModelAccessStatus = 'verified' | 'denied' | 'transient_error' | 'stale'
export type ProviderValidationStatus =
  | 'ok'
  | 'invalid_key'
  | 'insufficient_scope'
  | 'network_error'
  | 'rate_limited'

export interface ProviderValidationResult {
  status: ProviderValidationStatus
  message?: string
}

export interface ModelProbeResult {
  status: Extract<ModelAccessStatus, 'verified' | 'denied' | 'transient_error'>
  code?: string
  message?: string
}

export interface ProviderDiscoveryState {
  providerId: ProviderId
  status: 'idle' | 'refreshing' | 'ready' | 'no_key' | 'error'
  modelCount: number
  lastRefreshAt?: number
  message?: string
}

export interface ModelDiscoveryResult {
  models: AIModel[]
  providerStates: Record<ProviderId, ProviderDiscoveryState>
  refreshedAt: number
}

export interface EnsureUsableModelResult {
  usable: boolean
  requestedModelId: string
  resolvedModelId: string | null
  providerId: ProviderId | null
  switched: boolean
  reason?: string
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
