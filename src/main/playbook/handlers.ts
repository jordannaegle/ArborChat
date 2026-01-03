/**
 * Playbook IPC Handlers
 * 
 * IPC handlers for the Agentic Memory Playbook system.
 * Exposes playbook and learning system functionality to the renderer process.
 * 
 * @module main/playbook/handlers
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { getPlaybookService } from '../services/PlaybookService'
import { initReflectorService } from '../services/ReflectorService'
import { getReviewAgentService } from '../services/ReviewAgentService'
import { getReviewAgentAdapter } from '../services/ReviewAgentAdapter'
import { WorkJournalManager } from '../services/WorkJournalManager'
import type { 
  PlaybookEntry, 
  NewPlaybookEntry, 
  GetPlaybookOptions,
  PlaybookStats,
  FormattedPlaybook
} from '../../shared/types/playbook'
import type { LearningStats } from '../../shared/types/review'


// ============================================================================
// Handler Registration
// ============================================================================

export function registerPlaybookHandlers(workJournal: WorkJournalManager): void {
  console.log('[Playbook] Registering IPC handlers...');

  // Initialize services
  const playbookService = getPlaybookService();
  playbookService.init();
  
  // Initialize the Review Agent with Gemini adapter
  const reviewAgentService = getReviewAgentService();
  const aiAdapter = getReviewAgentAdapter();
  reviewAgentService.setAIProvider(aiAdapter);
  console.log('[Playbook] Review Agent configured with Gemini adapter');
  
  const reflectorService = initReflectorService(workJournal);

  // ========================================================================
  // Playbook Entry Operations
  // ========================================================================

  /**
   * Get playbook entries with optional filtering
   */
  ipcMain.handle('playbook:get-entries', async (
    _event: IpcMainInvokeEvent,
    options?: GetPlaybookOptions
  ): Promise<PlaybookEntry[]> => {
    return playbookService.getEntries(options);
  });

  /**
   * Get entries relevant to a specific context
   */
  ipcMain.handle('playbook:get-relevant', async (
    _event: IpcMainInvokeEvent,
    workingDirectory?: string,
    limit?: number
  ): Promise<PlaybookEntry[]> => {
    return playbookService.getRelevantEntries(workingDirectory, limit);
  });

  /**
   * Format playbook for agent context injection
   */
  ipcMain.handle('playbook:format-for-context', async (
    _event: IpcMainInvokeEvent,
    entries: PlaybookEntry[]
  ): Promise<FormattedPlaybook> => {
    return playbookService.formatForContext(entries);
  });

  /**
   * Generate the playbook context section (ready for injection)
   */
  ipcMain.handle('playbook:generate-context', async (
    _event: IpcMainInvokeEvent,
    workingDirectory?: string,
    maxTokens?: number
  ): Promise<string> => {
    return playbookService.generateContextSection(workingDirectory, maxTokens);
  });

  /**
   * Add a new entry manually
   */
  ipcMain.handle('playbook:add-entry', async (
    _event: IpcMainInvokeEvent,
    entry: NewPlaybookEntry
  ): Promise<PlaybookEntry> => {
    return playbookService.addEntry(entry);
  });

  /**
   * Update entry score (helpful/harmful)
   */
  ipcMain.handle('playbook:update-score', async (
    _event: IpcMainInvokeEvent,
    entryId: string,
    helpful: boolean
  ): Promise<void> => {
    playbookService.updateEntryScore(entryId, helpful);
  });

  /**
   * Get playbook statistics
   */
  ipcMain.handle('playbook:get-stats', async (
    _event: IpcMainInvokeEvent
  ): Promise<PlaybookStats> => {
    return playbookService.getStats();
  });

  /**
   * Seed initial entries (for bootstrapping)
   */
  ipcMain.handle('playbook:seed', async (
    _event: IpcMainInvokeEvent
  ): Promise<void> => {
    await playbookService.seedInitialEntries();
  });


  // ========================================================================
  // Learning System Operations
  // ========================================================================

  /**
   * Submit user feedback for a session
   */
  ipcMain.handle('playbook:submit-feedback', async (
    _event: IpcMainInvokeEvent,
    sessionId: string,
    rating: 'helpful' | 'unhelpful',
    comment?: string
  ): Promise<void> => {
    await reflectorService.processUserFeedback(sessionId, rating, comment);
  });

  /**
   * Get learning statistics
   */
  ipcMain.handle('playbook:get-learning-stats', async (
    _event: IpcMainInvokeEvent
  ): Promise<LearningStats> => {
    return reflectorService.getStats();
  });

  /**
   * Trigger manual reflection for a session
   */
  ipcMain.handle('playbook:trigger-reflection', async (
    _event: IpcMainInvokeEvent,
    sessionId: string
  ): Promise<void> => {
    await reflectorService.processSession(sessionId);
  });

  /**
   * Run maintenance (prune stale entries)
   */
  ipcMain.handle('playbook:run-maintenance', async (
    _event: IpcMainInvokeEvent
  ): Promise<void> => {
    await reflectorService.runMaintenance();
  });


  console.log('[Playbook] IPC handlers registered');
}


// ============================================================================
// Preload API Types (for type safety in renderer)
// ============================================================================

export interface PlaybookAPI {
  // Entry operations
  getEntries: (options?: GetPlaybookOptions) => Promise<PlaybookEntry[]>;
  getRelevant: (workingDirectory?: string, limit?: number) => Promise<PlaybookEntry[]>;
  formatForContext: (entries: PlaybookEntry[]) => Promise<FormattedPlaybook>;
  generateContext: (workingDirectory?: string, maxTokens?: number) => Promise<string>;
  addEntry: (entry: NewPlaybookEntry) => Promise<PlaybookEntry>;
  updateScore: (entryId: string, helpful: boolean) => Promise<void>;
  getStats: () => Promise<PlaybookStats>;
  seed: () => Promise<void>;
  
  // Learning system
  submitFeedback: (sessionId: string, rating: 'helpful' | 'unhelpful', comment?: string) => Promise<void>;
  getLearningStats: () => Promise<LearningStats>;
  triggerReflection: (sessionId: string) => Promise<void>;
  runMaintenance: () => Promise<void>;
}
