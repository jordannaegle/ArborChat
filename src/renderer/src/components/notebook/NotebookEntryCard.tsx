/**
 * NotebookEntryCard
 *
 * Individual entry card with content preview, editing, and actions.
 *
 * @module components/notebook/NotebookEntryCard
 */

import { useState, useRef, useEffect } from 'react'
import {
  Trash2,
  Copy,
  Check,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Edit2,
  X,
  Tag,
  GripVertical
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { NotebookEntry, UpdateEntryInput } from '../../types/notebook'

interface NotebookEntryCardProps {
  entry: NotebookEntry
  onDelete: () => Promise<boolean>
  onUpdate?: (input: UpdateEntryInput) => Promise<boolean>
  isDragging?: boolean
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>
}

export function NotebookEntryCard({
  entry,
  onDelete,
  onUpdate,
  isDragging = false,
  dragHandleProps
}: NotebookEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Editing state
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(entry.content)
  const [editTitle, setEditTitle] = useState(entry.title || '')
  const [editTags, setEditTags] = useState(entry.tags.join(', '))
  const [isSaving, setIsSaving] = useState(false)

  const contentRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when editing starts
  useEffect(() => {
    if (isEditing && contentRef.current) {
      contentRef.current.focus()
      contentRef.current.setSelectionRange(
        contentRef.current.value.length,
        contentRef.current.value.length
      )
    }
  }, [isEditing])

  // Reset edit state when entry changes
  useEffect(() => {
    setEditContent(entry.content)
    setEditTitle(entry.title || '')
    setEditTags(entry.tags.join(', '))
  }, [entry])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(entry.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
    }
  }

  const handleStartEdit = () => {
    setEditContent(entry.content)
    setEditTitle(entry.title || '')
    setEditTags(entry.tags.join(', '))
    setIsEditing(true)
    setIsExpanded(true)
  }

  const handleCancelEdit = () => {
    setEditContent(entry.content)
    setEditTitle(entry.title || '')
    setEditTags(entry.tags.join(', '))
    setIsEditing(false)
  }

  const handleSaveEdit = async () => {
    if (!onUpdate) return

    setIsSaving(true)
    try {
      // Parse tags from comma-separated string
      const parsedTags = editTags
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0)

      const success = await onUpdate({
        content: editContent,
        title: editTitle || undefined,
        tags: parsedTags
      })

      if (success) {
        setIsEditing(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  // Handle keyboard shortcuts in edit mode
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancelEdit()
    } else if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSaveEdit()
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  const isLongContent = entry.content.length > 300
  const displayContent = isExpanded ? entry.content : entry.content.slice(0, 300)

  return (
    <div
      className={cn(
        'rounded-lg border border-secondary/50',
        'bg-secondary/30 hover:bg-secondary/50',
        'transition-colors',
        isDragging && 'opacity-50 shadow-lg ring-2 ring-amber-500/50'
      )}
      onKeyDown={isEditing ? handleKeyDown : undefined}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-secondary/30">
        {/* Drag Handle */}
        {dragHandleProps && (
          <div
            {...dragHandleProps}
            className="cursor-grab active:cursor-grabbing p-1 -ml-1 text-text-muted/50 hover:text-text-muted"
          >
            <GripVertical size={14} />
          </div>
        )}

        {/* Source role indicator */}
        {entry.source_role && (
          <div
            className={cn(
              'p-1 rounded',
              entry.source_role === 'assistant'
                ? 'bg-primary/10 text-primary'
                : 'bg-emerald-500/10 text-emerald-400'
            )}
          >
            {entry.source_role === 'assistant' ? (
              <Sparkles size={12} />
            ) : (
              <User size={12} />
            )}
          </div>
        )}

        {/* Title or date */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Entry title (optional)"
              className={cn(
                'w-full px-2 py-1 rounded text-sm font-medium',
                'bg-tertiary border border-secondary',
                'text-text-normal placeholder-text-muted/50',
                'focus:outline-none focus:ring-1 focus:ring-amber-500/50'
              )}
            />
          ) : entry.title ? (
            <span className="text-sm font-medium text-text-normal truncate block">
              {entry.title}
            </span>
          ) : (
            <span className="text-xs text-text-muted">
              {formatDate(entry.created_at)}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="p-1.5 rounded hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
                title="Cancel (Esc)"
              >
                <X size={14} />
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                className="p-1.5 rounded hover:bg-emerald-500/20 text-text-muted hover:text-emerald-400 transition-colors disabled:opacity-50"
                title="Save (⌘S)"
              >
                <Check size={14} className={isSaving ? 'animate-pulse' : ''} />
              </button>
            </>
          ) : (
            <>
              {onUpdate && (
                <button
                  onClick={handleStartEdit}
                  className="p-1.5 rounded hover:bg-secondary text-text-muted hover:text-amber-400 transition-colors"
                  title="Edit entry"
                >
                  <Edit2 size={14} />
                </button>
              )}
              <button
                onClick={handleCopy}
                className="p-1.5 rounded hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
                title="Copy content"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="p-1.5 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors disabled:opacity-50"
                title="Delete entry"
              >
                <Trash2 size={14} className={isDeleting ? 'animate-pulse' : ''} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {isEditing ? (
          <textarea
            ref={contentRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className={cn(
              'w-full px-2 py-2 rounded text-sm min-h-[100px] resize-y',
              'bg-tertiary border border-secondary',
              'text-text-normal placeholder-text-muted/50',
              'focus:outline-none focus:ring-1 focus:ring-amber-500/50'
            )}
            placeholder="Entry content..."
          />
        ) : (
          <p className="text-sm text-text-normal whitespace-pre-wrap break-words">
            {displayContent}
            {isLongContent && !isExpanded && '...'}
          </p>
        )}

        {/* Expand/Collapse - only when not editing */}
        {!isEditing && isLongContent && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 mt-2 text-xs text-amber-400 hover:text-amber-300 transition-colors"
          >
            {isExpanded ? (
              <>
                <ChevronUp size={14} />
                Show less
              </>
            ) : (
              <>
                <ChevronDown size={14} />
                Show more
              </>
            )}
          </button>
        )}

        {/* Tags */}
        {isEditing ? (
          <div className="mt-3">
            <div className="flex items-center gap-2 text-xs text-text-muted mb-1">
              <Tag size={12} />
              <span>Tags (comma-separated)</span>
            </div>
            <input
              type="text"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="tag1, tag2, tag3"
              className={cn(
                'w-full px-2 py-1.5 rounded text-xs',
                'bg-tertiary border border-secondary',
                'text-text-normal placeholder-text-muted/50',
                'focus:outline-none focus:ring-1 focus:ring-amber-500/50'
              )}
            />
          </div>
        ) : entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {entry.tags.map((tag, i) => (
              <span
                key={i}
                className="px-1.5 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer with date if title exists and not editing */}
      {!isEditing && entry.title && (
        <div className="px-3 py-1.5 border-t border-secondary/30">
          <span className="text-xs text-text-muted">{formatDate(entry.created_at)}</span>
        </div>
      )}
    </div>
  )
}

export default NotebookEntryCard
