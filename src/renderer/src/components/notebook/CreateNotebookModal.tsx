/**
 * CreateNotebookModal
 *
 * Modal for creating a new notebook with name, description, emoji, and color.
 *
 * @module components/notebook/CreateNotebookModal
 */

import { useState, useEffect } from 'react'
import { X, BookOpen, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { NOTEBOOK_EMOJIS, NOTEBOOK_COLORS } from '../../types/notebook'

interface CreateNotebookModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: {
    name: string
    description?: string
    emoji?: string
    color?: string
  }) => Promise<void>
}

export function CreateNotebookModal({ isOpen, onClose, onSubmit }: CreateNotebookModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📓')
  const [color, setColor] = useState('default')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setName('')
      setDescription('')
      setEmoji('📓')
      setColor('default')
      setError(null)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Please enter a notebook name')
      return
    }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        emoji,
        color
      })
    } catch (err) {
      setError('Failed to create notebook')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, isSubmitting, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose()
      }}
    >
      <div
        className={cn(
          'bg-tertiary rounded-xl w-full max-w-md shadow-2xl',
          'border border-secondary/50',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary/50">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Create Notebook</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              'p-1.5 rounded-lg text-text-muted',
              'hover:text-white hover:bg-secondary transition-colors',
              'disabled:opacity-50'
            )}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Notebook"
              autoFocus
              disabled={isSubmitting}
              className={cn(
                'w-full px-3 py-2 rounded-lg',
                'bg-secondary border border-secondary/50',
                'text-text-normal placeholder-text-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                'disabled:opacity-50'
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this notebook for?"
              rows={2}
              disabled={isSubmitting}
              className={cn(
                'w-full px-3 py-2 rounded-lg resize-none',
                'bg-secondary border border-secondary/50',
                'text-text-normal placeholder-text-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                'disabled:opacity-50'
              )}
            />
          </div>

          {/* Emoji Picker */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Icon
            </label>
            <div className="flex flex-wrap gap-1">
              {NOTEBOOK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  disabled={isSubmitting}
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center text-xl',
                    'transition-colors',
                    emoji === e
                      ? 'bg-amber-500/20 ring-2 ring-amber-500'
                      : 'hover:bg-secondary',
                    'disabled:opacity-50'
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Color
            </label>
            <div className="flex flex-wrap gap-2">
              {NOTEBOOK_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  disabled={isSubmitting}
                  className={cn(
                    'w-8 h-8 rounded-lg border-2 transition-all',
                    c.class,
                    color === c.id
                      ? 'ring-2 ring-amber-500 ring-offset-2 ring-offset-tertiary'
                      : 'border-transparent hover:scale-110',
                    'disabled:opacity-50'
                  )}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-secondary/50">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className={cn(
              'px-4 py-2 rounded-lg',
              'text-text-muted hover:text-text-normal hover:bg-secondary',
              'transition-colors',
              'disabled:opacity-50'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name.trim()}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-amber-500 hover:bg-amber-600 text-white font-medium',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : (
              'Create Notebook'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CreateNotebookModal
