# Phase 3: useNotebooks React Hook

**Reference:** `docs/NOTEBOOK_FEATURE_DESIGN.md`  
**Depends on:** Phase 1 (Database & Service) ✅, Phase 2 (Preload API) ✅  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`

---

## Objective

Create a React hook (`useNotebooks`) for managing notebook state and operations in the renderer process. This hook provides the bridge between UI components and the preload API, following ArborChat's established patterns for state management.

---

## Pattern Reference

Follow the existing patterns established by:
- `src/renderer/src/hooks/useWorkJournal.ts` - Hook structure with typed helpers
- `src/renderer/src/hooks/useMCPTools.ts` - State management with useCallback
- `src/renderer/src/hooks/index.ts` - Barrel exports with types

---

## Files to Create

### 1. `src/renderer/src/hooks/useNotebooks.ts`

```typescript
/**
 * useNotebooks Hook
 *
 * Main hook for notebook management in the renderer.
 * Provides state management and operations for notebooks and entries.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type {
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput,
  NotebookSearchResult
} from '../types/notebook'

export interface UseNotebooksState {
  notebooks: Notebook[]
  loading: boolean
  error: string | null
  selectedNotebookId: string | null
  selectedNotebook: Notebook | null
  entries: NotebookEntry[]
  entriesLoading: boolean
}

export interface UseNotebooksActions {
  // Notebook operations
  loadNotebooks: () => Promise<void>
  createNotebook: (input: CreateNotebookInput) => Promise<Notebook>
  updateNotebook: (id: string, input: UpdateNotebookInput) => Promise<Notebook | null>
  deleteNotebook: (id: string) => Promise<boolean>
  selectNotebook: (id: string | null) => void

  // Entry operations
  loadEntries: (notebookId: string) => Promise<NotebookEntry[]>
  createEntry: (input: CreateEntryInput) => Promise<NotebookEntry>
  updateEntry: (id: string, input: UpdateEntryInput) => Promise<NotebookEntry | null>
  deleteEntry: (id: string) => Promise<boolean>

  // Search & Export
  search: (query: string) => Promise<NotebookSearchResult[]>
  exportNotebook: (id: string) => Promise<string | null>

  // Utility
  clearError: () => void
  refresh: () => Promise<void>
}

export type UseNotebooksReturn = UseNotebooksState & UseNotebooksActions

export function useNotebooks(): UseNotebooksReturn {
  // ============ STATE ============
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedNotebookId, setSelectedNotebookId] = useState<string | null>(null)
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [entriesLoading, setEntriesLoading] = useState(false)

  // ============ COMPUTED ============
  const selectedNotebook = useMemo(() => {
    if (!selectedNotebookId) return null
    return notebooks.find((n) => n.id === selectedNotebookId) ?? null
  }, [notebooks, selectedNotebookId])

  // ============ NOTEBOOK OPERATIONS ============

  const loadNotebooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.notebooks.list()
      setNotebooks(list)
    } catch (err) {
      console.error('[useNotebooks] Failed to load notebooks:', err)
      setError('Failed to load notebooks')
    } finally {
      setLoading(false)
    }
  }, [])

  const createNotebook = useCallback(async (input: CreateNotebookInput): Promise<Notebook> => {
    try {
      const notebook = await window.api.notebooks.create(input)
      setNotebooks((prev) => [notebook, ...prev])
      return notebook
    } catch (err) {
      console.error('[useNotebooks] Failed to create notebook:', err)
      setError('Failed to create notebook')
      throw err
    }
  }, [])

  const updateNotebook = useCallback(
    async (id: string, input: UpdateNotebookInput): Promise<Notebook | null> => {
      try {
        const updated = await window.api.notebooks.update(id, input)
        if (updated) {
          setNotebooks((prev) => prev.map((n) => (n.id === id ? updated : n)))
        }
        return updated
      } catch (err) {
        console.error('[useNotebooks] Failed to update notebook:', err)
        setError('Failed to update notebook')
        throw err
      }
    },
    []
  )

  const deleteNotebook = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const success = await window.api.notebooks.delete(id)
        if (success) {
          setNotebooks((prev) => prev.filter((n) => n.id !== id))
          // Clear selection if deleted notebook was selected
          if (selectedNotebookId === id) {
            setSelectedNotebookId(null)
            setEntries([])
          }
        }
        return success
      } catch (err) {
        console.error('[useNotebooks] Failed to delete notebook:', err)
        setError('Failed to delete notebook')
        throw err
      }
    },
    [selectedNotebookId]
  )

  const selectNotebook = useCallback((id: string | null) => {
    setSelectedNotebookId(id)
    if (!id) {
      setEntries([])
    }
  }, [])

  // ============ ENTRY OPERATIONS ============

  const loadEntries = useCallback(async (notebookId: string): Promise<NotebookEntry[]> => {
    setEntriesLoading(true)
    try {
      const entryList = await window.api.notebooks.entries.list(notebookId)
      // Only update state if this is the currently selected notebook
      if (notebookId === selectedNotebookId) {
        setEntries(entryList)
      }
      return entryList
    } catch (err) {
      console.error('[useNotebooks] Failed to load entries:', err)
      setError('Failed to load notebook entries')
      throw err
    } finally {
      setEntriesLoading(false)
    }
  }, [selectedNotebookId])

  const createEntry = useCallback(async (input: CreateEntryInput): Promise<NotebookEntry> => {
    try {
      const entry = await window.api.notebooks.entries.create(input)
      
      // Update local entries if this is for the selected notebook
      if (input.notebook_id === selectedNotebookId) {
        setEntries((prev) => [entry, ...prev])
      }

      // Update notebook entry count locally
      setNotebooks((prev) =>
        prev.map((n) =>
          n.id === input.notebook_id
            ? { ...n, entry_count: n.entry_count + 1, updated_at: new Date().toISOString() }
            : n
        )
      )

      return entry
    } catch (err) {
      console.error('[useNotebooks] Failed to create entry:', err)
      setError('Failed to save to notebook')
      throw err
    }
  }, [selectedNotebookId])

  const updateEntry = useCallback(
    async (id: string, input: UpdateEntryInput): Promise<NotebookEntry | null> => {
      try {
        const updated = await window.api.notebooks.entries.update(id, input)
        if (updated) {
          setEntries((prev) => prev.map((e) => (e.id === id ? updated : e)))
        }
        return updated
      } catch (err) {
        console.error('[useNotebooks] Failed to update entry:', err)
        setError('Failed to update entry')
        throw err
      }
    },
    []
  )

  const deleteEntry = useCallback(
    async (id: string): Promise<boolean> => {
      // Get entry first to know which notebook to update
      const entry = entries.find((e) => e.id === id)
      
      try {
        const success = await window.api.notebooks.entries.delete(id)
        if (success) {
          setEntries((prev) => prev.filter((e) => e.id !== id))

          // Update notebook entry count locally
          if (entry) {
            setNotebooks((prev) =>
              prev.map((n) =>
                n.id === entry.notebook_id
                  ? { ...n, entry_count: Math.max(0, n.entry_count - 1) }
                  : n
              )
            )
          }
        }
        return success
      } catch (err) {
        console.error('[useNotebooks] Failed to delete entry:', err)
        setError('Failed to delete entry')
        throw err
      }
    },
    [entries]
  )

  // ============ SEARCH & EXPORT ============

  const search = useCallback(async (query: string): Promise<NotebookSearchResult[]> => {
    try {
      return await window.api.notebooks.search(query)
    } catch (err) {
      console.error('[useNotebooks] Search failed:', err)
      setError('Search failed')
      throw err
    }
  }, [])

  const exportNotebook = useCallback(async (id: string): Promise<string | null> => {
    try {
      return await window.api.notebooks.export(id)
    } catch (err) {
      console.error('[useNotebooks] Export failed:', err)
      setError('Export failed')
      throw err
    }
  }, [])

  // ============ UTILITY ============

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const refresh = useCallback(async () => {
    await loadNotebooks()
    if (selectedNotebookId) {
      await loadEntries(selectedNotebookId)
    }
  }, [loadNotebooks, loadEntries, selectedNotebookId])

  // ============ EFFECTS ============

  // Load notebooks on mount
  useEffect(() => {
    loadNotebooks()
  }, [loadNotebooks])

  // Load entries when notebook is selected
  useEffect(() => {
    if (selectedNotebookId) {
      loadEntries(selectedNotebookId)
    }
  }, [selectedNotebookId, loadEntries])

  // ============ RETURN ============

  return {
    // State
    notebooks,
    loading,
    error,
    selectedNotebookId,
    selectedNotebook,
    entries,
    entriesLoading,

    // Notebook operations
    loadNotebooks,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    selectNotebook,

    // Entry operations
    loadEntries,
    createEntry,
    updateEntry,
    deleteEntry,

    // Search & Export
    search,
    exportNotebook,

    // Utility
    clearError,
    refresh
  }
}

export default useNotebooks
```

---

## Files to Modify

### 2. `src/renderer/src/hooks/index.ts`

**Add the following exports at the end of the file:**

```typescript
// Notebook System
export { useNotebooks } from './useNotebooks'
export type {
  UseNotebooksState,
  UseNotebooksActions,
  UseNotebooksReturn
} from './useNotebooks'
```

---

## Implementation Notes

### State Management Strategy

The hook manages two levels of state:

1. **Notebook List State** - Global list of all notebooks
2. **Selected Notebook State** - Currently selected notebook and its entries

```
┌─────────────────────────────────────────────────────────┐
│  useNotebooks State                                      │
│  ┌───────────────────┐  ┌───────────────────────────┐   │
│  │ notebooks[]       │  │ selectedNotebookId        │   │
│  │ loading           │  │ selectedNotebook (derived)│   │
│  │ error             │  │ entries[]                 │   │
│  └───────────────────┘  │ entriesLoading            │   │
│                         └───────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Optimistic Updates

The hook performs optimistic updates for:
- **Creating entries** - Adds to local state immediately, updates entry count
- **Deleting entries** - Removes from local state immediately, updates entry count
- **Deleting notebooks** - Removes from local state, clears selection if needed

### Error Handling Pattern

```typescript
// Standard error handling with user-friendly messages
try {
  const result = await window.api.notebooks.operation()
  // Update state optimistically
  return result
} catch (err) {
  console.error('[useNotebooks] Operation failed:', err)
  setError('User-friendly error message')
  throw err // Re-throw for component-level handling
}
```

### Type Safety

All operations are fully typed with interfaces exported for component use:
- `UseNotebooksState` - Read-only state properties
- `UseNotebooksActions` - Available methods
- `UseNotebooksReturn` - Combined return type

---

## Usage Examples

### Basic Usage

```typescript
import { useNotebooks } from '../hooks'

function NotebookList() {
  const { notebooks, loading, error, selectNotebook } = useNotebooks()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <ul>
      {notebooks.map((nb) => (
        <li key={nb.id} onClick={() => selectNotebook(nb.id)}>
          {nb.emoji} {nb.name} ({nb.entry_count})
        </li>
      ))}
    </ul>
  )
}
```

### Creating a Notebook

```typescript
const { createNotebook } = useNotebooks()

async function handleCreate() {
  try {
    const notebook = await createNotebook({
      name: 'My Notes',
      emoji: '📝',
      color: 'blue'
    })
    console.log('Created:', notebook.id)
  } catch (err) {
    // Error already set in hook state
  }
}
```

### Saving Chat Content

```typescript
const { createEntry } = useNotebooks()

async function saveToNotebook(messageContent: string, messageId: string, conversationId: string) {
  const entry = await createEntry({
    notebook_id: selectedNotebookId,
    content: messageContent,
    source_message_id: messageId,
    source_conversation_id: conversationId,
    source_role: 'assistant'
  })
  return entry
}
```

### Search

```typescript
const { search } = useNotebooks()
const [results, setResults] = useState<NotebookSearchResult[]>([])

async function handleSearch(query: string) {
  const searchResults = await search(query)
  setResults(searchResults)
}
```

---

## Verification

### TypeScript Compilation
```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

### Manual Testing (in Electron DevTools Console)

The hook relies on the preload API, which was verified in Phase 2:

```javascript
// Verify preload API is accessible
await window.api.notebooks.list()

// Verify notebook creation flow
const nb = await window.api.notebooks.create({ name: 'Test', emoji: '📓' })
await window.api.notebooks.entries.create({
  notebook_id: nb.id,
  content: 'Test entry'
})
await window.api.notebooks.delete(nb.id)
```

### React Component Test

Create a minimal test component:

```typescript
// Temporary test - add to any rendered component
import { useNotebooks } from '../hooks'

function NotebookTest() {
  const { notebooks, loading, error, createNotebook, deleteNotebook } = useNotebooks()
  
  useEffect(() => {
    console.log('[NotebookTest] State:', { notebooks, loading, error })
  }, [notebooks, loading, error])

  const handleTest = async () => {
    const nb = await createNotebook({ name: 'Hook Test', emoji: '🧪' })
    console.log('[NotebookTest] Created:', nb)
    setTimeout(() => deleteNotebook(nb.id), 2000)
  }

  return <button onClick={handleTest}>Test Hook</button>
}
```

---

## Checklist

- [ ] `src/renderer/src/hooks/useNotebooks.ts` created
- [ ] All state variables implemented (notebooks, loading, error, selectedNotebookId, entries, entriesLoading)
- [ ] `selectedNotebook` computed with useMemo
- [ ] `loadNotebooks` implemented with error handling
- [ ] `createNotebook` implemented with optimistic update
- [ ] `updateNotebook` implemented
- [ ] `deleteNotebook` implemented with selection cleanup
- [ ] `selectNotebook` implemented
- [ ] `loadEntries` implemented
- [ ] `createEntry` implemented with notebook entry count update
- [ ] `updateEntry` implemented
- [ ] `deleteEntry` implemented with entry count update
- [ ] `search` implemented
- [ ] `exportNotebook` implemented
- [ ] `clearError` utility implemented
- [ ] `refresh` utility implemented
- [ ] Mount effect loads notebooks
- [ ] Selection effect loads entries
- [ ] All types exported (UseNotebooksState, UseNotebooksActions, UseNotebooksReturn)
- [ ] Hook added to `src/renderer/src/hooks/index.ts` exports
- [ ] TypeScript compiles without errors

---

## Git Commit

```bash
git add -A
git commit -m "feat(notebook): Phase 3 - useNotebooks React hook

- Create useNotebooks hook for state management
- Implement notebook CRUD with optimistic updates
- Implement entry CRUD with automatic count sync
- Add search and export functionality
- Add selectedNotebook computed state
- Add automatic entry loading on notebook selection
- Export types for component consumption"
```

---

## Next Phase

**Phase 4** will create the `SaveToNotebookModal` component that allows users to save chat messages to notebooks.

---

*Phase 3 Implementation Prompt*  
*Depends on: Phase 1 ✅, Phase 2 ✅*  
*Enables: Phase 4 (SaveToNotebookModal Component)*
