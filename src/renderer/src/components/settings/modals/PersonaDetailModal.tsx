import { useState, useEffect, useCallback } from 'react'
import {
  X,
  Edit2,
  Save,
  Calendar,
  Tag,
  AlertCircle,
  Loader2
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { Persona, UpdatePersonaInput } from '../../../types/persona'

// Validation constants (must match service.ts)
const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500
const MAX_CONTENT_LENGTH = 100000 // 100KB

interface PersonaDetailModalProps {
  persona: Persona
  isEditing: boolean
  onClose: () => void
  onEdit: () => void
  onSave: (updates: UpdatePersonaInput) => Promise<void>
}

interface ValidationErrors {
  name?: string
  description?: string
  content?: string
}

export function PersonaDetailModal({
  persona,
  isEditing,
  onClose,
  onEdit,
  onSave
}: PersonaDetailModalProps) {
  const [name, setName] = useState(persona.name)
  const [emoji, setEmoji] = useState(persona.emoji)
  const [description, setDescription] = useState(persona.description)
  const [content, setContent] = useState(persona.content)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({})

  // Reset form when persona changes
  useEffect(() => {
    setName(persona.name)
    setEmoji(persona.emoji)
    setDescription(persona.description)
    setContent(persona.content)
    setError(null)
    setValidationErrors({})
  }, [persona])

  // Validate input fields
  const validate = useCallback((): boolean => {
    const errors: ValidationErrors = {}

    if (!name.trim()) {
      errors.name = 'Name is required'
    } else if (name.length > MAX_NAME_LENGTH) {
      errors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
    } else if (!/^[a-zA-Z0-9]/.test(name)) {
      errors.name = 'Name must start with a letter or number'
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
    }

    if (!content.trim()) {
      errors.content = 'Persona instructions are required'
    } else if (content.length > MAX_CONTENT_LENGTH) {
      errors.content = `Content is too large (max ${Math.round(MAX_CONTENT_LENGTH / 1000)}KB)`
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }, [name, description, content])

  const handleSave = async () => {
    if (!validate()) return

    setSaving(true)
    setError(null)
    
    try {
      await onSave({
        name,
        emoji,
        description,
        content
      })
    } catch (err: any) {
      setError(err.message || 'Failed to save persona')
      console.error('Failed to save persona:', err)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Character count helper
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
          "relative w-full max-w-3xl max-h-[90vh] overflow-y-auto",
          "bg-background rounded-xl border border-secondary",
          "shadow-2xl shadow-black/50"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-secondary bg-background z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-2xl">
              {isEditing ? (
                <input
                  type="text"
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value.slice(-2))}
                  className="w-full h-full text-center bg-transparent focus:outline-none"
                />
              ) : (
                emoji
              )}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={cn(
                      "text-lg font-bold text-white bg-transparent w-full",
                      "border-b focus:outline-none",
                      validationErrors.name 
                        ? "border-red-400 focus:border-red-400" 
                        : "border-primary/50 focus:border-primary"
                    )}
                  />
                  {validationErrors.name && (
                    <p className="text-xs text-red-400 mt-1">{validationErrors.name}</p>
                  )}
                </div>
              ) : (
                <h2 className="text-lg font-bold text-white">{persona.name}</h2>
              )}
              <p className="text-xs text-text-muted">Persona Details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <button
                onClick={onEdit}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
              >
                <Edit2 size={14} />
                Edit
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-4 mt-4 flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
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

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Metadata */}
          <div className="flex flex-wrap gap-4 text-sm text-text-muted">
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>Created: {formatDate(persona.created)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar size={14} />
              <span>Modified: {formatDate(persona.modified)}</span>
            </div>
          </div>

          {/* Tags */}
          {persona.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={14} className="text-text-muted" />
              {persona.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs text-text-muted bg-secondary px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-text-normal">
                Description
              </label>
              {isEditing && (
                <CharacterCount current={description.length} max={MAX_DESCRIPTION_LENGTH} />
              )}
            </div>
            {isEditing ? (
              <div>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of this persona"
                  className={cn(
                    "w-full px-3 py-2 rounded-lg",
                    "bg-secondary border",
                    validationErrors.description
                      ? "border-red-400"
                      : "border-secondary/50",
                    "text-white placeholder-text-muted/50",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                />
                {validationErrors.description && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.description}</p>
                )}
              </div>
            ) : (
              <p className="text-text-muted">{persona.description || 'No description'}</p>
            )}
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-text-normal">
                Persona Instructions
              </label>
              {isEditing && (
                <CharacterCount 
                  current={content.length} 
                  max={MAX_CONTENT_LENGTH} 
                  warning={0.9}
                />
              )}
            </div>
            {isEditing ? (
              <div>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={16}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg resize-none font-mono text-sm",
                    "bg-secondary border",
                    validationErrors.content
                      ? "border-red-400"
                      : "border-secondary/50",
                    "text-white placeholder-text-muted/50",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                />
                {validationErrors.content && (
                  <p className="text-xs text-red-400 mt-1">{validationErrors.content}</p>
                )}
              </div>
            ) : (
              <div className={cn(
                "max-h-96 overflow-y-auto p-4 rounded-lg",
                "bg-secondary/50 border border-secondary/30",
                "font-mono text-sm text-text-normal whitespace-pre-wrap"
              )}>
                {persona.content}
              </div>
            )}
          </div>
        </div>

        {/* Footer (only when editing) */}
        {isEditing && (
          <div className="sticky bottom-0 flex justify-end gap-3 p-4 border-t border-secondary bg-background">
            <button
              onClick={onClose}
              className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-lg",
                "bg-primary hover:bg-primary/90 text-white font-medium",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
