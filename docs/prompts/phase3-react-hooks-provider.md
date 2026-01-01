# Phase 3 Prompt: React Hooks + Provider

Copy everything below this line to start Phase 3 in a new window:

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

## Task: Agent Work Journal System - Phase 3

Please adopt the **Alex Chen persona** (Distinguished Software Architect) for this implementation.

Start responses with: `[Architecting as Alex Chen — evaluating through security boundaries, type safety, and scalable patterns...]`

### Design Document
Full design: `/Users/cory.naegle/ArborChat/docs/agent-context-memory-extension.md`

### Previous Phases: ✅ COMPLETE

**Phase 1 — Types + Manager Service:**
- `src/shared/types/workJournal.ts` — All TypeScript types
- `src/main/services/WorkJournalManager.ts` — Core service with SQLite

**Phase 2 — IPC Handlers + Preload API:**
- `src/main/workJournal/index.ts` — 11 IPC handlers with real-time subscriptions
- `src/preload/index.ts` — `window.api.workJournal` API surface
- `src/main/index.ts` — Handler wiring and cleanup

---

## Phase 3: React Hooks + Provider

**Estimate:** 2-3 hours

### Reference Files (Read First)

Before implementing, study these existing patterns:

```
src/renderer/src/components/mcp/MCPProvider.tsx    — Provider pattern with event subscriptions
src/renderer/src/contexts/AgentContext.tsx         — useReducer for complex state
src/renderer/src/hooks/useMCPTools.ts              — Custom hook composing from provider
src/renderer/src/hooks/index.ts                    — Barrel export pattern
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/src/components/workJournal/WorkJournalProvider.tsx` | Context provider with state + actions |
| `src/renderer/src/components/workJournal/index.ts` | Barrel export |
| `src/renderer/src/hooks/useWorkJournal.ts` | Main hook for work journal access |
| `src/renderer/src/hooks/useWorkSession.ts` | Hook for managing specific sessions |
| Update `src/renderer/src/hooks/index.ts` | Add new exports |

---

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    WorkJournalProvider                           │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ State:                                                       │ │
│  │ - sessions: Map<sessionId, WorkSession>                     │ │
│  │ - activeSessionId: string | null                            │ │
│  │ - entries: Map<sessionId, WorkEntry[]>                      │ │
│  │ - isLoading: boolean                                        │ │
│  │ - error: string | null                                      │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Actions:                                                     │ │
│  │ - createSession(conversationId, prompt)                     │ │
│  │ - logEntry(sessionId, type, content, importance?)           │ │
│  │ - updateStatus(sessionId, status)                           │ │
│  │ - createCheckpoint(sessionId)                               │ │
│  │ - getResumptionContext(sessionId)                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ Event Subscriptions (via useEffect):                        │ │
│  │ - work-journal:new-entry → updates entries state            │ │
│  │ - work-journal:status-change → updates session status       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼ (consumed by)
┌─────────────────────────────────────────────────────────────────┐
│  useWorkJournal()        │  useWorkSession(sessionId)           │
│  - Full provider access  │  - Session-specific operations       │
│  - All actions           │  - Auto-subscribe to session events  │
│  - Global state          │  - entries, status, checkpoint       │
└─────────────────────────────────────────────────────────────────┘
```

---

### File 1: `src/renderer/src/components/workJournal/WorkJournalProvider.tsx`

```typescript
/**
 * Work Journal Provider
 * 
 * Provides React context for agent work persistence.
 * Manages session state, entries, and real-time subscriptions.
 * 
 * Pattern: Follows MCPProvider.tsx structure with event subscriptions
 */

import { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  useCallback, 
  useRef,
  ReactNode 
} from 'react'

// Types imported from shared (replicate for preload isolation)
type WorkSessionStatus = 'active' | 'paused' | 'completed' | 'crashed'
type EntryImportance = 'low' | 'normal' | 'high' | 'critical'

interface WorkSession {
  id: string
  conversationId: string
  originalPrompt: string
  status: WorkSessionStatus
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
  importance: EntryImportance
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

// ============================================================================
// Context Value Interface
// ============================================================================

interface WorkJournalContextValue {
  // State
  sessions: Map<string, WorkSession>
  activeSessionId: string | null
  entries: Map<string, WorkEntry[]>
  isLoading: boolean
  error: string | null

  // Session Management
  createSession: (conversationId: string, originalPrompt: string) => Promise<WorkSession>
  getSession: (sessionId: string) => Promise<WorkSession | null>
  getActiveSessionForConversation: (conversationId: string) => Promise<WorkSession | null>
  updateSessionStatus: (sessionId: string, status: WorkSessionStatus) => Promise<void>
  setActiveSession: (sessionId: string | null) => void

  // Entry Logging
  logEntry: (
    sessionId: string,
    entryType: string,
    content: Record<string, unknown>,
    importance?: EntryImportance
  ) => Promise<WorkEntry>
  getEntries: (
    sessionId: string,
    options?: {
      since?: number
      limit?: number
      importance?: EntryImportance[]
      types?: string[]
    }
  ) => Promise<WorkEntry[]>
  refreshEntries: (sessionId: string) => Promise<void>

  // Checkpointing
  createCheckpoint: (sessionId: string, manual?: boolean) => Promise<WorkCheckpoint>
  getLatestCheckpoint: (sessionId: string) => Promise<WorkCheckpoint | null>

  // Resumption
  generateResumptionContext: (sessionId: string, targetTokens?: number) => Promise<ResumptionContext>

  // Utilities
  getSessionTokens: (sessionId: string) => Promise<number>
  isApproachingLimit: (sessionId: string, threshold?: number) => Promise<boolean>

  // Subscription management
  subscribeToSession: (sessionId: string) => Promise<void>
  unsubscribeFromSession: (sessionId: string) => Promise<void>
}

const WorkJournalContext = createContext<WorkJournalContextValue | null>(null)

// ============================================================================
// Hook Export
// ============================================================================

export function useWorkJournalContext(): WorkJournalContextValue {
  const context = useContext(WorkJournalContext)
  if (!context) {
    throw new Error('useWorkJournalContext must be used within WorkJournalProvider')
  }
  return context
}

// ============================================================================
// Provider Component
// ============================================================================

interface WorkJournalProviderProps {
  children: ReactNode
}

export function WorkJournalProvider({ children }: WorkJournalProviderProps) {
  // State
  const [sessions, setSessions] = useState<Map<string, WorkSession>>(new Map())
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Map<string, WorkEntry[]>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Track subscribed sessions to prevent duplicate subscriptions
  const subscribedSessions = useRef<Set<string>>(new Set())

  // -------------------------------------------------------------------------
  // Session Management
  // -------------------------------------------------------------------------

  const createSession = useCallback(async (
    conversationId: string, 
    originalPrompt: string
  ): Promise<WorkSession> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const session = await window.api.workJournal.createSession(conversationId, originalPrompt)
      
      setSessions(prev => new Map(prev).set(session.id, session))
      setActiveSessionId(session.id)
      setEntries(prev => new Map(prev).set(session.id, []))
      
      // Auto-subscribe to the new session
      await subscribeToSession(session.id)
      
      console.log('[WorkJournal Provider] Created session:', session.id)
      return session
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getSession = useCallback(async (sessionId: string): Promise<WorkSession | null> => {
    // Check local cache first
    const cached = sessions.get(sessionId)
    if (cached) return cached
    
    try {
      const session = await window.api.workJournal.getSession(sessionId)
      if (session) {
        setSessions(prev => new Map(prev).set(session.id, session))
      }
      return session
    } catch (err) {
      console.error('[WorkJournal Provider] Get session error:', err)
      return null
    }
  }, [sessions])

  const getActiveSessionForConversation = useCallback(async (
    conversationId: string
  ): Promise<WorkSession | null> => {
    try {
      const session = await window.api.workJournal.getActiveSession(conversationId)
      if (session) {
        setSessions(prev => new Map(prev).set(session.id, session))
      }
      return session
    } catch (err) {
      console.error('[WorkJournal Provider] Get active session error:', err)
      return null
    }
  }, [])

  const updateSessionStatus = useCallback(async (
    sessionId: string, 
    status: WorkSessionStatus
  ): Promise<void> => {
    try {
      await window.api.workJournal.updateSessionStatus(sessionId, status)
      
      // Update local state
      setSessions(prev => {
        const updated = new Map(prev)
        const session = updated.get(sessionId)
        if (session) {
          updated.set(sessionId, { 
            ...session, 
            status, 
            updatedAt: Date.now(),
            completedAt: (status === 'completed' || status === 'crashed') ? Date.now() : session.completedAt
          })
        }
        return updated
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    }
  }, [])

  const setActiveSession = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId)
  }, [])

  // -------------------------------------------------------------------------
  // Entry Logging
  // -------------------------------------------------------------------------

  const logEntry = useCallback(async (
    sessionId: string,
    entryType: string,
    content: Record<string, unknown>,
    importance?: EntryImportance
  ): Promise<WorkEntry> => {
    try {
      const entry = await window.api.workJournal.logEntry(
        sessionId, 
        entryType, 
        content, 
        importance
      )
      
      // Note: Real-time subscription will also update entries,
      // but we update here for immediate feedback
      setEntries(prev => {
        const updated = new Map(prev)
        const sessionEntries = updated.get(sessionId) || []
        updated.set(sessionId, [...sessionEntries, entry])
        return updated
      })
      
      // Update session entry count
      setSessions(prev => {
        const updated = new Map(prev)
        const session = updated.get(sessionId)
        if (session) {
          updated.set(sessionId, {
            ...session,
            entryCount: session.entryCount + 1,
            tokenEstimate: session.tokenEstimate + entry.tokenEstimate,
            updatedAt: Date.now()
          })
        }
        return updated
      })
      
      return entry
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    }
  }, [])

  const getEntries = useCallback(async (
    sessionId: string,
    options?: {
      since?: number
      limit?: number
      importance?: EntryImportance[]
      types?: string[]
    }
  ): Promise<WorkEntry[]> => {
    try {
      const fetchedEntries = await window.api.workJournal.getEntries(sessionId, options)
      
      // Update cache if fetching all entries
      if (!options?.since) {
        setEntries(prev => new Map(prev).set(sessionId, fetchedEntries))
      }
      
      return fetchedEntries
    } catch (err) {
      console.error('[WorkJournal Provider] Get entries error:', err)
      return []
    }
  }, [])

  const refreshEntries = useCallback(async (sessionId: string): Promise<void> => {
    const fetchedEntries = await window.api.workJournal.getEntries(sessionId)
    setEntries(prev => new Map(prev).set(sessionId, fetchedEntries))
  }, [])

  // -------------------------------------------------------------------------
  // Checkpointing
  // -------------------------------------------------------------------------

  const createCheckpoint = useCallback(async (
    sessionId: string, 
    manual: boolean = false
  ): Promise<WorkCheckpoint> => {
    try {
      setIsLoading(true)
      const checkpoint = await window.api.workJournal.createCheckpoint(sessionId, { manual })
      console.log('[WorkJournal Provider] Created checkpoint:', checkpoint.id)
      return checkpoint
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getLatestCheckpoint = useCallback(async (
    sessionId: string
  ): Promise<WorkCheckpoint | null> => {
    try {
      return await window.api.workJournal.getLatestCheckpoint(sessionId)
    } catch (err) {
      console.error('[WorkJournal Provider] Get checkpoint error:', err)
      return null
    }
  }, [])

  // -------------------------------------------------------------------------
  // Resumption
  // -------------------------------------------------------------------------

  const generateResumptionContext = useCallback(async (
    sessionId: string,
    targetTokens?: number
  ): Promise<ResumptionContext> => {
    try {
      setIsLoading(true)
      return await window.api.workJournal.generateResumptionContext(sessionId, targetTokens)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  const getSessionTokens = useCallback(async (sessionId: string): Promise<number> => {
    return await window.api.workJournal.getSessionTokens(sessionId)
  }, [])

  const isApproachingLimit = useCallback(async (
    sessionId: string, 
    threshold?: number
  ): Promise<boolean> => {
    return await window.api.workJournal.isApproachingLimit(sessionId, threshold)
  }, [])

  // -------------------------------------------------------------------------
  // Subscription Management
  // -------------------------------------------------------------------------

  const subscribeToSession = useCallback(async (sessionId: string): Promise<void> => {
    if (subscribedSessions.current.has(sessionId)) {
      return // Already subscribed
    }
    
    try {
      await window.api.workJournal.subscribe(sessionId)
      subscribedSessions.current.add(sessionId)
      console.log('[WorkJournal Provider] Subscribed to session:', sessionId)
    } catch (err) {
      console.error('[WorkJournal Provider] Subscribe error:', err)
    }
  }, [])

  const unsubscribeFromSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!subscribedSessions.current.has(sessionId)) {
      return // Not subscribed
    }
    
    try {
      await window.api.workJournal.unsubscribe(sessionId)
      subscribedSessions.current.delete(sessionId)
      console.log('[WorkJournal Provider] Unsubscribed from session:', sessionId)
    } catch (err) {
      console.error('[WorkJournal Provider] Unsubscribe error:', err)
    }
  }, [])

  // -------------------------------------------------------------------------
  // Event Listeners (Real-time updates)
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Handle new entry events
    const cleanupEntry = window.api.workJournal.onNewEntry((data) => {
      console.log('[WorkJournal Provider] New entry received:', data.entry.entryType)
      
      setEntries(prev => {
        const updated = new Map(prev)
        const sessionEntries = updated.get(data.sessionId) || []
        
        // Avoid duplicates (entry might already be added via logEntry)
        const exists = sessionEntries.some(e => e.id === data.entry.id)
        if (!exists) {
          updated.set(data.sessionId, [...sessionEntries, data.entry])
        }
        return updated
      })
    })

    // Handle status change events
    const cleanupStatus = window.api.workJournal.onStatusChange((data) => {
      console.log('[WorkJournal Provider] Status change:', data.sessionId, data.status)
      
      setSessions(prev => {
        const updated = new Map(prev)
        const session = updated.get(data.sessionId)
        if (session) {
          updated.set(data.sessionId, {
            ...session,
            status: data.status,
            updatedAt: Date.now(),
            completedAt: (data.status === 'completed' || data.status === 'crashed') 
              ? Date.now() 
              : session.completedAt
          })
        }
        return updated
      })
    })

    return () => {
      cleanupEntry()
      cleanupStatus()
    }
  }, [])

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from all sessions
      subscribedSessions.current.forEach(sessionId => {
        window.api.workJournal.unsubscribe(sessionId).catch(console.error)
      })
      subscribedSessions.current.clear()
      
      // Remove all event listeners
      window.api.workJournal.removeAllListeners()
    }
  }, [])

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------

  const value: WorkJournalContextValue = {
    // State
    sessions,
    activeSessionId,
    entries,
    isLoading,
    error,

    // Session Management
    createSession,
    getSession,
    getActiveSessionForConversation,
    updateSessionStatus,
    setActiveSession,

    // Entry Logging
    logEntry,
    getEntries,
    refreshEntries,

    // Checkpointing
    createCheckpoint,
    getLatestCheckpoint,

    // Resumption
    generateResumptionContext,

    // Utilities
    getSessionTokens,
    isApproachingLimit,

    // Subscriptions
    subscribeToSession,
    unsubscribeFromSession
  }

  return (
    <WorkJournalContext.Provider value={value}>
      {children}
    </WorkJournalContext.Provider>
  )
}

export default WorkJournalProvider
```

---

### File 2: `src/renderer/src/components/workJournal/index.ts`

```typescript
// src/renderer/src/components/workJournal/index.ts

export { WorkJournalProvider, useWorkJournalContext } from './WorkJournalProvider'
export type { default as WorkJournalProviderType } from './WorkJournalProvider'
```

---

### File 3: `src/renderer/src/hooks/useWorkJournal.ts`

```typescript
/**
 * useWorkJournal Hook
 * 
 * Main hook for accessing work journal functionality.
 * Wraps the WorkJournalProvider context with convenience methods.
 */

import { useCallback, useMemo } from 'react'
import { useWorkJournalContext } from '../components/workJournal'

// Entry content type helpers for type-safe logging
export interface ThinkingContent {
  type: 'thinking'
  reasoning: string
  planSteps?: string[]
}

export interface ToolRequestContent {
  type: 'tool_request'
  toolName: string
  toolInput: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
}

export interface ToolResultContent {
  type: 'tool_result'
  toolName: string
  success: boolean
  output: string
  truncated: boolean
  errorMessage?: string
  duration?: number
}

export interface DecisionContent {
  type: 'decision'
  question: string
  chosenOption: string
  alternatives?: string[]
  reasoning: string
}

export interface ErrorContent {
  type: 'error'
  errorType: string
  message: string
  recoverable: boolean
  stackTrace?: string
}

export interface FileOperationContent {
  type: 'file_read' | 'file_written'
  filePath: string
  operation: 'read' | 'create' | 'modify' | 'delete'
  contentPreview?: string
  linesAffected?: number
}

export function useWorkJournal() {
  const context = useWorkJournalContext()

  // Convenience methods for typed entry logging
  const logThinking = useCallback(
    (sessionId: string, reasoning: string, planSteps?: string[]) => {
      return context.logEntry(sessionId, 'thinking', {
        type: 'thinking',
        reasoning,
        planSteps
      } as ThinkingContent)
    },
    [context]
  )

  const logToolRequest = useCallback(
    (
      sessionId: string,
      toolName: string,
      toolInput: Record<string, unknown>,
      riskLevel: 'safe' | 'moderate' | 'dangerous'
    ) => {
      return context.logEntry(sessionId, 'tool_request', {
        type: 'tool_request',
        toolName,
        toolInput,
        riskLevel
      } as ToolRequestContent)
    },
    [context]
  )

  const logToolResult = useCallback(
    (
      sessionId: string,
      toolName: string,
      success: boolean,
      output: string,
      options?: { truncated?: boolean; errorMessage?: string; duration?: number }
    ) => {
      return context.logEntry(
        sessionId,
        'tool_result',
        {
          type: 'tool_result',
          toolName,
          success,
          output,
          truncated: options?.truncated ?? false,
          errorMessage: options?.errorMessage,
          duration: options?.duration
        } as ToolResultContent,
        success ? 'normal' : 'high'
      )
    },
    [context]
  )

  const logDecision = useCallback(
    (
      sessionId: string,
      question: string,
      chosenOption: string,
      reasoning: string,
      alternatives?: string[]
    ) => {
      return context.logEntry(
        sessionId,
        'decision',
        {
          type: 'decision',
          question,
          chosenOption,
          alternatives,
          reasoning
        } as DecisionContent,
        'high'
      )
    },
    [context]
  )

  const logError = useCallback(
    (
      sessionId: string,
      errorType: string,
      message: string,
      recoverable: boolean,
      stackTrace?: string
    ) => {
      return context.logEntry(
        sessionId,
        'error',
        {
          type: 'error',
          errorType,
          message,
          recoverable,
          stackTrace
        } as ErrorContent,
        'critical'
      )
    },
    [context]
  )

  const logFileOperation = useCallback(
    (
      sessionId: string,
      operation: 'read' | 'create' | 'modify' | 'delete',
      filePath: string,
      contentPreview?: string,
      linesAffected?: number
    ) => {
      const entryType = operation === 'read' ? 'file_read' : 'file_written'
      return context.logEntry(
        sessionId,
        entryType,
        {
          type: entryType,
          filePath,
          operation,
          contentPreview,
          linesAffected
        } as FileOperationContent,
        operation === 'delete' ? 'high' : 'normal'
      )
    },
    [context]
  )

  // Get the active session object
  const activeSession = useMemo(() => {
    if (!context.activeSessionId) return null
    return context.sessions.get(context.activeSessionId) ?? null
  }, [context.activeSessionId, context.sessions])

  // Get entries for active session
  const activeSessionEntries = useMemo(() => {
    if (!context.activeSessionId) return []
    return context.entries.get(context.activeSessionId) ?? []
  }, [context.activeSessionId, context.entries])

  return {
    // Original context
    ...context,

    // Computed properties
    activeSession,
    activeSessionEntries,

    // Typed logging helpers
    logThinking,
    logToolRequest,
    logToolResult,
    logDecision,
    logError,
    logFileOperation
  }
}

export default useWorkJournal
```

---

### File 4: `src/renderer/src/hooks/useWorkSession.ts`

```typescript
/**
 * useWorkSession Hook
 * 
 * Hook for managing a specific work session.
 * Auto-subscribes to session events and provides session-specific state.
 */

import { useEffect, useMemo, useCallback } from 'react'
import { useWorkJournalContext } from '../components/workJournal'

interface UseWorkSessionOptions {
  autoSubscribe?: boolean
  autoLoadEntries?: boolean
}

export function useWorkSession(
  sessionId: string | null,
  options: UseWorkSessionOptions = {}
) {
  const { autoSubscribe = true, autoLoadEntries = true } = options
  
  const context = useWorkJournalContext()

  // Get session from state
  const session = useMemo(() => {
    if (!sessionId) return null
    return context.sessions.get(sessionId) ?? null
  }, [sessionId, context.sessions])

  // Get entries from state
  const entries = useMemo(() => {
    if (!sessionId) return []
    return context.entries.get(sessionId) ?? []
  }, [sessionId, context.entries])

  // Derived state
  const isActive = session?.status === 'active'
  const isPaused = session?.status === 'paused'
  const isCompleted = session?.status === 'completed' || session?.status === 'crashed'
  const entryCount = session?.entryCount ?? 0
  const tokenEstimate = session?.tokenEstimate ?? 0

  // Get entries by type
  const getEntriesByType = useCallback(
    (type: string) => entries.filter((e) => e.entryType === type),
    [entries]
  )

  // Get high importance entries
  const criticalEntries = useMemo(
    () => entries.filter((e) => e.importance === 'critical' || e.importance === 'high'),
    [entries]
  )

  // Get the latest entry
  const latestEntry = useMemo(
    () => (entries.length > 0 ? entries[entries.length - 1] : null),
    [entries]
  )

  // Session actions bound to this session
  const updateStatus = useCallback(
    (status: 'active' | 'paused' | 'completed' | 'crashed') => {
      if (!sessionId) return Promise.resolve()
      return context.updateSessionStatus(sessionId, status)
    },
    [sessionId, context]
  )

  const logEntry = useCallback(
    (
      entryType: string,
      content: Record<string, unknown>,
      importance?: 'low' | 'normal' | 'high' | 'critical'
    ) => {
      if (!sessionId) {
        return Promise.reject(new Error('No session ID'))
      }
      return context.logEntry(sessionId, entryType, content, importance)
    },
    [sessionId, context]
  )

  const createCheckpoint = useCallback(
    (manual: boolean = true) => {
      if (!sessionId) {
        return Promise.reject(new Error('No session ID'))
      }
      return context.createCheckpoint(sessionId, manual)
    },
    [sessionId, context]
  )

  const getResumptionContext = useCallback(
    (targetTokens?: number) => {
      if (!sessionId) {
        return Promise.reject(new Error('No session ID'))
      }
      return context.generateResumptionContext(sessionId, targetTokens)
    },
    [sessionId, context]
  )

  const refreshEntries = useCallback(() => {
    if (!sessionId) return Promise.resolve()
    return context.refreshEntries(sessionId)
  }, [sessionId, context])

  // Auto-subscribe to session events
  useEffect(() => {
    if (!sessionId || !autoSubscribe) return

    context.subscribeToSession(sessionId)

    return () => {
      context.unsubscribeFromSession(sessionId)
    }
  }, [sessionId, autoSubscribe, context])

  // Auto-load entries on mount
  useEffect(() => {
    if (!sessionId || !autoLoadEntries) return
    
    // Only load if we don't have entries cached
    if (!context.entries.has(sessionId)) {
      context.getEntries(sessionId)
    }
  }, [sessionId, autoLoadEntries, context])

  return {
    // Session data
    session,
    sessionId,
    entries,
    
    // Derived state
    isActive,
    isPaused,
    isCompleted,
    entryCount,
    tokenEstimate,
    criticalEntries,
    latestEntry,
    
    // Helpers
    getEntriesByType,
    
    // Actions
    updateStatus,
    logEntry,
    createCheckpoint,
    getResumptionContext,
    refreshEntries,
    
    // Loading state
    isLoading: context.isLoading,
    error: context.error
  }
}

export default useWorkSession
```

---

### File 5: Update `src/renderer/src/hooks/index.ts`

Add exports:

```typescript
// Work Journal hooks
export { useWorkJournal } from './useWorkJournal'
export { useWorkSession } from './useWorkSession'
export type {
  ThinkingContent,
  ToolRequestContent,
  ToolResultContent,
  DecisionContent,
  ErrorContent,
  FileOperationContent
} from './useWorkJournal'
```

---

## Integration with App

After Phase 3, wrap your app with the provider in `App.tsx`:

```typescript
import { WorkJournalProvider } from './components/workJournal'

function App() {
  return (
    <WorkJournalProvider>
      {/* ... existing providers and app content ... */}
    </WorkJournalProvider>
  )
}
```

---

## Verification Steps

1. **TypeScript compilation**: `npm run typecheck`
2. **Development server**: `npm run dev`
3. **Console output**: Should see no errors

### Quick Test in Component

```tsx
import { useWorkJournal, useWorkSession } from '../hooks'

function TestComponent() {
  const { createSession, activeSession } = useWorkJournal()
  const { entries, logEntry } = useWorkSession(activeSession?.id ?? null)

  const handleTest = async () => {
    // Create a session
    const session = await createSession('test-conv', 'Test the work journal')
    console.log('Created session:', session)

    // Log an entry
    await logEntry('thinking', {
      type: 'thinking',
      reasoning: 'Testing the hook system'
    })
    console.log('Logged entry, total entries:', entries.length)
  }

  return <button onClick={handleTest}>Test Work Journal</button>
}
```

---

## Success Criteria

- [ ] WorkJournalProvider manages state correctly
- [ ] Real-time subscriptions update UI automatically
- [ ] useWorkJournal provides typed logging helpers
- [ ] useWorkSession auto-subscribes and provides session-specific state
- [ ] TypeScript compiles without errors
- [ ] No memory leaks (subscriptions cleaned up on unmount)
- [ ] Console test passes

---

## Key Implementation Notes

1. **State Management**: Use useState for simplicity (like MCPProvider), not useReducer. The state shape is simpler than AgentContext.

2. **Subscription Deduplication**: Track subscribed sessions in a ref to prevent multiple subscriptions to the same session.

3. **Optimistic Updates**: Update local state immediately in `logEntry` for responsive UI, even though the subscription will also deliver the event.

4. **Type Safety**: Replicate types in the provider file to avoid import issues from shared types in the renderer context.

5. **Cleanup**: Always unsubscribe and remove listeners on unmount to prevent memory leaks.

Please begin Phase 3 implementation.
