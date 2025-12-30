/**
 * NotebookSidebar
 *
 * Slide-out panel for browsing and managing notebooks.
 * Shows notebook list with selection, and entry viewer for selected notebook.
 * 
 * Phase 6: Integrated keyboard shortcuts, export menu, drag-and-drop, bulk ops
 * Phase 7: Debounced search, ARIA accessibility, skeleton loaders, toasts
 *
 * @module components/notebook/NotebookSidebar
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import {
  BookOpen,
  X,
  Plus,
  Search,
  ChevronLeft,
  Loader2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useNotebooks, useNotebookShortcuts, useDebounce } from '../../hooks'
import { useNotificationContext } from '../../contexts'
import { NotebookList } from './NotebookList'
import { NotebookViewer } from './NotebookViewer'
import { CreateNotebookModal } from './CreateNotebookModal'
import { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'
import { NotebookListSkeleton } from './NotebookSkeleton'
import type { NotebookSearchResult } from '../../types/notebook'

interface NotebookSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function NotebookSidebar({ isOpen, onClose }: NotebookSidebarProps) {
  const {
    notebooks,
    loading,
    error,
    selectedNotebook,
    entries,
    entriesLoading,
    selectNotebook,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    updateEntry,
    deleteEntry,
    reorderEntries,
    bulkDeleteEntries,
    exportNotebook,
    exportNotebookJSON,
    exportNotebookText,
    search,
    refresh
  } = useNotebooks()
  
  const { success: toastSuccess } = useNotificationContext()

  // Local state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NotebookSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Debounced search query for performance
  const debouncedQuery = useDebounce(searchQuery, 300)

  // Refs for keyboard shortcuts
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Effect to run search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([])
      return
    }

    let cancelled = false
    setIsSearching(true)

    search(debouncedQuery)
      .then((results) => {
        if (!cancelled) setSearchResults(results)
      })
      .catch((err) => {
        if (!cancelled) console.error('[NotebookSidebar] Search failed:', err)
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQuery, search])

  // Handle back navigation from viewer
  const handleBack = useCallback(() => {
    selectNotebook(null)
  }, [selectNotebook])

  // Handle notebook creation with toast
  const handleCreateNotebook = useCallback(async (input: {
    name: string
    description?: string
    emoji?: string
    color?: string
  }) => {
    try {
      await createNotebook(input)
      setShowCreateModal(false)
      // Toast is shown by CreateNotebookModal
    } catch (err) {
      console.error('[NotebookSidebar] Create notebook failed:', err)
      // Error toast is shown by CreateNotebookModal
    }
  }, [createNotebook])

  // Phase 6: Keyboard shortcuts
  useNotebookShortcuts({
    onNewNotebook: () => setShowCreateModal(true),
    onSearch: () => searchInputRef.current?.focus(),
    onClosePanel: onClose,
    onNavigateBack: selectedNotebook ? handleBack : undefined
  }, isOpen)

  // Collapsed state - show toggle button
  if (!isOpen) {
    return (
      <button
        onClick={onClose} // This toggles open
        aria-label="Open Notebooks panel"
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-40',
          'bg-tertiary border border-secondary border-r-0',
          'rounded-l-lg p-2.5 hover:bg-secondary transition-colors',
          'group'
        )}
        title="Open Notebooks"
      >
        <BookOpen className="w-5 h-5 text-text-muted group-hover:text-amber-400 transition-colors" aria-hidden="true" />
      </button>
    )
  }

  return (
    <>
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-96 z-40',
          'bg-tertiary border-l border-secondary',
          'flex flex-col shadow-2xl',
          'animate-in slide-in-from-right duration-200'
        )}
        role="complementary"
        aria-label="Notebooks panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-secondary bg-tertiary">
          <div className="flex items-center gap-2">
            {selectedNotebook && (
              <button
                onClick={handleBack}
                aria-label="Back to notebook list"
                className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
              >
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
            <BookOpen className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <span className="font-medium text-text-normal">
              {selectedNotebook ? selectedNotebook.name : 'Notebooks'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {!selectedNotebook && (
              <button
                onClick={() => setShowCreateModal(true)}
                aria-label="Create notebook (⌘N)"
                className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-amber-400 transition-colors"
                title="Create notebook (⌘N)"
              >
                <Plus size={18} aria-hidden="true" />
              </button>
            )}
            <button
              onClick={onClose}
              aria-label="Close panel (Esc)"
              className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
              title="Close panel (Esc)"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Search Bar - only show in list view */}
        {!selectedNotebook && (
          <div className="px-3 py-2 border-b border-secondary/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search all notebooks... (⌘F)"
                role="searchbox"
                aria-label="Search notebooks"
                className={cn(
                  'w-full pl-9 pr-3 py-2 rounded-lg',
                  'bg-secondary border border-secondary/50',
                  'text-text-normal placeholder-text-muted/50 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500/50'
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" aria-hidden="true" />
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <NotebookListSkeleton count={4} />
          ) : error ? (
            <div className="text-center py-12 px-4" role="alert">
              <p className="text-red-400 text-sm">{error}</p>
              <button
                onClick={refresh}
                className="mt-2 text-sm text-amber-400 hover:text-amber-300"
              >
                Try again
              </button>
            </div>
          ) : selectedNotebook ? (
            <NotebookViewer
              notebook={selectedNotebook}
              entries={entries}
              loading={entriesLoading}
              onDeleteEntry={deleteEntry}
              onUpdateEntry={async (id, input) => {
                const result = await updateEntry(id, input)
                return result !== null
              }}
              onUpdateNotebook={updateNotebook}
              onDeleteNotebook={async () => {
                const name = selectedNotebook.name
                await deleteNotebook(selectedNotebook.id)
                selectNotebook(null)
                toastSuccess(`Deleted "${name}"`)
              }}
              onReorderEntries={(orderedIds) => reorderEntries(selectedNotebook.id, orderedIds)}
              onBulkDeleteEntries={async (ids) => {
                const success = await bulkDeleteEntries(ids)
                if (success) {
                  toastSuccess(`Deleted ${ids.length} entries`)
                }
                return success
              }}
              onExportMarkdown={async () => {
                const result = await exportNotebook(selectedNotebook.id)
                if (result) {
                  toastSuccess('Exported as Markdown')
                }
                return result
              }}
              onExportJSON={async () => {
                const result = await exportNotebookJSON(selectedNotebook.id)
                if (result) {
                  toastSuccess('Exported as JSON')
                }
                return result
              }}
              onExportText={async () => {
                const result = await exportNotebookText(selectedNotebook.id)
                if (result) {
                  toastSuccess('Exported as plain text')
                }
                return result
              }}
            />
          ) : searchQuery ? (
            <SearchResults
              results={searchResults}
              loading={isSearching}
              onSelectNotebook={(id) => {
                setSearchQuery('')
                setSearchResults([])
                selectNotebook(id)
              }}
            />
          ) : (
            <NotebookList
              notebooks={notebooks}
              onSelectNotebook={selectNotebook}
              onCreateNotebook={() => setShowCreateModal(true)}
            />
          )}
        </div>

        {/* Keyboard Shortcuts Help - only show in list view */}
        {!selectedNotebook && <KeyboardShortcutsHelp />}
      </div>

      {/* Create Notebook Modal */}
      <CreateNotebookModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateNotebook}
      />
    </>
  )
}

// Search results sub-component
function SearchResults({
  results,
  loading,
  onSelectNotebook
}: {
  results: NotebookSearchResult[]
  loading: boolean
  onSelectNotebook: (id: string) => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" aria-hidden="true" />
        <span className="sr-only">Searching...</span>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Search className="w-8 h-8 mx-auto text-text-muted/40 mb-2" aria-hidden="true" />
        <p className="text-text-muted text-sm">No results found</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2" role="list" aria-label="Search results">
      <p className="text-xs text-text-muted mb-2">{results.length} results</p>
      {results.map((result) => (
        <button
          key={result.entry.id}
          onClick={() => onSelectNotebook(result.notebook.id)}
          role="listitem"
          className={cn(
            'w-full text-left p-3 rounded-lg',
            'bg-secondary/50 hover:bg-secondary',
            'border border-secondary/50 hover:border-amber-500/30',
            'transition-colors'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span aria-hidden="true">{result.notebook.emoji}</span>
            <span className="text-sm font-medium text-text-normal">
              {result.notebook.name}
            </span>
          </div>
          <p className="text-xs text-text-muted line-clamp-2">
            {result.snippet}
          </p>
        </button>
      ))}
    </div>
  )
}

export default NotebookSidebar
