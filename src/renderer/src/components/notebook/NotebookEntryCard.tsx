/**
 * NotebookEntryCard
 *
 * Individual entry card with content preview and actions.
 *
 * @module components/notebook/NotebookEntryCard
 */

import { useState } from 'react'
import { Trash2, Copy, Check, User, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { NotebookEntry } from '../../types/notebook'

interface NotebookEntryCardProps {
  entry: NotebookEntry
  onDelete: () => Promise<boolean>
}

export function NotebookEntryCard({ entry, onDelete }: NotebookEntryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

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
        'transition-colors'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-secondary/30">
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
          {entry.title ? (
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
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <p className="text-sm text-text-normal whitespace-pre-wrap break-words">
          {displayContent}
          {isLongContent && !isExpanded && '...'}
        </p>

        {/* Expand/Collapse */}
        {isLongContent && (
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
        {entry.tags.length > 0 && (
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

      {/* Footer with date if title exists */}
      {entry.title && (
        <div className="px-3 py-1.5 border-t border-secondary/30">
          <span className="text-xs text-text-muted">{formatDate(entry.created_at)}</span>
        </div>
      )}
    </div>
  )
}

export default NotebookEntryCard
