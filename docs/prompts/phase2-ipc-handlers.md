# Phase 2 Prompt: IPC Handlers + Preload API

Copy everything below this line to start Phase 2 in a new window:

---

## Project Context

I'm working on ArborChat, an Electron-based threaded AI chat desktop application.

**Location:** `/Users/cory.naegle/ArborChat`

**Tech Stack:**
- Electron 39, React 19, TypeScript 5.9
- Tailwind CSS v4, Vite 7
- better-sqlite3 for persistence
- @google/generative-ai for AI features
- @modelcontextprotocol/sdk for MCP integration
- Lucide React icons

**Architecture:**
- Main process: `src/main/`
- Preload scripts: `src/preload/`
- Renderer/UI: `src/renderer/src/`
- Shared types: `src/shared/types/`

---

## Task: Agent Work Journal System - Phase 2

Please adopt the **Alex Chen persona** (Distinguished Software Architect) for this implementation.

Start responses with: `[Architecting as Alex Chen — evaluating through security boundaries, type safety, and scalable patterns...]`

### Design Document
Full design: `/Users/cory.naegle/ArborChat/docs/agent-context-memory-extension.md`

### Phase 1 Status: ✅ COMPLETE

Files created:
1. `src/shared/types/workJournal.ts` — All TypeScript types including:
   - `WorkSession`, `WorkEntry`, `WorkCheckpoint`, `ResumptionContext`
   - `EntryType`, `EntryImportance`, `WorkSessionStatus`
   - All `EntryContent` discriminated union types
   - `GetEntriesOptions`, `CreateCheckpointOptions`
   - `WorkJournalEntryEvent`, `WorkJournalStatusEvent` (IPC event types)
   - `WorkEntryCallback`, `UnsubscribeFn` (subscription types)
   
2. `src/shared/types/index.ts` — Barrel export (add workJournal exports)

3. `src/main/services/WorkJournalManager.ts` — Core service class with:
   - SQLite tables: `work_sessions`, `work_entries`, `work_checkpoints`
   - Session management: `createSession`, `getSession`, `getActiveSession`, `updateSessionStatus`
   - Entry logging: `logEntry`, `getEntries`, `getLatestEntry`
   - Checkpointing: `createCheckpoint`, `getLatestCheckpoint`, `getCheckpoints`
   - Subscriptions: `subscribe(sessionId, callback)` returns unsubscribe function
   - Resumption: `generateResumptionContext`
   - Utilities: `getSessionTokens`, `isApproachingLimit`, `cleanupOldSessions`
   - Singleton export: `workJournalManager`

4. `src/main/services/index.ts` — Barrel export

---

## Phase 2: IPC Handlers + Preload API — ✅ COMPLETE

**Implemented:** December 28, 2025
**Estimate:** 2-3 hours

### Implementation Summary

Phase 2 has been successfully implemented with all IPC handlers and preload API in place.

### Files to Create

1. **`src/main/workJournal/index.ts`** — IPC handler setup
2. **Update `src/preload/index.ts`** — Add workJournal API
3. **Update `src/main/index.ts`** — Wire up handlers

---

### Reference Files to Read First

Before implementing, read these files for patterns:

```
src/main/personas/index.ts        — IPC handler setup pattern
src/main/mcp/ipc.ts               — Real-time subscription pattern  
src/preload/index.ts              — Preload API exposure pattern
src/main/index.ts                 — Handler initialization
```

---

### IPC Channels to Implement

| Channel | Type | Description |
|---------|------|-------------|
| `work-journal:create-session` | invoke | Create new work session |
| `work-journal:get-session` | invoke | Get session by ID |
| `work-journal:get-active-session` | invoke | Get active session for conversation |
| `work-journal:update-session-status` | invoke | Update session status |
| `work-journal:log-entry` | invoke | Log a new entry |
| `work-journal:get-entries` | invoke | Get entries with optional filters |
| `work-journal:create-checkpoint` | invoke | Create checkpoint |
| `work-journal:get-latest-checkpoint` | invoke | Get latest checkpoint |
| `work-journal:generate-resumption-context` | invoke | Generate resumption context |
| `work-journal:subscribe` | invoke | Subscribe to session events |
| `work-journal:unsubscribe` | invoke | Unsubscribe from session events |

---

### File 1: `src/main/workJournal/index.ts`

```typescript
/**
 * Work Journal IPC Handlers
 * 
 * Sets up IPC communication between renderer and WorkJournalManager.
 * Follows patterns from src/main/personas/index.ts and src/main/mcp/ipc.ts
 */

import { ipcMain, BrowserWindow, WebContents } from 'electron'
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

// Track subscribed webContents per session
const sessionSubscribers = new Map<string, Set<WebContents>>()

/**
 * Setup all work journal IPC handlers
 * Call this during app initialization
 */
export function setupWorkJournalHandlers(): void {
  console.log('[WorkJournal] Setting up IPC handlers...')

  // Ensure WorkJournalManager is initialized
  workJournalManager.init()

  // =========================================================================
  // Session Management
  // =========================================================================

  ipcMain.handle(
    'work-journal:create-session',
    async (_, { conversationId, originalPrompt }: { 
      conversationId: string
      originalPrompt: string 
    }) => {
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

  // =========================================================================
  // Entry Logging
  // =========================================================================

  ipcMain.handle(
    'work-journal:log-entry',
    async (_, { 
      sessionId, 
      entryType, 
      content, 
      importance 
    }: {
      sessionId: string
      entryType: EntryType
      content: EntryContent
      importance?: EntryImportance
    }) => {
      try {
        const entry = workJournalManager.logEntry(sessionId, entryType, content, importance)
        
        // Note: WorkJournalManager already notifies via its internal subscribe mechanism
        // We additionally broadcast via IPC for renderer subscribers
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

  // =========================================================================
  // Checkpointing
  // =========================================================================

  ipcMain.handle(
    'work-journal:create-checkpoint',
    async (_, { sessionId, options }: { sessionId: string; options?: CreateCheckpointOptions }) => {
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

  // =========================================================================
  // Resumption
  // =========================================================================

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

  // =========================================================================
  // Subscriptions (Real-time updates to renderer)
  // =========================================================================

  ipcMain.handle('work-journal:subscribe', async (event, sessionId: string) => {
    const webContents = event.sender
    
    if (!sessionSubscribers.has(sessionId)) {
      sessionSubscribers.set(sessionId, new Set())
    }
    sessionSubscribers.get(sessionId)!.add(webContents)
    
    // Clean up when window closes
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

  // =========================================================================
  // Utility handlers
  // =========================================================================

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

// =========================================================================
// Helper Functions for Real-time Notifications
// =========================================================================

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
```

---

### File 2: Update `src/preload/index.ts`

Add these types near the top (after existing type definitions):

```typescript
// Work Journal API types
interface WorkSession {
  id: string
  conversationId: string
  originalPrompt: string
  status: 'active' | 'paused' | 'completed' | 'crashed'
  createdAt: number
  updatedAt: number
  completedAt?: number
  tokenEstimate: number
  entryCount: number
}

interface WorkEntry {
  id: number
  sessionId: string
  sequenceNum: number
  entryType: string
  timestamp: number
  content: Record<string, unknown>
  tokenEstimate: number
  importance: 'low' | 'normal' | 'high' | 'critical'
}

interface WorkCheckpoint {
  id: string
  sessionId: string
  createdAt: number
  summary: string
  keyDecisions: string[]
  currentState: string
  filesModified: string[]
  pendingActions: string[]
}

interface ResumptionContext {
  originalPrompt: string
  workSummary: string
  keyDecisions: string[]
  currentState: string
  filesModified: string[]
  pendingActions: string[]
  errorHistory: string[]
  suggestedNextSteps: string[]
  tokenCount: number
}

interface WorkJournalEntryEvent {
  sessionId: string
  entry: WorkEntry
}

interface WorkJournalStatusEvent {
  sessionId: string
  status: 'active' | 'paused' | 'completed' | 'crashed'
}
```

Add the workJournalApi object:

```typescript
// Work Journal API for agent work persistence
const workJournalApi = {
  // Session Management
  createSession: (conversationId: string, originalPrompt: string) =>
    ipcRenderer.invoke('work-journal:create-session', { conversationId, originalPrompt }) as Promise<WorkSession>,

  getSession: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-session', sessionId) as Promise<WorkSession | null>,

  getActiveSession: (conversationId: string) =>
    ipcRenderer.invoke('work-journal:get-active-session', conversationId) as Promise<WorkSession | null>,

  updateSessionStatus: (sessionId: string, status: 'active' | 'paused' | 'completed' | 'crashed') =>
    ipcRenderer.invoke('work-journal:update-session-status', { sessionId, status }) as Promise<{ success: boolean }>,

  // Entry Logging
  logEntry: (
    sessionId: string,
    entryType: string,
    content: Record<string, unknown>,
    importance?: 'low' | 'normal' | 'high' | 'critical'
  ) =>
    ipcRenderer.invoke('work-journal:log-entry', { sessionId, entryType, content, importance }) as Promise<WorkEntry>,

  getEntries: (
    sessionId: string,
    options?: {
      since?: number
      limit?: number
      importance?: ('low' | 'normal' | 'high' | 'critical')[]
      types?: string[]
    }
  ) =>
    ipcRenderer.invoke('work-journal:get-entries', { sessionId, options }) as Promise<WorkEntry[]>,

  // Checkpointing
  createCheckpoint: (sessionId: string, options?: { manual?: boolean }) =>
    ipcRenderer.invoke('work-journal:create-checkpoint', { sessionId, options }) as Promise<WorkCheckpoint>,

  getLatestCheckpoint: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-latest-checkpoint', sessionId) as Promise<WorkCheckpoint | null>,

  // Resumption
  generateResumptionContext: (sessionId: string, targetTokens?: number) =>
    ipcRenderer.invoke('work-journal:generate-resumption-context', { sessionId, targetTokens }) as Promise<ResumptionContext>,

  // Utilities
  getSessionTokens: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-session-tokens', sessionId) as Promise<number>,

  isApproachingLimit: (sessionId: string, threshold?: number) =>
    ipcRenderer.invoke('work-journal:is-approaching-limit', { sessionId, threshold }) as Promise<boolean>,

  // Real-time Subscriptions
  subscribe: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:subscribe', sessionId) as Promise<{ success: boolean; sessionId: string }>,

  unsubscribe: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:unsubscribe', sessionId) as Promise<{ success: boolean }>,

  // Event listeners (returns unsubscribe function)
  onNewEntry: (callback: (data: WorkJournalEntryEvent) => void) => {
    const handler = (_: unknown, data: WorkJournalEntryEvent) => callback(data)
    ipcRenderer.on('work-journal:new-entry', handler)
    return () => ipcRenderer.removeListener('work-journal:new-entry', handler)
  },

  onStatusChange: (callback: (data: WorkJournalStatusEvent) => void) => {
    const handler = (_: unknown, data: WorkJournalStatusEvent) => callback(data)
    ipcRenderer.on('work-journal:status-change', handler)
    return () => ipcRenderer.removeListener('work-journal:status-change', handler)
  },

  // Remove all event listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('work-journal:new-entry')
    ipcRenderer.removeAllListeners('work-journal:status-change')
  }
}
```

Add to the `api` object:

```typescript
const api = {
  // ... existing properties ...
  
  // Work Journal API
  workJournal: workJournalApi
}
```

---

### File 3: Update `src/main/index.ts`

Add import at top:

```typescript
import { setupWorkJournalHandlers, cleanupWorkJournalSubscriptions } from './workJournal'
```

Add handler setup after other handlers (around line 180):

```typescript
// Setup Work Journal handlers for agent work persistence
setupWorkJournalHandlers()
```

Add cleanup in the `before-quit` handler:

```typescript
app.on('before-quit', async () => {
  console.log('[App] Cleaning up...')
  cleanupWorkJournalSubscriptions()
  await mcpManager.disconnectAll()
})
```

---

## Verification Steps

After implementation, verify:

1. **TypeScript compilation**: `npm run typecheck`
2. **Development server**: `npm run dev`
3. **Console output**: Should see `[WorkJournal] IPC handlers ready`

### Quick Test in DevTools Console

```javascript
// Test session creation
const session = await window.api.workJournal.createSession('test-conv-id', 'Test prompt')
console.log('Session created:', session)

// Test logging an entry
const entry = await window.api.workJournal.logEntry(session.id, 'thinking', {
  type: 'thinking',
  reasoning: 'Testing the work journal system'
})
console.log('Entry logged:', entry)

// Test getting entries
const entries = await window.api.workJournal.getEntries(session.id)
console.log('Entries:', entries)

// Test subscription
const unsub = window.api.workJournal.onNewEntry((data) => {
  console.log('New entry received:', data)
})
await window.api.workJournal.subscribe(session.id)

// Log another entry to test subscription
await window.api.workJournal.logEntry(session.id, 'decision', {
  type: 'decision',
  question: 'Should we continue?',
  chosenOption: 'Yes',
  reasoning: 'Testing subscriptions'
})

// Cleanup
unsub()
await window.api.workJournal.unsubscribe(session.id)
```

---

## Key Implementation Notes

1. **Subscription Pattern**: Follow the MCP pattern where:
   - `subscribe` registers the webContents for push notifications
   - `onNewEntry`/`onStatusChange` set up the renderer-side listeners
   - Both are needed for real-time updates to work

2. **WebContents Cleanup**: Always clean up when webContents is destroyed to prevent memory leaks

3. **Error Handling**: All IPC handlers should catch errors and either throw (for invoke) or log

4. **Type Safety**: The preload types mirror the shared types but are self-contained to avoid import issues in the preload context

---

## Success Criteria

- [x] All IPC channels implemented and tested
- [x] Preload API exposes all workJournal methods
- [x] Real-time subscriptions work (test with onNewEntry callback)
- [x] TypeScript compiles without errors
- [x] No console errors on app startup
- [ ] DevTools console test passes

Please begin Phase 2 implementation.
