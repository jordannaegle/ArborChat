/**
 * NotebookCard
 *
 * Individual notebook display card with emoji, name, and entry count.
 *
 * @module components/notebook/NotebookCard
 */

import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Notebook } from '../../types/notebook'
import { getNotebookColorClass } from '../../types/notebook'

interface NotebookCardProps {
  notebook: Notebook
  onClick: () => void
}

export function NotebookCard({ notebook, onClick }: NotebookCardProps) {
  const colorClass = getNotebookColorClass(notebook.color)

  // Format relative time
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-lg',
        'bg-secondary/50 hover:bg-secondary',
        'border border-secondary/50 hover:border-amber-500/30',
        'transition-all duration-150',
        'group'
      )}
    >
      {/* Emoji Icon */}
      <div
        className={cn(
          'w-12 h-12 rounded-lg flex items-center justify-center text-2xl',
          'transition-transform group-hover:scale-105',
          colorClass
        )}
      >
        {notebook.emoji}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <h3 className="font-medium text-text-normal truncate">
          {notebook.name}
        </h3>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>
            {notebook.entry_count} {notebook.entry_count === 1 ? 'entry' : 'entries'}
          </span>
          <span>•</span>
          <span>{formatRelativeTime(notebook.updated_at)}</span>
        </div>
        {notebook.description && (
          <p className="text-xs text-text-muted/70 truncate mt-0.5">
            {notebook.description}
          </p>
        )}
      </div>

      {/* Chevron */}
      <ChevronRight
        size={18}
        className="text-text-muted group-hover:text-amber-400 transition-colors shrink-0"
      />
    </button>
  )
}

export default NotebookCard
