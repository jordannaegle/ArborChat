import { ChevronDown, Loader2, AlertCircle } from 'lucide-react'
import { useState, useRef, useEffect, useCallback, type ComponentType } from 'react'
import { Model, ModelCatalog, ProviderModelState, ModelProvider } from '../types'
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

const PROVIDER_GROUPS: Record<
  ModelProvider,
  {
    icon: ComponentType<{ size?: number; className?: string }>
    iconClass: string
    label: string
  }
> = {
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
}

const PROVIDER_ORDER: ModelProvider[] = [
  'anthropic',
  'openai',
  'mistral',
  'github',
  'gemini',
  'ollama'
]

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [models, setModels] = useState<Model[]>([])
  const [providerStates, setProviderStates] = useState<Record<string, ProviderModelState>>({})
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentModel = models.find((m) => m.id === selectedModel) ?? null

  const applyCatalog = useCallback(
    async (catalog: ModelCatalog) => {
      const availableModels = catalog.models || []
      setModels(availableModels)
      setProviderStates(catalog.providerStates || {})

      if (availableModels.length === 0) {
        return
      }

      if (!availableModels.some((model) => model.id === selectedModel)) {
        const configuredProviders = await window.api.credentials.getConfigured()
        const fallbackModel =
          availableModels.find(
            (model) => model.provider === 'ollama' || configuredProviders[model.provider] === true
          ) || availableModels[0]

        if (fallbackModel && fallbackModel.id !== selectedModel) {
          onModelChange(fallbackModel.id)
        }
      }
    },
    [onModelChange, selectedModel]
  )

  const fetchCatalog = useCallback(async () => {
    setLoading(true)
    try {
      const catalog = await window.api.models.getCatalog()
      await applyCatalog(catalog)
    } catch (error) {
      console.error('[ModelSelector] Failed to fetch model catalog:', error)
      setModels([])
    } finally {
      setLoading(false)
    }
  }, [applyCatalog])

  useEffect(() => {
    fetchCatalog()

    const unsubscribe = window.api.models.onUpdated((catalog) => {
      void applyCatalog(catalog)
    })

    return () => {
      unsubscribe()
    }
  }, [fetchCatalog, applyCatalog])

  useEffect(() => {
    if (isOpen) {
      fetchCatalog()
    }
  }, [isOpen, fetchCatalog])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const groupedModels: Record<ModelProvider, Model[]> = {
    anthropic: models.filter((m) => m.provider === 'anthropic'),
    openai: models.filter((m) => m.provider === 'openai'),
    mistral: models.filter((m) => m.provider === 'mistral'),
    github: models.filter((m) => m.provider === 'github'),
    gemini: models.filter((m) => m.provider === 'gemini'),
    ollama: models.filter((m) => m.provider === 'ollama')
  }

  const getProviderIcon = (provider?: ModelProvider) => {
    const group = provider ? PROVIDER_GROUPS[provider] : undefined
    if (!group) return <GeminiIcon size={16} className="text-[#4285F4]" />
    const Icon = group.icon
    return <Icon size={16} className={group.iconClass} />
  }

  const renderProviderStatus = (provider: ModelProvider) => {
    const state = providerStates[provider]
    if (!state || groupedModels[provider].length > 0) {
      return null
    }

    if (state.status === 'refreshing') {
      return (
        <div key={`${provider}-loading`} className="px-4 py-3 border-b border-tertiary/50">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />
            Checking available {PROVIDER_GROUPS[provider].label} models...
          </div>
        </div>
      )
    }

    if (state.status === 'error') {
      return (
        <div key={`${provider}-error`} className="px-4 py-3 border-b border-tertiary/50">
          <div className="text-xs text-red-400">{state.message || `Unable to load ${PROVIDER_GROUPS[provider].label} models`}</div>
        </div>
      )
    }

    return null
  }

  const renderModelSection = (provider: ModelProvider) => {
    const providerModels = groupedModels[provider]
    if (providerModels.length === 0) {
      return null
    }

    const { icon: Icon, iconClass, label } = PROVIDER_GROUPS[provider]

    return (
      <div key={provider}>
        <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
          <div className="flex items-center gap-2">
            <Icon size={14} className={iconClass} />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">{label}</span>
          </div>
        </div>

        {providerModels.map((model) => (
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
      </div>
    )
  }

  const ollamaState = providerStates.ollama
  const hasCloudModels =
    groupedModels.anthropic.length > 0 ||
    groupedModels.openai.length > 0 ||
    groupedModels.mistral.length > 0 ||
    groupedModels.github.length > 0 ||
    groupedModels.gemini.length > 0

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
        {getProviderIcon(currentModel?.provider)}
        <span className="text-sm font-medium flex-1 text-left">
          {currentModel?.name || (loading ? 'Loading models...' : 'No available models')}
        </span>
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
          {PROVIDER_ORDER.map((provider) => renderProviderStatus(provider))}
          {PROVIDER_ORDER.map((provider) => renderModelSection(provider))}

          {models.length === 0 && (
            <div className="px-4 py-4 text-xs text-text-muted">
              No verified models found for the configured providers. Add a token and wait for model discovery.
            </div>
          )}

          {hasCloudModels && groupedModels.ollama.length === 0 && ollamaState?.status === 'error' && (
            <div className="px-4 py-3 bg-tertiary/20 border-t border-tertiary">
              <div className="flex items-start gap-2">
                <AlertCircle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-text-muted">
                  <div className="font-medium text-yellow-500">Ollama not detected</div>
                  <div className="mt-1">Install and run Ollama to use local models</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
