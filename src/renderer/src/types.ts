export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parent_message_id: string | null
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type ModelProvider = 'gemini' | 'ollama' | 'anthropic'

export interface Model {
  id: string
  name: string
  description: string
  provider: ModelProvider
  isLocal: boolean
}

/**
 * Provider metadata for UI display
 */
export interface ProviderInfo {
  id: ModelProvider
  name: string
  icon: string
  description: string
  isLocal: boolean
  requiresApiKey: boolean
  helpUrl?: string
  placeholder?: string
}

/**
 * Available AI providers
 */
export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🧠',
    description: 'Claude Opus 4.5, Sonnet 4.5 - Advanced reasoning',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api...'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔮',
    description: 'Gemini 2.5 Flash, Pro, and more',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIzaSy...'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '🦙',
    description: 'Run models locally on your machine',
    isLocal: true,
    requiresApiKey: false
  }
]

/**
 * Anthropic Claude models
 */
export const ANTHROPIC_MODELS: Model[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most intelligent - Complex reasoning',
    provider: 'anthropic',
    isLocal: false
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced - Fast & capable',
    provider: 'anthropic',
    isLocal: false
  }
]

// Legacy Gemini models (static list)
export const GEMINI_MODELS: Model[] = [
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast & cost-effective',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Balanced speed & capability',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Fastest, lowest latency',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Advanced reasoning',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-3.0-flash',
    name: 'Gemini 3.0 Flash',
    description: 'Next-gen speed & reasoning',
    provider: 'gemini',
    isLocal: false
  },
  {
    id: 'gemini-3.0-pro',
    name: 'Gemini 3.0 Pro',
    description: 'Most capable, frontier intelligence',
    provider: 'gemini',
    isLocal: false
  }
]

// Backward compatibility
export type GeminiModel = Model
export const AVAILABLE_MODELS = GEMINI_MODELS
