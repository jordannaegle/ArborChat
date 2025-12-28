// src/main/credentials/types.ts

/**
 * Supported AI provider identifiers
 */
export type ProviderId = 'anthropic' | 'gemini' | 'ollama' | 'openai'

/**
 * Individual provider credential
 */
export interface ProviderCredential {
  apiKey: string
  createdAt: string
  lastUsedAt?: string
  metadata?: Record<string, unknown>
}

/**
 * Encrypted credentials structure
 */
export interface EncryptedCredentials {
  version: number
  providers: {
    [K in ProviderId]?: ProviderCredential
  }
}

/**
 * Provider metadata for UI display
 */
export interface ProviderInfo {
  id: ProviderId
  name: string
  icon: string
  description: string
  isLocal: boolean
  requiresApiKey: boolean
  helpUrl?: string
  keyPlaceholder?: string
  keyPattern?: RegExp
}

/**
 * Model capabilities for feature detection
 */
export interface ModelCapabilities {
  streaming: boolean
  systemPrompt: boolean
  vision: boolean
  toolUse: boolean
  maxTokens?: number
}
