# Phase 5: NotebookSidebar Panel

**Reference:** `docs/NOTEBOOK_FEATURE_DESIGN.md`  
**Depends on:** Phase 1 (Database & Service) ✅, Phase 2 (Preload API) ✅, Phase 3 (useNotebooks Hook) ✅, Phase 4 (SaveToNotebookModal) ✅  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`

---

## Objective

Create the `NotebookSidebar` panel for browsing, managing, and viewing all notebooks and their entries. This panel slides out from the right side of the application, similar to the WorkJournalPanel pattern, and provides full notebook management capabilities.

---

## Pattern Reference

Follow the existing patterns established by:
- `src/renderer/src/components/workJournal/WorkJournalPanel.tsx` - Slide-out panel structure
- `src/renderer/src/components/workJournal/EntryCard.tsx` - Card display pattern
- `src/renderer/src/components/Sidebar.tsx` - Footer button placement
- `src/renderer/src/components/agent/AgentPanel.tsx` - Panel with multiple views

---

## Files to Create

### 1. `src/renderer/src/components/notebook/NotebookSidebar.tsx`

Main container panel with notebook list and viewer:

```typescript
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
  const [searchResults, setSearchResults] = useState<any[]>([])
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
  results: any[]
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
```

---

### 2. `src/renderer/src/components/notebook/NotebookList.tsx`

```typescript
/**
 * NotebookList
 *
 * Displays a list of all notebooks with selection support.
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
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mb-4">
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
          <Plus size={16} />
          Create Notebook
        </button>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-2">
      {notebooks.map((notebook) => (
        <NotebookCard
          key={notebook.id}
          notebook={notebook}
          onClick={() => onSelectNotebook(notebook.id)}
        />
      ))}
    </div>
  )
}

export default NotebookList
```

---

### 3. `src/renderer/src/components/notebook/NotebookCard.tsx`

```typescript
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
```

---

### 4. `src/renderer/src/components/notebook/NotebookViewer.tsx`

```typescript
/**
 * NotebookViewer
 *
 * Displays entries within a selected notebook with management actions.
 *
 * @module components/notebook/NotebookViewer
 */

import { useState } from 'react'
import { Trash2, Edit2, MoreVertical, Loader2, BookOpen } from 'lucide-react'
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
  onUpdateNotebook,
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
```

---

### 5. `src/renderer/src/components/notebook/NotebookEntryCard.tsx`

```typescript
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
```

---

### 6. `src/renderer/src/components/notebook/CreateNotebookModal.tsx`

```typescript
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
```

---

## Files to Modify

### 7. Update `src/renderer/src/components/notebook/index.ts`

```typescript
/**
 * Notebook Components
 * Barrel exports for notebook feature components
 *
 * @module components/notebook
 */

// Phase 4 Components
export { SaveToNotebookModal } from './SaveToNotebookModal'
export { NotebookIcon } from './NotebookIcon'

// Phase 5 Components
export { NotebookSidebar } from './NotebookSidebar'
export { NotebookList } from './NotebookList'
export { NotebookCard } from './NotebookCard'
export { NotebookViewer } from './NotebookViewer'
export { NotebookEntryCard } from './NotebookEntryCard'
export { CreateNotebookModal } from './CreateNotebookModal'

// Re-export types for convenience
export type {
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  CreateEntryInput
} from '../../types/notebook'
```

---

### 8. Update `src/renderer/src/components/Sidebar.tsx`

Add a Notebooks button to the footer:

**Add import:**
```typescript
import { Plus, MessageSquare, Trash2, Settings, MessagesSquare, History, BookOpen } from 'lucide-react'
```

**Update SidebarProps interface:**
```typescript
interface SidebarProps {
  // ... existing props
  onResumeSession?: () => void
  onOpenNotebooks?: () => void  // Add this
}
```

**Update function signature and destructuring:**
```typescript
export function Sidebar({
  // ... existing
  onResumeSession,
  onOpenNotebooks  // Add this
}: SidebarProps) {
```

**Add button in footer (before Settings):**
```typescript
{/* Footer with Settings */}
<div className="p-2 border-t border-secondary/50 space-y-0.5">
  {/* Notebooks Button */}
  {onOpenNotebooks && (
    <button
      onClick={onOpenNotebooks}
      className={cn(
        'w-full flex items-center gap-2 p-2.5 rounded-lg',
        'text-text-muted hover:text-amber-400 hover:bg-amber-500/10',
        'transition-colors duration-150',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30'
      )}
    >
      <BookOpen size={16} />
      <span className="text-sm font-medium">Notebooks</span>
    </button>
  )}

  {/* Phase 5: Resume Session Button */}
  {onResumeSession && (
    // ... existing code
  )}
  
  {/* Settings button */}
  // ... existing code
</div>
```

---

### 9. Update `src/renderer/src/components/Layout.tsx`

Add NotebookSidebar panel integration.

**Add import:**
```typescript
import { NotebookSidebar } from './notebook'
```

**Add to LayoutProps:**
```typescript
export interface LayoutProps {
  // ... existing props
  
  // Notebook Props
  isNotebookPanelOpen?: boolean
  onToggleNotebookPanel?: () => void
}
```

**Add state and render:**
```typescript
export function Layout({
  // ... existing props
  isNotebookPanelOpen = false,
  onToggleNotebookPanel
}: LayoutProps) {
  // ... existing code

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden text-text-normal">
      {/* Sidebar */}
      <Sidebar
        // ... existing props
        onOpenNotebooks={onToggleNotebookPanel}
      />

      {/* Main content area */}
      {/* ... existing code ... */}

      {/* Notebook Panel */}
      {onToggleNotebookPanel && (
        <NotebookSidebar
          isOpen={isNotebookPanelOpen}
          onClose={onToggleNotebookPanel}
        />
      )}
    </div>
  )
}
```

---

### 10. Wire up in App.tsx

Add state management for the notebook panel.

**Add state:**
```typescript
const [isNotebookPanelOpen, setIsNotebookPanelOpen] = useState(false)
```

**Pass to Layout:**
```typescript
<Layout
  // ... existing props
  isNotebookPanelOpen={isNotebookPanelOpen}
  onToggleNotebookPanel={() => setIsNotebookPanelOpen(prev => !prev)}
/>
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Application Layout                                                          │
│ ┌──────────┬─────────────────────────────────────────┬───────────────────┐ │
│ │          │                                         │                   │ │
│ │ Sidebar  │            Chat Window                  │  NotebookSidebar  │ │
│ │          │                                         │  (when open)      │ │
│ │ ┌──────┐ │                                         │  ┌─────────────┐  │ │
│ │ │Chats │ │                                         │  │ Header      │  │ │
│ │ └──────┘ │                                         │  │ Search Bar  │  │ │
│ │ ┌──────┐ │                                         │  │             │  │ │
│ │ │Agents│ │                                         │  │ List View   │  │ │
│ │ └──────┘ │                                         │  │   OR        │  │ │
│ │          │                                         │  │ Viewer View │  │ │
│ │ ┌──────┐ │                                         │  │             │  │ │
│ │ │📓Note│◄├─────────────────────────────────────────│  │             │  │ │
│ │ └──────┘ │         Toggle                          │  └─────────────┘  │ │
│ │ ┌──────┐ │                                         │                   │ │
│ │ │⚙️Set │ │                                         │                   │ │
│ │ └──────┘ │                                         │                   │ │
│ └──────────┴─────────────────────────────────────────┴───────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Verification

### TypeScript Compilation
```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

### Manual Testing Checklist

1. **Open panel from sidebar:**
   - Click Notebooks button in sidebar footer
   - Panel should slide in from right

2. **Empty state:**
   - With no notebooks, show empty state with create button
   - Clicking create opens CreateNotebookModal

3. **Create notebook:**
   - Fill in name, select emoji and color
   - Notebook appears in list after creation

4. **Select notebook:**
   - Click notebook card to open viewer
   - Back button returns to list

5. **View entries:**
   - Entries show content with expand/collapse for long content
   - Copy button copies content to clipboard
   - Delete button removes entry

6. **Search:**
   - Type in search bar to search all notebooks
   - Click result to navigate to notebook

7. **Export:**
   - In viewer, click export button
   - Markdown file downloads

8. **Delete notebook:**
   - Click menu, then delete
   - Confirm delete removes notebook

9. **Close panel:**
   - X button closes panel
   - Collapsed state shows toggle button on right edge

---

## Checklist

- [ ] `NotebookSidebar.tsx` created with list/viewer states
- [ ] `NotebookList.tsx` created with empty state and cards
- [ ] `NotebookCard.tsx` created with emoji, counts, timestamps
- [ ] `NotebookViewer.tsx` created with header and entry list
- [ ] `NotebookEntryCard.tsx` created with expand/copy/delete
- [ ] `CreateNotebookModal.tsx` created with full form
- [ ] `notebook/index.ts` updated with all exports
- [ ] `Sidebar.tsx` updated with Notebooks button (amber accent)
- [ ] `Layout.tsx` updated with NotebookSidebar panel
- [ ] `App.tsx` wired with panel state
- [ ] Search functionality works across notebooks
- [ ] Export generates valid Markdown
- [ ] TypeScript compiles without errors
- [ ] Manual testing completed

---

## Git Commit

```bash
git add -A
git commit -m "feat(notebook): Phase 5 - NotebookSidebar panel

- Create NotebookSidebar with list/viewer states
- Create NotebookList with empty state and notebook cards  
- Create NotebookCard with emoji, entry counts, timestamps
- Create NotebookViewer with entry list and delete actions
- Create NotebookEntryCard with expand/copy/delete actions
- Create CreateNotebookModal with emoji and color pickers
- Add Notebooks button to Sidebar footer (amber accent)
- Integrate NotebookSidebar panel with Layout
- Add search across all notebooks
- Add export to Markdown functionality"
```

---

## Next Phase

**Phase 6** will add advanced features:
- Entry editing and tagging
- Drag-and-drop reordering
- Notebook sharing/export options
- Keyboard shortcuts

---

*Phase 5 Implementation Prompt*  
*Depends on: Phase 1 ✅, Phase 2 ✅, Phase 3 ✅, Phase 4 ✅*  
*Enables: Phase 6 (Advanced Features)*
