import { ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Model, GEMINI_MODELS } from '../types'
import { cn } from '../lib/utils'
import {
  ClaudeIcon,
  OpenAIIcon,
  MistralIcon,
  GeminiIcon,
  GitHubCopilotIcon,
  OllamaIcon
} from './icons'

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
  disabled?: boolean
}

/**
 * Model provider groupings with icons and labels
 */
const PROVIDER_GROUPS = {
  anthropic: {
    icon: ClaudeIcon,
    iconClass: 'text-[#D97757]',
    label: 'Anthropic Claude'
  },
  openai: {
    icon: OpenAIIcon,
    iconClass: 'text-[#10A37F]',
    label: 'OpenAI'
  },
  mistral: {
    icon: MistralIcon,
    iconClass: 'text-[#F7931A]',
    label: 'Mistral AI'
  },
  github: {
    icon: GitHubCopilotIcon,
    iconClass: 'text-[#8B5CF6]',
    label: 'GitHub Copilot'
  },
  gemini: {
    icon: GeminiIcon,
    iconClass: 'text-[#4285F4]',
    label: 'Google Gemini'
  },
  ollama: {
    icon: OllamaIcon,
    iconClass: 'text-white',
    label: 'Local (Ollama)'
  }
} as const

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [models, setModels] = useState<Model[]>(GEMINI_MODELS)
  const [loading, setLoading] = useState(false)
  const [ollamaOnline, setOllamaOnline] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentModel = models.find((m) => m.id === selectedModel) ?? models[0]

  // Fetch models on mount
  useEffect(() => {
    fetchModels()
  }, [])

  async function fetchModels() {
    setLoading(true)
    try {
      const apiKey = await window.api.getApiKey()
      const availableModels = await window.api.getAvailableModels(apiKey)

      if (availableModels && availableModels.length > 0) {
        setModels(availableModels)

        // Check if any Ollama models are present
        const hasOllama = availableModels.some((m: Model) => m.provider === 'ollama')
        setOllamaOnline(hasOllama)
      }
    } catch (error) {
      console.error('[ModelSelector] Failed to fetch models:', error)
      // Fallback to Gemini models only
      setModels(GEMINI_MODELS)
      setOllamaOnline(false)
    } finally {
      setLoading(false)
    }
  }

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Group models by provider
  const anthropicModels = models.filter((m) => m.provider === 'anthropic')
  const openaiModels = models.filter((m) => m.provider === 'openai')
  const mistralModels = models.filter((m) => m.provider === 'mistral')
  const githubModels = models.filter((m) => m.provider === 'github')
  const geminiModels = models.filter((m) => m.provider === 'gemini')
  const ollamaModels = models.filter((m) => m.provider === 'ollama')

  // Get icon for current model
  const getProviderIcon = (provider: string) => {
    const group = PROVIDER_GROUPS[provider as keyof typeof PROVIDER_GROUPS]
    if (!group) return <GeminiIcon size={16} className="text-[#4285F4]" />
    const Icon = group.icon
    return <Icon size={16} className={group.iconClass} />
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg w-full',
          'bg-tertiary border border-gray-700 text-white',
          'hover:bg-tertiary/80 transition-colors',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {getProviderIcon(currentModel.provider)}
        <span className="text-sm font-medium flex-1 text-left">{currentModel.name}</span>
        {loading ? (
          <Loader2 size={14} className="animate-spin text-text-muted" />
        ) : (
          <ChevronDown
            size={14}
            className={cn('text-text-muted transition-transform', isOpen && 'rotate-180')}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-secondary border border-tertiary rounded-lg shadow-xl z-50 overflow-hidden max-h-96 overflow-y-auto">
          {/* Anthropic Claude Models Section */}
          {anthropicModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <ClaudeIcon size={14} className="text-[#D97757]" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Anthropic Claude
                  </span>
                </div>
              </div>
              {anthropicModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors',
                    model.id === selectedModel && 'bg-primary/10 border-l-2 border-primary'
                  )}
                >
                  <div className="text-sm font-medium text-white">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.description}</div>
                </button>
              ))}
            </>
          )}

          {/* OpenAI Models Section */}
          {openaiModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <OpenAIIcon size={14} className="text-[#10A37F]" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    OpenAI
                  </span>
                </div>
              </div>
              {openaiModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors',
                    model.id === selectedModel && 'bg-primary/10 border-l-2 border-primary'
                  )}
                >
                  <div className="text-sm font-medium text-white">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.description}</div>
                </button>
              ))}
            </>
          )}

          {/* Mistral AI Models Section */}
          {mistralModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <MistralIcon size={14} className="text-[#F7931A]" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Mistral AI
                  </span>
                </div>
              </div>
              {mistralModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors',
                    model.id === selectedModel && 'bg-primary/10 border-l-2 border-primary'
                  )}
                >
                  <div className="text-sm font-medium text-white">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.description}</div>
                </button>
              ))}
            </>
          )}

          {/* GitHub Copilot Models Section */}
          {githubModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <GitHubCopilotIcon size={14} className="text-[#8B5CF6]" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    GitHub Copilot
                  </span>
                </div>
              </div>
              {githubModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors',
                    model.id === selectedModel && 'bg-primary/10 border-l-2 border-primary'
                  )}
                >
                  <div className="text-sm font-medium text-white">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.description}</div>
                </button>
              ))}
            </>
          )}

          {/* Gemini Models Section */}
          {geminiModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <GeminiIcon size={14} className="text-[#4285F4]" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Google Gemini
                  </span>
                </div>
              </div>
              {geminiModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors',
                    model.id === selectedModel && 'bg-primary/10 border-l-2 border-primary'
                  )}
                >
                  <div className="text-sm font-medium text-white">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.description}</div>
                </button>
              ))}
            </>
          )}

          {/* Local Models Section (Ollama) */}
          {ollamaModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <OllamaIcon size={14} className="text-white" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Local Models (Ollama)
                  </span>
                </div>
              </div>
              {ollamaModels.map((model) => (
                <button
                  key={model.id}
                  onClick={() => {
                    onModelChange(model.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors',
                    model.id === selectedModel && 'bg-primary/10 border-l-2 border-primary'
                  )}
                >
                  <div className="text-sm font-medium text-white">{model.name}</div>
                  <div className="text-xs text-text-muted">{model.description}</div>
                </button>
              ))}
            </>
          )}

          {/* Ollama Offline Message */}
          {!ollamaOnline && (geminiModels.length > 0 || anthropicModels.length > 0) && (
            <div className="px-4 py-3 bg-tertiary/20 border-t border-tertiary">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-text-muted">
                  <div className="font-medium text-yellow-500">Ollama not detected</div>
                  <div className="mt-1">Install Ollama to use local models</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
