/**
 * NotebookSidebar
 *
 * Slide-out panel for browsing and managing notebooks.
 * Shows notebook list with selection, and entry viewer for selected notebook.
 *
 * @module components/notebook/NotebookSidebar
 */

import { useState, useCallback } from 'react'
import {
  BookOpen,
  X,
  Plus,
  Search,
  Download,
  ChevronLeft,
  Loader2
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { useNotebooks } from '../../hooks'
import { NotebookList } from './NotebookList'
import { NotebookViewer } from './NotebookViewer'
import { CreateNotebookModal } from './CreateNotebookModal'
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
    selectedNotebookId,
    selectedNotebook,
    entries,
    entriesLoading,
    selectNotebook,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    deleteEntry,
    exportNotebook,
    search,
    refresh
  } = useNotebooks()

  // Local state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NotebookSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Handle search
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    try {
      const results = await search(query)
      setSearchResults(results)
    } catch (err) {
      console.error('[NotebookSidebar] Search failed:', err)
    } finally {
      setIsSearching(false)
    }
  }, [search])

  // Handle export
  const handleExport = useCallback(async () => {
    if (!selectedNotebookId) return
    setIsExporting(true)
    try {
      const markdown = await exportNotebook(selectedNotebookId)
      if (markdown) {
        const blob = new Blob([markdown], { type: 'text/markdown' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${selectedNotebook?.name || 'notebook'}.md`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('[NotebookSidebar] Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [selectedNotebookId, selectedNotebook, exportNotebook])

  // Handle notebook creation
  const handleCreateNotebook = useCallback(async (input: {
    name: string
    description?: string
    emoji?: string
    color?: string
  }) => {
    await createNotebook(input)
    setShowCreateModal(false)
  }, [createNotebook])

  // Handle back navigation from viewer
  const handleBack = useCallback(() => {
    selectNotebook(null)
  }, [selectNotebook])

  // Collapsed state - show toggle button
  if (!isOpen) {
    return (
      <button
        onClick={onClose} // This toggles open
        className={cn(
          'fixed right-0 top-1/2 -translate-y-1/2 z-40',
          'bg-tertiary border border-secondary border-r-0',
          'rounded-l-lg p-2.5 hover:bg-secondary transition-colors',
          'group'
        )}
        title="Open Notebooks"
      >
        <BookOpen className="w-5 h-5 text-text-muted group-hover:text-amber-400 transition-colors" />
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
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-secondary bg-tertiary">
          <div className="flex items-center gap-2">
            {selectedNotebook && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="font-medium text-text-normal">
              {selectedNotebook ? selectedNotebook.name : 'Notebooks'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {selectedNotebook && (
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
                title="Export as Markdown"
              >
                <Download className={cn('w-4 h-4', isExporting && 'animate-pulse')} />
              </button>
            )}
            {!selectedNotebook && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-amber-400 transition-colors"
                title="Create notebook"
              >
                <Plus size={18} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
              title="Close panel"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Search Bar - only show in list view */}
        {!selectedNotebook && (
          <div className="px-3 py-2 border-b border-secondary/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search all notebooks..."
                className={cn(
                  'w-full pl-9 pr-3 py-2 rounded-lg',
                  'bg-secondary border border-secondary/50',
                  'text-text-normal placeholder-text-muted/50 text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-amber-500/50'
                )}
              />
              {isSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted animate-spin" />
              )}
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-text-muted animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12 px-4">
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
              onUpdateNotebook={updateNotebook}
              onDeleteNotebook={async () => {
                await deleteNotebook(selectedNotebook.id)
                selectNotebook(null)
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <Search className="w-8 h-8 mx-auto text-text-muted/40 mb-2" />
        <p className="text-text-muted text-sm">No results found</p>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      <p className="text-xs text-text-muted mb-2">{results.length} results</p>
      {results.map((result) => (
        <button
          key={result.entry.id}
          onClick={() => onSelectNotebook(result.notebook.id)}
          className={cn(
            'w-full text-left p-3 rounded-lg',
            'bg-secondary/50 hover:bg-secondary',
            'border border-secondary/50 hover:border-amber-500/30',
            'transition-colors'
          )}
        >
          <div className="flex items-center gap-2 mb-1">
            <span>{result.notebook.emoji}</span>
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
