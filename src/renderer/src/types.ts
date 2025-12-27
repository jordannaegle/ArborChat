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

export type ModelProvider = 'gemini' | 'ollama'

export interface Model {
  id: string
  name: string
  description: string
  provider: ModelProvider
  isLocal: boolean
}

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
