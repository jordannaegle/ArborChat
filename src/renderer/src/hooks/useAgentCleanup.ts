// src/renderer/src/hooks/useAgentCleanup.ts
// Phase 6.5: Centralized Agent Cleanup Coordination
// Author: Alex Chen (Distinguished Software Architect)

/**
 * Agent Cleanup Hook
 * 
 * Provides centralized cleanup coordination for agent resources.
 * Handles:
 * - Automatic history trimming when thresholds are exceeded
 * - Work journal session cleanup
 * - Memory profiling utilities for development
 * 
 * Architecture:
 * - Coordinates between AgentContext, MCPProvider, and WorkJournalProvider
 * - Provides hooks for monitoring cleanup effectiveness
 * - Implements configurable thresholds for auto-trimming
 */

import { useCallback, useRef, useEffect } from 'react'
import { useAgentContext } from '../contexts/AgentContext'

/**
 * Cleanup configuration thresholds
 */
export const CLEANUP_THRESHOLDS = {
  /** Maximum steps before auto-trimming kicks in */
  MAX_STEPS: 100,
  /** Maximum messages before auto-trimming */
  MAX_MESSAGES: 50,
  /** Steps to keep after trimming */
  TRIM_KEEP_STEPS: 75,
  /** Messages to keep after trimming */
  TRIM_KEEP_MESSAGES: 40,
  /** Check interval in ms (run trim check periodically) */
  CHECK_INTERVAL_MS: 30000,
} as const

/**
 * Memory profile snapshot for debugging
 */
export interface MemorySnapshot {
  timestamp: number
  agentCount: number
  totalSteps: number
  totalMessages: number
  pendingApprovals: number
  jsHeapUsed?: number
  jsHeapTotal?: number
}

interface UseAgentCleanupOptions {
  /** Enable automatic periodic trimming */
  autoTrim?: boolean
  /** Custom step threshold (default: CLEANUP_THRESHOLDS.MAX_STEPS) */
  maxSteps?: number
  /** Custom message threshold (default: CLEANUP_THRESHOLDS.MAX_MESSAGES) */
  maxMessages?: number
  /** Callback when trimming occurs */
  onTrim?: (agentId: string, stepsTrimmed: number, messagesTrimmed: number) => void
}

interface UseAgentCleanupResult {
  /** Manually trigger trim for a specific agent */
  trimAgent: (agentId: string) => void
  /** Trim all agents that exceed thresholds */
  trimAllAgents: () => void
  /** Take a memory snapshot for debugging */
  takeMemorySnapshot: () => MemorySnapshot
  /** Get memory growth since last snapshot */
  getMemoryGrowth: () => { steps: number; messages: number; agents: number } | null
  /** Force garbage collection hint (development only) */
  forceGCHint: () => void
}

/**
 * Hook for agent cleanup coordination
 * 
 * @example
 * ```tsx
 * const { trimAllAgents, takeMemorySnapshot } = useAgentCleanup({
 *   autoTrim: true,
 *   onTrim: (agentId, steps, msgs) => {
 *     console.log(`Trimmed agent ${agentId}: ${steps} steps, ${msgs} messages`)
 *   }
 * })
 * ```
 */
export function useAgentCleanup(options: UseAgentCleanupOptions = {}): UseAgentCleanupResult {
  const {
    autoTrim = true,
    maxSteps = CLEANUP_THRESHOLDS.MAX_STEPS,
    maxMessages = CLEANUP_THRESHOLDS.MAX_MESSAGES,
    onTrim
  } = options

  const { state, trimAgentHistory, getAgent } = useAgentContext()
  
  // Track last snapshot for growth comparison
  const lastSnapshotRef = useRef<MemorySnapshot | null>(null)
  
  // Auto-trim interval
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  /**
   * Take a memory snapshot for profiling
   */
  const takeMemorySnapshot = useCallback((): MemorySnapshot => {
    const agents = Object.values(state.agents)
    
    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      agentCount: agents.length,
      totalSteps: agents.reduce((sum, a) => sum + a.steps.length, 0),
      totalMessages: agents.reduce((sum, a) => sum + a.messages.length, 0),
      pendingApprovals: agents.reduce((sum, a) => sum + a.pendingApprovals.length, 0),
    }

    // Try to get JS heap info (only in dev with performance API)
    if (typeof performance !== 'undefined' && 'memory' in performance) {
      const mem = (performance as { memory: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory
      snapshot.jsHeapUsed = mem.usedJSHeapSize
      snapshot.jsHeapTotal = mem.totalJSHeapSize
    }

    lastSnapshotRef.current = snapshot
    return snapshot
  }, [state.agents])

  /**
   * Get memory growth since last snapshot
   */
  const getMemoryGrowth = useCallback((): { steps: number; messages: number; agents: number } | null => {
    const last = lastSnapshotRef.current
    if (!last) return null

    const current = takeMemorySnapshot()
    
    return {
      steps: current.totalSteps - last.totalSteps,
      messages: current.totalMessages - last.totalMessages,
      agents: current.agentCount - last.agentCount
    }
  }, [takeMemorySnapshot])

  /**
   * Trim a specific agent's history
   */
  const trimAgent = useCallback((agentId: string) => {
    const agent = getAgent(agentId)
    if (!agent) return

    const stepsBefore = agent.steps.length
    const messagesBefore = agent.messages.length

    // Only trim if exceeding thresholds
    if (stepsBefore > maxSteps || messagesBefore > maxMessages) {
      trimAgentHistory(
        agentId,
        CLEANUP_THRESHOLDS.TRIM_KEEP_STEPS,
        CLEANUP_THRESHOLDS.TRIM_KEEP_MESSAGES
      )

      const stepsAfter = getAgent(agentId)?.steps.length ?? 0
      const messagesAfter = getAgent(agentId)?.messages.length ?? 0

      const stepsTrimmed = stepsBefore - stepsAfter
      const messagesTrimmed = messagesBefore - messagesAfter

      if (stepsTrimmed > 0 || messagesTrimmed > 0) {
        console.log(`[AgentCleanup] Trimmed agent ${agentId}: ${stepsTrimmed} steps, ${messagesTrimmed} messages`)
        onTrim?.(agentId, stepsTrimmed, messagesTrimmed)
      }
    }
  }, [getAgent, maxSteps, maxMessages, trimAgentHistory, onTrim])

  /**
   * Trim all agents exceeding thresholds
   */
  const trimAllAgents = useCallback(() => {
    const agentIds = Object.keys(state.agents)
    let totalStepsTrimmed = 0
    let totalMessagesTrimmed = 0

    for (const agentId of agentIds) {
      const agent = state.agents[agentId]
      if (!agent) continue

      if (agent.steps.length > maxSteps || agent.messages.length > maxMessages) {
        const stepsBefore = agent.steps.length
        const messagesBefore = agent.messages.length

        trimAgentHistory(
          agentId,
          CLEANUP_THRESHOLDS.TRIM_KEEP_STEPS,
          CLEANUP_THRESHOLDS.TRIM_KEEP_MESSAGES
        )

        // Recalculate after trim (note: this reads from updated state)
        totalStepsTrimmed += Math.max(0, stepsBefore - CLEANUP_THRESHOLDS.TRIM_KEEP_STEPS)
        totalMessagesTrimmed += Math.max(0, messagesBefore - CLEANUP_THRESHOLDS.TRIM_KEEP_MESSAGES)
      }
    }

    if (totalStepsTrimmed > 0 || totalMessagesTrimmed > 0) {
      console.log(`[AgentCleanup] Bulk trim complete: ${totalStepsTrimmed} steps, ${totalMessagesTrimmed} messages`)
    }
  }, [state.agents, maxSteps, maxMessages, trimAgentHistory])

  /**
   * Hint to garbage collector (development only)
   * Note: This doesn't force GC, just makes orphaned refs collectable
   */
  const forceGCHint = useCallback(() => {
    // Clear any weak refs in the scope
    if (typeof window !== 'undefined' && 'gc' in window) {
      // Only works if Chrome is started with --expose-gc flag
      try {
        (window as unknown as { gc: () => void }).gc()
        console.log('[AgentCleanup] GC triggered (dev mode)')
      } catch {
        console.log('[AgentCleanup] GC not available - run Chrome with --expose-gc')
      }
    }
  }, [])

  // Setup auto-trim interval
  useEffect(() => {
    if (!autoTrim) return

    intervalRef.current = setInterval(() => {
      trimAllAgents()
    }, CLEANUP_THRESHOLDS.CHECK_INTERVAL_MS)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoTrim, trimAllAgents])

  return {
    trimAgent,
    trimAllAgents,
    takeMemorySnapshot,
    getMemoryGrowth,
    forceGCHint
  }
}

export default useAgentCleanup
