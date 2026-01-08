/**
 * Playbook Types
 * 
 * Type definitions for the Agentic Memory Playbook system.
 * Enables autonomous learning from agent execution outcomes.
 * 
 * Based on ACE Framework research and Swarm Sentinel patterns.
 * 
 * @module shared/types/playbook
 */

// ============================================================================
// Playbook Entry Types
// ============================================================================

/**
 * Types of playbook entries
 */
export type PlaybookEntryType = 
  | 'strategy'           // Patterns that lead to success
  | 'mistake'            // Patterns to avoid
  | 'preference'         // User-specific preferences
  | 'codebase_context';  // Project/codebase-specific knowledge

/**
 * Scope of a playbook entry
 * - 'global': Applies to all sessions
 * - 'tool:xxx': Applies when using specific tool
 * - 'project:xxx': Applies to specific project/directory
 */
export type PlaybookScope = 'global' | `tool:${string}` | `project:${string}`;

/**
 * A single playbook entry representing learned knowledge
 */
export interface PlaybookEntry {
  id: string;
  entryType: PlaybookEntryType;
  content: string;
  helpfulCount: number;
  harmfulCount: number;
  scope: PlaybookScope;
  sourceSessionId?: string;
  createdAt: number;
  lastReferenced: number;
}

/**
 * Database row representation of a playbook entry
 */
export interface PlaybookEntryRow {
  id: string;
  entry_type: string;
  content: string;
  helpful_count: number;
  harmful_count: number;
  scope: string;
  source_session_id: string | null;
  created_at: number;
  last_referenced: number;
}

/**
 * Options for retrieving playbook entries
 */
export interface GetPlaybookOptions {
  /** Maximum number of entries to return */
  limit?: number;
  /** Filter by entry type */
  types?: PlaybookEntryType[];
  /** Filter by scope */
  scope?: PlaybookScope;
  /** Minimum helpful count */
  minHelpful?: number;
  /** Working directory for project-scoped entries */
  workingDirectory?: string;
}

/**
 * New playbook entry (without id and timestamps)
 */
export interface NewPlaybookEntry {
  entryType: PlaybookEntryType;
  content: string;
  helpfulCount?: number;
  harmfulCount?: number;
  scope?: PlaybookScope;
  sourceSessionId?: string;
}

/**
 * Playbook formatted for injection into agent context
 */
export interface FormattedPlaybook {
  strategies: string[];
  mistakes: string[];
  preferences: string[];
  codebaseContext: string[];
  totalEntries: number;
  tokenEstimate: number;
}


// ============================================================================
// Playbook Service Interface
// ============================================================================

/**
 * Interface for the PlaybookService
 */
export interface IPlaybookService {
  /**
   * Initialize the playbook system
   */
  init(): void;

  /**
   * Add a new entry to the playbook
   */
  addEntry(entry: NewPlaybookEntry): Promise<PlaybookEntry>;

  /**
   * Get entries matching the criteria
   */
  getEntries(options?: GetPlaybookOptions): PlaybookEntry[];

  /**
   * Get entries relevant to a specific context
   */
  getRelevantEntries(workingDirectory?: string, limit?: number): PlaybookEntry[];

  /**
   * Format playbook for injection into agent context
   */
  formatForContext(entries: PlaybookEntry[]): FormattedPlaybook;

  /**
   * Increment the helpful/harmful count for an entry
   */
  updateEntryScore(entryId: string, helpful: boolean): void;

  /**
   * Find similar existing entry (for deduplication)
   */
  findSimilarEntry(content: string, entryType: PlaybookEntryType): PlaybookEntry | null;

  /**
   * Merge a new entry with existing or create new
   */
  addOrMergeEntry(entry: NewPlaybookEntry): Promise<PlaybookEntry>;

  /**
   * Prune stale entries that haven't been helpful
   */
  pruneStaleEntries(olderThanDays?: number): number;

  /**
   * Get playbook statistics
   */
  getStats(): PlaybookStats;
}

/**
 * Playbook statistics
 */
export interface PlaybookStats {
  totalEntries: number;
  strategiesCount: number;
  mistakesCount: number;
  preferencesCount: number;
  codebaseContextCount: number;
  avgHelpfulScore: number;
  lastUpdated: number;
}
