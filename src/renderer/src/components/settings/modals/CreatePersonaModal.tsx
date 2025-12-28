import { useState, useCallback } from 'react'
import {
  X,
  Wand2,
  User,
  FileText,
  Sparkles,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { cn } from '../../../lib/utils'

// Validation constants (must match service.ts)
const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500
const MAX_CONTENT_LENGTH = 100000 // 100KB
const RESERVED_NAMES = ['default', 'system', 'none', 'null', 'undefined']

interface CreatePersonaModalProps {
  onClose: () => void
  onCreated: () => void
}

type CreateMode = 'generate' | 'manual'

interface ValidationErrors {
  name?: string
  description?: string
  content?: string
}

export function CreatePersonaModal({ onClose, onCreated }: CreatePersonaModalProps) {
  const [mode, setMode] = useState<CreateMode>('generate')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [emoji, setEmoji] = useState('🤖')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Validate input fields
  const validate = useCallback((): boolean => {
    const errors: ValidationErrors = {}

    if (!name.trim()) {
      errors.name = 'Name is required'
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
    } else if (!/^[a-zA-Z0-9]/.test(name)) {
      errors.name = 'Name must start with a letter or number'
    } else if (RESERVED_NAMES.includes(name.toLowerCase())) {
      errors.name = `"${name}" is a reserved name`
    }

    if (mode === 'generate') {
      if (!description.trim()) {
        errors.description = 'Description is required for AI generation'
      }
    } else {
      if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
      }
      if (!content.trim()) {
        errors.content = 'Persona instructions are required'
      } else if (content.length > MAX_CONTENT_LENGTH) {
        errors.content = `Content is too large (max ${Math.round(MAX_CONTENT_LENGTH / 1000)}KB)`
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, description, content, mode])

  // Clear field-specific error when user starts typing
  const handleNameChange = (value: string) => {
    setName(value)
    if (validationErrors.name) {
      setValidationErrors(prev => ({ ...prev, name: undefined }))
    }
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    if (validationErrors.description) {
      setValidationErrors(prev => ({ ...prev, description: undefined }))
    }
  }

  const handleContentChange = (value: string) => {
    setContent(value)
    if (validationErrors.content) {
      setValidationErrors(prev => ({ ...prev, content: undefined }))
    }
  }

  const handleGenerate = async () => {
    if (!validate()) return

    setLoading(true)
    setError(null)

    try {
      const generated = await window.api.personas.generate(description, name)
      
      // Create the persona with generated content
      await window.api.personas.create({
        name: generated.name || name,
        emoji: generated.emoji || '🤖',
        description: generated.description || description,
        content: generated.content,
        tags: generated.tags
      })

      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to generate persona')
    } finally {
      setLoading(false)
    }
  }

  const handleManualCreate = async () => {
    if (!validate()) return

    setLoading(true)
    setError(null)

    try {
      await window.api.personas.create({
        name,
        emoji,
        description,
        content
      })

      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create persona')
    } finally {
      setLoading(false)
    }
  }

  // Character count helper component
  const CharacterCount = ({ current, max, warning = 0.8 }: { 
    current: number
    max: number 
    warning?: number
  }) => {
    const percentage = current / max
    const isWarning = percentage >= warning
    const isError = percentage >= 1
    
    return (
      <span className={cn(
        "text-xs",
        isError ? "text-red-400" : isWarning ? "text-yellow-400" : "text-text-muted/60"
      )}>
        {current.toLocaleString()}/{max.toLocaleString()}
      </span>
    )
  }

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div 
        className={cn(
          "relative w-full max-w-2xl max-h-[90vh] overflow-y-auto",
          "bg-background rounded-xl border border-secondary",
          "shadow-2xl shadow-black/50"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-secondary bg-background z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Persona</h2>
              <p className="text-xs text-text-muted">Define a custom AI personality</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Mode Selection */}
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
            <button
              onClick={() => {
                setMode('generate')
                setValidationErrors({})
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md",
                "text-sm font-medium transition-all",
                mode === 'generate'
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-white"
              )}
            >
              <Wand2 size={16} />
              AI Generate
            </button>
            <button
              onClick={() => {
                setMode('manual')
                setValidationErrors({})
              }}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md",
                "text-sm font-medium transition-all",
                mode === 'manual'
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-white"
              )}
            >
              <FileText size={16} />
              Write Manually
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
              <AlertCircle size={18} className="text-red-400 shrink-0" />
              <span className="text-sm text-red-400 flex-1">{error}</span>
              <button
                onClick={() => setError(null)}
                className="p-1 text-red-400 hover:text-red-300 rounded"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-normal">
                  Persona Name <span className="text-red-400">*</span>
                </label>
                <CharacterCount current={name.length} max={MAX_NAME_LENGTH} />
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g., Senior Developer, Creative Writer..."
                className={cn(
                  "w-full px-3 py-2 rounded-lg",
                  "bg-secondary border",
                  validationErrors.name
                    ? "border-red-400 focus:ring-red-400/50"
                    : "border-secondary/50 focus:ring-primary/50",
                  "text-white placeholder-text-muted/50",
                  "focus:outline-none focus:ring-2"
                )}
              />
              {validationErrors.name && (
                <p className="text-xs text-red-400 mt-1">{validationErrors.name}</p>
              )}
            </div>

            {mode === 'generate' ? (
              /* AI Generation Description */
              <div>
                <label className="block text-sm font-medium text-text-normal mb-1.5">
                  Describe Your Persona <span className="text-red-400">*</span>
                </label>
                <textarea
                  value={description}
                  onChange={(e) => handleDescriptionChange(e.target.value)}
                  placeholder="Describe the persona you want to create. Be specific about their expertise, communication style, and how they should behave..."
                  rows={6}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg resize-none",
                    "bg-secondary border",
                    validationErrors.description
                      ? "border-red-400 focus:ring-red-400/50"
                      : "border-secondary/50 focus:ring-primary/50",
                    "text-white placeholder-text-muted/50",
                    "focus:outline-none focus:ring-2"
                  )}
                />
                {validationErrors.description && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.description}</p>
                )}
                <p className="mt-1.5 text-xs text-text-muted">
                  The AI will generate a complete persona definition based on your description
                </p>
              </div>
            ) : (
              /* Manual Content Entry */
              <>
                {/* Emoji & Description Row */}
                <div className="grid grid-cols-[80px_1fr] gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-normal mb-1.5">
                      Emoji
                    </label>
                    <input
                      type="text"
                      value={emoji}
                      onChange={(e) => setEmoji(e.target.value.slice(-2))}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-center text-2xl",
                        "bg-secondary border border-secondary/50",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                      )}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-sm font-medium text-text-normal">
                        Short Description
                      </label>
                      <CharacterCount current={description.length} max={MAX_DESCRIPTION_LENGTH} />
                    </div>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => handleDescriptionChange(e.target.value)}
                      placeholder="Brief description of this persona"
                      className={cn(
                        "w-full px-3 py-2 rounded-lg",
                        "bg-secondary border",
                        validationErrors.description
                          ? "border-red-400 focus:ring-red-400/50"
                          : "border-secondary/50 focus:ring-primary/50",
                        "text-white placeholder-text-muted/50",
                        "focus:outline-none focus:ring-2"
                      )}
                    />
                    {validationErrors.description && (
                      <p className="text-xs text-red-400 mt-1">{validationErrors.description}</p>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-text-normal">
                      Persona Instructions <span className="text-red-400">*</span>
                    </label>
                    <CharacterCount 
                      current={content.length} 
                      max={MAX_CONTENT_LENGTH} 
                      warning={0.9}
                    />
                  </div>
                  <textarea
                    value={content}
                    onChange={(e) => handleContentChange(e.target.value)}
                    placeholder="Write the system prompt instructions for this persona. This will be injected into the AI context when the persona is active..."
                    rows={12}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg resize-none font-mono text-sm",
                      "bg-secondary border",
                      validationErrors.content
                        ? "border-red-400 focus:ring-red-400/50"
                        : "border-secondary/50 focus:ring-primary/50",
                      "text-white placeholder-text-muted/50",
                      "focus:outline-none focus:ring-2"
                    )}
                  />
                  {validationErrors.content && (
                    <p className="text-xs text-red-400 mt-1">{validationErrors.content}</p>
                  )}
                  <p className="mt-1.5 text-xs text-text-muted">
                    Write in Markdown. Describe who the persona is, their expertise, communication style, and guidelines.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 p-4 border-t border-secondary bg-background">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'generate' ? handleGenerate : handleManualCreate}
            disabled={loading}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90 text-white font-medium",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === 'generate' ? 'Generating...' : 'Creating...'}
              </>
            ) : mode === 'generate' ? (
              <>
                <Sparkles size={16} />
                Generate Persona
              </>
            ) : (
              'Create Persona'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
