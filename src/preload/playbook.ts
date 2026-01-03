/**
 * Playbook Preload API
 * 
 * Preload script additions for the Agentic Memory Playbook system.
 * Add this to your existing preload/index.ts contextBridge.exposeInMainWorld call.
 * 
 * @module preload/playbook
 */

import { ipcRenderer } from 'electron'
import type { 
  PlaybookEntry, 
  NewPlaybookEntry, 
  GetPlaybookOptions,
  PlaybookStats,
  FormattedPlaybook
} from '../shared/types/playbook'
import type { LearningStats } from '../shared/types/review'


/**
 * Playbook API object to be merged into window.api
 */
export const playbookApi = {
  // ========================================================================
  // Playbook Entry Operations
  // ========================================================================

  /**
   * Get playbook entries with optional filtering
   */
  getEntries: (options?: GetPlaybookOptions): Promise<PlaybookEntry[]> =>
    ipcRenderer.invoke('playbook:get-entries', options),

  /**
   * Get entries relevant to a specific context
   */
  getRelevant: (workingDirectory?: string, limit?: number): Promise<PlaybookEntry[]> =>
    ipcRenderer.invoke('playbook:get-relevant', workingDirectory, limit),

  /**
   * Format playbook entries for agent context injection
   */
  formatForContext: (entries: PlaybookEntry[]): Promise<FormattedPlaybook> =>
    ipcRenderer.invoke('playbook:format-for-context', entries),

  /**
   * Generate the playbook context section (ready for injection)
   */
  generateContext: (workingDirectory?: string, maxTokens?: number): Promise<string> =>
    ipcRenderer.invoke('playbook:generate-context', workingDirectory, maxTokens),

  /**
   * Add a new entry manually
   */
  addEntry: (entry: NewPlaybookEntry): Promise<PlaybookEntry> =>
    ipcRenderer.invoke('playbook:add-entry', entry),

  /**
   * Update entry score (helpful/harmful)
   */
  updateScore: (entryId: string, helpful: boolean): Promise<void> =>
    ipcRenderer.invoke('playbook:update-score', entryId, helpful),

  /**
   * Get playbook statistics
   */
  getStats: (): Promise<PlaybookStats> =>
    ipcRenderer.invoke('playbook:get-stats'),

  /**
   * Seed initial entries (for bootstrapping)
   */
  seed: (): Promise<void> =>
    ipcRenderer.invoke('playbook:seed'),

  // ========================================================================
  // Learning System Operations
  // ========================================================================

  /**
   * Submit user feedback for a session
   */
  submitFeedback: (sessionId: string, rating: 'helpful' | 'unhelpful', comment?: string): Promise<void> =>
    ipcRenderer.invoke('playbook:submit-feedback', sessionId, rating, comment),

  /**
   * Get learning statistics
   */
  getLearningStats: (): Promise<LearningStats> =>
    ipcRenderer.invoke('playbook:get-learning-stats'),

  /**
   * Trigger manual reflection for a session
   */
  triggerReflection: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke('playbook:trigger-reflection', sessionId),

  /**
   * Run maintenance (prune stale entries)
   */
  runMaintenance: (): Promise<void> =>
    ipcRenderer.invoke('playbook:run-maintenance')
}


// ============================================================================
// Type Declaration for Window
// ============================================================================

declare global {
  interface Window {
    api: {
      // ... existing API ...
      playbook: typeof playbookApi
    }
  }
}
