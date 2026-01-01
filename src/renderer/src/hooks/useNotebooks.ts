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
  reorderEntries: (notebookId: string, orderedIds: string[]) => Promise<boolean>
  bulkDeleteEntries: (ids: string[]) => Promise<boolean>

  // Search & Export
  search: (query: string) => Promise<NotebookSearchResult[]>
  exportNotebook: (id: string) => Promise<string | null>
  exportNotebookJSON: (id: string) => Promise<string | null>
  exportNotebookText: (id: string) => Promise<string | null>

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
      console.log('[useNotebooks] Loading notebooks...')
      const list = await window.api.notebooks.list()
      console.log('[useNotebooks] Loaded notebooks:', list.length, list.map(n => n.name))
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

  const selectNotebook = useCallback(async (id: string | null) => {
    console.log('[useNotebooks] selectNotebook called with id:', id)
    setSelectedNotebookId(id)
    if (!id) {
      setEntries([])
      return
    }
    
    // Check if notebook exists in local state
    const existsLocally = notebooks.some(n => n.id === id)
    console.log('[useNotebooks] Notebook exists locally:', existsLocally, 'notebooks count:', notebooks.length)
    
    // If notebook not found locally, refresh the list
    if (!existsLocally) {
      console.log('[useNotebooks] Notebook not in local state, refreshing...')
      try {
        const list = await window.api.notebooks.list()
        console.log('[useNotebooks] Refreshed notebooks:', list.length, list.map(n => n.name))
        setNotebooks(list)
      } catch (err) {
        console.error('[useNotebooks] Failed to refresh notebooks:', err)
      }
    }
  }, [notebooks])

  // ============ ENTRY OPERATIONS ============

  const loadEntries = useCallback(
    async (notebookId: string): Promise<NotebookEntry[]> => {
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
    },
    [selectedNotebookId]
  )

  const createEntry = useCallback(
    async (input: CreateEntryInput): Promise<NotebookEntry> => {
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
    },
    [selectedNotebookId]
  )

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

  // Phase 6: Reorder entries within a notebook
  const reorderEntries = useCallback(
    async (notebookId: string, orderedIds: string[]): Promise<boolean> => {
      try {
        const success = await window.api.notebooks.entries.reorder(notebookId, orderedIds)
        if (success && notebookId === selectedNotebookId) {
          // Reorder local entries to match
          const reordered = orderedIds
            .map(id => entries.find(e => e.id === id))
            .filter((e): e is NotebookEntry => e !== undefined)
          setEntries(reordered)
        }
        return success
      } catch (err) {
        console.error('[useNotebooks] Failed to reorder entries:', err)
        setError('Failed to reorder entries')
        return false
      }
    },
    [entries, selectedNotebookId]
  )

  // Phase 6: Bulk delete entries
  const bulkDeleteEntries = useCallback(
    async (ids: string[]): Promise<boolean> => {
      try {
        const success = await window.api.notebooks.entries.bulkDelete(ids)
        if (success) {
          // Remove deleted entries from local state
          setEntries((prev) => prev.filter((e) => !ids.includes(e.id)))

          // Update notebook entry counts
          const deletedEntries = entries.filter(e => ids.includes(e.id))
          const countsByNotebook = new Map<string, number>()
          deletedEntries.forEach(e => {
            countsByNotebook.set(e.notebook_id, (countsByNotebook.get(e.notebook_id) || 0) + 1)
          })

          setNotebooks((prev) =>
            prev.map((n) => {
              const deletedCount = countsByNotebook.get(n.id) || 0
              return deletedCount > 0
                ? { ...n, entry_count: Math.max(0, n.entry_count - deletedCount) }
                : n
            })
          )
        }
        return success
      } catch (err) {
        console.error('[useNotebooks] Failed to bulk delete entries:', err)
        setError('Failed to delete entries')
        return false
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
      return await window.api.notebooks.export.markdown(id)
    } catch (err) {
      console.error('[useNotebooks] Export failed:', err)
      setError('Export failed')
      throw err
    }
  }, [])

  // Phase 6: Export as JSON
  const exportNotebookJSON = useCallback(async (id: string): Promise<string | null> => {
    try {
      return await window.api.notebooks.export.json(id)
    } catch (err) {
      console.error('[useNotebooks] JSON export failed:', err)
      setError('Export failed')
      throw err
    }
  }, [])

  // Phase 6: Export as plain text
  const exportNotebookText = useCallback(async (id: string): Promise<string | null> => {
    try {
      return await window.api.notebooks.export.text(id)
    } catch (err) {
      console.error('[useNotebooks] Text export failed:', err)
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
    reorderEntries,
    bulkDeleteEntries,

    // Search & Export
    search,
    exportNotebook,
    exportNotebookJSON,
    exportNotebookText,

    // Utility
    clearError,
    refresh
  }
}

export default useNotebooks
