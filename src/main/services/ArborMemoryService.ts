/**
 * Arbor Memory Service
 * 
 * Core service for the native memory system providing persistent,
 * scoped, auto-injecting memory for AI conversations.
 * 
 * Design principles:
 * - SQLite backend matching ArborChat's existing architecture
 * - Layered retrieval (always-include → global → project → conversation)
 * - Access-pattern decay for relevance maintenance
 * - Full-text search via FTS5
 * - Singleton pattern for consistent state
 * 
 * @module main/services/ArborMemoryService
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import type {
  ArborMemory,
  MemoryQuery,
  MemoryContext,
  StoreMemoryRequest,
  StoreMemoryResult,
  UpdateMemoryRequest,
  CompactionCandidate,
  DecayResult,
  MemoryStats,
  MemoryScope,
  MemoryType,
  MemorySource,
  MemoryPrivacyLevel,
  MemoryRow
} from '../../shared/types/memory';

// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // Context retrieval limits
  DEFAULT_MAX_TOKENS: 2000,
  ALWAYS_INCLUDE_LIMIT: 20,
  GLOBAL_LIMIT: 30,
  PROJECT_LIMIT: 20,
  CONVERSATION_LIMIT: 10,
  SEARCH_LIMIT: 10,
  
  // Confidence thresholds
  ALWAYS_INCLUDE_MIN_CONFIDENCE: 0.1,
  GLOBAL_MIN_CONFIDENCE: 0.5,
  PROJECT_MIN_CONFIDENCE: 0.3,
  CONVERSATION_MIN_CONFIDENCE: 0.2,
  
  // Decay settings
  DECAY_THRESHOLD_HOURS: 24,
  DELETE_THRESHOLD_DAYS: 7,
  LOW_CONFIDENCE_DELETE: 0.15,
  
  // Compaction settings
  COMPACTION_AGE_DAYS: 30,
  COMPACTION_MIN_LENGTH: 200,
  
  // Duplicate detection
  CONFIDENCE_BOOST_ON_DUPLICATE: 0.05,
  MAX_CONFIDENCE: 1.0,
  
  // Token estimation (rough: ~4 chars per token)
  CHARS_PER_TOKEN: 4
} as const;

// ============================================================================
// Schema Definition
// ============================================================================

const SCHEMA_SQL = `
-- Main memories table
CREATE TABLE IF NOT EXISTS arbor_memories (
    id TEXT PRIMARY KEY,
    
    -- Content
    content TEXT NOT NULL,
    summary TEXT,
    
    -- Classification
    type TEXT NOT NULL CHECK (type IN (
        'preference', 'fact', 'context', 'skill', 'instruction', 'relationship'
    )),
    
    -- Scoping
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN (
        'global', 'project', 'conversation'
    )),
    scope_id TEXT,
    
    -- Attribution
    source TEXT NOT NULL CHECK (source IN (
        'user_stated', 'ai_inferred', 'agent_stored', 'system'
    )),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Metadata
    tags TEXT,
    related_memories TEXT,
    
    -- Lifecycle
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    accessed_at INTEGER NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    
    -- Decay & Compaction
    decay_rate REAL NOT NULL DEFAULT 0.1,
    compacted_at INTEGER,
    expires_at INTEGER,
    
    -- Privacy
    privacy_level TEXT NOT NULL DEFAULT 'normal' CHECK (privacy_level IN (
        'always_include', 'normal', 'sensitive', 'never_share'
    ))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_memories_scope ON arbor_memories(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON arbor_memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON arbor_memories(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_confidence ON arbor_memories(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_memories_privacy ON arbor_memories(privacy_level);
CREATE INDEX IF NOT EXISTS idx_memories_created ON arbor_memories(created_at DESC);

-- Memory access log for analytics
CREATE TABLE IF NOT EXISTS memory_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT NOT NULL,
    accessed_at INTEGER NOT NULL,
    context TEXT,
    conversation_id TEXT,
    FOREIGN KEY (memory_id) REFERENCES arbor_memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_access_log_memory ON memory_access_log(memory_id);
CREATE INDEX IF NOT EXISTS idx_access_log_time ON memory_access_log(accessed_at DESC);
`;

const FTS_SCHEMA_SQL = `
-- Full-text search for content (created separately to handle upgrades)
CREATE VIRTUAL TABLE IF NOT EXISTS arbor_memories_fts USING fts5(
    content,
    summary,
    tags,
    content='arbor_memories',
    content_rowid='rowid'
);
`;

const FTS_TRIGGERS_SQL = `
-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS arbor_memories_ai AFTER INSERT ON arbor_memories BEGIN
    INSERT INTO arbor_memories_fts(rowid, content, summary, tags)
    VALUES (NEW.rowid, NEW.content, NEW.summary, NEW.tags);
END;

CREATE TRIGGER IF NOT EXISTS arbor_memories_ad AFTER DELETE ON arbor_memories BEGIN
    INSERT INTO arbor_memories_fts(arbor_memories_fts, rowid, content, summary, tags)
    VALUES ('delete', OLD.rowid, OLD.content, OLD.summary, OLD.tags);
END;

CREATE TRIGGER IF NOT EXISTS arbor_memories_au AFTER UPDATE ON arbor_memories BEGIN
    INSERT INTO arbor_memories_fts(arbor_memories_fts, rowid, content, summary, tags)
    VALUES ('delete', OLD.rowid, OLD.content, OLD.summary, OLD.tags);
    INSERT INTO arbor_memories_fts(rowid, content, summary, tags)
    VALUES (NEW.rowid, NEW.content, NEW.summary, NEW.tags);
END;
`;


// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert database row to ArborMemory object
 */
function rowToMemory(row: MemoryRow): ArborMemory {
  return {
    id: row.id,
    content: row.content,
    summary: row.summary ?? undefined,
    type: row.type as MemoryType,
    scope: row.scope as MemoryScope,
    scopeId: row.scope_id ?? undefined,
    source: row.source as MemorySource,
    confidence: row.confidence,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    relatedMemories: row.related_memories ? JSON.parse(row.related_memories) : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    accessedAt: row.accessed_at,
    accessCount: row.access_count,
    decayRate: row.decay_rate,
    compactedAt: row.compacted_at ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    privacyLevel: row.privacy_level as MemoryPrivacyLevel
  };
}

/**
 * Estimate tokens for a string (rough approximation)
 * @internal Reserved for future use in token budget calculations
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CONFIG.CHARS_PER_TOKEN);
}

// ============================================================================
// ArborMemoryService Class
// ============================================================================

/**
 * Main service class for Arbor Memory functionality.
 * Uses singleton pattern for consistent state across the application.
 */
export class ArborMemoryService {
  private db: Database.Database;
  private static instance: ArborMemoryService;

  /**
   * Private constructor - use getInstance() for access.
   * @param dbPath Optional custom database path (for testing)
   */
  private constructor(dbPath?: string) {
    const path = dbPath ?? join(app.getPath('userData'), 'arbor_memory.db');
    this.db = new Database(path);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
    console.log('[ArborMemory] Service initialized with database at:', path);
  }

  /**
   * Get singleton instance of the service.
   */
  static getInstance(): ArborMemoryService {
    if (!ArborMemoryService.instance) {
      ArborMemoryService.instance = new ArborMemoryService();
    }
    return ArborMemoryService.instance;
  }

  /**
   * Initialize database schema.
   */
  private initializeSchema(): void {
    try {
      // Main tables and indexes
      this.db.exec(SCHEMA_SQL);
      
      // FTS table (separate to handle errors gracefully)
      try {
        this.db.exec(FTS_SCHEMA_SQL);
        this.db.exec(FTS_TRIGGERS_SQL);
      } catch (ftsError) {
        console.warn('[ArborMemory] FTS setup warning (may already exist):', ftsError);
      }
      
      console.log('[ArborMemory] Schema initialized successfully');
    } catch (error) {
      console.error('[ArborMemory] Schema initialization failed:', error);
      throw error;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT RETRIEVAL (Primary method for conversation start)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get memories for injection into conversation context.
   * This is the PRIMARY method called at conversation start.
   * 
   * Layered retrieval:
   * 1. Always-include memories (privacy_level = 'always_include')
   * 2. Global high-confidence memories
   * 3. Project-scoped memories (if projectPath provided)
   * 4. Conversation-scoped memories (if conversationId provided)
   * 5. Query-relevant memories (if searchText provided)
   */
  getContextMemories(options: {
    conversationId?: string;
    projectPath?: string;
    searchText?: string;
    maxTokens?: number;
  } = {}): MemoryContext {
    const {
      conversationId,
      projectPath,
      searchText,
      maxTokens = CONFIG.DEFAULT_MAX_TOKENS
    } = options;

    const memories: ArborMemory[] = [];
    const seenIds = new Set<string>();

    try {
      // Layer 1: Always-include memories
      const alwaysInclude = this.queryMemories({
        privacyLevels: ['always_include'],
        minConfidence: CONFIG.ALWAYS_INCLUDE_MIN_CONFIDENCE,
        sortBy: 'confidence',
        sortOrder: 'desc',
        limit: CONFIG.ALWAYS_INCLUDE_LIMIT
      });
      for (const m of alwaysInclude) {
        if (!seenIds.has(m.id)) {
          memories.push(m);
          seenIds.add(m.id);
        }
      }

      // Layer 2: Global high-confidence memories
      const globalMemories = this.queryMemories({
        scope: 'global',
        minConfidence: CONFIG.GLOBAL_MIN_CONFIDENCE,
        privacyLevels: ['normal', 'sensitive'],
        sortBy: 'accessedAt',
        sortOrder: 'desc',
        limit: CONFIG.GLOBAL_LIMIT
      });
      for (const m of globalMemories) {
        if (!seenIds.has(m.id)) {
          memories.push(m);
          seenIds.add(m.id);
        }
      }

      // Layer 3: Project-scoped memories
      if (projectPath) {
        const projectMemories = this.queryMemories({
          scope: 'project',
          scopeId: projectPath,
          minConfidence: CONFIG.PROJECT_MIN_CONFIDENCE,
          sortBy: 'accessedAt',
          sortOrder: 'desc',
          limit: CONFIG.PROJECT_LIMIT
        });
        for (const m of projectMemories) {
          if (!seenIds.has(m.id)) {
            memories.push(m);
            seenIds.add(m.id);
          }
        }
      }

      // Layer 4: Conversation-scoped memories
      if (conversationId) {
        const conversationMemories = this.queryMemories({
          scope: 'conversation',
          scopeId: conversationId,
          minConfidence: CONFIG.CONVERSATION_MIN_CONFIDENCE,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: CONFIG.CONVERSATION_LIMIT
        });
        for (const m of conversationMemories) {
          if (!seenIds.has(m.id)) {
            memories.push(m);
            seenIds.add(m.id);
          }
        }
      }

      // Layer 5: Search-relevant memories
      if (searchText) {
        const searchResults = this.searchMemories(searchText, CONFIG.SEARCH_LIMIT);
        for (const m of searchResults) {
          if (!seenIds.has(m.id)) {
            memories.push(m);
            seenIds.add(m.id);
          }
        }
      }

      // Update access timestamps for retrieved memories
      if (memories.length > 0) {
        this.recordAccess(
          memories.map(m => m.id),
          'conversation_start',
          conversationId
        );
      }

      // Format for prompt injection
      const formattedPrompt = this.formatMemoriesForPrompt(memories, maxTokens);

      // Calculate stats
      const stats = this.calculateContextStats(memories);

      return {
        formattedPrompt,
        memories,
        stats,
        status: memories.length > 0 ? 'loaded' : 'empty'
      };

    } catch (error) {
      console.error('[ArborMemory] Error loading context:', error);
      return {
        formattedPrompt: '',
        memories: [],
        stats: {
          totalLoaded: 0,
          byScope: { global: 0, project: 0, conversation: 0 },
          byType: { preference: 0, fact: 0, context: 0, skill: 0, instruction: 0, relationship: 0 },
          avgConfidence: 0
        },
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // STORAGE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Store a new memory with duplicate detection.
   */
  storeMemory(request: StoreMemoryRequest): StoreMemoryResult {
    const {
      content,
      type,
      scope = 'global',
      scopeId,
      source = 'ai_inferred',
      confidence = 0.8,
      tags = [],
      privacyLevel = 'normal',
      decayRate = 0.1,
      expiresAt
    } = request;

    // Validate content
    if (!content || content.trim().length < 3) {
      return { success: false, error: 'Content must be at least 3 characters' };
    }

    if (content.length > 10000) {
      return { success: false, error: 'Content exceeds maximum length of 10000 characters' };
    }

    try {
      // Check for duplicates (simple content similarity)
      const duplicate = this.findDuplicate(content, scope, scopeId);
      if (duplicate) {
        // Update existing memory's confidence and access time
        this.updateMemoryAccess(duplicate.id);
        console.log('[ArborMemory] Duplicate detected, updated existing:', duplicate.id);
        return {
          success: true,
          duplicate: true,
          existingMemoryId: duplicate.id
        };
      }

      const now = Date.now();
      const id = randomUUID();

      const stmt = this.db.prepare(`
        INSERT INTO arbor_memories (
          id, content, type, scope, scope_id, source, confidence,
          tags, privacy_level, decay_rate, expires_at,
          created_at, updated_at, accessed_at, access_count
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, 0
        )
      `);

      stmt.run(
        id, content.trim(), type, scope, scopeId ?? null, source, confidence,
        JSON.stringify(tags), privacyLevel, decayRate, expiresAt ?? null,
        now, now, now
      );

      console.log('[ArborMemory] Stored new memory:', id, type);
      return { success: true, memoryId: id };

    } catch (error) {
      console.error('[ArborMemory] Error storing memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Find potential duplicate memory by normalized content.
   */
  private findDuplicate(
    content: string,
    scope: MemoryScope,
    scopeId?: string
  ): ArborMemory | null {
    const normalized = content.toLowerCase().trim();
    
    const stmt = this.db.prepare(`
      SELECT * FROM arbor_memories
      WHERE scope = ? AND (scope_id = ? OR (scope_id IS NULL AND ? IS NULL))
      AND LOWER(TRIM(content)) = ?
    `);

    const row = stmt.get(scope, scopeId ?? null, scopeId ?? null, normalized) as MemoryRow | undefined;
    return row ? rowToMemory(row) : null;
  }

  /**
   * Update access time and boost confidence for duplicate detection.
   */
  private updateMemoryAccess(memoryId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE arbor_memories
      SET accessed_at = ?,
          access_count = access_count + 1,
          confidence = MIN(?, confidence + ?)
      WHERE id = ?
    `);
    stmt.run(now, CONFIG.MAX_CONFIDENCE, CONFIG.CONFIDENCE_BOOST_ON_DUPLICATE, memoryId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERYING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Query memories with flexible filters.
   */
  queryMemories(query: MemoryQuery): ArborMemory[] {
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    // Scope filter
    if (query.scope) {
      conditions.push('scope = ?');
      params.push(query.scope);
    }

    // Scope ID filter
    if (query.scopeId !== undefined) {
      if (query.scopeId === null) {
        conditions.push('scope_id IS NULL');
      } else {
        conditions.push('scope_id = ?');
        params.push(query.scopeId);
      }
    }

    // Type filters
    if (query.types && query.types.length > 0) {
      conditions.push(`type IN (${query.types.map(() => '?').join(', ')})`);
      params.push(...query.types);
    }

    // Confidence threshold
    if (query.minConfidence !== undefined) {
      conditions.push('confidence >= ?');
      params.push(query.minConfidence);
    }

    // Privacy level filters
    if (query.privacyLevels && query.privacyLevels.length > 0) {
      conditions.push(`privacy_level IN (${query.privacyLevels.map(() => '?').join(', ')})`);
      params.push(...query.privacyLevels);
    }

    // Exclude never_share by default unless explicitly requested
    if (!query.privacyLevels) {
      conditions.push("privacy_level != 'never_share'");
    }

    // Tag filters (JSON array contains check)
    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      params.push(...query.tags.map(t => `%"${t}"%`));
    }

    // Sort configuration
    const sortColumn: Record<string, string> = {
      confidence: 'confidence',
      accessedAt: 'accessed_at',
      createdAt: 'created_at',
      accessCount: 'access_count'
    };
    const sortBy = query.sortBy ? sortColumn[query.sortBy] : 'accessed_at';
    const sortOrder = (query.sortOrder || 'desc').toUpperCase();

    // Pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const sql = `
      SELECT * FROM arbor_memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    try {
      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as MemoryRow[];
      return rows.map(rowToMemory);
    } catch (error) {
      console.error('[ArborMemory] Query error:', error);
      return [];
    }
  }

  /**
   * Full-text search across memory content.
   */
  searchMemories(searchText: string, limit: number = 20): ArborMemory[] {
    if (!searchText || searchText.trim().length < 2) {
      return [];
    }

    try {
      // Try FTS5 search first
      const ftsStmt = this.db.prepare(`
        SELECT m.* FROM arbor_memories m
        JOIN arbor_memories_fts fts ON m.rowid = fts.rowid
        WHERE arbor_memories_fts MATCH ?
        AND m.privacy_level != 'never_share'
        ORDER BY rank
        LIMIT ?
      `);

      const rows = ftsStmt.all(searchText, limit) as MemoryRow[];
      return rows.map(rowToMemory);

    } catch (ftsError) {
      // Fallback to LIKE search if FTS fails
      console.warn('[ArborMemory] FTS search failed, using LIKE fallback:', ftsError);
      
      const likeStmt = this.db.prepare(`
        SELECT * FROM arbor_memories
        WHERE (content LIKE ? OR summary LIKE ?)
        AND privacy_level != 'never_share'
        ORDER BY accessed_at DESC
        LIMIT ?
      `);

      const pattern = `%${searchText}%`;
      const rows = likeStmt.all(pattern, pattern, limit) as MemoryRow[];
      return rows.map(rowToMemory);
    }
  }


  // ─────────────────────────────────────────────────────────────────────────
  // CRUD OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get a single memory by ID.
   */
  getMemory(id: string): ArborMemory | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM arbor_memories WHERE id = ?');
      const row = stmt.get(id) as MemoryRow | undefined;
      return row ? rowToMemory(row) : null;
    } catch (error) {
      console.error('[ArborMemory] Error getting memory:', error);
      return null;
    }
  }

  /**
   * Update an existing memory.
   */
  updateMemory(request: UpdateMemoryRequest): boolean {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (request.content !== undefined) {
      updates.push('content = ?');
      params.push(request.content.trim());
    }
    if (request.type !== undefined) {
      updates.push('type = ?');
      params.push(request.type);
    }
    if (request.scope !== undefined) {
      updates.push('scope = ?');
      params.push(request.scope);
    }
    if (request.scopeId !== undefined) {
      updates.push('scope_id = ?');
      params.push(request.scopeId ?? null);
    }
    if (request.confidence !== undefined) {
      updates.push('confidence = ?');
      params.push(Math.max(0, Math.min(1, request.confidence)));
    }
    if (request.tags !== undefined) {
      updates.push('tags = ?');
      params.push(JSON.stringify(request.tags));
    }
    if (request.privacyLevel !== undefined) {
      updates.push('privacy_level = ?');
      params.push(request.privacyLevel);
    }
    if (request.summary !== undefined) {
      updates.push('summary = ?');
      params.push(request.summary);
    }

    if (updates.length === 0) {
      return false;
    }

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(request.id);

    try {
      const stmt = this.db.prepare(`
        UPDATE arbor_memories
        SET ${updates.join(', ')}
        WHERE id = ?
      `);

      const result = stmt.run(...params);
      return result.changes > 0;
    } catch (error) {
      console.error('[ArborMemory] Error updating memory:', error);
      return false;
    }
  }

  /**
   * Delete a memory by ID.
   */
  deleteMemory(id: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM arbor_memories WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('[ArborMemory] Error deleting memory:', error);
      return false;
    }
  }

  /**
   * Delete all memories from the database.
   * Returns the number of memories deleted.
   */
  clearAll(): { success: boolean; deleted: number; error?: string } {
    try {
      // First get the count for reporting
      const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM arbor_memories');
      const countResult = countStmt.get() as { count: number };
      const totalCount = countResult.count;

      // Delete all memories
      const deleteStmt = this.db.prepare('DELETE FROM arbor_memories');
      deleteStmt.run();

      // Also clear the access log
      const clearLogStmt = this.db.prepare('DELETE FROM memory_access_log');
      clearLogStmt.run();

      console.log(`[ArborMemory] Cleared all ${totalCount} memories`);
      return { success: true, deleted: totalCount };
    } catch (error) {
      console.error('[ArborMemory] Error clearing all memories:', error);
      return { 
        success: false, 
        deleted: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FORMATTING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Format memories for system prompt injection.
   */
  private formatMemoriesForPrompt(memories: ArborMemory[], maxTokens: number): string {
    if (memories.length === 0) return '';

    const maxChars = maxTokens * CONFIG.CHARS_PER_TOKEN;
    const grouped = this.groupMemoriesByType(memories);

    const sections: string[] = [];
    let currentLength = 0;

    // Priority order for types (most important first)
    const typeOrder: MemoryType[] = [
      'instruction',
      'preference',
      'fact',
      'skill',
      'context',
      'relationship'
    ];

    const typeHeaders: Record<MemoryType, string> = {
      instruction: '**Standing Instructions:**',
      preference: '**User Preferences:**',
      fact: '**Known Facts:**',
      skill: '**User Skills:**',
      context: '**Current Context:**',
      relationship: '**Relationships:**'
    };

    for (const type of typeOrder) {
      const typeMemories = grouped[type] || [];
      if (typeMemories.length === 0) continue;

      const header = typeHeaders[type];
      const items = typeMemories
        .sort((a, b) => b.confidence - a.confidence)
        .map(m => `- ${m.summary || m.content}`);

      const section = `${header}\n${items.join('\n')}`;

      if (currentLength + section.length > maxChars) {
        // Truncate this section to fit
        const remaining = maxChars - currentLength - header.length - 10;
        if (remaining > 50) {
          const truncatedItems: string[] = [];
          let itemLength = 0;
          for (const item of items) {
            if (itemLength + item.length > remaining) break;
            truncatedItems.push(item);
            itemLength += item.length + 1;
          }
          if (truncatedItems.length > 0) {
            sections.push(`${header}\n${truncatedItems.join('\n')}`);
          }
        }
        break;
      }

      sections.push(section);
      currentLength += section.length + 2;
    }

    if (sections.length === 0) return '';

    return `<user_context>
The following is contextual information about the user from previous conversations:

${sections.join('\n\n')}
</user_context>`;
  }

  /**
   * Group memories by type for formatted output.
   */
  private groupMemoriesByType(memories: ArborMemory[]): Record<MemoryType, ArborMemory[]> {
    const grouped: Record<MemoryType, ArborMemory[]> = {
      preference: [],
      fact: [],
      context: [],
      skill: [],
      instruction: [],
      relationship: []
    };

    for (const memory of memories) {
      grouped[memory.type].push(memory);
    }

    return grouped;
  }

  /**
   * Calculate statistics for context retrieval.
   */
  private calculateContextStats(memories: ArborMemory[]): MemoryContext['stats'] {
    const byScope: Record<MemoryScope, number> = { global: 0, project: 0, conversation: 0 };
    const byType: Record<MemoryType, number> = {
      preference: 0, fact: 0, context: 0, skill: 0, instruction: 0, relationship: 0
    };

    let totalConfidence = 0;

    for (const m of memories) {
      byScope[m.scope]++;
      byType[m.type]++;
      totalConfidence += m.confidence;
    }

    return {
      totalLoaded: memories.length,
      byScope,
      byType,
      avgConfidence: memories.length > 0 ? totalConfidence / memories.length : 0
    };
  }


  // ─────────────────────────────────────────────────────────────────────────
  // DECAY & COMPACTION
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Run decay on memories not accessed recently.
   * Should be called periodically (e.g., daily via scheduler).
   */
  runDecay(): DecayResult {
    const now = Date.now();
    const decayThreshold = now - CONFIG.DECAY_THRESHOLD_HOURS * 60 * 60 * 1000;
    const deleteThreshold = now - CONFIG.DELETE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    try {
      // Decay confidence for unaccessed memories
      const decayStmt = this.db.prepare(`
        UPDATE arbor_memories
        SET confidence = MAX(0, confidence - (decay_rate * 0.01)),
            updated_at = ?
        WHERE accessed_at < ?
        AND privacy_level NOT IN ('always_include', 'sensitive')
      `);

      const decayResult = decayStmt.run(now, decayThreshold);

      // Delete very low confidence, old memories
      const deleteStmt = this.db.prepare(`
        DELETE FROM arbor_memories
        WHERE confidence < ?
        AND accessed_at < ?
        AND privacy_level NOT IN ('always_include', 'sensitive')
      `);

      const deleteResult = deleteStmt.run(CONFIG.LOW_CONFIDENCE_DELETE, deleteThreshold);

      console.log(`[ArborMemory] Decay complete: ${decayResult.changes} updated, ${deleteResult.changes} deleted`);

      return {
        updated: decayResult.changes,
        deleted: deleteResult.changes
      };
    } catch (error) {
      console.error('[ArborMemory] Decay error:', error);
      return { updated: 0, deleted: 0 };
    }
  }

  /**
   * Get memories that are candidates for AI-driven compaction/summarization.
   */
  getCompactionCandidates(limit: number = 20): CompactionCandidate[] {
    const now = Date.now();
    const ageThreshold = now - CONFIG.COMPACTION_AGE_DAYS * 24 * 60 * 60 * 1000;

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM arbor_memories
        WHERE compacted_at IS NULL
        AND created_at < ?
        AND LENGTH(content) > ?
        AND type IN ('context', 'fact')
        ORDER BY accessed_at ASC
        LIMIT ?
      `);

      const rows = stmt.all(ageThreshold, CONFIG.COMPACTION_MIN_LENGTH, limit) as MemoryRow[];

      return rows.map(row => ({
        memory: rowToMemory(row),
        reason: 'age' as const,
        suggestedAction: 'summarize' as const
      }));
    } catch (error) {
      console.error('[ArborMemory] Error getting compaction candidates:', error);
      return [];
    }
  }

  /**
   * Apply compaction (AI-generated summary) to a memory.
   */
  applyCompaction(memoryId: string, summary: string): boolean {
    const now = Date.now();

    try {
      const stmt = this.db.prepare(`
        UPDATE arbor_memories
        SET summary = ?,
            compacted_at = ?,
            updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(summary.trim(), now, now, memoryId);
      return result.changes > 0;
    } catch (error) {
      console.error('[ArborMemory] Error applying compaction:', error);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ACCESS TRACKING
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Record access for multiple memories.
   */
  private recordAccess(
    memoryIds: string[],
    context: string,
    conversationId?: string
  ): void {
    if (memoryIds.length === 0) return;

    const now = Date.now();

    try {
      const updateStmt = this.db.prepare(`
        UPDATE arbor_memories
        SET accessed_at = ?,
            access_count = access_count + 1
        WHERE id = ?
      `);

      const logStmt = this.db.prepare(`
        INSERT INTO memory_access_log (memory_id, accessed_at, context, conversation_id)
        VALUES (?, ?, ?, ?)
      `);

      const updateMany = this.db.transaction((ids: string[]) => {
        for (const id of ids) {
          updateStmt.run(now, id);
          logStmt.run(id, now, context, conversationId ?? null);
        }
      });

      updateMany(memoryIds);
    } catch (error) {
      console.error('[ArborMemory] Error recording access:', error);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STATISTICS
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get comprehensive memory statistics.
   */
  getStats(): MemoryStats {
    try {
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN scope = 'global' THEN 1 ELSE 0 END) as global_count,
          SUM(CASE WHEN scope = 'project' THEN 1 ELSE 0 END) as project_count,
          SUM(CASE WHEN scope = 'conversation' THEN 1 ELSE 0 END) as conversation_count,
          SUM(CASE WHEN type = 'preference' THEN 1 ELSE 0 END) as preference_count,
          SUM(CASE WHEN type = 'fact' THEN 1 ELSE 0 END) as fact_count,
          SUM(CASE WHEN type = 'context' THEN 1 ELSE 0 END) as context_count,
          SUM(CASE WHEN type = 'skill' THEN 1 ELSE 0 END) as skill_count,
          SUM(CASE WHEN type = 'instruction' THEN 1 ELSE 0 END) as instruction_count,
          SUM(CASE WHEN type = 'relationship' THEN 1 ELSE 0 END) as relationship_count,
          SUM(CASE WHEN source = 'user_stated' THEN 1 ELSE 0 END) as user_stated_count,
          SUM(CASE WHEN source = 'ai_inferred' THEN 1 ELSE 0 END) as ai_inferred_count,
          SUM(CASE WHEN source = 'agent_stored' THEN 1 ELSE 0 END) as agent_stored_count,
          SUM(CASE WHEN source = 'system' THEN 1 ELSE 0 END) as system_count,
          AVG(confidence) as avg_confidence,
          MIN(created_at) as oldest,
          MAX(created_at) as newest,
          SUM(access_count) as total_access,
          SUM(CASE WHEN compacted_at IS NOT NULL THEN 1 ELSE 0 END) as compacted_count
        FROM arbor_memories
      `);

      const row = stmt.get() as Record<string, number | null>;

      return {
        totalMemories: row.total || 0,
        byScope: {
          global: row.global_count || 0,
          project: row.project_count || 0,
          conversation: row.conversation_count || 0
        },
        byType: {
          preference: row.preference_count || 0,
          fact: row.fact_count || 0,
          context: row.context_count || 0,
          skill: row.skill_count || 0,
          instruction: row.instruction_count || 0,
          relationship: row.relationship_count || 0
        },
        bySource: {
          user_stated: row.user_stated_count || 0,
          ai_inferred: row.ai_inferred_count || 0,
          agent_stored: row.agent_stored_count || 0,
          system: row.system_count || 0
        },
        avgConfidence: row.avg_confidence || 0,
        oldestMemory: row.oldest || 0,
        newestMemory: row.newest || 0,
        totalAccessCount: row.total_access || 0,
        compactedCount: row.compacted_count || 0
      };
    } catch (error) {
      console.error('[ArborMemory] Error getting stats:', error);
      return {
        totalMemories: 0,
        byScope: { global: 0, project: 0, conversation: 0 },
        byType: { preference: 0, fact: 0, context: 0, skill: 0, instruction: 0, relationship: 0 },
        bySource: { user_stated: 0, ai_inferred: 0, agent_stored: 0, system: 0 },
        avgConfidence: 0,
        oldestMemory: 0,
        newestMemory: 0,
        totalAccessCount: 0,
        compactedCount: 0
      };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // LIFECYCLE
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Close the database connection.
   */
  close(): void {
    try {
      this.db.close();
      console.log('[ArborMemory] Database connection closed');
    } catch (error) {
      console.error('[ArborMemory] Error closing database:', error);
    }
  }
}
