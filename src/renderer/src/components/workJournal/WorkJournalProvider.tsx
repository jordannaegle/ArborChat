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

// Types replicated from preload for isolation
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

  const createSession = useCallback(
    async (conversationId: string, originalPrompt: string): Promise<WorkSession> => {
      try {
        setIsLoading(true)
        setError(null)

        const session = await window.api.workJournal.createSession(conversationId, originalPrompt)

        setSessions((prev) => new Map(prev).set(session.id, session))
        setActiveSessionId(session.id)
        setEntries((prev) => new Map(prev).set(session.id, []))

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
    },
    [subscribeToSession]
  )

  const getSession = useCallback(
    async (sessionId: string): Promise<WorkSession | null> => {
      // Check local cache first
      const cached = sessions.get(sessionId)
      if (cached) return cached

      try {
        const session = await window.api.workJournal.getSession(sessionId)
        if (session) {
          setSessions((prev) => new Map(prev).set(session.id, session))
        }
        return session
      } catch (err) {
        console.error('[WorkJournal Provider] Get session error:', err)
        return null
      }
    },
    [sessions]
  )

  const getActiveSessionForConversation = useCallback(
    async (conversationId: string): Promise<WorkSession | null> => {
      try {
        const session = await window.api.workJournal.getActiveSession(conversationId)
        if (session) {
          setSessions((prev) => new Map(prev).set(session.id, session))
        }
        return session
      } catch (err) {
        console.error('[WorkJournal Provider] Get active session error:', err)
        return null
      }
    },
    []
  )

  const updateSessionStatus = useCallback(
    async (sessionId: string, status: WorkSessionStatus): Promise<void> => {
      try {
        await window.api.workJournal.updateSessionStatus(sessionId, status)

        // Update local state
        setSessions((prev) => {
          const updated = new Map(prev)
          const session = updated.get(sessionId)
          if (session) {
            updated.set(sessionId, {
              ...session,
              status,
              updatedAt: Date.now(),
              completedAt:
                status === 'completed' || status === 'crashed' ? Date.now() : session.completedAt
            })
          }
          return updated
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(message)
        throw err
      }
    },
    []
  )

  const setActiveSession = useCallback((sessionId: string | null) => {
    setActiveSessionId(sessionId)
  }, [])

  // -------------------------------------------------------------------------
  // Entry Logging
  // -------------------------------------------------------------------------

  const logEntry = useCallback(
    async (
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
        setEntries((prev) => {
          const updated = new Map(prev)
          const sessionEntries = updated.get(sessionId) || []
          updated.set(sessionId, [...sessionEntries, entry])
          return updated
        })

        // Update session entry count
        setSessions((prev) => {
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
    },
    []
  )

  const getEntries = useCallback(
    async (
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
          setEntries((prev) => new Map(prev).set(sessionId, fetchedEntries))
        }

        return fetchedEntries
      } catch (err) {
        console.error('[WorkJournal Provider] Get entries error:', err)
        return []
      }
    },
    []
  )

  const refreshEntries = useCallback(async (sessionId: string): Promise<void> => {
    const fetchedEntries = await window.api.workJournal.getEntries(sessionId)
    setEntries((prev) => new Map(prev).set(sessionId, fetchedEntries))
  }, [])

  // -------------------------------------------------------------------------
  // Checkpointing
  // -------------------------------------------------------------------------

  const createCheckpoint = useCallback(
    async (sessionId: string, manual: boolean = false): Promise<WorkCheckpoint> => {
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
    },
    []
  )

  const getLatestCheckpoint = useCallback(
    async (sessionId: string): Promise<WorkCheckpoint | null> => {
      try {
        return await window.api.workJournal.getLatestCheckpoint(sessionId)
      } catch (err) {
        console.error('[WorkJournal Provider] Get checkpoint error:', err)
        return null
      }
    },
    []
  )

  // -------------------------------------------------------------------------
  // Resumption
  // -------------------------------------------------------------------------

  const generateResumptionContext = useCallback(
    async (sessionId: string, targetTokens?: number): Promise<ResumptionContext> => {
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
    },
    []
  )

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  const getSessionTokens = useCallback(async (sessionId: string): Promise<number> => {
    return await window.api.workJournal.getSessionTokens(sessionId)
  }, [])

  const isApproachingLimit = useCallback(
    async (sessionId: string, threshold?: number): Promise<boolean> => {
      return await window.api.workJournal.isApproachingLimit(sessionId, threshold)
    },
    []
  )

  // -------------------------------------------------------------------------
  // Event Listeners (Real-time updates)
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Handle new entry events
    const cleanupEntry = window.api.workJournal.onNewEntry((data) => {
      console.log('[WorkJournal Provider] New entry received:', data.entry.entryType)

      setEntries((prev) => {
        const updated = new Map(prev)
        const sessionEntries = updated.get(data.sessionId) || []

        // Avoid duplicates (entry might already be added via logEntry)
        const exists = sessionEntries.some((e) => e.id === data.entry.id)
        if (!exists) {
          updated.set(data.sessionId, [...sessionEntries, data.entry])
        }
        return updated
      })
    })

    // Handle status change events
    const cleanupStatus = window.api.workJournal.onStatusChange((data) => {
      console.log('[WorkJournal Provider] Status change:', data.sessionId, data.status)

      setSessions((prev) => {
        const updated = new Map(prev)
        const session = updated.get(data.sessionId)
        if (session) {
          updated.set(data.sessionId, {
            ...session,
            status: data.status,
            updatedAt: Date.now(),
            completedAt:
              data.status === 'completed' || data.status === 'crashed'
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
      subscribedSessions.current.forEach((sessionId) => {
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

  return <WorkJournalContext.Provider value={value}>{children}</WorkJournalContext.Provider>
}

export default WorkJournalProvider
