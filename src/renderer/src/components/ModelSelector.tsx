import { ChevronDown, Sparkles, Cloud, HardDrive, Loader2, AlertCircle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { Model, GEMINI_MODELS } from '../types'
import { cn } from '../lib/utils'

interface ModelSelectorProps {
  selectedModel: string
  onModelChange: (modelId: string) => void
  disabled?: boolean
}

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
  const geminiModels = models.filter((m) => m.provider === 'gemini')
  const ollamaModels = models.filter((m) => m.provider === 'ollama')

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
        {currentModel.isLocal ? (
          <HardDrive size={16} className="text-green-400" />
        ) : (
          <Cloud size={16} className="text-blue-400" />
        )}
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
          {/* Cloud Models Section */}
          {geminiModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <Cloud size={14} className="text-blue-400" />
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                    Cloud Models
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

          {/* Local Models Section */}
          {ollamaModels.length > 0 && (
            <>
              <div className="px-4 py-2 bg-tertiary/30 border-b border-tertiary">
                <div className="flex items-center gap-2">
                  <HardDrive size={14} className="text-green-400" />
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
          {!ollamaOnline && geminiModels.length > 0 && (
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
