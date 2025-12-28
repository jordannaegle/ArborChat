import { useState, useEffect, useCallback } from 'react'
import {
  Check,
  Edit2,
  Trash2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Key,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ModelSelector } from '../../ModelSelector'
import { PROVIDERS, ProviderInfo } from '../../../types'

interface APIKeysSectionProps {
  selectedModel: string
  onModelChange: (model: string) => void
}

interface ProviderState extends ProviderInfo {
  hasKey: boolean
  isValidating?: boolean
  validationError?: string
}

export function APIKeysSection({ selectedModel, onModelChange }: APIKeysSectionProps) {
  const [providers, setProviders] = useState<ProviderState[]>(
    PROVIDERS.map((p) => ({ ...p, hasKey: false }))
  )
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load configured providers on mount
  const loadConfiguredProviders = useCallback(async () => {
    try {
      const configured = await window.api.credentials.getConfigured()
      setProviders((prev) =>
        prev.map((p) => ({
          ...p,
          hasKey: configured[p.id] === true
        }))
      )
    } catch (err) {
      console.error('Failed to load configured providers:', err)
    }
  }, [])

  useEffect(() => {
    loadConfiguredProviders()
  }, [loadConfiguredProviders])

  const handleSaveKey = async (providerId: string) => {
    if (!keyInput.trim()) return

    setLoading(true)
    setError(null)

    // Update provider to show validating state
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId ? { ...p, isValidating: true, validationError: undefined } : p
      )
    )

    try {
      // Validate the key with the provider
      const isValid = await window.api.credentials.validateKey(providerId, keyInput.trim())

      if (!isValid) {
        setProviders((prev) =>
          prev.map((p) =>
            p.id === providerId
              ? { ...p, isValidating: false, validationError: 'Invalid API key' }
              : p
          )
        )
        setError('Invalid API key. Please check and try again.')
        setLoading(false)
        return
      }

      // Save the validated key
      await window.api.credentials.setKey(providerId, keyInput.trim())

      setProviders((prev) =>
        prev.map((p) =>
          p.id === providerId
            ? { ...p, hasKey: true, isValidating: false, validationError: undefined }
            : p
        )
      )
      setKeyInput('')
      setExpandedProvider(null)
    } catch (err) {
      setError('Failed to save API key')
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, isValidating: false } : p))
      )
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteKey = async (providerId: string) => {
    try {
      await window.api.credentials.deleteKey(providerId)
      setProviders((prev) =>
        prev.map((p) => (p.id === providerId ? { ...p, hasKey: false } : p))
      )
      setExpandedProvider(null)
    } catch (err) {
      setError('Failed to delete API key')
    }
  }

  const toggleProvider = (providerId: string) => {
    if (expandedProvider === providerId) {
      setExpandedProvider(null)
      setKeyInput('')
      setError(null)
    } else {
      setExpandedProvider(providerId)
      setKeyInput('')
      setError(null)
    }
  }

  // Filter to only show providers that require API keys
  const keyProviders = providers.filter((p) => p.requiresApiKey)

  return (
    <div className="space-y-6">
      {/* Model Selection */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-2">Selected Model</label>
        <ModelSelector selectedModel={selectedModel} onModelChange={onModelChange} />
      </div>

      {/* API Keys List */}
      <div>
        <label className="block text-sm font-medium text-text-muted mb-3">API Keys</label>
        <div className="space-y-2">
          {keyProviders.map((provider) => (
            <div
              key={provider.id}
              className="bg-tertiary/50 rounded-lg border border-gray-700 overflow-hidden"
            >
              {/* Provider Header */}
              <button
                onClick={() => toggleProvider(provider.id)}
                className={cn(
                  'w-full px-4 py-3 flex items-center gap-3 text-left',
                  'hover:bg-tertiary/70 transition-colors'
                )}
              >
                <span className="text-xl">{provider.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">{provider.name}</div>
                  <div className="text-xs text-text-muted truncate">{provider.description}</div>
                </div>
                <div className="flex items-center gap-2">
                  {provider.hasKey ? (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <Check size={14} />
                      Configured
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      <Key size={14} />
                      Not set
                    </span>
                  )}
                  {expandedProvider === provider.id ? (
                    <ChevronUp size={16} className="text-text-muted" />
                  ) : (
                    <ChevronDown size={16} className="text-text-muted" />
                  )}
                </div>
              </button>

              {/* Expanded Section */}
              {expandedProvider === provider.id && (
                <div className="px-4 pb-4 border-t border-gray-700/50 space-y-3">
                  <div className="pt-3">
                    {/* Help Link */}
                    {provider.helpUrl && (
                      <a
                        href={provider.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 mb-3"
                      >
                        Get your API key
                        <ExternalLink size={12} />
                      </a>
                    )}

                    {/* Key Input */}
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={keyInput}
                        onChange={(e) => setKeyInput(e.target.value)}
                        placeholder={provider.placeholder || 'Enter API key...'}
                        className={cn(
                          'flex-1 bg-tertiary border rounded-lg px-3 py-2 text-sm text-white',
                          'placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary',
                          provider.validationError ? 'border-red-500' : 'border-gray-700'
                        )}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveKey(provider.id)
                          }
                        }}
                      />
                      <button
                        onClick={() => handleSaveKey(provider.id)}
                        disabled={loading || !keyInput.trim()}
                        className={cn(
                          'px-4 py-2 rounded-lg text-sm font-medium',
                          'bg-primary text-white',
                          'hover:bg-primary/90 transition-colors',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          'flex items-center gap-2'
                        )}
                      >
                        {provider.isValidating ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Validating...
                          </>
                        ) : provider.hasKey ? (
                          <>
                            <Edit2 size={14} />
                            Update
                          </>
                        ) : (
                          <>
                            <Check size={14} />
                            Save
                          </>
                        )}
                      </button>
                    </div>

                    {/* Validation Error */}
                    {provider.validationError && (
                      <div className="flex items-center gap-2 text-xs text-red-400 mt-2">
                        <AlertCircle size={14} />
                        {provider.validationError}
                      </div>
                    )}

                    {/* Delete Button */}
                    {provider.hasKey && (
                      <button
                        onClick={() => handleDeleteKey(provider.id)}
                        className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 mt-3"
                      >
                        <Trash2 size={12} />
                        Remove API key
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Global Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
          <AlertCircle size={16} className="text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      )}
    </div>
  )
}
