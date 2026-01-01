/**
 * NotebookList
 *
 * Displays a list of all notebooks with selection support.
 *
 * Phase 7: Added ARIA accessibility attributes.
 *
 * @module components/notebook/NotebookList
 */

import { BookOpen, Plus } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Notebook } from '../../types/notebook'
import { NotebookCard } from './NotebookCard'

interface NotebookListProps {
  notebooks: Notebook[]
  onSelectNotebook: (id: string) => void
  onCreateNotebook: () => void
}

export function NotebookList({
  notebooks,
  onSelectNotebook,
  onCreateNotebook
}: NotebookListProps) {
  if (notebooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div 
          className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4"
          aria-hidden="true"
        >
          <BookOpen size={28} className="text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-text-normal mb-2">
          No notebooks yet
        </h3>
        <p className="text-sm text-text-muted max-w-xs mb-4">
          Create your first notebook to start saving valuable content from your chats.
        </p>
        <button
          onClick={onCreateNotebook}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg',
            'bg-amber-500 hover:bg-amber-600 text-white font-medium',
            'transition-colors'
          )}
        >
          <Plus size={16} aria-hidden="true" />
          Create Notebook
        </button>
      </div>
    )
  }

  return (
    <div 
      className="p-3 space-y-2"
      role="list"
      aria-label="Notebooks"
    >
      {notebooks.map((notebook) => (
        <div role="listitem" key={notebook.id}>
          <NotebookCard
            notebook={notebook}
            onClick={() => onSelectNotebook(notebook.id)}
          />
        </div>
      ))}
    </div>
  )
}

export default NotebookList
