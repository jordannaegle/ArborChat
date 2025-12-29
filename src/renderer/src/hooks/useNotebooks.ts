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
