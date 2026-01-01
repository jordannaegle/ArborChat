/**
 * Work Journal Manager
 * 
 * Core service for the Agent Work Journal system.
 * Handles session management, real-time entry logging, checkpointing,
 * and resumption context generation.
 * 
 * Design principles:
 * - Append-only entries for durability
 * - Real-time subscriptions via callbacks
 * - Efficient querying with proper indexes
 * - Token estimation for context management
 * 
 * @module main/services/WorkJournalManager
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  WorkSession,
  WorkEntry,
  WorkCheckpoint,
  WorkSessionStatus,
  EntryType,
  EntryImportance,
  EntryContent,
  GetEntriesOptions,
  CreateCheckpointOptions,
  ResumptionContext,
  WorkSessionRow,
  WorkEntryRow,
  WorkCheckpointRow,
  WorkEntryCallback,
  UnsubscribeFn
} from '../../shared/types/workJournal'
import { SummarizationService } from './SummarizationService'


// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // Checkpoint triggers
  CHECKPOINT_ENTRY_THRESHOLD: 50,  // Create checkpoint after N entries
  CHECKPOINT_TOKEN_THRESHOLD: 8000, // Create checkpoint after N tokens
  
  // Token limits
  DEFAULT_RESUMPTION_TOKENS: 4000,
  MAX_CONTENT_PREVIEW_LENGTH: 500,
  
  // Cleanup
  MAX_SESSIONS_PER_CONVERSATION: 100,
  SESSION_RETENTION_DAYS: 90
} as const;

// ============================================================================
// Token Estimation Utilities
// ============================================================================

/**
 * Rough token estimation (approximately 4 characters per token)
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens for entry content based on type
 */
function estimateContentTokens(content: EntryContent): number {
  const json = JSON.stringify(content);
  return estimateTokens(json);
}


// ============================================================================
// Row Conversion Utilities
// ============================================================================

function rowToSession(row: WorkSessionRow): WorkSession {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    originalPrompt: row.original_prompt,
    status: row.status as WorkSessionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
    tokenEstimate: row.token_estimate,
    entryCount: row.entry_count
  };
}

function rowToEntry(row: WorkEntryRow): WorkEntry {
  return {
    id: row.id,
    sessionId: row.session_id,
    sequenceNum: row.sequence_num,
    entryType: row.entry_type as EntryType,
    timestamp: row.timestamp,
    content: JSON.parse(row.content) as EntryContent,
    tokenEstimate: row.token_estimate,
    importance: row.importance as EntryImportance
  };
}

function rowToCheckpoint(row: WorkCheckpointRow): WorkCheckpoint {
  return {
    id: row.id,
    sessionId: row.session_id,
    createdAt: row.created_at,
    summary: row.summary,
    keyDecisions: JSON.parse(row.key_decisions) as string[],
    currentState: row.current_state,
    filesModified: JSON.parse(row.files_modified) as string[],
    pendingActions: JSON.parse(row.pending_actions) as string[]
  };
}


// ============================================================================
// WorkJournalManager Class
// ============================================================================

export class WorkJournalManager {
  private db: Database.Database;
  private initialized = false;
  private subscribers: Map<string, Set<WorkEntryCallback>> = new Map();
  
  // Prepared statements (populated on init)
  private stmts!: {
    createSession: Database.Statement;
    getSession: Database.Statement;
    getActiveSession: Database.Statement;
    updateSessionStatus: Database.Statement;
    updateSessionStats: Database.Statement;
    insertEntry: Database.Statement;
    getEntries: Database.Statement;
    getEntriesSince: Database.Statement;
    getEntriesWithFilters: Database.Statement;
    getNextSequence: Database.Statement;
    createCheckpoint: Database.Statement;
    getLatestCheckpoint: Database.Statement;
    getCheckpoints: Database.Statement;
    getSessionsByConversation: Database.Statement;
    deleteOldSessions: Database.Statement;
  };

  constructor() {
    const dbPath = join(app.getPath('userData'), 'arborchat.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }


  /**
   * Initialize the work journal system
   * Creates tables and prepares statements
   */
  init(): void {
    if (this.initialized) return;

    console.log('[WorkJournal] Initializing...');

    // Create tables
    this.createTables();

    // Prepare statements
    this.prepareStatements();

    this.initialized = true;
    console.log('[WorkJournal] Initialized successfully');
  }

  /**
   * Create database tables if they don't exist
   */
  private createTables(): void {
    this.db.exec(`
      -- Work Sessions: Top-level container for agent work
      CREATE TABLE IF NOT EXISTS work_sessions (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        original_prompt TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER,
        token_estimate INTEGER DEFAULT 0,
        entry_count INTEGER DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );

      -- Work Entries: Individual logged actions (append-only for durability)
      CREATE TABLE IF NOT EXISTS work_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sequence_num INTEGER NOT NULL,
        entry_type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        content TEXT NOT NULL,
        token_estimate INTEGER DEFAULT 0,
        importance TEXT DEFAULT 'normal',
        FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE
      );

      -- Checkpoints: Periodic snapshots for efficient resumption
      CREATE TABLE IF NOT EXISTS work_checkpoints (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        summary TEXT NOT NULL,
        key_decisions TEXT DEFAULT '[]',
        current_state TEXT DEFAULT '',
        files_modified TEXT DEFAULT '[]',
        pending_actions TEXT DEFAULT '[]',
        FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE
      );

      -- Indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_work_entries_session 
        ON work_entries(session_id, sequence_num);
      CREATE INDEX IF NOT EXISTS idx_work_entries_type 
        ON work_entries(session_id, entry_type);
      CREATE INDEX IF NOT EXISTS idx_work_sessions_conversation 
        ON work_sessions(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_work_sessions_status 
        ON work_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_work_checkpoints_session 
        ON work_checkpoints(session_id, created_at DESC);
    `);
  }


  /**
   * Prepare all SQL statements for efficient execution
   */
  private prepareStatements(): void {
    this.stmts = {
      createSession: this.db.prepare(`
        INSERT INTO work_sessions 
        (id, conversation_id, original_prompt, status, created_at, updated_at)
        VALUES (?, ?, ?, 'active', ?, ?)
      `),

      getSession: this.db.prepare(`
        SELECT * FROM work_sessions WHERE id = ?
      `),

      getActiveSession: this.db.prepare(`
        SELECT * FROM work_sessions 
        WHERE conversation_id = ? AND status = 'active'
        ORDER BY created_at DESC LIMIT 1
      `),

      updateSessionStatus: this.db.prepare(`
        UPDATE work_sessions 
        SET status = ?, updated_at = ?, completed_at = CASE WHEN ? IN ('completed', 'crashed') THEN ? ELSE completed_at END
        WHERE id = ?
      `),

      updateSessionStats: this.db.prepare(`
        UPDATE work_sessions 
        SET token_estimate = token_estimate + ?, entry_count = entry_count + 1, updated_at = ?
        WHERE id = ?
      `),

      insertEntry: this.db.prepare(`
        INSERT INTO work_entries 
        (session_id, sequence_num, entry_type, timestamp, content, token_estimate, importance)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `),

      getEntries: this.db.prepare(`
        SELECT * FROM work_entries 
        WHERE session_id = ?
        ORDER BY sequence_num ASC
      `),

      getEntriesSince: this.db.prepare(`
        SELECT * FROM work_entries 
        WHERE session_id = ? AND sequence_num > ?
        ORDER BY sequence_num ASC
        LIMIT ?
      `),

      getEntriesWithFilters: this.db.prepare(`
        SELECT * FROM work_entries 
        WHERE session_id = ?
        ORDER BY sequence_num ASC
      `),

      getNextSequence: this.db.prepare(`
        SELECT COALESCE(MAX(sequence_num), 0) + 1 as next_seq 
        FROM work_entries WHERE session_id = ?
      `),

      createCheckpoint: this.db.prepare(`
        INSERT INTO work_checkpoints 
        (id, session_id, created_at, summary, key_decisions, current_state, files_modified, pending_actions)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `),

      getLatestCheckpoint: this.db.prepare(`
        SELECT * FROM work_checkpoints 
        WHERE session_id = ?
        ORDER BY created_at DESC LIMIT 1
      `),

      getCheckpoints: this.db.prepare(`
        SELECT * FROM work_checkpoints 
        WHERE session_id = ?
        ORDER BY created_at DESC
      `),

      getSessionsByConversation: this.db.prepare(`
        SELECT * FROM work_sessions 
        WHERE conversation_id = ?
        ORDER BY created_at DESC
      `),

      deleteOldSessions: this.db.prepare(`
        DELETE FROM work_sessions 
        WHERE created_at < ? AND status IN ('completed', 'crashed')
      `)
    };
  }


  // ==========================================================================
  // Session Management
  // ==========================================================================

  /**
   * Create a new work session for a conversation
   */
  createSession(conversationId: string, originalPrompt: string): WorkSession {
    this.ensureInitialized();

    const id = randomUUID();
    const now = Date.now();

    this.stmts.createSession.run(id, conversationId, originalPrompt, now, now);

    const session: WorkSession = {
      id,
      conversationId,
      originalPrompt,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      tokenEstimate: 0,
      entryCount: 0
    };

    console.log(`[WorkJournal] Created session ${id} for conversation ${conversationId}`);
    return session;
  }


  /**
   * Get a session by ID
   */
  getSession(sessionId: string): WorkSession | null {
    this.ensureInitialized();

    const row = this.stmts.getSession.get(sessionId) as WorkSessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  /**
   * Get the active session for a conversation (if any)
   */
  getActiveSession(conversationId: string): WorkSession | null {
    this.ensureInitialized();

    const row = this.stmts.getActiveSession.get(conversationId) as WorkSessionRow | undefined;
    return row ? rowToSession(row) : null;
  }

  /**
   * Update a session's status
   */
  updateSessionStatus(sessionId: string, status: WorkSessionStatus): void {
    this.ensureInitialized();

    const now = Date.now();
    this.stmts.updateSessionStatus.run(status, now, status, now, sessionId);

    console.log(`[WorkJournal] Updated session ${sessionId} status to ${status}`);
  }

  /**
   * Get all sessions for a conversation
   */
  getSessionsForConversation(conversationId: string): WorkSession[] {
    this.ensureInitialized();

    const rows = this.stmts.getSessionsByConversation.all(conversationId) as WorkSessionRow[];
    return rows.map(rowToSession);
  }

  /**
   * Get sessions that can be resumed (paused or crashed)
   * Used by the session resumption UI
   */
  getResumableSessions(limit: number = 20): WorkSession[] {
    this.ensureInitialized();

    const stmt = this.db.prepare(`
      SELECT * FROM work_sessions 
      WHERE status IN ('paused', 'crashed')
      ORDER BY updated_at DESC
      LIMIT ?
    `);
    
    const rows = stmt.all(limit) as WorkSessionRow[];
    return rows.map(rowToSession);
  }


  // ==========================================================================
  // Entry Logging (Real-time, append-only)
  // ==========================================================================

  /**
   * Log a new entry to a session
   * This is the primary method for recording agent work in real-time
   */
  logEntry(
    sessionId: string,
    entryType: EntryType,
    content: EntryContent,
    importance: EntryImportance = 'normal'
  ): WorkEntry {
    this.ensureInitialized();

    const timestamp = Date.now();
    const tokenEstimate = estimateContentTokens(content);
    const contentJson = JSON.stringify(content);

    // Get next sequence number
    const { next_seq } = this.stmts.getNextSequence.get(sessionId) as { next_seq: number };

    // Insert entry
    const result = this.stmts.insertEntry.run(
      sessionId,
      next_seq,
      entryType,
      timestamp,
      contentJson,
      tokenEstimate,
      importance
    );

    // Update session stats
    this.stmts.updateSessionStats.run(tokenEstimate, timestamp, sessionId);

    const entry: WorkEntry = {
      id: result.lastInsertRowid as number,
      sessionId,
      sequenceNum: next_seq,
      entryType,
      timestamp,
      content,
      tokenEstimate,
      importance
    };

    // Notify subscribers
    this.notifySubscribers(sessionId, entry);

    // Check if we should auto-checkpoint
    this.maybeAutoCheckpoint(sessionId);

    return entry;
  }

  /**
   * Get entries for a session with optional filtering
   */
  getEntries(sessionId: string, options?: GetEntriesOptions): WorkEntry[] {
    this.ensureInitialized();

    let rows: WorkEntryRow[];

    if (options?.since !== undefined) {
      rows = this.stmts.getEntriesSince.all(
        sessionId,
        options.since,
        options.limit ?? 1000
      ) as WorkEntryRow[];
    } else {
      rows = this.stmts.getEntries.all(sessionId) as WorkEntryRow[];
    }

    let entries = rows.map(rowToEntry);

    // Apply filters if specified
    if (options?.importance?.length) {
      entries = entries.filter(e => options.importance!.includes(e.importance));
    }
    if (options?.types?.length) {
      entries = entries.filter(e => options.types!.includes(e.entryType));
    }
    if (options?.limit && entries.length > options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Get the latest entry for a session
   */
  getLatestEntry(sessionId: string): WorkEntry | null {
    this.ensureInitialized();

    const entries = this.getEntries(sessionId);
    return entries.length > 0 ? entries[entries.length - 1] : null;
  }


  // ==========================================================================
  // Checkpointing
  // ==========================================================================

  /** Summarization service instance for AI-powered checkpoints */
  private summarizationService: SummarizationService | null = null;
  
  /** Configuration for AI summarization */
  private aiSummarizationEnabled: boolean = true;

  /**
   * Get or create the summarization service
   */
  private getSummarizationService(): SummarizationService {
    if (!this.summarizationService) {
      this.summarizationService = new SummarizationService();
    }
    return this.summarizationService;
  }

  /**
   * Enable or disable AI summarization
   */
  setAISummarizationEnabled(enabled: boolean): void {
    this.aiSummarizationEnabled = enabled;
    console.log(`[WorkJournal] AI summarization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if AI summarization is enabled
   */
  isAISummarizationEnabled(): boolean {
    return this.aiSummarizationEnabled;
  }

  /**
   * Create a checkpoint for a session
   * Summarizes work done so far for efficient resumption
   * Uses AI summarization when available, falls back to heuristic
   */
  async createCheckpoint(
    sessionId: string, 
    options?: CreateCheckpointOptions
  ): Promise<WorkCheckpoint> {
    this.ensureInitialized();

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entries = this.getEntries(sessionId);
    let checkpoint: WorkCheckpoint;

    // Try AI summarization if enabled and not explicitly disabled
    const useAI = this.aiSummarizationEnabled && options?.useAISummarization !== false;
    
    if (useAI) {
      try {
        const summarizer = this.getSummarizationService();
        const aiResult = await summarizer.summarizeWorkSession(
          session,
          entries,
          { targetTokens: options?.targetTokens ?? 500 }
        );

        checkpoint = {
          id: randomUUID(),
          sessionId: session.id,
          createdAt: Date.now(),
          summary: aiResult.summary,
          keyDecisions: aiResult.keyDecisions,
          currentState: aiResult.currentState,
          filesModified: aiResult.filesModified.map(f => f.path),
          pendingActions: aiResult.suggestedNextSteps
        };

        console.log('[WorkJournal] Created AI-powered checkpoint');
      } catch (error) {
        console.warn('[WorkJournal] AI summarization failed, using heuristic:', error);
        checkpoint = this.buildCheckpoint(session, entries, options?.manual ?? false);
      }
    } else {
      checkpoint = this.buildCheckpoint(session, entries, options?.manual ?? false);
    }

    // Store checkpoint
    this.stmts.createCheckpoint.run(
      checkpoint.id,
      checkpoint.sessionId,
      checkpoint.createdAt,
      checkpoint.summary,
      JSON.stringify(checkpoint.keyDecisions),
      checkpoint.currentState,
      JSON.stringify(checkpoint.filesModified),
      JSON.stringify(checkpoint.pendingActions)
    );

    // Log checkpoint as an entry
    this.logEntry(sessionId, 'checkpoint', {
      type: 'checkpoint',
      checkpointId: checkpoint.id,
      summary: checkpoint.summary,
      completedTasks: checkpoint.keyDecisions,
      pendingTasks: checkpoint.pendingActions
    } as const, 'high');

    console.log(`[WorkJournal] Created checkpoint ${checkpoint.id} for session ${sessionId}`);
    return checkpoint;
  }

  /**
   * Get the latest checkpoint for a session
   */
  getLatestCheckpoint(sessionId: string): WorkCheckpoint | null {
    this.ensureInitialized();

    const row = this.stmts.getLatestCheckpoint.get(sessionId) as WorkCheckpointRow | undefined;
    return row ? rowToCheckpoint(row) : null;
  }

  /**
   * Get all checkpoints for a session
   */
  getCheckpoints(sessionId: string): WorkCheckpoint[] {
    this.ensureInitialized();

    const rows = this.stmts.getCheckpoints.all(sessionId) as WorkCheckpointRow[];
    return rows.map(rowToCheckpoint);
  }


  /**
   * Build a checkpoint object from session and entries
   * This is a local summarization - AI summarization comes in Phase 6
   */
  private buildCheckpoint(
    session: WorkSession,
    entries: WorkEntry[],
    isManual: boolean
  ): WorkCheckpoint {
    const keyDecisions: string[] = [];
    const filesModified: string[] = [];
    const pendingActions: string[] = [];

    // Extract key information from entries
    for (const entry of entries) {
      if (entry.entryType === 'decision' && entry.content.type === 'decision') {
        keyDecisions.push(`${entry.content.question}: ${entry.content.chosenOption}`);
      }
      if (entry.entryType === 'file_written' && entry.content.type === 'file_written') {
        if (!filesModified.includes(entry.content.filePath)) {
          filesModified.push(entry.content.filePath);
        }
      }
    }

    // Build summary from recent entries
    const recentEntries = entries.slice(-10);
    const summaryParts = recentEntries
      .filter(e => ['tool_result', 'decision', 'error'].includes(e.entryType))
      .map(e => `[${e.entryType}] ${this.getEntrySummary(e)}`)
      .slice(-5);

    const summary = isManual 
      ? `Manual checkpoint at entry ${entries.length}`
      : `Auto-checkpoint: ${summaryParts.join('; ')}`;

    const currentState = recentEntries.length > 0
      ? `Last action: ${this.getEntrySummary(recentEntries[recentEntries.length - 1])}`
      : 'Session just started';

    return {
      id: randomUUID(),
      sessionId: session.id,
      createdAt: Date.now(),
      summary,
      keyDecisions,
      currentState,
      filesModified,
      pendingActions
    };
  }

  /**
   * Get a brief summary of an entry for checkpoint building
   */
  private getEntrySummary(entry: WorkEntry): string {
    const content = entry.content;
    
    switch (content.type) {
      case 'tool_result':
        return content.success 
          ? `${content.toolName} succeeded`
          : `${content.toolName} failed: ${content.errorMessage}`;
      case 'decision':
        return `Decided: ${content.chosenOption}`;
      case 'error':
        return `Error: ${content.message}`;
      case 'file_written':
        return `Wrote ${content.filePath}`;
      case 'thinking':
        return content.reasoning.slice(0, 100);
      default:
        return entry.entryType;
    }
  }


  /**
   * Summarize a session on-demand (without creating a checkpoint)
   * Useful for getting a summary without persisting it
   */
  async summarizeSession(
    sessionId: string,
    options?: { targetTokens?: number; useAI?: boolean }
  ): Promise<{
    summary: string;
    keyDecisions: string[];
    currentState: string;
    suggestedNextSteps: string[];
    usedAI: boolean;
  }> {
    this.ensureInitialized();

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entries = this.getEntries(sessionId);
    const useAI = options?.useAI !== false && this.aiSummarizationEnabled;

    if (useAI) {
      try {
        const summarizer = this.getSummarizationService();
        const result = await summarizer.summarizeWorkSession(
          session,
          entries,
          { targetTokens: options?.targetTokens ?? 500 }
        );
        return {
          summary: result.summary,
          keyDecisions: result.keyDecisions,
          currentState: result.currentState,
          suggestedNextSteps: result.suggestedNextSteps,
          usedAI: result.usedAI
        };
      } catch (error) {
        console.warn('[WorkJournal] AI summarization failed:', error);
      }
    }

    // Fallback to heuristic
    const checkpoint = this.buildCheckpoint(session, entries, false);
    return {
      summary: checkpoint.summary,
      keyDecisions: checkpoint.keyDecisions,
      currentState: checkpoint.currentState,
      suggestedNextSteps: checkpoint.pendingActions,
      usedAI: false
    };
  }


  /**
   * Check if we should auto-create a checkpoint
   */
  private maybeAutoCheckpoint(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (!session) return;

    const latestCheckpoint = this.getLatestCheckpoint(sessionId);
    const entriesSinceCheckpoint = latestCheckpoint
      ? this.getEntries(sessionId, { since: 0 }).filter(
          e => e.timestamp > latestCheckpoint.createdAt
        ).length
      : session.entryCount;

    // Check entry threshold
    if (entriesSinceCheckpoint >= CONFIG.CHECKPOINT_ENTRY_THRESHOLD) {
      console.log(`[WorkJournal] Auto-checkpoint triggered (${entriesSinceCheckpoint} entries)`);
      this.createCheckpoint(sessionId, { manual: false }).catch(err => {
        console.error('[WorkJournal] Auto-checkpoint failed:', err);
      });
    }
  }

  // ==========================================================================
  // Subscriptions (Real-time updates)
  // ==========================================================================

  /**
   * Subscribe to new entries for a session
   * Returns an unsubscribe function
   */
  subscribe(sessionId: string, callback: WorkEntryCallback): UnsubscribeFn {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set());
    }
    this.subscribers.get(sessionId)!.add(callback);

    console.log(`[WorkJournal] Added subscriber for session ${sessionId}`);

    return () => {
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(sessionId);
        }
      }
    };
  }


  /**
   * Notify all subscribers of a new entry
   */
  private notifySubscribers(sessionId: string, entry: WorkEntry): void {
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      for (const callback of subs) {
        try {
          callback(entry);
        } catch (err) {
          console.error('[WorkJournal] Subscriber callback error:', err);
        }
      }
    }
  }

  // ==========================================================================
  // Resumption Context Generation
  // ==========================================================================

  /**
   * Generate a resumption context for continuing work in a new session
   * This provides a compressed summary that fits in a fresh context window
   * 
   * Note: AI-powered summarization is added in Phase 6
   */
  async generateResumptionContext(
    sessionId: string,
    _targetTokens: number = CONFIG.DEFAULT_RESUMPTION_TOKENS
  ): Promise<ResumptionContext> {
    this.ensureInitialized();

    const session = this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const entries = this.getEntries(sessionId);
    const latestCheckpoint = this.getLatestCheckpoint(sessionId);

    // Extract key information from entries
    const keyDecisions: string[] = [];
    const filesModified: string[] = [];
    const errorHistory: string[] = [];
    const suggestedNextSteps: string[] = [];

    for (const entry of entries) {
      const content = entry.content;

      if (content.type === 'decision') {
        keyDecisions.push(`${content.question}: ${content.chosenOption}`);
      }
      if (content.type === 'file_written' || content.type === 'file_read') {
        if (!filesModified.includes(content.filePath)) {
          filesModified.push(content.filePath);
        }
      }
      if (content.type === 'error') {
        errorHistory.push(`${content.errorType}: ${content.message}`);
      }
    }

    // Get current state from latest checkpoint or last entries
    let currentState = 'Work in progress';
    if (latestCheckpoint) {
      currentState = latestCheckpoint.currentState;
      suggestedNextSteps.push(...latestCheckpoint.pendingActions);
    }

    // Build work summary
    const workSummary = this.buildWorkSummary(session, entries, latestCheckpoint);

    const context: ResumptionContext = {
      originalPrompt: session.originalPrompt,
      workSummary,
      keyDecisions: keyDecisions.slice(-10), // Keep last 10 decisions
      currentState,
      filesModified: [...new Set(filesModified)], // Deduplicate
      pendingActions: suggestedNextSteps,
      errorHistory: errorHistory.slice(-5), // Keep last 5 errors
      suggestedNextSteps,
      tokenCount: estimateTokens(workSummary) + estimateTokens(session.originalPrompt)
    };

    return context;
  }

  /**
   * Build a work summary from session and entries
   */
  private buildWorkSummary(
    session: WorkSession,
    entries: WorkEntry[],
    checkpoint: WorkCheckpoint | null
  ): string {
    const parts: string[] = [];

    parts.push(`Original task: ${session.originalPrompt}`);
    parts.push(`Session started: ${new Date(session.createdAt).toISOString()}`);
    parts.push(`Total entries: ${entries.length}`);

    if (checkpoint) {
      parts.push(`\nLatest checkpoint: ${checkpoint.summary}`);
    }

    // Add key actions summary
    const toolResults = entries.filter(e => e.entryType === 'tool_result');
    const successCount = toolResults.filter(
      e => e.content.type === 'tool_result' && e.content.success
    ).length;
    const failCount = toolResults.length - successCount;

    if (toolResults.length > 0) {
      parts.push(`\nTool executions: ${successCount} succeeded, ${failCount} failed`);
    }

    // Add recent activity
    const recentEntries = entries.slice(-5);
    if (recentEntries.length > 0) {
      parts.push('\nRecent activity:');
      for (const entry of recentEntries) {
        parts.push(`- ${this.getEntrySummary(entry)}`);
      }
    }

    return parts.join('\n');
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }


  /**
   * Get total token estimate for a session
   */
  getSessionTokens(sessionId: string): number {
    const session = this.getSession(sessionId);
    return session?.tokenEstimate ?? 0;
  }

  /**
   * Check if session is approaching token limit
   */
  isApproachingLimit(sessionId: string, threshold: number = 100000): boolean {
    return this.getSessionTokens(sessionId) >= threshold;
  }

  /**
   * Clean up old sessions (call periodically)
   */
  cleanupOldSessions(): number {
    this.ensureInitialized();

    const cutoff = Date.now() - (CONFIG.SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = this.stmts.deleteOldSessions.run(cutoff);
    
    if (result.changes > 0) {
      console.log(`[WorkJournal] Cleaned up ${result.changes} old sessions`);
    }
    
    return result.changes;
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// Singleton instance
export const workJournalManager = new WorkJournalManager();
