/**
 * usePlaybook Hook
 * 
 * React hook for interacting with the Agentic Memory Playbook system.
 * Provides easy access to playbook entries and learning system controls.
 * 
 * @module renderer/hooks/usePlaybook
 */

import { useState, useEffect, useCallback } from 'react'
import type { 
  PlaybookEntry, 
  NewPlaybookEntry, 
  GetPlaybookOptions,
  PlaybookStats,
  LearningStats
} from '../../../preload/index.d'


// ============================================================================
// Hook Return Type
// ============================================================================

interface UsePlaybookReturn {
  // State
  entries: PlaybookEntry[]
  stats: PlaybookStats | null
  learningStats: LearningStats | null
  isLoading: boolean
  error: string | null

  // Actions
  refreshEntries: (options?: GetPlaybookOptions) => Promise<void>
  getRelevantEntries: (workingDirectory?: string, limit?: number) => Promise<PlaybookEntry[]>
  generateContextSection: (workingDirectory?: string, maxTokens?: number) => Promise<string>
  addEntry: (entry: NewPlaybookEntry) => Promise<PlaybookEntry | null>
  updateEntryScore: (entryId: string, helpful: boolean) => Promise<void>
  submitFeedback: (sessionId: string, rating: 'helpful' | 'unhelpful', comment?: string) => Promise<void>
  refreshStats: () => Promise<void>
}


// ============================================================================
// Hook Implementation
// ============================================================================

export function usePlaybook(autoLoad: boolean = true): UsePlaybookReturn {
  const [entries, setEntries] = useState<PlaybookEntry[]>([])
  const [stats, setStats] = useState<PlaybookStats | null>(null)
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Refresh playbook entries
   */
  const refreshEntries = useCallback(async (options?: GetPlaybookOptions) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await window.api.playbook.getEntries(options)
      setEntries(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load playbook entries'
      setError(message)
      console.error('[usePlaybook] Error loading entries:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Get entries relevant to a specific context
   */
  const getRelevantEntries = useCallback(async (
    workingDirectory?: string,
    limit?: number
  ): Promise<PlaybookEntry[]> => {
    try {
      return await window.api.playbook.getRelevant(workingDirectory, limit)
    } catch (err) {
      console.error('[usePlaybook] Error getting relevant entries:', err)
      return []
    }
  }, [])

  /**
   * Generate playbook context section for agent injection
   */
  const generateContextSection = useCallback(async (
    workingDirectory?: string,
    maxTokens?: number
  ): Promise<string> => {
    try {
      return await window.api.playbook.generateContext(workingDirectory, maxTokens)
    } catch (err) {
      console.error('[usePlaybook] Error generating context:', err)
      return ''
    }
  }, [])

  /**
   * Add a new entry
   */
  const addEntry = useCallback(async (entry: NewPlaybookEntry): Promise<PlaybookEntry | null> => {
    setError(null)
    
    try {
      const result = await window.api.playbook.addEntry(entry)
      // Refresh entries to include the new one
      await refreshEntries()
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to add entry'
      setError(message)
      console.error('[usePlaybook] Error adding entry:', err)
      return null
    }
  }, [refreshEntries])

  /**
   * Update entry score
   */
  const updateEntryScore = useCallback(async (entryId: string, helpful: boolean) => {
    try {
      await window.api.playbook.updateScore(entryId, helpful)
      // Update local state
      setEntries(prev => prev.map(entry => 
        entry.id === entryId
          ? {
              ...entry,
              helpfulCount: entry.helpfulCount + (helpful ? 1 : 0),
              harmfulCount: entry.harmfulCount + (helpful ? 0 : 1)
            }
          : entry
      ))
    } catch (err) {
      console.error('[usePlaybook] Error updating score:', err)
    }
  }, [])

  /**
   * Submit session feedback
   */
  const submitFeedback = useCallback(async (
    sessionId: string,
    rating: 'helpful' | 'unhelpful',
    comment?: string
  ) => {
    try {
      await window.api.playbook.submitFeedback(sessionId, rating, comment)
      // Refresh stats after feedback
      await refreshStats()
    } catch (err) {
      console.error('[usePlaybook] Error submitting feedback:', err)
      throw err
    }
  }, [])

  /**
   * Refresh statistics
   */
  const refreshStats = useCallback(async () => {
    try {
      const [playbookStats, learning] = await Promise.all([
        window.api.playbook.getStats(),
        window.api.playbook.getLearningStats()
      ])
      setStats(playbookStats)
      setLearningStats(learning)
    } catch (err) {
      console.error('[usePlaybook] Error loading stats:', err)
    }
  }, [])

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad) {
      refreshEntries()
      refreshStats()
    }
  }, [autoLoad, refreshEntries, refreshStats])

  return {
    entries,
    stats,
    learningStats,
    isLoading,
    error,
    refreshEntries,
    getRelevantEntries,
    generateContextSection,
    addEntry,
    updateEntryScore,
    submitFeedback,
    refreshStats
  }
}


// ============================================================================
// Context-Specific Hook
// ============================================================================

/**
 * Hook for getting playbook context for agent sessions
 */
export function usePlaybookContext(workingDirectory?: string) {
  const [contextSection, setContextSection] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      const section = await window.api.playbook.generateContext(workingDirectory, 4000)
      setContextSection(section)
    } catch (err) {
      console.error('[usePlaybookContext] Error:', err)
      setContextSection('')
    } finally {
      setIsLoading(false)
    }
  }, [workingDirectory])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { contextSection, isLoading, refresh }
}
