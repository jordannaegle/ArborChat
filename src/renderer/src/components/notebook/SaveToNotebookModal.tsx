/**
 * SaveToNotebookModal
 *
 * Modal for saving chat content to notebooks.
 * Allows selecting existing notebooks or creating new ones inline.
 *
 * Security: Content is sanitized through IPC boundary before storage.
 *
 * @module components/notebook/SaveToNotebookModal
 */

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, BookOpen, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useNotebooks } from '../../hooks'
import type { Notebook } from '../../types/notebook'
import { NOTEBOOK_EMOJIS } from '../../types/notebook'

interface SaveToNotebookModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
  sourceMessageId?: string
  sourceConversationId?: string
  sourceRole?: 'user' | 'assistant'
}

export function SaveToNotebookModal({
  isOpen,
  onClose,
  content,
  sourceMessageId,
  sourceConversationId,
  sourceRole
}: SaveToNotebookModalProps) {
  const { notebooks, loading, createNotebook, createEntry } = useNotebooks()

  // Selection state
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  // New notebook form
  const [newNotebookName, setNewNotebookName] = useState('')
  const [newNotebookEmoji, setNewNotebookEmoji] = useState('📓')

  // Entry form
  const [entryTitle, setEntryTitle] = useState('')

  // Operation state
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedNotebookId(null)
      setIsCreatingNew(false)
      setNewNotebookName('')
      setNewNotebookEmoji('📓')
      setEntryTitle('')
      setSaving(false)
      setSuccess(false)
      setError(null)
    }
  }, [isOpen])

  const handleSave = useCallback(async () => {
    if (saving) return
    setError(null)
    setSaving(true)

    try {
      let targetNotebookId = selectedNotebookId

      // Create new notebook if needed
      if (isCreatingNew) {
        if (!newNotebookName.trim()) {
          setError('Please enter a notebook name')
          setSaving(false)
          return
        }
        const newNotebook = await createNotebook({
          name: newNotebookName.trim(),
          emoji: newNotebookEmoji
        })
        targetNotebookId = newNotebook.id
      }

      if (!targetNotebookId) {
        setError('Please select a notebook')
        setSaving(false)
        return
      }

      // Create the entry
      await createEntry({
        notebook_id: targetNotebookId,
        content,
        source_message_id: sourceMessageId,
        source_conversation_id: sourceConversationId,
        source_role: sourceRole,
        title: entryTitle.trim() || undefined
      })

      setSuccess(true)

      // Close after showing success
      setTimeout(() => {
        onClose()
      }, 800)
    } catch (err) {
      console.error('[SaveToNotebookModal] Failed to save:', err)
      setError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [
    saving,
    selectedNotebookId,
    isCreatingNew,
    newNotebookName,
    newNotebookEmoji,
    content,
    sourceMessageId,
    sourceConversationId,
    sourceRole,
    entryTitle,
    createNotebook,
    createEntry,
    onClose
  ])

  const canSave =
    (selectedNotebookId || (isCreatingNew && newNotebookName.trim())) && !saving && !success

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !saving) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, saving, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose()
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
            <h2 className="text-lg font-semibold text-white">Save to Notebook</h2>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className={cn(
              'p-1.5 rounded-lg text-text-muted',
              'hover:text-white hover:bg-secondary transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {/* Content Preview */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Content Preview
            </label>
            <div className="bg-secondary/50 rounded-lg p-3 max-h-24 overflow-y-auto">
              <p className="text-sm text-text-normal whitespace-pre-wrap line-clamp-4">
                {content.length > 300 ? content.slice(0, 300) + '...' : content}
              </p>
            </div>
          </div>

          {/* Optional Title */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Title (Optional)
            </label>
            <input
              type="text"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Add a title for this entry..."
              disabled={saving || success}
              className={cn(
                'w-full px-3 py-2 rounded-lg',
                'bg-secondary border border-secondary/50',
                'text-text-normal placeholder-text-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                'disabled:opacity-50'
              )}
            />
          </div>

          {/* Notebook Selection */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Select Notebook
            </label>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-text-muted" size={24} />
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {/* Create New Option */}
                <button
                  onClick={() => {
                    setIsCreatingNew(true)
                    setSelectedNotebookId(null)
                  }}
                  disabled={saving || success}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
                    'border border-dashed',
                    isCreatingNew
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-secondary hover:border-amber-500/50 hover:bg-secondary/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center',
                      isCreatingNew ? 'bg-amber-500/20' : 'bg-secondary'
                    )}
                  >
                    <Plus
                      size={20}
                      className={isCreatingNew ? 'text-amber-400' : 'text-text-muted'}
                    />
                  </div>
                  <div className="text-left">
                    <p
                      className={cn(
                        'font-medium',
                        isCreatingNew ? 'text-amber-400' : 'text-text-normal'
                      )}
                    >
                      Create New Notebook
                    </p>
                    <p className="text-xs text-text-muted">Start a fresh collection</p>
                  </div>
                </button>

                {/* New notebook form */}
                {isCreatingNew && (
                  <div className="pl-4 space-y-2">
                    <input
                      type="text"
                      value={newNotebookName}
                      onChange={(e) => setNewNotebookName(e.target.value)}
                      placeholder="Enter notebook name..."
                      autoFocus
                      disabled={saving || success}
                      className={cn(
                        'w-full px-3 py-2 rounded-lg',
                        'bg-secondary border border-amber-500/30',
                        'text-text-normal placeholder-text-muted/50',
                        'focus:outline-none focus:ring-2 focus:ring-amber-500/50',
                        'disabled:opacity-50'
                      )}
                    />
                    {/* Emoji picker */}
                    <div className="flex flex-wrap gap-1">
                      {NOTEBOOK_EMOJIS.slice(0, 12).map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => setNewNotebookEmoji(emoji)}
                          disabled={saving || success}
                          className={cn(
                            'w-8 h-8 rounded flex items-center justify-center text-lg',
                            'transition-colors',
                            newNotebookEmoji === emoji
                              ? 'bg-amber-500/20 ring-2 ring-amber-500'
                              : 'hover:bg-secondary',
                            'disabled:opacity-50'
                          )}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Notebooks */}
                {notebooks.map((notebook) => (
                  <NotebookOption
                    key={notebook.id}
                    notebook={notebook}
                    selected={selectedNotebookId === notebook.id}
                    disabled={saving || success}
                    onSelect={() => {
                      setSelectedNotebookId(notebook.id)
                      setIsCreatingNew(false)
                    }}
                  />
                ))}

                {notebooks.length === 0 && !isCreatingNew && (
                  <p className="text-center text-text-muted py-4 text-sm">
                    No notebooks yet. Create your first one above!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-secondary/50">
          <button
            onClick={onClose}
            disabled={saving}
            className={cn(
              'px-4 py-2 rounded-lg',
              'text-text-muted hover:text-text-normal hover:bg-secondary',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg',
              'bg-amber-500 hover:bg-amber-600 text-white font-medium',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check size={16} />
                Saved!
              </>
            ) : (
              <>
                <BookOpen size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ Sub-Components ============

interface NotebookOptionProps {
  notebook: Notebook
  selected: boolean
  disabled: boolean
  onSelect: () => void
}

function NotebookOption({ notebook, selected, disabled, onSelect }: NotebookOptionProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg transition-colors',
        'border',
        selected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-secondary/50 hover:border-secondary hover:bg-secondary/30',
        'disabled:opacity-50 disabled:cursor-not-allowed'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center text-xl',
          selected ? 'bg-amber-500/20' : 'bg-secondary'
        )}
      >
        {notebook.emoji}
      </div>
      <div className="text-left flex-1 min-w-0">
        <p className={cn('font-medium truncate', selected ? 'text-amber-400' : 'text-text-normal')}>
          {notebook.name}
        </p>
        <p className="text-xs text-text-muted">
          {notebook.entry_count} {notebook.entry_count === 1 ? 'entry' : 'entries'}
        </p>
      </div>
      {selected && <Check size={18} className="text-amber-400 shrink-0" />}
    </button>
  )
}

export default SaveToNotebookModal
