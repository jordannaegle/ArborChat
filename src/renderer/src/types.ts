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

export type ModelProvider = 'gemini' | 'ollama' | 'anthropic' | 'github' | 'openai' | 'mistral'

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
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    description: 'GPT-4.1, o3, o4 - Cutting-edge AI',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://platform.openai.com/api-keys',
    placeholder: 'sk-...'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: '🌬️',
    description: 'Mistral Large, Codestral - European AI excellence',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://console.mistral.ai/api-keys',
    placeholder: 'sk-...'
  },
  {
    id: 'github',
    name: 'GitHub Copilot',
    icon: '🐙',
    description: 'GPT-4o, Llama, Mistral via GitHub Models',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://github.com/settings/tokens',
    placeholder: 'ghp_...'
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

/**
 * GitHub Copilot models (via GitHub Models API)
 */
export const GITHUB_COPILOT_MODELS: Model[] = [
  {
    id: 'github:openai/gpt-4o',
    name: 'GPT-4o (GitHub)',
    description: 'OpenAI GPT-4o via GitHub Models',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:openai/gpt-4o-mini',
    name: 'GPT-4o Mini (GitHub)',
    description: 'Fast & cost-effective via GitHub',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:openai/o1',
    name: 'OpenAI o1 (GitHub)',
    description: 'Advanced reasoning model',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:openai/o1-mini',
    name: 'OpenAI o1-mini (GitHub)',
    description: 'Fast reasoning model',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:meta/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B (GitHub)',
    description: 'Meta Llama 3.3 70B instruction-tuned',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:mistral-ai/mistral-large-2411',
    name: 'Mistral Large (GitHub)',
    description: 'Mistral AI flagship model',
    provider: 'github',
    isLocal: false
  },
  {
    id: 'github:deepseek/deepseek-r1',
    name: 'DeepSeek R1 (GitHub)',
    description: 'Advanced reasoning model',
    provider: 'github',
    isLocal: false
  }
]

/**
 * Mistral AI models (direct API)
 */
export const MISTRAL_MODELS: Model[] = [
  {
    id: 'mistral-large-latest',
    name: 'Mistral Large',
    description: 'Flagship - Complex reasoning & analysis',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'mistral-medium-latest',
    name: 'Mistral Medium',
    description: 'Balanced - Cost-effective reasoning',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'mistral-small-latest',
    name: 'Mistral Small',
    description: 'Fast & efficient for simple tasks',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'codestral-latest',
    name: 'Codestral',
    description: 'Specialized for code generation',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'ministral-8b-latest',
    name: 'Ministral 8B',
    description: 'Compact model for edge deployment',
    provider: 'mistral',
    isLocal: false
  },
  {
    id: 'pixtral-large-latest',
    name: 'Pixtral Large',
    description: 'Multimodal - Vision & text',
    provider: 'mistral',
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
  }
]

// Backward compatibility
export type GeminiModel = Model
export const AVAILABLE_MODELS = GEMINI_MODELS
