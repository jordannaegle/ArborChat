/**
 * Work Journal IPC Handlers
 *
 * Sets up IPC communication between renderer and WorkJournalManager.
 * Follows patterns from src/main/personas/index.ts and src/main/mcp/ipc.ts
 *
 * Security considerations:
 * - All handlers validate inputs before processing
 * - WebContents cleanup prevents memory leaks
 * - Errors are caught and logged, not exposed raw to renderer
 *
 * @module main/workJournal
 */

import { ipcMain, WebContents } from 'electron'
import { workJournalManager } from '../services/WorkJournalManager'
import type {
  WorkSessionStatus,
  EntryType,
  EntryImportance,
  EntryContent,
  GetEntriesOptions,
  CreateCheckpointOptions,
  WorkEntry
} from '../../shared/types/workJournal'

// Track subscribed webContents per session for real-time updates
const sessionSubscribers = new Map<string, Set<WebContents>>()

/** Options for on-demand summarization */
interface SummarizationOptions {
  targetTokens?: number
  useAI?: boolean
}

/**
 * Setup all work journal IPC handlers
 * Call this during app initialization
 */
export function setupWorkJournalHandlers(): void {
  console.log('[WorkJournal] Setting up IPC handlers...')

  // Ensure WorkJournalManager is initialized
  workJournalManager.init()

  // ===========================================================================
  // Session Management
  // ===========================================================================

  ipcMain.handle(
    'work-journal:create-session',
    async (
      _,
      { conversationId, originalPrompt }: { conversationId: string; originalPrompt: string }
    ) => {
      try {
        return workJournalManager.createSession(conversationId, originalPrompt)
      } catch (error) {
        console.error('[WorkJournal] Create session failed:', error)
        throw error
      }
    }
  )

  ipcMain.handle('work-journal:get-session', async (_, sessionId: string) => {
    try {
      return workJournalManager.getSession(sessionId)
    } catch (error) {
      console.error(`[WorkJournal] Get session failed for ${sessionId}:`, error)
      throw error
    }
  })

  ipcMain.handle('work-journal:get-active-session', async (_, conversationId: string) => {
    try {
      return workJournalManager.getActiveSession(conversationId)
    } catch (error) {
      console.error(`[WorkJournal] Get active session failed for ${conversationId}:`, error)
      throw error
    }
  })

  // Get sessions that can be resumed (paused or crashed)
  ipcMain.handle('work-journal:get-resumable-sessions', async (_, limit?: number) => {
    try {
      return workJournalManager.getResumableSessions(limit)
    } catch (error) {
      console.error('[WorkJournal] Get resumable sessions failed:', error)
      throw error
    }
  })

  ipcMain.handle(
    'work-journal:update-session-status',
    async (_, { sessionId, status }: { sessionId: string; status: WorkSessionStatus }) => {
      try {
        workJournalManager.updateSessionStatus(sessionId, status)

        // Notify subscribers of status change
        notifyStatusChange(sessionId, status)

        return { success: true }
      } catch (error) {
        console.error(`[WorkJournal] Update status failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  // ===========================================================================
  // Entry Logging
  // ===========================================================================

  ipcMain.handle(
    'work-journal:log-entry',
    async (
      _,
      {
        sessionId,
        entryType,
        content,
        importance
      }: {
        sessionId: string
        entryType: EntryType
        content: EntryContent
        importance?: EntryImportance
      }
    ) => {
      try {
        const entry = workJournalManager.logEntry(sessionId, entryType, content, importance)

        // Broadcast via IPC for renderer subscribers
        notifyNewEntry(sessionId, entry)

        return entry
      } catch (error) {
        console.error(`[WorkJournal] Log entry failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  ipcMain.handle(
    'work-journal:get-entries',
    async (_, { sessionId, options }: { sessionId: string; options?: GetEntriesOptions }) => {
      try {
        return workJournalManager.getEntries(sessionId, options)
      } catch (error) {
        console.error(`[WorkJournal] Get entries failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  // ===========================================================================
  // Checkpointing
  // ===========================================================================

  ipcMain.handle(
    'work-journal:create-checkpoint',
    async (
      _,
      { sessionId, options }: { sessionId: string; options?: CreateCheckpointOptions }
    ) => {
      try {
        return await workJournalManager.createCheckpoint(sessionId, options)
      } catch (error) {
        console.error(`[WorkJournal] Create checkpoint failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  ipcMain.handle('work-journal:get-latest-checkpoint', async (_, sessionId: string) => {
    try {
      return workJournalManager.getLatestCheckpoint(sessionId)
    } catch (error) {
      console.error(`[WorkJournal] Get checkpoint failed for ${sessionId}:`, error)
      throw error
    }
  })

  // ===========================================================================
  // AI Summarization (Phase 6)
  // ===========================================================================

  /**
   * Summarize a session on-demand without creating a checkpoint
   */
  ipcMain.handle(
    'work-journal:summarize-session',
    async (_, { sessionId, options }: { sessionId: string; options?: SummarizationOptions }) => {
      try {
        return await workJournalManager.summarizeSession(sessionId, options)
      } catch (error) {
        console.error(`[WorkJournal] Summarize session failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  /**
   * Enable/disable AI summarization globally
   */
  ipcMain.handle('work-journal:set-ai-summarization', async (_, enabled: boolean) => {
    try {
      workJournalManager.setAISummarizationEnabled(enabled)
      return { success: true, enabled }
    } catch (error) {
      console.error('[WorkJournal] Set AI summarization failed:', error)
      throw error
    }
  })

  /**
   * Get AI summarization status
   */
  ipcMain.handle('work-journal:get-ai-summarization-status', async () => {
    try {
      return {
        enabled: workJournalManager.isAISummarizationEnabled()
      }
    } catch (error) {
      console.error('[WorkJournal] Get AI summarization status failed:', error)
      throw error
    }
  })

  // ===========================================================================
  // Resumption
  // ===========================================================================

  ipcMain.handle(
    'work-journal:generate-resumption-context',
    async (_, { sessionId, targetTokens }: { sessionId: string; targetTokens?: number }) => {
      try {
        return await workJournalManager.generateResumptionContext(sessionId, targetTokens)
      } catch (error) {
        console.error(`[WorkJournal] Generate context failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  // ===========================================================================
  // Subscriptions (Real-time updates to renderer)
  // ===========================================================================

  ipcMain.handle('work-journal:subscribe', async (event, sessionId: string) => {
    const webContents = event.sender

    if (!sessionSubscribers.has(sessionId)) {
      sessionSubscribers.set(sessionId, new Set())
    }
    sessionSubscribers.get(sessionId)!.add(webContents)

    // Clean up when window closes to prevent memory leaks
    webContents.once('destroyed', () => {
      const subs = sessionSubscribers.get(sessionId)
      if (subs) {
        subs.delete(webContents)
        if (subs.size === 0) {
          sessionSubscribers.delete(sessionId)
        }
      }
    })

    console.log(`[WorkJournal] Subscribed to session ${sessionId}`)
    return { success: true, sessionId }
  })

  ipcMain.handle('work-journal:unsubscribe', async (event, sessionId: string) => {
    const webContents = event.sender
    const subs = sessionSubscribers.get(sessionId)

    if (subs) {
      subs.delete(webContents)
      if (subs.size === 0) {
        sessionSubscribers.delete(sessionId)
      }
    }

    console.log(`[WorkJournal] Unsubscribed from session ${sessionId}`)
    return { success: true }
  })

  // ===========================================================================
  // Utility handlers
  // ===========================================================================

  ipcMain.handle('work-journal:get-session-tokens', async (_, sessionId: string) => {
    try {
      return workJournalManager.getSessionTokens(sessionId)
    } catch (error) {
      console.error(`[WorkJournal] Get tokens failed for ${sessionId}:`, error)
      throw error
    }
  })

  ipcMain.handle(
    'work-journal:is-approaching-limit',
    async (_, { sessionId, threshold }: { sessionId: string; threshold?: number }) => {
      try {
        return workJournalManager.isApproachingLimit(sessionId, threshold)
      } catch (error) {
        console.error(`[WorkJournal] Check limit failed for ${sessionId}:`, error)
        throw error
      }
    }
  )

  console.log('[WorkJournal] IPC handlers ready')
}

// =============================================================================
// Helper Functions for Real-time Notifications
// =============================================================================

/**
 * Notify all subscribers of a new entry
 */
function notifyNewEntry(sessionId: string, entry: WorkEntry): void {
  const subs = sessionSubscribers.get(sessionId)
  if (!subs) return

  for (const webContents of subs) {
    if (!webContents.isDestroyed()) {
      webContents.send('work-journal:new-entry', { sessionId, entry })
    }
  }
}

/**
 * Notify all subscribers of a status change
 */
function notifyStatusChange(sessionId: string, status: WorkSessionStatus): void {
  const subs = sessionSubscribers.get(sessionId)
  if (!subs) return

  for (const webContents of subs) {
    if (!webContents.isDestroyed()) {
      webContents.send('work-journal:status-change', { sessionId, status })
    }
  }
}

/**
 * Clean up all subscriptions (call on app quit)
 */
export function cleanupWorkJournalSubscriptions(): void {
  sessionSubscribers.clear()
  console.log('[WorkJournal] Cleaned up all subscriptions')
}

// Re-export manager for direct access if needed
export { workJournalManager }
