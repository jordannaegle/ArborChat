/**
 * Playbook Service
 * 
 * Core service for the Agentic Memory Playbook system.
 * Handles storage, retrieval, and merging of learned strategies.
 * 
 * Design principles:
 * - Security-first: Never store credentials or sensitive data
 * - Efficient deduplication using text similarity
 * - Scoped entries for project-specific knowledge
 * - Automatic pruning of low-value entries
 * 
 * @module main/services/PlaybookService
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
  PlaybookEntry,
  PlaybookEntryRow,
  PlaybookEntryType,
  PlaybookScope,
  NewPlaybookEntry,
  GetPlaybookOptions,
  FormattedPlaybook,
  PlaybookStats,
  IPlaybookService
} from '../../shared/types/playbook'


// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // Entry limits
  MAX_ENTRY_LENGTH: 2000,
  MAX_ENTRIES_PER_TYPE: 100,
  DEFAULT_LIMIT: 20,
  
  // Similarity threshold for deduplication
  SIMILARITY_THRESHOLD: 0.7,
  
  // Pruning configuration
  PRUNE_AFTER_DAYS: 30,
  MIN_HELPFUL_TO_KEEP: 1,
  
  // Token estimation
  CHARS_PER_TOKEN: 4
} as const;

// Patterns that should NEVER be stored (security)
const FORBIDDEN_PATTERNS = [
  /password[=:]/i,
  /api[_-]?key[=:]/i,
  /bearer\s+[a-zA-Z0-9-_.]+/i,
  /ssh[_-]?key/i,
  /BEGIN\s+(RSA|OPENSSH|EC)\s+PRIVATE\s+KEY/,
  /secret[=:]/i,
  /token[=:]\s*[a-zA-Z0-9-_.]{20,}/i
];


// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate Jaccard similarity between two strings
 */
function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  const intersection = new Set([...wordsA].filter(x => wordsB.has(x)));
  const union = new Set([...wordsA, ...wordsB]);
  
  return intersection.size / union.size;
}

/**
 * Estimate tokens in text
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN);
}

/**
 * Check if content contains forbidden patterns
 */
function containsForbiddenContent(content: string): boolean {
  return FORBIDDEN_PATTERNS.some(pattern => pattern.test(content));
}

/**
 * Convert database row to PlaybookEntry
 */
function rowToEntry(row: PlaybookEntryRow): PlaybookEntry {
  return {
    id: row.id,
    entryType: row.entry_type as PlaybookEntryType,
    content: row.content,
    helpfulCount: row.helpful_count,
    harmfulCount: row.harmful_count,
    scope: row.scope as PlaybookScope,
    sourceSessionId: row.source_session_id ?? undefined,
    createdAt: row.created_at,
    lastReferenced: row.last_referenced
  };
}


// ============================================================================
// PlaybookService Class
// ============================================================================

export class PlaybookService implements IPlaybookService {
  private db: Database.Database;
  private initialized = false;
  
  // Prepared statements
  private stmts!: {
    insert: Database.Statement;
    getById: Database.Statement;
    getByType: Database.Statement;
    getByScope: Database.Statement;
    getAll: Database.Statement;
    getTopEntries: Database.Statement;
    updateScore: Database.Statement;
    updateLastReferenced: Database.Statement;
    delete: Database.Statement;
    pruneStale: Database.Statement;
    countByType: Database.Statement;
  };

  constructor() {
    const dbPath = join(app.getPath('userData'), 'arborchat.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * Initialize the playbook system
   */
  init(): void {
    if (this.initialized) return;

    console.log('[Playbook] Initializing...');
    this.createTables();
    this.prepareStatements();
    this.initialized = true;
    console.log('[Playbook] Initialized successfully');
  }

  /**
   * Create database tables
   */
  private createTables(): void {
    this.db.exec(`
      -- Playbook entries table
      CREATE TABLE IF NOT EXISTS playbook_entries (
        id TEXT PRIMARY KEY,
        entry_type TEXT NOT NULL CHECK (entry_type IN ('strategy', 'mistake', 'preference', 'codebase_context')),
        content TEXT NOT NULL,
        helpful_count INTEGER DEFAULT 1,
        harmful_count INTEGER DEFAULT 0,
        scope TEXT DEFAULT 'global',
        source_session_id TEXT,
        created_at INTEGER NOT NULL,
        last_referenced INTEGER NOT NULL,
        FOREIGN KEY (source_session_id) REFERENCES work_sessions(id) ON DELETE SET NULL
      );

      -- Indexes for efficient querying
      CREATE INDEX IF NOT EXISTS idx_playbook_type ON playbook_entries(entry_type);
      CREATE INDEX IF NOT EXISTS idx_playbook_scope ON playbook_entries(scope);
      CREATE INDEX IF NOT EXISTS idx_playbook_helpful ON playbook_entries(helpful_count DESC);
      CREATE INDEX IF NOT EXISTS idx_playbook_referenced ON playbook_entries(last_referenced DESC);
    `);
  }

  /**
   * Prepare SQL statements
   */
  private prepareStatements(): void {
    this.stmts = {
      insert: this.db.prepare(`
        INSERT INTO playbook_entries 
        (id, entry_type, content, helpful_count, harmful_count, scope, source_session_id, created_at, last_referenced)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `),

      getById: this.db.prepare(`
        SELECT * FROM playbook_entries WHERE id = ?
      `),

      getByType: this.db.prepare(`
        SELECT * FROM playbook_entries 
        WHERE entry_type = ?
        ORDER BY helpful_count DESC, last_referenced DESC
        LIMIT ?
      `),

      getByScope: this.db.prepare(`
        SELECT * FROM playbook_entries 
        WHERE scope = ? OR scope = 'global'
        ORDER BY helpful_count DESC
        LIMIT ?
      `),

      getAll: this.db.prepare(`
        SELECT * FROM playbook_entries
        ORDER BY helpful_count DESC, last_referenced DESC
      `),

      getTopEntries: this.db.prepare(`
        SELECT * FROM playbook_entries
        WHERE helpful_count >= ?
        ORDER BY helpful_count DESC, last_referenced DESC
        LIMIT ?
      `),

      updateScore: this.db.prepare(`
        UPDATE playbook_entries 
        SET helpful_count = helpful_count + ?, 
            harmful_count = harmful_count + ?,
            last_referenced = ?
        WHERE id = ?
      `),

      updateLastReferenced: this.db.prepare(`
        UPDATE playbook_entries 
        SET last_referenced = ?
        WHERE id = ?
      `),

      delete: this.db.prepare(`
        DELETE FROM playbook_entries WHERE id = ?
      `),

      pruneStale: this.db.prepare(`
        DELETE FROM playbook_entries 
        WHERE helpful_count < ? 
        AND created_at < ?
        AND last_referenced < ?
      `),

      countByType: this.db.prepare(`
        SELECT entry_type, COUNT(*) as count 
        FROM playbook_entries 
        GROUP BY entry_type
      `)
    };
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }


  // ==========================================================================
  // Core Entry Operations
  // ==========================================================================

  /**
   * Add a new entry to the playbook
   * Security: Validates content doesn't contain credentials
   */
  async addEntry(entry: NewPlaybookEntry): Promise<PlaybookEntry> {
    this.ensureInitialized();

    // Security check
    if (containsForbiddenContent(entry.content)) {
      throw new Error('Playbook entries cannot contain credentials or sensitive data');
    }

    // Validate content length
    if (entry.content.length > CONFIG.MAX_ENTRY_LENGTH) {
      throw new Error(`Playbook entry too long (max ${CONFIG.MAX_ENTRY_LENGTH} chars)`);
    }

    const id = randomUUID();
    const now = Date.now();

    const playbookEntry: PlaybookEntry = {
      id,
      entryType: entry.entryType,
      content: entry.content,
      helpfulCount: entry.helpfulCount ?? 1,
      harmfulCount: entry.harmfulCount ?? 0,
      scope: entry.scope ?? 'global',
      sourceSessionId: entry.sourceSessionId,
      createdAt: now,
      lastReferenced: now
    };

    this.stmts.insert.run(
      playbookEntry.id,
      playbookEntry.entryType,
      playbookEntry.content,
      playbookEntry.helpfulCount,
      playbookEntry.harmfulCount,
      playbookEntry.scope,
      playbookEntry.sourceSessionId ?? null,
      playbookEntry.createdAt,
      playbookEntry.lastReferenced
    );

    console.log(`[Playbook] Added entry ${id} (${entry.entryType}): ${entry.content.slice(0, 50)}...`);
    return playbookEntry;
  }

  /**
   * Get entries matching criteria
   */
  getEntries(options?: GetPlaybookOptions): PlaybookEntry[] {
    this.ensureInitialized();

    const limit = options?.limit ?? CONFIG.DEFAULT_LIMIT;
    let rows: PlaybookEntryRow[];

    if (options?.scope) {
      rows = this.stmts.getByScope.all(options.scope, limit) as PlaybookEntryRow[];
    } else if (options?.types?.length === 1) {
      rows = this.stmts.getByType.all(options.types[0], limit) as PlaybookEntryRow[];
    } else {
      rows = this.stmts.getTopEntries.all(
        options?.minHelpful ?? 0,
        limit
      ) as PlaybookEntryRow[];
    }

    let entries = rows.map(rowToEntry);

    // Apply additional filters
    if (options?.types && options.types.length > 1) {
      entries = entries.filter(e => options.types!.includes(e.entryType));
    }

    return entries;
  }

  /**
   * Get entries relevant to a specific context (working directory)
   */
  getRelevantEntries(workingDirectory?: string, limit: number = 15): PlaybookEntry[] {
    this.ensureInitialized();

    const entries: PlaybookEntry[] = [];
    const seenIds = new Set<string>();

    // 1. Get project-specific entries if working directory provided
    if (workingDirectory) {
      const projectScope = `project:${workingDirectory}` as PlaybookScope;
      const projectEntries = this.getEntries({ scope: projectScope, limit: 5 });
      for (const entry of projectEntries) {
        if (!seenIds.has(entry.id)) {
          entries.push(entry);
          seenIds.add(entry.id);
        }
      }
    }

    // 2. Get global high-value entries
    const globalEntries = this.getEntries({ 
      scope: 'global', 
      limit: limit - entries.length,
      minHelpful: 1
    });
    for (const entry of globalEntries) {
      if (!seenIds.has(entry.id) && entries.length < limit) {
        entries.push(entry);
        seenIds.add(entry.id);
      }
    }

    // 3. Update last_referenced for all retrieved entries
    const now = Date.now();
    for (const entry of entries) {
      this.stmts.updateLastReferenced.run(now, entry.id);
    }

    return entries;
  }

  /**
   * Format playbook entries for injection into agent context
   */
  formatForContext(entries: PlaybookEntry[]): FormattedPlaybook {
    const strategies: string[] = [];
    const mistakes: string[] = [];
    const preferences: string[] = [];
    const codebaseContext: string[] = [];

    for (const entry of entries) {
      const formatted = `[helpful=${entry.helpfulCount}] ${entry.content}`;
      
      switch (entry.entryType) {
        case 'strategy':
          strategies.push(formatted);
          break;
        case 'mistake':
          mistakes.push(formatted);
          break;
        case 'preference':
          preferences.push(formatted);
          break;
        case 'codebase_context':
          codebaseContext.push(formatted);
          break;
      }
    }

    const allContent = [...strategies, ...mistakes, ...preferences, ...codebaseContext].join('\n');

    return {
      strategies,
      mistakes,
      preferences,
      codebaseContext,
      totalEntries: entries.length,
      tokenEstimate: estimateTokens(allContent)
    };
  }

  /**
   * Generate the playbook section for agent context injection
   */
  generateContextSection(workingDirectory?: string, maxTokens: number = 4000): string {
    const entries = this.getRelevantEntries(workingDirectory, 20);
    const formatted = this.formatForContext(entries);

    if (entries.length === 0) {
      return '';
    }

    const sections: string[] = ['## PLAYBOOK (Learned Strategies)\n'];

    if (formatted.strategies.length > 0) {
      sections.push('### Strategies That Work');
      formatted.strategies.forEach((s, i) => sections.push(`${i + 1}. ${s}`));
      sections.push('');
    }

    if (formatted.mistakes.length > 0) {
      sections.push('### Patterns to Avoid');
      formatted.mistakes.forEach((m, i) => sections.push(`${i + 1}. ${m}`));
      sections.push('');
    }

    if (formatted.codebaseContext.length > 0) {
      sections.push('### Codebase-Specific Knowledge');
      formatted.codebaseContext.forEach((c, i) => sections.push(`${i + 1}. ${c}`));
      sections.push('');
    }

    let result = sections.join('\n');

    // Truncate if exceeding token budget
    while (estimateTokens(result) > maxTokens && sections.length > 2) {
      sections.pop();
      result = sections.join('\n');
    }

    return result;
  }


  // ==========================================================================
  // Score Updates and Deduplication
  // ==========================================================================

  /**
   * Update helpful/harmful score for an entry
   */
  updateEntryScore(entryId: string, helpful: boolean): void {
    this.ensureInitialized();

    const now = Date.now();
    this.stmts.updateScore.run(
      helpful ? 1 : 0,
      helpful ? 0 : 1,
      now,
      entryId
    );
  }

  /**
   * Find similar existing entry for deduplication
   */
  findSimilarEntry(content: string, entryType: PlaybookEntryType): PlaybookEntry | null {
    this.ensureInitialized();

    const candidates = this.stmts.getByType.all(entryType, 50) as PlaybookEntryRow[];

    for (const candidate of candidates) {
      if (calculateSimilarity(content, candidate.content) > CONFIG.SIMILARITY_THRESHOLD) {
        return rowToEntry(candidate);
      }
    }

    return null;
  }

  /**
   * Add entry or merge with existing similar entry
   */
  async addOrMergeEntry(entry: NewPlaybookEntry): Promise<PlaybookEntry> {
    this.ensureInitialized();

    // Security check
    if (containsForbiddenContent(entry.content)) {
      throw new Error('Playbook entries cannot contain credentials or sensitive data');
    }

    // Check for similar existing entry
    const existing = this.findSimilarEntry(entry.content, entry.entryType);

    if (existing) {
      // Merge: increment score on existing
      this.stmts.updateScore.run(
        entry.helpfulCount ?? 1,
        entry.harmfulCount ?? 0,
        Date.now(),
        existing.id
      );

      console.log(`[Playbook] Merged with existing entry ${existing.id}`);
      
      // Return updated entry
      const updated = this.stmts.getById.get(existing.id) as PlaybookEntryRow;
      return rowToEntry(updated);
    }

    // No similar entry found, create new
    return this.addEntry(entry);
  }


  // ==========================================================================
  // Maintenance Operations
  // ==========================================================================

  /**
   * Prune stale entries that haven't been helpful
   */
  pruneStaleEntries(olderThanDays: number = CONFIG.PRUNE_AFTER_DAYS): number {
    this.ensureInitialized();

    const cutoffTime = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    
    const result = this.stmts.pruneStale.run(
      CONFIG.MIN_HELPFUL_TO_KEEP,
      cutoffTime,
      cutoffTime
    );

    if (result.changes > 0) {
      console.log(`[Playbook] Pruned ${result.changes} stale entries`);
    }

    return result.changes;
  }

  /**
   * Get playbook statistics
   */
  getStats(): PlaybookStats {
    this.ensureInitialized();

    const counts = this.stmts.countByType.all() as Array<{ entry_type: string; count: number }>;
    const allEntries = this.stmts.getAll.all() as PlaybookEntryRow[];

    const stats: PlaybookStats = {
      totalEntries: allEntries.length,
      strategiesCount: 0,
      mistakesCount: 0,
      preferencesCount: 0,
      codebaseContextCount: 0,
      avgHelpfulScore: 0,
      lastUpdated: 0
    };

    for (const { entry_type, count } of counts) {
      switch (entry_type) {
        case 'strategy':
          stats.strategiesCount = count;
          break;
        case 'mistake':
          stats.mistakesCount = count;
          break;
        case 'preference':
          stats.preferencesCount = count;
          break;
        case 'codebase_context':
          stats.codebaseContextCount = count;
          break;
      }
    }

    if (allEntries.length > 0) {
      stats.avgHelpfulScore = allEntries.reduce((sum, e) => sum + e.helpful_count, 0) / allEntries.length;
      stats.lastUpdated = Math.max(...allEntries.map(e => e.last_referenced));
    }

    return stats;
  }

  /**
   * Seed playbook with initial entries (for bootstrapping)
   */
  async seedInitialEntries(): Promise<void> {
    this.ensureInitialized();

    const initialStrategies: NewPlaybookEntry[] = [
      {
        entryType: 'strategy',
        content: 'When using Desktop Commander, prefer read_file over execute_command with cat for viewing files',
        scope: 'global'
      },
      {
        entryType: 'strategy',
        content: 'Always use absolute paths for file operations to ensure reliability',
        scope: 'global'
      },
      {
        entryType: 'strategy',
        content: 'For TypeScript projects, check tsconfig.json before suggesting imports',
        scope: 'global'
      },
      {
        entryType: 'mistake',
        content: 'Never hardcode credentials, API keys, or secrets in code',
        scope: 'global'
      },
      {
        entryType: 'mistake',
        content: 'Avoid modifying files without first reading their current content',
        scope: 'global'
      }
    ];

    for (const entry of initialStrategies) {
      const existing = this.findSimilarEntry(entry.content, entry.entryType);
      if (!existing) {
        await this.addEntry(entry);
      }
    }

    console.log('[Playbook] Seeded initial entries');
  }
}


// ============================================================================
// Singleton Export
// ============================================================================

let playbookServiceInstance: PlaybookService | null = null;

export function getPlaybookService(): PlaybookService {
  if (!playbookServiceInstance) {
    playbookServiceInstance = new PlaybookService();
  }
  return playbookServiceInstance;
}
