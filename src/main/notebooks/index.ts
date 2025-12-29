/**
 * Notebook Module
 * IPC handlers and exports for the notebook system
 *
 * @module main/notebooks
 */

import { ipcMain } from 'electron'
import {
  initNotebookTables,
  createNotebook,
  getNotebooks,
  getNotebook,
  updateNotebook,
  deleteNotebook,
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
  exportNotebookAsMarkdown
} from './service'
import type {
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput
} from './types'

/**
 * Setup all notebook IPC handlers
 * Called during app initialization
 */
export function setupNotebookHandlers(): void {
  console.log('[Notebooks] Setting up IPC handlers...')

  // Initialize database tables
  initNotebookTables()

  // ===== NOTEBOOK HANDLERS =====

  ipcMain.handle('notebooks:list', async () => {
    return getNotebooks()
  })

  ipcMain.handle('notebooks:get', async (_, id: string) => {
    return getNotebook(id)
  })

  ipcMain.handle('notebooks:create', async (_, input: CreateNotebookInput) => {
    return createNotebook(input)
  })

  ipcMain.handle('notebooks:update', async (_, { id, input }: { id: string; input: UpdateNotebookInput }) => {
    return updateNotebook(id, input)
  })

  ipcMain.handle('notebooks:delete', async (_, id: string) => {
    return deleteNotebook(id)
  })

  // ===== ENTRY HANDLERS =====

  ipcMain.handle('notebooks:entries:list', async (_, notebookId: string) => {
    return getEntries(notebookId)
  })

  ipcMain.handle('notebooks:entries:get', async (_, id: string) => {
    return getEntry(id)
  })

  ipcMain.handle('notebooks:entries:create', async (_, input: CreateEntryInput) => {
    return createEntry(input)
  })

  ipcMain.handle('notebooks:entries:update', async (_, { id, input }: { id: string; input: UpdateEntryInput }) => {
    return updateEntry(id, input)
  })

  ipcMain.handle('notebooks:entries:delete', async (_, id: string) => {
    return deleteEntry(id)
  })

  // ===== SEARCH & EXPORT =====

  ipcMain.handle('notebooks:search', async (_, query: string) => {
    return searchEntries(query)
  })

  ipcMain.handle('notebooks:export', async (_, id: string) => {
    return exportNotebookAsMarkdown(id)
  })

  console.log('[Notebooks] IPC handlers ready')
}

// Re-export types for convenience
export * from './types'
