/**
 * Memory Scheduler Service
 * 
 * Handles periodic maintenance tasks for ArborMemoryService:
 * - Decay: Reduce confidence of unaccessed memories over time
 * - Cleanup: Remove very low confidence, old memories
 * 
 * The decay algorithm follows the design from Alex Chen:
 * - Memories that are accessed have their confidence maintained/boosted
 * - Unaccessed memories decay based on days since last access
 * - Very old, low-confidence memories are automatically purged
 * 
 * @module main/services/MemoryScheduler
 * @author Alex Chen Design Implementation
 */

import { ArborMemoryService } from './ArborMemoryService'

// ============================================================================
// Types
// ============================================================================

export interface DecayResult {
  updated: number
  deleted: number
  errors: number
}

export interface SchedulerStatus {
  isRunning: boolean
  lastDecayRun: Date | null
  nextDecayRun: Date | null
  decayIntervalMs: number
}

// ============================================================================
// Memory Scheduler
// ============================================================================

export class MemoryScheduler {
  private decayInterval: NodeJS.Timeout | null = null
  private memoryService: ArborMemoryService
  private isRunning = false
  private lastDecayRun: Date | null = null
  private decayIntervalMs: number

  // Default: Run every 24 hours
  private static readonly DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000

  constructor(intervalMs?: number) {
    this.memoryService = ArborMemoryService.getInstance()
    this.decayIntervalMs = intervalMs ?? MemoryScheduler.DEFAULT_INTERVAL_MS
  }

  /**
   * Start the decay scheduler.
   * Runs immediately on start, then periodically based on interval.
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MemoryScheduler] Already running')
      return
    }

    this.isRunning = true
    console.log('[MemoryScheduler] Starting decay scheduler...')

    // Run immediately on start
    this.runDecay()

    // Then run periodically
    this.decayInterval = setInterval(() => {
      this.runDecay()
    }, this.decayIntervalMs)

    const intervalHours = Math.round(this.decayIntervalMs / (60 * 60 * 1000))
    console.log(`[MemoryScheduler] Decay scheduler started (runs every ${intervalHours}h)`)
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval)
      this.decayInterval = null
    }
    this.isRunning = false
    console.log('[MemoryScheduler] Stopped')
  }

  /**
   * Run decay process manually.
   * This triggers the ArborMemoryService's decay algorithm.
   */
  runDecay(): DecayResult {
    const startTime = Date.now()
    let result: DecayResult = { updated: 0, deleted: 0, errors: 0 }

    try {
      console.log('[MemoryScheduler] Running memory decay...')
      
      const decayResult = this.memoryService.runDecay()
      result = {
        updated: decayResult.updated,
        deleted: decayResult.deleted,
        errors: 0
      }

      this.lastDecayRun = new Date()
      
      const duration = Date.now() - startTime
      console.log(
        `[MemoryScheduler] Decay complete in ${duration}ms: ` +
        `${result.updated} confidence reduced, ${result.deleted} deleted`
      )
    } catch (error) {
      console.error('[MemoryScheduler] Decay failed:', error)
      result.errors = 1
    }

    return result
  }

  /**
   * Check if scheduler is running
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * Get scheduler status
   */
  getStatus(): SchedulerStatus {
    const nextRun = this.lastDecayRun && this.isRunning
      ? new Date(this.lastDecayRun.getTime() + this.decayIntervalMs)
      : null

    return {
      isRunning: this.isRunning,
      lastDecayRun: this.lastDecayRun,
      nextDecayRun: nextRun,
      decayIntervalMs: this.decayIntervalMs
    }
  }

  /**
   * Force an immediate decay run
   */
  forceDecay(): DecayResult {
    console.log('[MemoryScheduler] Force decay triggered')
    return this.runDecay()
  }
}


// ============================================================================
// Singleton Instance
// ============================================================================

let schedulerInstance: MemoryScheduler | null = null

/**
 * Get the singleton MemoryScheduler instance.
 * Creates one if it doesn't exist.
 */
export function getMemoryScheduler(): MemoryScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new MemoryScheduler()
  }
  return schedulerInstance
}

/**
 * Reset the scheduler instance (for testing).
 * Stops any running scheduler before resetting.
 */
export function resetMemoryScheduler(): void {
  if (schedulerInstance) {
    schedulerInstance.stop()
    schedulerInstance = null
  }
}
