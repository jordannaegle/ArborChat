# Phase 6: Notebook Advanced Features

**Reference:** `docs/NOTEBOOK_FEATURE_DESIGN.md`  
**Depends on:** Phase 1-5 ✅  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`

---

## Objective

Enhance the Notebook system with advanced features for power users:
1. **Entry Editing** - Edit entry content, title, and tags inline
2. **Drag-and-Drop Reordering** - Reorder entries within a notebook
3. **Enhanced Export Options** - Export to JSON, copy all to clipboard
4. **Keyboard Shortcuts** - Quick actions for common operations
5. **Bulk Operations** - Select multiple entries for delete/move

---

## Pattern Reference

Follow established patterns from:
- `src/renderer/src/components/notebook/NotebookEntryCard.tsx` - Entry display
- `src/renderer/src/components/workJournal/EntryCard.tsx` - Expandable cards
- `src/renderer/src/hooks/useNotebooks.ts` - State management

---

## Part 1: Entry Editing

### 1.1 Update `NotebookEntryCard.tsx`

Add inline editing capability:

```typescript
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
```

---


### 1.2 Update `useNotebooks.ts` Hook

Add the updateEntry capability with proper return type:

```typescript
// In useNotebooks.ts, update the updateEntry function:

const updateEntry = useCallback(async (
  id: string,
  input: UpdateEntryInput
): Promise<boolean> => {
  try {
    const result = await window.api.notebooks.entries.update(id, input)
    return result !== null
  } catch (err) {
    console.error('[useNotebooks] Failed to update entry:', err)
    return false
  }
}, [])
```

### 1.3 Update `NotebookViewer.tsx`

Pass the update handler to entry cards:

```typescript
// In NotebookViewer.tsx, update the entries.map section:

{entries.map((entry) => (
  <NotebookEntryCard
    key={entry.id}
    entry={entry}
    onDelete={() => onDeleteEntry(entry.id)}
    onUpdate={async (input) => {
      const result = await window.api.notebooks.entries.update(entry.id, input)
      if (result) {
        // Refresh entries after update
        // This will be handled by the parent component
        return true
      }
      return false
    }}
  />
))}
```

---

## Part 2: Drag-and-Drop Reordering

### 2.1 Install Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### 2.2 Update Database Schema

Add `sort_order` column to entries:

```typescript
// In src/main/notebooks/service.ts, update initNotebookTables:

db.exec(`
  -- Add sort_order column if not exists
  ALTER TABLE notebook_entries ADD COLUMN sort_order INTEGER DEFAULT 0;
`)

// Wrap in try-catch for existing databases:
try {
  db.exec(`ALTER TABLE notebook_entries ADD COLUMN sort_order INTEGER DEFAULT 0`)
} catch (e) {
  // Column already exists
}
```

### 2.3 Add Reorder IPC Handler

```typescript
// In src/main/notebooks/service.ts, add:

export function reorderEntries(notebookId: string, orderedIds: string[]): boolean {
  const transaction = db.transaction(() => {
    const stmt = db.prepare('UPDATE notebook_entries SET sort_order = ? WHERE id = ? AND notebook_id = ?')
    orderedIds.forEach((id, index) => {
      stmt.run(index, id, notebookId)
    })
  })
  
  try {
    transaction()
    return true
  } catch (err) {
    console.error('[NotebookService] Failed to reorder entries:', err)
    return false
  }
}

// Update getEntries to sort by sort_order:
export function getEntries(notebookId: string): NotebookEntry[] {
  const rows = db
    .prepare('SELECT * FROM notebook_entries WHERE notebook_id = ? ORDER BY sort_order ASC, created_at DESC')
    .all(notebookId) as any[]

  return rows.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  }))
}
```

```typescript
// In src/main/notebooks/index.ts, add handler:

ipcMain.handle('notebooks:entries:reorder', async (_, { notebookId, orderedIds }: { 
  notebookId: string
  orderedIds: string[] 
}) => {
  return reorderEntries(notebookId, orderedIds)
})
```

### 2.4 Update Preload API

```typescript
// In src/preload/index.ts, add to entries:

entries: {
  // ... existing methods
  reorder: (notebookId: string, orderedIds: string[]) =>
    ipcRenderer.invoke('notebooks:entries:reorder', { notebookId, orderedIds }) as Promise<boolean>
}
```

### 2.5 Create `SortableEntryList.tsx`

```typescript
/**
 * SortableEntryList
 *
 * Drag-and-drop sortable list of notebook entries.
 *
 * @module components/notebook/SortableEntryList
 */

import { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { NotebookEntryCard } from './NotebookEntryCard'
import type { NotebookEntry, UpdateEntryInput } from '../../types/notebook'

interface SortableEntryListProps {
  entries: NotebookEntry[]
  notebookId: string
  onDeleteEntry: (id: string) => Promise<boolean>
  onUpdateEntry: (id: string, input: UpdateEntryInput) => Promise<boolean>
  onReorder: (orderedIds: string[]) => Promise<boolean>
}

function SortableEntry({
  entry,
  onDelete,
  onUpdate
}: {
  entry: NotebookEntry
  onDelete: () => Promise<boolean>
  onUpdate: (input: UpdateEntryInput) => Promise<boolean>
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <NotebookEntryCard
        entry={entry}
        onDelete={onDelete}
        onUpdate={onUpdate}
        isDragging={isDragging}
        dragHandleProps={listeners}
      />
    </div>
  )
}

export function SortableEntryList({
  entries,
  notebookId,
  onDeleteEntry,
  onUpdateEntry,
  onReorder
}: SortableEntryListProps) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [localEntries, setLocalEntries] = useState(entries)

  // Update local entries when prop changes
  useState(() => {
    setLocalEntries(entries)
  })

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8 // Require 8px drag before activating
      }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = localEntries.findIndex(e => e.id === active.id)
      const newIndex = localEntries.findIndex(e => e.id === over.id)

      const newOrder = arrayMove(localEntries, oldIndex, newIndex)
      setLocalEntries(newOrder)

      // Persist the new order
      const orderedIds = newOrder.map(e => e.id)
      await onReorder(orderedIds)
    }
  }

  const activeEntry = activeId ? localEntries.find(e => e.id === activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localEntries.map(e => e.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {localEntries.map((entry) => (
            <SortableEntry
              key={entry.id}
              entry={entry}
              onDelete={() => onDeleteEntry(entry.id)}
              onUpdate={(input) => onUpdateEntry(entry.id, input)}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeEntry ? (
          <div className="opacity-80">
            <NotebookEntryCard
              entry={activeEntry}
              onDelete={async () => false}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export default SortableEntryList
```

---

## Part 3: Enhanced Export Options

### 3.1 Add Export Formats to Service

```typescript
// In src/main/notebooks/service.ts, add:

export function exportNotebookAsJSON(id: string): string | null {
  const notebook = getNotebook(id)
  if (!notebook) return null

  const entries = getEntries(id)
  
  return JSON.stringify({
    notebook: {
      id: notebook.id,
      name: notebook.name,
      description: notebook.description,
      emoji: notebook.emoji,
      color: notebook.color,
      created_at: notebook.created_at,
      updated_at: notebook.updated_at
    },
    entries: entries.map(e => ({
      id: e.id,
      content: e.content,
      title: e.title,
      tags: e.tags,
      source_role: e.source_role,
      created_at: e.created_at,
      updated_at: e.updated_at
    })),
    exported_at: new Date().toISOString(),
    version: '1.0'
  }, null, 2)
}

export function getNotebookPlainText(id: string): string | null {
  const notebook = getNotebook(id)
  if (!notebook) return null

  const entries = getEntries(id)
  
  let text = `${notebook.emoji} ${notebook.name}\n`
  if (notebook.description) {
    text += `${notebook.description}\n`
  }
  text += '\n---\n\n'
  
  for (const entry of entries) {
    if (entry.title) {
      text += `${entry.title}\n\n`
    }
    text += `${entry.content}\n\n`
    text += '---\n\n'
  }
  
  return text
}
```

### 3.2 Add IPC Handlers

```typescript
// In src/main/notebooks/index.ts, add:

ipcMain.handle('notebooks:export:json', async (_, id: string) => {
  return exportNotebookAsJSON(id)
})

ipcMain.handle('notebooks:export:text', async (_, id: string) => {
  return getNotebookPlainText(id)
})
```

### 3.3 Update Preload API

```typescript
// In src/preload/index.ts, update export:

export: {
  markdown: (id: string) =>
    ipcRenderer.invoke('notebooks:export', id) as Promise<string | null>,
  json: (id: string) =>
    ipcRenderer.invoke('notebooks:export:json', id) as Promise<string | null>,
  text: (id: string) =>
    ipcRenderer.invoke('notebooks:export:text', id) as Promise<string | null>
}
```

### 3.4 Create `ExportMenu.tsx`

```typescript
/**
 * ExportMenu
 *
 * Dropdown menu for notebook export options.
 *
 * @module components/notebook/ExportMenu
 */

import { useState } from 'react'
import { Download, FileText, FileJson, Copy, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ExportMenuProps {
  notebookId: string
  notebookName: string
  onExportMarkdown: () => Promise<string | null>
  onExportJSON: () => Promise<string | null>
  onExportText: () => Promise<string | null>
}

export function ExportMenu({
  notebookId,
  notebookName,
  onExportMarkdown,
  onExportJSON,
  onExportText
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleExport = async (
    format: 'markdown' | 'json' | 'text',
    action: 'download' | 'copy'
  ) => {
    setIsExporting(true)
    try {
      let content: string | null = null
      let extension = ''
      let mimeType = ''

      switch (format) {
        case 'markdown':
          content = await onExportMarkdown()
          extension = 'md'
          mimeType = 'text/markdown'
          break
        case 'json':
          content = await onExportJSON()
          extension = 'json'
          mimeType = 'application/json'
          break
        case 'text':
          content = await onExportText()
          extension = 'txt'
          mimeType = 'text/plain'
          break
      }

      if (!content) return

      if (action === 'copy') {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${notebookName}.${extension}`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
        title="Export notebook"
      >
        {isExporting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-tertiary border border-secondary rounded-lg shadow-xl py-1 min-w-[180px]">
            {/* Markdown */}
            <div className="px-2 py-1">
              <p className="text-xs text-text-muted uppercase tracking-wide px-2 mb-1">
                Markdown
              </p>
              <button
                onClick={() => handleExport('markdown', 'download')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                <FileText size={14} />
                Download .md
              </button>
              <button
                onClick={() => handleExport('markdown', 'copy')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                Copy to clipboard
              </button>
            </div>

            <div className="border-t border-secondary/50 my-1" />

            {/* JSON */}
            <div className="px-2 py-1">
              <p className="text-xs text-text-muted uppercase tracking-wide px-2 mb-1">
                JSON
              </p>
              <button
                onClick={() => handleExport('json', 'download')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                <FileJson size={14} />
                Download .json
              </button>
            </div>

            <div className="border-t border-secondary/50 my-1" />

            {/* Plain Text */}
            <div className="px-2 py-1">
              <p className="text-xs text-text-muted uppercase tracking-wide px-2 mb-1">
                Plain Text
              </p>
              <button
                onClick={() => handleExport('text', 'download')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                <FileText size={14} />
                Download .txt
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ExportMenu
```

---


## Part 4: Keyboard Shortcuts

### 4.1 Create `useNotebookShortcuts.ts` Hook

```typescript
/**
 * useNotebookShortcuts
 *
 * Keyboard shortcut handler for notebook operations.
 *
 * @module hooks/useNotebookShortcuts
 */

import { useEffect, useCallback } from 'react'

interface NotebookShortcutHandlers {
  onNewNotebook?: () => void
  onSearch?: () => void
  onExport?: () => void
  onClosePanel?: () => void
  onNavigateBack?: () => void
  onDelete?: () => void
}

export function useNotebookShortcuts(
  handlers: NotebookShortcutHandlers,
  enabled: boolean = true
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    // Don't trigger if typing in an input/textarea
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape in inputs
      if (e.key !== 'Escape') return
    }

    const isMeta = e.metaKey || e.ctrlKey

    // ⌘/Ctrl + N - New notebook
    if (isMeta && e.key === 'n' && !e.shiftKey) {
      e.preventDefault()
      handlers.onNewNotebook?.()
      return
    }

    // ⌘/Ctrl + F - Focus search
    if (isMeta && e.key === 'f') {
      e.preventDefault()
      handlers.onSearch?.()
      return
    }

    // ⌘/Ctrl + E - Export
    if (isMeta && e.key === 'e') {
      e.preventDefault()
      handlers.onExport?.()
      return
    }

    // Escape - Close panel or go back
    if (e.key === 'Escape') {
      e.preventDefault()
      if (handlers.onNavigateBack) {
        handlers.onNavigateBack()
      } else {
        handlers.onClosePanel?.()
      }
      return
    }

    // Backspace - Navigate back (when not in input)
    if (e.key === 'Backspace' && !isMeta) {
      e.preventDefault()
      handlers.onNavigateBack?.()
      return
    }

    // ⌘/Ctrl + Backspace - Delete
    if (isMeta && e.key === 'Backspace') {
      e.preventDefault()
      handlers.onDelete?.()
      return
    }
  }, [enabled, handlers])

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled, handleKeyDown])
}

export default useNotebookShortcuts
```

### 4.2 Integrate with `NotebookSidebar.tsx`

```typescript
// In NotebookSidebar.tsx, add import and usage:

import { useNotebookShortcuts } from '../../hooks/useNotebookShortcuts'

// Inside the component:
const searchInputRef = useRef<HTMLInputElement>(null)

useNotebookShortcuts({
  onNewNotebook: () => setShowCreateModal(true),
  onSearch: () => searchInputRef.current?.focus(),
  onExport: selectedNotebook ? handleExport : undefined,
  onClosePanel: onClose,
  onNavigateBack: selectedNotebook ? handleBack : undefined
}, isOpen)

// Add ref to search input:
<input
  ref={searchInputRef}
  type="text"
  value={searchQuery}
  // ... rest of props
/>
```

### 4.3 Add Keyboard Shortcut Help

```typescript
/**
 * KeyboardShortcutsHelp
 *
 * Shows available keyboard shortcuts.
 *
 * @module components/notebook/KeyboardShortcutsHelp
 */

import { Keyboard } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ShortcutItem {
  keys: string[]
  description: string
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', 'N'], description: 'New notebook' },
  { keys: ['⌘', 'F'], description: 'Search' },
  { keys: ['⌘', 'E'], description: 'Export' },
  { keys: ['Esc'], description: 'Close / Go back' },
  { keys: ['⌘', '⌫'], description: 'Delete' },
  { keys: ['⌘', 'S'], description: 'Save (when editing)' }
]

export function KeyboardShortcutsHelp() {
  return (
    <div className="p-3 border-t border-secondary/50">
      <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
        <Keyboard size={12} />
        <span>Keyboard Shortcuts</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {SHORTCUTS.map((shortcut, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, j) => (
                <kbd
                  key={j}
                  className={cn(
                    'px-1.5 py-0.5 rounded',
                    'bg-secondary border border-secondary/80',
                    'text-text-muted font-mono text-[10px]'
                  )}
                >
                  {key}
                </kbd>
              ))}
            </div>
            <span className="text-text-muted/70">{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default KeyboardShortcutsHelp
```

---

## Part 5: Bulk Operations

### 5.1 Update `NotebookViewer.tsx` with Selection Mode

```typescript
/**
 * NotebookViewer (Updated)
 *
 * Displays entries within a selected notebook with selection mode for bulk operations.
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
}

export function NotebookViewer({
  notebook,
  entries,
  loading,
  onDeleteEntry,
  onUpdateEntry,
  onUpdateNotebook,
  onDeleteNotebook,
  onReorderEntries,
  onBulkDeleteEntries
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
                <div className="absolute right-0 top-full mt-1 z-20 bg-tertiary border border-secondary rounded-lg shadow-xl py-1 min-w-[160px]">
                  {/* Selection mode toggle */}
                  <button
                    onClick={() => {
                      setIsSelectionMode(!isSelectionMode)
                      setShowMenu(false)
                      if (isSelectionMode) clearSelection()
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-muted hover:text-text-normal hover:bg-secondary transition-colors"
                  >
                    <CheckSquare size={14} />
                    {isSelectionMode ? 'Exit Selection' : 'Select Entries'}
                  </button>

                  <div className="border-t border-secondary/50 my-1" />

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

      {/* Selection Bar */}
      {isSelectionMode && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <div className="flex items-center gap-3">
            <span className="text-sm text-amber-400">
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
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs',
                'bg-red-500/20 text-red-400 hover:bg-red-500/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
            >
              {isBulkDeleting ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Trash2 size={12} />
              )}
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="p-1 rounded hover:bg-secondary text-text-muted hover:text-text-normal transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

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
        ) : isSelectionMode ? (
          // Selection mode - show checkboxes
          entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-2">
              <button
                onClick={() => toggleSelection(entry.id)}
                className="mt-3 p-1 rounded hover:bg-secondary transition-colors"
              >
                {selectedIds.has(entry.id) ? (
                  <CheckSquare size={18} className="text-amber-400" />
                ) : (
                  <Square size={18} className="text-text-muted" />
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
          ))
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
```

### 5.2 Add Bulk Delete Handler

```typescript
// In src/main/notebooks/service.ts, add:

export function bulkDeleteEntries(ids: string[]): boolean {
  if (ids.length === 0) return true

  const transaction = db.transaction(() => {
    // Get notebook IDs for count updates
    const entries = db.prepare(
      `SELECT notebook_id, COUNT(*) as count FROM notebook_entries WHERE id IN (${ids.map(() => '?').join(',')}) GROUP BY notebook_id`
    ).all(...ids) as { notebook_id: string; count: number }[]

    // Delete entries
    const deleteStmt = db.prepare(
      `DELETE FROM notebook_entries WHERE id IN (${ids.map(() => '?').join(',')})`
    )
    deleteStmt.run(...ids)

    // Update notebook counts
    const updateStmt = db.prepare(
      'UPDATE notebooks SET entry_count = entry_count - ?, updated_at = ? WHERE id = ?'
    )
    const now = new Date().toISOString()
    for (const { notebook_id, count } of entries) {
      updateStmt.run(count, now, notebook_id)
    }
  })

  try {
    transaction()
    return true
  } catch (err) {
    console.error('[NotebookService] Bulk delete failed:', err)
    return false
  }
}
```

```typescript
// In src/main/notebooks/index.ts, add handler:

ipcMain.handle('notebooks:entries:bulk-delete', async (_, ids: string[]) => {
  return bulkDeleteEntries(ids)
})
```

```typescript
// In src/preload/index.ts, add to entries:

entries: {
  // ... existing methods
  bulkDelete: (ids: string[]) =>
    ipcRenderer.invoke('notebooks:entries:bulk-delete', ids) as Promise<boolean>
}
```

---

## Files to Update: Summary

### New Files
- `src/renderer/src/components/notebook/SortableEntryList.tsx`
- `src/renderer/src/components/notebook/ExportMenu.tsx`
- `src/renderer/src/components/notebook/KeyboardShortcutsHelp.tsx`
- `src/renderer/src/hooks/useNotebookShortcuts.ts`

### Modified Files
- `src/main/notebooks/service.ts` - Add reorder, bulk delete, export formats
- `src/main/notebooks/index.ts` - Add new IPC handlers
- `src/preload/index.ts` - Add new API methods
- `src/renderer/src/components/notebook/NotebookEntryCard.tsx` - Add editing, drag handle
- `src/renderer/src/components/notebook/NotebookViewer.tsx` - Add selection mode, sortable list
- `src/renderer/src/components/notebook/NotebookSidebar.tsx` - Add keyboard shortcuts
- `src/renderer/src/components/notebook/index.ts` - Export new components

---

## Update Barrel Export

```typescript
// src/renderer/src/components/notebook/index.ts

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

// Phase 6 Components
export { SortableEntryList } from './SortableEntryList'
export { ExportMenu } from './ExportMenu'
export { KeyboardShortcutsHelp } from './KeyboardShortcutsHelp'

// Re-export types for convenience
export type {
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput
} from '../../types/notebook'
```

---

## Verification

### TypeScript Compilation
```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

### Manual Testing Checklist

1. **Entry Editing:**
   - [ ] Click edit button on entry card
   - [ ] Edit content, title, and tags
   - [ ] Save with button or ⌘S
   - [ ] Cancel with X or Escape
   - [ ] Verify changes persist after refresh

2. **Drag-and-Drop:**
   - [ ] Drag entries by grip handle
   - [ ] Drop to reorder
   - [ ] Verify order persists after refresh
   - [ ] Keyboard navigation works

3. **Export Options:**
   - [ ] Export as Markdown downloads .md file
   - [ ] Export as JSON downloads .json file
   - [ ] Export as Text downloads .txt file
   - [ ] Copy to clipboard works

4. **Keyboard Shortcuts:**
   - [ ] ⌘N opens create notebook modal
   - [ ] ⌘F focuses search input
   - [ ] ⌘E triggers export
   - [ ] Escape closes panel or navigates back
   - [ ] ⌘S saves when editing

5. **Bulk Operations:**
   - [ ] Enter selection mode from menu
   - [ ] Select individual entries
   - [ ] Select all works
   - [ ] Bulk delete removes selected
   - [ ] Clear selection exits mode

---

## Checklist

- [ ] Install @dnd-kit dependencies
- [ ] Add sort_order column migration
- [ ] Implement entry editing in NotebookEntryCard
- [ ] Create SortableEntryList with drag-and-drop
- [ ] Add reorder IPC handler and preload API
- [ ] Create ExportMenu with multiple formats
- [ ] Add export format handlers (JSON, text)
- [ ] Create useNotebookShortcuts hook
- [ ] Integrate keyboard shortcuts in NotebookSidebar
- [ ] Create KeyboardShortcutsHelp component
- [ ] Add selection mode to NotebookViewer
- [ ] Implement bulk delete handler
- [ ] Update barrel exports
- [ ] TypeScript compiles without errors
- [ ] Manual testing completed

---

## Git Commit

```bash
git add -A
git commit -m "feat(notebook): Phase 6 - Advanced features

- Add inline entry editing with title and tags
- Implement drag-and-drop entry reordering with @dnd-kit
- Add sort_order column for persistent ordering
- Create ExportMenu with Markdown, JSON, and plain text formats
- Add keyboard shortcuts (⌘N, ⌘F, ⌘E, ⌘S, Escape)
- Create useNotebookShortcuts hook
- Add selection mode for bulk operations
- Implement bulk delete for multiple entries
- Add KeyboardShortcutsHelp component"
```

---

## Future Enhancements (Phase 7+)

- **Notebook Templates** - Pre-defined notebook structures
- **Entry Linking** - Link entries across notebooks
- **Notebook Sharing** - Export/import notebook packages
- **Tags View** - Browse entries by tag across notebooks
- **Full-Text Search** - Upgrade to FTS5 for better search
- **Entry Comments** - Add notes/comments to entries
- **Version History** - Track entry changes over time

---

*Phase 6 Implementation Prompt*  
*Depends on: Phase 1-5 ✅*  
*Enables: Phase 7 (Templates & Sharing)*
