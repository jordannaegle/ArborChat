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
