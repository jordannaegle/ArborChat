// src/renderer/src/hooks/useAgentWatchdog.ts
// Phase 2: Agent Execution Monitoring - Watchdog System
// Author: Alex Chen (Distinguished Software Architect)

import { useEffect, useRef, useCallback, useState } from 'react'
import type { ExecutionPhase, WatchdogConfig } from '../types/agent'
import { DEFAULT_WATCHDOG_CONFIG } from '../types/agent'

/**
 * Watchdog Status - Current state of the watchdog monitor
 */
export type WatchdogStatus = 
  | 'idle'       // Not monitoring (agent not active)
  | 'normal'     // Monitoring, no issues detected
  | 'warning'    // Progress stalled, warn threshold exceeded
  | 'stalled'    // Stall detected, recovery needed

/**
 * Execution Activity State - Subset of runner state needed for watchdog
 * This interface matches the execution tracking from useAgentRunner
 */
export interface WatchdogActivityState {
  phase: ExecutionPhase
  currentActivity: string
  activityStartedAt: number
  lastProgressAt: number
  currentToolName?: string
  currentToolDuration?: number
}

/**
 * Watchdog State - Comprehensive monitoring state
 */
export interface WatchdogState {
  status: WatchdogStatus
  /** Time since last progress (ms) */
  timeSinceProgress: number
  /** Whether a warning has been triggered */
  hasWarning: boolean
  /** Whether a stall has been detected */
  isStalled: boolean
  /** Current phase being monitored */
  currentPhase: ExecutionPhase | null
  /** Tool currently being monitored (if any) */
  currentTool: string | null
  /** Time the current tool has been running (ms) */
  currentToolDuration: number
  /** Whether tool timeout is imminent (>80% of timeout) */
  toolTimeoutImminent: boolean
}

/**
 * Watchdog Callbacks - Event handlers for watchdog triggers
 */
export interface WatchdogCallbacks {
  /** Called when warn threshold exceeded (first time) */
  onWarnThresholdExceeded?: () => void
  /** Called when stall threshold exceeded (first time) */
  onStallDetected?: () => void
  /** Called when tool timeout is imminent */
  onToolTimeoutImminent?: () => void
  /** Called when activity resumes after warning/stall */
  onActivityResumed?: () => void
}

/**
 * useAgentWatchdog - Hook for monitoring agent execution and detecting stalls
 * 
 * This hook provides real-time monitoring of agent execution state and
 * triggers callbacks when stalls are detected. It uses a polling interval
 * to check progress and maintains its own state for UI display.
 * 
 * @param agentId - ID of the agent being monitored
 * @param activity - Current execution activity state from useAgentRunner
 * @param callbacks - Event handlers for watchdog triggers
 * @param config - Optional watchdog configuration (uses defaults if not provided)
 * 
 * @returns WatchdogState for UI display
 * 
 * @example
 * ```tsx
 * const watchdogState = useAgentWatchdog(
 *   agentId,
 *   runnerState.execution,
 *   {
 *     onWarnThresholdExceeded: () => console.log('Agent taking longer than expected'),
 *     onStallDetected: () => showStallRecoveryUI(),
 *     onActivityResumed: () => hideStallWarning()
 *   }
 * )
 * ```
 */
export function useAgentWatchdog(
  agentId: string,
  activity: WatchdogActivityState | null,
  callbacks: WatchdogCallbacks = {},
  config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): WatchdogState {
  // State for UI rendering
  const [watchdogState, setWatchdogState] = useState<WatchdogState>({
    status: 'idle',
    timeSinceProgress: 0,
    hasWarning: false,
    isStalled: false,
    currentPhase: null,
    currentTool: null,
    currentToolDuration: 0,
    toolTimeoutImminent: false
  })

  // Refs for tracking callback triggers (to avoid duplicate calls)
  const hasTriggeredWarningRef = useRef(false)
  const hasTriggeredStallRef = useRef(false)
  const hasTriggeredTimeoutImminentRef = useRef(false)
  const previousPhaseRef = useRef<ExecutionPhase | null>(null)

  // Destructure callbacks for stable reference in useEffect
  const {
    onWarnThresholdExceeded,
    onStallDetected,
    onToolTimeoutImminent,
    onActivityResumed
  } = callbacks

  /**
   * Calculate current watchdog metrics
   */
  const calculateMetrics = useCallback((
    activityState: WatchdogActivityState | null
  ): Omit<WatchdogState, 'status'> => {
    if (!activityState || activityState.phase === 'idle') {
      return {
        timeSinceProgress: 0,
        hasWarning: false,
        isStalled: false,
        currentPhase: null,
        currentTool: null,
        currentToolDuration: 0,
        toolTimeoutImminent: false
      }
    }

    const now = Date.now()
    const timeSinceProgress = now - activityState.lastProgressAt
    const hasWarning = timeSinceProgress > config.warnThreshold
    const isStalled = timeSinceProgress > config.stallThreshold

    // Tool-specific metrics
    const currentTool = activityState.currentToolName || null
    const currentToolDuration = activityState.phase === 'executing_tool' && activityState.activityStartedAt
      ? now - activityState.activityStartedAt
      : 0
    const toolTimeoutImminent = currentTool !== null && 
      currentToolDuration > config.toolTimeout * 0.8

    return {
      timeSinceProgress,
      hasWarning,
      isStalled,
      currentPhase: activityState.phase,
      currentTool,
      currentToolDuration,
      toolTimeoutImminent
    }
  }, [config.warnThreshold, config.stallThreshold, config.toolTimeout])

  /**
   * Determine watchdog status from metrics
   */
  const determineStatus = useCallback((
    metrics: Omit<WatchdogState, 'status'>
  ): WatchdogStatus => {
    if (metrics.currentPhase === null || metrics.currentPhase === 'idle') {
      return 'idle'
    }
    if (metrics.isStalled) {
      return 'stalled'
    }
    if (metrics.hasWarning) {
      return 'warning'
    }
    return 'normal'
  }, [])

  // Main monitoring effect
  useEffect(() => {
    // If no activity or idle, reset state
    if (!activity || activity.phase === 'idle') {
      setWatchdogState({
        status: 'idle',
        timeSinceProgress: 0,
        hasWarning: false,
        isStalled: false,
        currentPhase: null,
        currentTool: null,
        currentToolDuration: 0,
        toolTimeoutImminent: false
      })
      // Reset trigger refs when going idle
      hasTriggeredWarningRef.current = false
      hasTriggeredStallRef.current = false
      hasTriggeredTimeoutImminentRef.current = false
      previousPhaseRef.current = null
      return
    }

    // Set up polling interval
    const intervalId = setInterval(() => {
      const metrics = calculateMetrics(activity)
      const status = determineStatus(metrics)
      const newState = { ...metrics, status }

      // Check for phase transitions (activity resumed)
      if (previousPhaseRef.current !== null && 
          (hasTriggeredWarningRef.current || hasTriggeredStallRef.current)) {
        // If we were in warning/stall state and now have new progress
        if (!metrics.hasWarning && !metrics.isStalled) {
          console.log(`[Watchdog:${agentId}] Activity resumed after stall/warning`)
          onActivityResumed?.()
          hasTriggeredWarningRef.current = false
          hasTriggeredStallRef.current = false
        }
      }
      previousPhaseRef.current = activity.phase

      // Trigger warning callback (once)
      if (metrics.hasWarning && !metrics.isStalled && !hasTriggeredWarningRef.current) {
        console.log(`[Watchdog:${agentId}] Warning threshold exceeded: ${Math.round(metrics.timeSinceProgress / 1000)}s since progress`)
        hasTriggeredWarningRef.current = true
        onWarnThresholdExceeded?.()
      }

      // Trigger stall callback (once)
      if (metrics.isStalled && !hasTriggeredStallRef.current) {
        console.log(`[Watchdog:${agentId}] STALL DETECTED: ${Math.round(metrics.timeSinceProgress / 1000)}s since progress`)
        hasTriggeredStallRef.current = true
        onStallDetected?.()
      }

      // Trigger tool timeout imminent callback (once per tool)
      if (metrics.toolTimeoutImminent && !hasTriggeredTimeoutImminentRef.current) {
        console.log(`[Watchdog:${agentId}] Tool timeout imminent: ${metrics.currentTool} running for ${Math.round(metrics.currentToolDuration / 1000)}s`)
        hasTriggeredTimeoutImminentRef.current = true
        onToolTimeoutImminent?.()
      }

      // Reset tool timeout trigger when tool changes
      if (metrics.currentTool !== watchdogState.currentTool) {
        hasTriggeredTimeoutImminentRef.current = false
      }

      setWatchdogState(newState)
    }, config.checkInterval)

    // Initial calculation
    const initialMetrics = calculateMetrics(activity)
    const initialStatus = determineStatus(initialMetrics)
    setWatchdogState({ ...initialMetrics, status: initialStatus })

    return () => clearInterval(intervalId)
  }, [
    agentId,
    activity,
    config.checkInterval,
    calculateMetrics,
    determineStatus,
    onWarnThresholdExceeded,
    onStallDetected,
    onToolTimeoutImminent,
    onActivityResumed,
    watchdogState.currentTool
  ])

  return watchdogState
}

/**
 * Format time duration for display
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1m 30s", "45s", "2m")
 */
export function formatWatchdogDuration(ms: number): string {
  if (ms < 1000) return '<1s'
  
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes === 0) {
    return `${seconds}s`
  }
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

export default useAgentWatchdog
