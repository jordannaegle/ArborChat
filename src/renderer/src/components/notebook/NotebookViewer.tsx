/**
 * NotebookViewer
 *
 * Displays entries within a selected notebook with management actions.
 *
 * @module components/notebook/NotebookViewer
 */

import { useState } from 'react'
import { Trash2, MoreVertical, Loader2, BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Notebook, NotebookEntry, UpdateNotebookInput } from '../../types/notebook'
import { NotebookEntryCard } from './NotebookEntryCard'

interface NotebookViewerProps {
  notebook: Notebook
  entries: NotebookEntry[]
  loading: boolean
  onDeleteEntry: (id: string) => Promise<boolean>
  onUpdateNotebook: (id: string, input: UpdateNotebookInput) => Promise<Notebook | null>
  onDeleteNotebook: () => Promise<void>
}

export function NotebookViewer({
  notebook,
  entries,
  loading,
  onDeleteEntry,
  onDeleteNotebook
}: NotebookViewerProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleDeleteNotebook = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setIsDeleting(true)
    try {
      await onDeleteNotebook()
    } finally {
      setIsDeleting(false)
      setConfirmDelete(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notebook Header */}
      <div className="p-4 border-b border-secondary/50">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center text-3xl">
            {notebook.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-text-normal text-lg truncate">
              {notebook.name}
            </h2>
            {notebook.description && (
              <p className="text-sm text-text-muted mt-0.5 line-clamp-2">
                {notebook.description}
              </p>
            )}
            <p className="text-xs text-text-muted/70 mt-1">
              {notebook.entry_count} {notebook.entry_count === 1 ? 'entry' : 'entries'}
            </p>
          </div>

          {/* Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
            >
              <MoreVertical size={18} />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setShowMenu(false)
                    setConfirmDelete(false)
                  }}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-tertiary border border-secondary rounded-lg shadow-xl py-1 min-w-[140px]">
                  <button
                    onClick={handleDeleteNotebook}
                    disabled={isDeleting}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm',
                      'transition-colors',
                      confirmDelete
                        ? 'text-red-400 bg-red-500/10'
                        : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    {confirmDelete ? 'Confirm Delete' : 'Delete Notebook'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 px-4">
            <BookOpen className="w-10 h-10 mx-auto text-text-muted/40 mb-3" />
            <p className="text-text-muted text-sm">No entries yet</p>
            <p className="text-text-muted/60 text-xs mt-1">
              Save content from chat messages to this notebook
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <NotebookEntryCard
              key={entry.id}
              entry={entry}
              onDelete={() => onDeleteEntry(entry.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

export default NotebookViewer
