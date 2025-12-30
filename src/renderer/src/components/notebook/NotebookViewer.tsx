/**
 * NotebookViewer
 *
 * Displays entries within a selected notebook with selection mode for bulk operations.
 *
 * Phase 7: Added ARIA accessibility and skeleton loaders.
 *
 * @module components/notebook/NotebookViewer
 */

import { useState, useCallback } from 'react'
import {
  Trash2,
  MoreVertical,
  Loader2,
  BookOpen,
  CheckSquare,
  Square,
  X
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Notebook, NotebookEntry, UpdateNotebookInput, UpdateEntryInput } from '../../types/notebook'
import { NotebookEntryCard } from './NotebookEntryCard'
import { SortableEntryList } from './SortableEntryList'
import { ExportMenu } from './ExportMenu'
import { NotebookEntriesListSkeleton } from './NotebookSkeleton'

interface NotebookViewerProps {
  notebook: Notebook
  entries: NotebookEntry[]
  loading: boolean
  onDeleteEntry: (id: string) => Promise<boolean>
  onUpdateEntry: (id: string, input: UpdateEntryInput) => Promise<boolean>
  onUpdateNotebook: (id: string, input: UpdateNotebookInput) => Promise<Notebook | null>
  onDeleteNotebook: () => Promise<void>
  onReorderEntries: (orderedIds: string[]) => Promise<boolean>
  onBulkDeleteEntries: (ids: string[]) => Promise<boolean>
  onExportMarkdown: () => Promise<string | null>
  onExportJSON: () => Promise<string | null>
  onExportText: () => Promise<string | null>
}

export function NotebookViewer({
  notebook,
  entries,
  loading,
  onDeleteEntry,
  onUpdateEntry,
  onDeleteNotebook,
  onReorderEntries,
  onBulkDeleteEntries,
  onExportMarkdown,
  onExportJSON,
  onExportText
}: NotebookViewerProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

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

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(entries.map(e => e.id)))
  }, [entries])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
    setIsSelectionMode(false)
  }, [])

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    setIsBulkDeleting(true)
    try {
      await onBulkDeleteEntries(Array.from(selectedIds))
      clearSelection()
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notebook Header */}
      <div className="p-4 border-b border-secondary/50">
        <div className="flex items-start gap-3">
          <div 
            className="w-14 h-14 rounded-xl bg-amber-500/10 flex items-center justify-center text-3xl"
            aria-hidden="true"
          >
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

          {/* Export Menu */}
          <ExportMenu
            notebookName={notebook.name}
            onExportMarkdown={onExportMarkdown}
            onExportJSON={onExportJSON}
            onExportText={onExportText}
          />

          {/* More Menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              aria-label="Notebook options"
              aria-expanded={showMenu}
              aria-haspopup="menu"
              className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
            >
              <MoreVertical size={18} aria-hidden="true" />
            </button>

            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => {
                    setShowMenu(false)
                    setConfirmDelete(false)
                  }}
                  aria-hidden="true"
                />
                <div 
                  className="absolute right-0 top-full mt-1 z-20 bg-tertiary border border-secondary rounded-lg shadow-xl py-1 min-w-[160px]"
                  role="menu"
                  aria-label="Notebook actions"
                >
                  {/* Selection mode toggle */}
                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode)
                      setShowMenu(false)
                      if (isSelectionMode) clearSelection()
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text-normal hover:bg-secondary transition-colors"
                  >
                    <CheckSquare size={14} aria-hidden="true" />
                    {isSelectionMode ? 'Exit Selection' : 'Select Entries'}
                  </button>

                  <div className="border-t border-secondary/50 my-1" role="separator" />

                  <button
                    onClick={handleDeleteNotebook}
                    disabled={isDeleting}
                    role="menuitem"
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm',
                      'transition-colors',
                      confirmDelete
                        ? 'text-red-400 bg-red-500/10'
                        : 'text-text-muted hover:text-red-400 hover:bg-red-500/10'
                    )}
                  >
                    {isDeleting ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Trash2 size={14} aria-hidden="true" />
                    )}
                    {confirmDelete ? 'Confirm Delete' : 'Delete Notebook'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Selection Bar */}
      {isSelectionMode && (
        <div 
          className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20"
          role="toolbar"
          aria-label="Selection actions"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-400" aria-live="polite">
              {selectedIds.size} selected
            </span>
            <button
              onClick={selectAll}
              className="text-xs text-amber-400 hover:text-amber-300"
            >
              Select all
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkDelete}
              disabled={selectedIds.size === 0 || isBulkDeleting}
              aria-label={`Delete ${selectedIds.size} selected entries`}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs',
                'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              {isBulkDeleting ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 size={12} aria-hidden="true" />
              )}
              Delete
            </button>
            <button
              onClick={clearSelection}
              aria-label="Exit selection mode"
              className="p-1 rounded hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <NotebookEntriesListSkeleton count={3} />
        ) : entries.length === 0 ? (
          <div className="text-center py-12 px-4">
            <BookOpen className="w-10 h-10 mx-auto text-text-muted/40 mb-3" aria-hidden="true" />
            <p className="text-text-muted text-sm">No entries yet</p>
            <p className="text-text-muted/60 text-xs mt-1">
              Save content from chat messages to this notebook
            </p>
          </div>
        ) : isSelectionMode ? (
          // Selection mode - show checkboxes
          <div role="list" aria-label="Notebook entries">
            {entries.map((entry) => (
              <div key={entry.id} className="flex items-start gap-2 mb-3" role="listitem">
                <button
                  onClick={() => toggleSelection(entry.id)}
                  aria-label={selectedIds.has(entry.id) ? 'Deselect entry' : 'Select entry'}
                  aria-pressed={selectedIds.has(entry.id)}
                  className="mt-3 p-1 rounded hover:bg-secondary transition-colors"
                >
                  {selectedIds.has(entry.id) ? (
                    <CheckSquare size={18} className="text-amber-400" aria-hidden="true" />
                  ) : (
                    <Square size={18} className="text-text-muted" aria-hidden="true" />
                  )}
                </button>
                <div className="flex-1">
                  <NotebookEntryCard
                    entry={entry}
                    onDelete={() => onDeleteEntry(entry.id)}
                    onUpdate={(input) => onUpdateEntry(entry.id, input)}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Normal mode - sortable list
          <SortableEntryList
            entries={entries}
            notebookId={notebook.id}
            onDeleteEntry={onDeleteEntry}
            onUpdateEntry={onUpdateEntry}
            onReorder={onReorderEntries}
          />
        )}
      </div>
    </div>
  )
}

export default NotebookViewer
