// src/renderer/src/hooks/useAgentWatchdog.ts
// Phase 2: Agent Execution Monitoring - Watchdog System
// Author: Alex Chen (Distinguished Software Architect)
// 
// ARCHITECTURE NOTE: This hook uses refs for activity tracking to prevent
// infinite render loops. The activity object from parent changes reference
// on every render, so we store it in a ref and use a stable primitive
// (activity.lastProgressAt) to trigger effect re-runs.

import { useEffect, useRef, useCallback, useState, useMemo } from 'react'
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

// Idle state constant to avoid recreating object
const IDLE_STATE: WatchdogState = {
  status: 'idle',
  timeSinceProgress: 0,
  hasWarning: false,
  isStalled: false,
  currentPhase: null,
  currentTool: null,
  currentToolDuration: 0,
  toolTimeoutImminent: false
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
 */
export function useAgentWatchdog(
  agentId: string,
  activity: WatchdogActivityState | null,
  callbacks: WatchdogCallbacks = {},
  config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG
): WatchdogState {
  // State for UI rendering
  const [watchdogState, setWatchdogState] = useState<WatchdogState>(IDLE_STATE)

  // === REFS FOR STABLE REFERENCES ===
  // Store activity in ref to avoid dependency on object reference
  const activityRef = useRef<WatchdogActivityState | null>(activity)
  activityRef.current = activity

  // Store callbacks in refs to avoid dependency on inline functions
  const callbacksRef = useRef(callbacks)
  callbacksRef.current = callbacks

  // Tracking refs for callback triggers (to avoid duplicate calls)
  const hasTriggeredWarningRef = useRef(false)
  const hasTriggeredStallRef = useRef(false)
  const hasTriggeredTimeoutImminentRef = useRef(false)
  const previousPhaseRef = useRef<ExecutionPhase | null>(null)
  const currentToolRef = useRef<string | null>(null)

  // Memoize config values to prevent unnecessary effect re-runs
  const { warnThreshold, stallThreshold, toolTimeout, checkInterval } = config
  const configValues = useMemo(() => ({
    warnThreshold,
    stallThreshold, 
    toolTimeout,
    checkInterval
  }), [warnThreshold, stallThreshold, toolTimeout, checkInterval])

  /**
   * Calculate current watchdog metrics
   * Using ref for activity to avoid dependency issues
   */
  const calculateMetrics = useCallback((): Omit<WatchdogState, 'status'> => {
    const activityState = activityRef.current
    
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
    const hasWarning = timeSinceProgress > configValues.warnThreshold
    const isStalled = timeSinceProgress > configValues.stallThreshold

    // Tool-specific metrics
    const currentTool = activityState.currentToolName || null
    const currentToolDuration = activityState.phase === 'executing_tool' && activityState.activityStartedAt
      ? now - activityState.activityStartedAt
      : 0
    const toolTimeoutImminent = currentTool !== null && 
      currentToolDuration > configValues.toolTimeout * 0.8

    return {
      timeSinceProgress,
      hasWarning,
      isStalled,
      currentPhase: activityState.phase,
      currentTool,
      currentToolDuration,
      toolTimeoutImminent
    }
  }, [configValues.warnThreshold, configValues.stallThreshold, configValues.toolTimeout])

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


  // Derive stable primitives from activity for dependency tracking
  // This avoids depending on the activity object reference
  const isActive = activity !== null && activity.phase !== 'idle'
  const activityPhase = activity?.phase ?? 'idle'
  const lastProgressAt = activity?.lastProgressAt ?? 0

  // Main monitoring effect
  // Dependencies are carefully chosen primitives, not object references
  useEffect(() => {
    // If no activity or idle, reset state
    if (!isActive) {
      setWatchdogState(IDLE_STATE)
      // Reset trigger refs when going idle
      hasTriggeredWarningRef.current = false
      hasTriggeredStallRef.current = false
      hasTriggeredTimeoutImminentRef.current = false
      previousPhaseRef.current = null
      currentToolRef.current = null
      return
    }

    // Tick function for interval - reads from refs for latest values
    const tick = () => {
      const metrics = calculateMetrics()
      const status = determineStatus(metrics)
      const newState = { ...metrics, status }
      const callbacks = callbacksRef.current

      // Check for phase transitions (activity resumed)
      if (previousPhaseRef.current !== null && 
          (hasTriggeredWarningRef.current || hasTriggeredStallRef.current)) {
        // If we were in warning/stall state and now have new progress
        if (!metrics.hasWarning && !metrics.isStalled) {
          console.log(`[Watchdog:${agentId}] Activity resumed after stall/warning`)
          callbacks.onActivityResumed?.()
          hasTriggeredWarningRef.current = false
          hasTriggeredStallRef.current = false
        }
      }
      previousPhaseRef.current = activityRef.current?.phase ?? null

      // Trigger warning callback (once)
      if (metrics.hasWarning && !metrics.isStalled && !hasTriggeredWarningRef.current) {
        console.log(`[Watchdog:${agentId}] Warning threshold exceeded: ${Math.round(metrics.timeSinceProgress / 1000)}s since progress`)
        hasTriggeredWarningRef.current = true
        callbacks.onWarnThresholdExceeded?.()
      }

      // Trigger stall callback (once)
      if (metrics.isStalled && !hasTriggeredStallRef.current) {
        console.log(`[Watchdog:${agentId}] STALL DETECTED: ${Math.round(metrics.timeSinceProgress / 1000)}s since progress`)
        hasTriggeredStallRef.current = true
        callbacks.onStallDetected?.()
      }

      // Trigger tool timeout imminent callback (once per tool)
      if (metrics.toolTimeoutImminent && !hasTriggeredTimeoutImminentRef.current) {
        console.log(`[Watchdog:${agentId}] Tool timeout imminent: ${metrics.currentTool} running for ${Math.round(metrics.currentToolDuration / 1000)}s`)
        hasTriggeredTimeoutImminentRef.current = true
        callbacks.onToolTimeoutImminent?.()
      }

      // Reset tool timeout trigger when tool changes (using ref for comparison)
      if (metrics.currentTool !== currentToolRef.current) {
        hasTriggeredTimeoutImminentRef.current = false
        currentToolRef.current = metrics.currentTool
      }

      setWatchdogState(newState)
    }

    // Set up polling interval
    const intervalId = setInterval(tick, configValues.checkInterval)

    // Run initial tick after a microtask to avoid sync setState during render
    // This prevents the "setState during render" warning
    Promise.resolve().then(tick)

    return () => clearInterval(intervalId)
  }, [
    agentId,
    isActive,           // Primitive boolean
    activityPhase,      // Primitive string  
    lastProgressAt,     // Primitive number - changes when progress made
    configValues.checkInterval,
    calculateMetrics,
    determineStatus
    // NOTE: callbacks and activity accessed via refs, not dependencies
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
