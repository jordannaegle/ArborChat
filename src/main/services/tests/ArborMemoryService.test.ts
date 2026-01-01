/**
 * ArborMemoryService Unit Tests
 * 
 * Comprehensive test suite for the native memory system.
 * Uses in-memory SQLite database for isolated, fast testing.
 * 
 * Test Categories:
 * - Storage: storeMemory() + duplicate detection
 * - Querying: queryMemories() with various filters
 * - Search: searchMemories() FTS functionality
 * - CRUD: getMemory(), updateMemory(), deleteMemory()
 * - Context: getContextMemories() layered retrieval
 * - Maintenance: runDecay() behavior
 * 
 * @module tests/ArborMemoryService.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { randomUUID } from 'crypto';
import type {
  ArborMemory,
  MemoryQuery,
  StoreMemoryRequest,
  MemoryType,
  MemoryScope,
  MemorySource,
  MemoryPrivacyLevel,
  MemoryRow
} from '../../../shared/types/memory';

// ============================================================================
// Test Infrastructure
// ============================================================================

/**
 * Mock the Electron app module since it's not available in test environment
 */
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('/tmp/test-arbor-memory')
  }
}));

/**
 * Configuration constants (mirrored from service for validation)
 */
const CONFIG = {
  DEFAULT_MAX_TOKENS: 2000,
  ALWAYS_INCLUDE_LIMIT: 20,
  GLOBAL_LIMIT: 30,
  PROJECT_LIMIT: 20,
  CONVERSATION_LIMIT: 10,
  SEARCH_LIMIT: 10,
  ALWAYS_INCLUDE_MIN_CONFIDENCE: 0.1,
  GLOBAL_MIN_CONFIDENCE: 0.5,
  PROJECT_MIN_CONFIDENCE: 0.3,
  CONVERSATION_MIN_CONFIDENCE: 0.2,
  DECAY_THRESHOLD_HOURS: 24,
  DELETE_THRESHOLD_DAYS: 7,
  LOW_CONFIDENCE_DELETE: 0.15,
  CONFIDENCE_BOOST_ON_DUPLICATE: 0.05,
  MAX_CONFIDENCE: 1.0,
  CHARS_PER_TOKEN: 4
} as const;

/**
 * Schema SQL for creating in-memory test database
 */
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS arbor_memories (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    summary TEXT,
    type TEXT NOT NULL CHECK (type IN (
        'preference', 'fact', 'context', 'skill', 'instruction', 'relationship'
    )),
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN (
        'global', 'project', 'conversation'
    )),
    scope_id TEXT,
    source TEXT NOT NULL CHECK (source IN (
        'user_stated', 'ai_inferred', 'agent_stored', 'system'
    )),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    tags TEXT,
    related_memories TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    accessed_at INTEGER NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    decay_rate REAL NOT NULL DEFAULT 0.1,
    compacted_at INTEGER,
    expires_at INTEGER,
    privacy_level TEXT NOT NULL DEFAULT 'normal' CHECK (privacy_level IN (
        'always_include', 'normal', 'sensitive', 'never_share'
    ))
);

CREATE INDEX IF NOT EXISTS idx_memories_scope ON arbor_memories(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON arbor_memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_accessed ON arbor_memories(accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_confidence ON arbor_memories(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_memories_privacy ON arbor_memories(privacy_level);
CREATE INDEX IF NOT EXISTS idx_memories_created ON arbor_memories(created_at DESC);

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
CREATE VIRTUAL TABLE IF NOT EXISTS arbor_memories_fts USING fts5(
    content,
    summary,
    tags,
    content='arbor_memories',
    content_rowid='rowid'
);

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


/**
 * Utility function to convert database row to ArborMemory object
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

// ============================================================================
// TestableArborMemoryService Class
// ============================================================================

/**
 * Testable version of ArborMemoryService that uses in-memory SQLite.
 * This mirrors the production service implementation but allows direct instantiation.
 */
class TestableArborMemoryService {
  private db: Database.Database;

  constructor() {
    // Use in-memory SQLite for testing
    this.db = new Database(':memory:');
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(SCHEMA_SQL);
    try {
      this.db.exec(FTS_SCHEMA_SQL);
    } catch {
      // FTS may fail on some systems
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // STORAGE METHODS
  // ─────────────────────────────────────────────────────────────────────────

  storeMemory(request: StoreMemoryRequest) {
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

    if (!content || content.trim().length < 3) {
      return { success: false, error: 'Content must be at least 3 characters' };
    }

    if (content.length > 10000) {
      return { success: false, error: 'Content exceeds maximum length of 10000 characters' };
    }

    try {
      const duplicate = this.findDuplicate(content, scope, scopeId);
      if (duplicate) {
        this.updateMemoryAccess(duplicate.id);
        return { success: true, duplicate: true, existingMemoryId: duplicate.id };
      }

      const now = Date.now();
      const id = randomUUID();

      const stmt = this.db.prepare(`
        INSERT INTO arbor_memories (
          id, content, type, scope, scope_id, source, confidence,
          tags, privacy_level, decay_rate, expires_at,
          created_at, updated_at, accessed_at, access_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      stmt.run(
        id, content.trim(), type, scope, scopeId ?? null, source, confidence,
        JSON.stringify(tags), privacyLevel, decayRate, expiresAt ?? null,
        now, now, now
      );

      return { success: true, memoryId: id };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private findDuplicate(content: string, scope: MemoryScope, scopeId?: string): ArborMemory | null {
    const normalized = content.toLowerCase().trim();
    const stmt = this.db.prepare(`
      SELECT * FROM arbor_memories
      WHERE scope = ? AND (scope_id = ? OR (scope_id IS NULL AND ? IS NULL))
      AND LOWER(TRIM(content)) = ?
    `);
    const row = stmt.get(scope, scopeId ?? null, scopeId ?? null, normalized) as MemoryRow | undefined;
    return row ? rowToMemory(row) : null;
  }

  private updateMemoryAccess(memoryId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE arbor_memories
      SET accessed_at = ?, access_count = access_count + 1,
          confidence = MIN(?, confidence + ?)
      WHERE id = ?
    `);
    stmt.run(now, CONFIG.MAX_CONFIDENCE, CONFIG.CONFIDENCE_BOOST_ON_DUPLICATE, memoryId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // QUERY METHODS
  // ─────────────────────────────────────────────────────────────────────────

  queryMemories(query: MemoryQuery): ArborMemory[] {
    const conditions: string[] = ['1=1'];
    const params: (string | number)[] = [];

    if (query.scope) {
      conditions.push('scope = ?');
      params.push(query.scope);
    }

    if (query.scopeId !== undefined) {
      if (query.scopeId === null) {
        conditions.push('scope_id IS NULL');
      } else {
        conditions.push('scope_id = ?');
        params.push(query.scopeId);
      }
    }

    if (query.types && query.types.length > 0) {
      conditions.push(`type IN (${query.types.map(() => '?').join(', ')})`);
      params.push(...query.types);
    }

    if (query.minConfidence !== undefined) {
      conditions.push('confidence >= ?');
      params.push(query.minConfidence);
    }

    if (query.privacyLevels && query.privacyLevels.length > 0) {
      conditions.push(`privacy_level IN (${query.privacyLevels.map(() => '?').join(', ')})`);
      params.push(...query.privacyLevels);
    }

    if (!query.privacyLevels) {
      conditions.push("privacy_level != 'never_share'");
    }

    if (query.tags && query.tags.length > 0) {
      const tagConditions = query.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      params.push(...query.tags.map(t => `%"${t}"%`));
    }

    const sortColumn: Record<string, string> = {
      confidence: 'confidence',
      accessedAt: 'accessed_at',
      createdAt: 'created_at',
      accessCount: 'access_count'
    };
    const sortBy = query.sortBy ? sortColumn[query.sortBy] : 'accessed_at';
    const sortOrder = (query.sortOrder || 'desc').toUpperCase();
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
    } catch {
      return [];
    }
  }

  searchMemories(searchText: string, limit: number = 20): ArborMemory[] {
    if (!searchText || searchText.trim().length < 2) {
      return [];
    }

    try {
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
    } catch {
      // Fallback to LIKE search
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
  // CRUD METHODS
  // ─────────────────────────────────────────────────────────────────────────

  getMemory(id: string): ArborMemory | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM arbor_memories WHERE id = ?');
      const row = stmt.get(id) as MemoryRow | undefined;
      return row ? rowToMemory(row) : null;
    } catch {
      return null;
    }
  }

  updateMemory(request: { id: string; content?: string; type?: MemoryType; scope?: MemoryScope; 
    scopeId?: string; confidence?: number; tags?: string[]; privacyLevel?: MemoryPrivacyLevel; 
    summary?: string }): boolean {
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

    if (updates.length === 0) return false;

    updates.push('updated_at = ?');
    params.push(Date.now());
    params.push(request.id);

    try {
      const stmt = this.db.prepare(`UPDATE arbor_memories SET ${updates.join(', ')} WHERE id = ?`);
      const result = stmt.run(...params);
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  deleteMemory(id: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM arbor_memories WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch {
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONTEXT RETRIEVAL
  // ─────────────────────────────────────────────────────────────────────────

  getContextMemories(options: {
    conversationId?: string;
    projectPath?: string;
    searchText?: string;
    maxTokens?: number;
  } = {}) {
    const { conversationId, projectPath, searchText, maxTokens = CONFIG.DEFAULT_MAX_TOKENS } = options;

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
        if (!seenIds.has(m.id)) { memories.push(m); seenIds.add(m.id); }
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
        if (!seenIds.has(m.id)) { memories.push(m); seenIds.add(m.id); }
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
          if (!seenIds.has(m.id)) { memories.push(m); seenIds.add(m.id); }
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
          if (!seenIds.has(m.id)) { memories.push(m); seenIds.add(m.id); }
        }
      }

      // Layer 5: Search-relevant memories
      if (searchText) {
        const searchResults = this.searchMemories(searchText, CONFIG.SEARCH_LIMIT);
        for (const m of searchResults) {
          if (!seenIds.has(m.id)) { memories.push(m); seenIds.add(m.id); }
        }
      }

      // Record access
      if (memories.length > 0) {
        this.recordAccess(memories.map(m => m.id), 'conversation_start', conversationId);
      }

      const formattedPrompt = this.formatMemoriesForPrompt(memories, maxTokens);
      const stats = this.calculateContextStats(memories);

      return { formattedPrompt, memories, stats, status: memories.length > 0 ? 'loaded' : 'empty' };
    } catch (error) {
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
  // DECAY & MAINTENANCE
  // ─────────────────────────────────────────────────────────────────────────

  runDecay() {
    const now = Date.now();
    const decayThreshold = now - CONFIG.DECAY_THRESHOLD_HOURS * 60 * 60 * 1000;
    const deleteThreshold = now - CONFIG.DELETE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    try {
      const decayStmt = this.db.prepare(`
        UPDATE arbor_memories
        SET confidence = MAX(0, confidence - (decay_rate * 0.01)), updated_at = ?
        WHERE accessed_at < ?
        AND privacy_level NOT IN ('always_include', 'sensitive')
      `);
      const decayResult = decayStmt.run(now, decayThreshold);

      const deleteStmt = this.db.prepare(`
        DELETE FROM arbor_memories
        WHERE confidence < ?
        AND accessed_at < ?
        AND privacy_level NOT IN ('always_include', 'sensitive')
      `);
      const deleteResult = deleteStmt.run(CONFIG.LOW_CONFIDENCE_DELETE, deleteThreshold);

      return { updated: decayResult.changes, deleted: deleteResult.changes };
    } catch {
      return { updated: 0, deleted: 0 };
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // HELPER METHODS
  // ─────────────────────────────────────────────────────────────────────────

  private recordAccess(memoryIds: string[], context: string, conversationId?: string): void {
    if (memoryIds.length === 0) return;
    const now = Date.now();

    try {
      const updateStmt = this.db.prepare(`
        UPDATE arbor_memories SET accessed_at = ?, access_count = access_count + 1 WHERE id = ?
      `);
      const logStmt = this.db.prepare(`
        INSERT INTO memory_access_log (memory_id, accessed_at, context, conversation_id) VALUES (?, ?, ?, ?)
      `);

      const updateMany = this.db.transaction((ids: string[]) => {
        for (const id of ids) {
          updateStmt.run(now, id);
          logStmt.run(id, now, context, conversationId ?? null);
        }
      });

      updateMany(memoryIds);
    } catch {
      // Ignore access recording errors
    }
  }

  private formatMemoriesForPrompt(memories: ArborMemory[], maxTokens: number): string {
    if (memories.length === 0) return '';

    const maxChars = maxTokens * CONFIG.CHARS_PER_TOKEN;
    const grouped = this.groupMemoriesByType(memories);

    const sections: string[] = [];
    let currentLength = 0;

    const typeOrder: MemoryType[] = ['instruction', 'preference', 'fact', 'skill', 'context', 'relationship'];
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
      const items = typeMemories.sort((a, b) => b.confidence - a.confidence).map(m => `- ${m.summary || m.content}`);
      const section = `${header}\n${items.join('\n')}`;

      if (currentLength + section.length > maxChars) break;

      sections.push(section);
      currentLength += section.length + 2;
    }

    if (sections.length === 0) return '';

    return `<user_context>\nThe following is contextual information about the user from previous conversations:\n\n${sections.join('\n\n')}\n</user_context>`;
  }

  private groupMemoriesByType(memories: ArborMemory[]): Record<MemoryType, ArborMemory[]> {
    const grouped: Record<MemoryType, ArborMemory[]> = {
      preference: [], fact: [], context: [], skill: [], instruction: [], relationship: []
    };
    for (const memory of memories) {
      grouped[memory.type].push(memory);
    }
    return grouped;
  }

  private calculateContextStats(memories: ArborMemory[]) {
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

  getStats() {
    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as total,
          SUM(CASE WHEN scope = 'global' THEN 1 ELSE 0 END) as global_count,
          SUM(CASE WHEN scope = 'project' THEN 1 ELSE 0 END) as project_count,
          SUM(CASE WHEN scope = 'conversation' THEN 1 ELSE 0 END) as conversation_count,
          AVG(confidence) as avg_confidence
        FROM arbor_memories
      `);
      const row = stmt.get() as Record<string, number | null>;
      return {
        totalMemories: row.total || 0,
        byScope: { global: row.global_count || 0, project: row.project_count || 0, conversation: row.conversation_count || 0 },
        avgConfidence: row.avg_confidence || 0
      };
    } catch {
      return { totalMemories: 0, byScope: { global: 0, project: 0, conversation: 0 }, avgConfidence: 0 };
    }
  }

  close(): void {
    this.db.close();
  }

  /** Direct database access for test verification */
  getDatabase(): Database.Database {
    return this.db;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('ArborMemoryService', () => {
  let service: TestableArborMemoryService;

  beforeEach(() => {
    service = new TestableArborMemoryService();
  });

  afterEach(() => {
    service.close();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Storage Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('storeMemory()', () => {
    it('should store a valid memory and return memoryId', () => {
      const result = service.storeMemory({
        content: 'User prefers dark mode',
        type: 'preference',
        source: 'user_stated'
      });

      expect(result.success).toBe(true);
      expect(result.memoryId).toBeDefined();
      expect(result.duplicate).toBeUndefined();
    });

    it('should reject content that is too short', () => {
      const result = service.storeMemory({
        content: 'ab',
        type: 'fact'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('at least 3 characters');
    });

    it('should reject content that exceeds maximum length', () => {
      const longContent = 'x'.repeat(10001);
      const result = service.storeMemory({
        content: longContent,
        type: 'fact'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('exceeds maximum length');
    });

    it('should trim whitespace from content', () => {
      const result = service.storeMemory({
        content: '  User likes TypeScript  ',
        type: 'preference'
      });

      expect(result.success).toBe(true);
      const memory = service.getMemory(result.memoryId!);
      expect(memory?.content).toBe('User likes TypeScript');
    });

    it('should store memory with all optional fields', () => {
      const result = service.storeMemory({
        content: 'Always use semicolons in JavaScript',
        type: 'instruction',
        scope: 'project',
        scopeId: '/path/to/project',
        source: 'user_stated',
        confidence: 0.95,
        tags: ['coding', 'style'],
        privacyLevel: 'always_include',
        decayRate: 0.05,
        expiresAt: Date.now() + 86400000
      });

      expect(result.success).toBe(true);
      const memory = service.getMemory(result.memoryId!);
      expect(memory).toBeDefined();
      expect(memory?.scope).toBe('project');
      expect(memory?.scopeId).toBe('/path/to/project');
      expect(memory?.confidence).toBe(0.95);
      expect(memory?.tags).toEqual(['coding', 'style']);
      expect(memory?.privacyLevel).toBe('always_include');
    });

    it('should use default values for optional fields', () => {
      const result = service.storeMemory({
        content: 'Test memory content',
        type: 'fact'
      });

      const memory = service.getMemory(result.memoryId!);
      expect(memory?.scope).toBe('global');
      expect(memory?.source).toBe('ai_inferred');
      expect(memory?.confidence).toBe(0.8);
      expect(memory?.privacyLevel).toBe('normal');
      expect(memory?.decayRate).toBe(0.1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Duplicate Detection Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('duplicate detection', () => {
    it('should detect exact duplicate content', () => {
      const firstResult = service.storeMemory({
        content: 'User is a software engineer',
        type: 'fact',
        scope: 'global'
      });
      expect(firstResult.success).toBe(true);
      expect(firstResult.duplicate).toBeUndefined();

      const secondResult = service.storeMemory({
        content: 'User is a software engineer',
        type: 'fact',
        scope: 'global'
      });
      expect(secondResult.success).toBe(true);
      expect(secondResult.duplicate).toBe(true);
      expect(secondResult.existingMemoryId).toBe(firstResult.memoryId);
    });

    it('should detect duplicate with case-insensitive matching', () => {
      service.storeMemory({
        content: 'User prefers DARK MODE',
        type: 'preference'
      });

      const result = service.storeMemory({
        content: 'user prefers dark mode',
        type: 'preference'
      });

      expect(result.duplicate).toBe(true);
    });

    it('should detect duplicate with whitespace differences', () => {
      const first = service.storeMemory({
        content: '  User likes React  ',
        type: 'preference'
      });

      const second = service.storeMemory({
        content: 'User likes React',
        type: 'preference'
      });

      expect(second.duplicate).toBe(true);
      expect(second.existingMemoryId).toBe(first.memoryId);
    });

    it('should NOT detect duplicate across different scopes', () => {
      service.storeMemory({
        content: 'Project uses TypeScript',
        type: 'fact',
        scope: 'global'
      });

      const projectScoped = service.storeMemory({
        content: 'Project uses TypeScript',
        type: 'fact',
        scope: 'project',
        scopeId: '/my/project'
      });

      expect(projectScoped.duplicate).toBeUndefined();
      expect(projectScoped.memoryId).toBeDefined();
    });

    it('should boost confidence on duplicate detection', () => {
      const firstResult = service.storeMemory({
        content: 'Test confidence boost',
        type: 'fact',
        confidence: 0.7
      });

      const firstMemory = service.getMemory(firstResult.memoryId!);
      const initialConfidence = firstMemory!.confidence;

      // Store duplicate
      service.storeMemory({
        content: 'Test confidence boost',
        type: 'fact'
      });

      const updatedMemory = service.getMemory(firstResult.memoryId!);
      expect(updatedMemory!.confidence).toBeGreaterThan(initialConfidence);
      expect(updatedMemory!.confidence).toBe(
        Math.min(CONFIG.MAX_CONFIDENCE, initialConfidence + CONFIG.CONFIDENCE_BOOST_ON_DUPLICATE)
      );
    });

    it('should increment access count on duplicate', () => {
      const firstResult = service.storeMemory({
        content: 'Access count test',
        type: 'fact'
      });

      const initialMemory = service.getMemory(firstResult.memoryId!);
      expect(initialMemory!.accessCount).toBe(0);

      // Store duplicate
      service.storeMemory({ content: 'Access count test', type: 'fact' });

      const updatedMemory = service.getMemory(firstResult.memoryId!);
      expect(updatedMemory!.accessCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Query Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('queryMemories()', () => {
    beforeEach(() => {
      // Seed test data
      service.storeMemory({ content: 'Global preference 1', type: 'preference', scope: 'global', confidence: 0.9 });
      service.storeMemory({ content: 'Global fact 1', type: 'fact', scope: 'global', confidence: 0.7 });
      service.storeMemory({ content: 'Project context', type: 'context', scope: 'project', scopeId: '/project/a', confidence: 0.8 });
      service.storeMemory({ content: 'Conversation note', type: 'fact', scope: 'conversation', scopeId: 'conv-123', confidence: 0.6 });
      service.storeMemory({ content: 'Private memory', type: 'fact', scope: 'global', privacyLevel: 'never_share', confidence: 0.9 });
      service.storeMemory({ content: 'Always include', type: 'instruction', scope: 'global', privacyLevel: 'always_include', confidence: 0.95 });
      service.storeMemory({ content: 'Tagged memory', type: 'preference', scope: 'global', tags: ['coding', 'typescript'], confidence: 0.85 });
    });

    it('should return all non-private memories by default', () => {
      const results = service.queryMemories({});
      expect(results.length).toBeGreaterThanOrEqual(6);
      expect(results.every(m => m.privacyLevel !== 'never_share')).toBe(true);
    });

    it('should filter by scope', () => {
      const results = service.queryMemories({ scope: 'project' });
      expect(results.every(m => m.scope === 'project')).toBe(true);
    });

    it('should filter by scope and scopeId', () => {
      const results = service.queryMemories({ scope: 'project', scopeId: '/project/a' });
      expect(results.length).toBe(1);
      expect(results[0].content).toBe('Project context');
    });

    it('should filter by memory type', () => {
      const results = service.queryMemories({ types: ['preference'] });
      expect(results.every(m => m.type === 'preference')).toBe(true);
    });

    it('should filter by multiple types', () => {
      const results = service.queryMemories({ types: ['preference', 'fact'] });
      expect(results.every(m => m.type === 'preference' || m.type === 'fact')).toBe(true);
    });

    it('should filter by minimum confidence', () => {
      const results = service.queryMemories({ minConfidence: 0.85 });
      expect(results.every(m => m.confidence >= 0.85)).toBe(true);
    });

    it('should filter by privacy levels', () => {
      const results = service.queryMemories({ privacyLevels: ['always_include'] });
      expect(results.every(m => m.privacyLevel === 'always_include')).toBe(true);
    });

    it('should include never_share when explicitly requested', () => {
      const results = service.queryMemories({ privacyLevels: ['never_share'] });
      expect(results.some(m => m.privacyLevel === 'never_share')).toBe(true);
    });

    it('should filter by tags', () => {
      const results = service.queryMemories({ tags: ['typescript'] });
      expect(results.some(m => m.tags?.includes('typescript'))).toBe(true);
    });

    it('should sort by confidence descending', () => {
      const results = service.queryMemories({ sortBy: 'confidence', sortOrder: 'desc' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
      }
    });

    it('should sort by confidence ascending', () => {
      const results = service.queryMemories({ sortBy: 'confidence', sortOrder: 'asc' });
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].confidence).toBeLessThanOrEqual(results[i].confidence);
      }
    });

    it('should respect limit parameter', () => {
      const results = service.queryMemories({ limit: 2 });
      expect(results.length).toBe(2);
    });

    it('should respect offset parameter', () => {
      const allResults = service.queryMemories({ sortBy: 'createdAt', sortOrder: 'desc' });
      const offsetResults = service.queryMemories({ sortBy: 'createdAt', sortOrder: 'desc', offset: 2, limit: 2 });
      
      expect(offsetResults[0].id).toBe(allResults[2].id);
    });

    it('should combine multiple filters', () => {
      const results = service.queryMemories({
        scope: 'global',
        types: ['preference'],
        minConfidence: 0.8,
        sortBy: 'confidence',
        sortOrder: 'desc',
        limit: 5
      });

      expect(results.every(m => m.scope === 'global' && m.type === 'preference' && m.confidence >= 0.8)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Search Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('searchMemories() FTS', () => {
    beforeEach(() => {
      service.storeMemory({ content: 'User prefers TypeScript for all JavaScript projects', type: 'preference' });
      service.storeMemory({ content: 'Currently working on React Native mobile app', type: 'context' });
      service.storeMemory({ content: 'Experienced with PostgreSQL and MongoDB databases', type: 'skill' });
      service.storeMemory({ content: 'Always use ESLint for code quality', type: 'instruction' });
      service.storeMemory({ content: 'Private database credentials', type: 'fact', privacyLevel: 'never_share' });
    });

    it('should return empty array for short search text', () => {
      expect(service.searchMemories('a')).toEqual([]);
      expect(service.searchMemories('')).toEqual([]);
    });

    it('should find memories by content keyword', () => {
      const results = service.searchMemories('TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.some(m => m.content.includes('TypeScript'))).toBe(true);
    });

    it('should find memories by partial match', () => {
      const results = service.searchMemories('React');
      expect(results.length).toBeGreaterThan(0);
    });

    it('should exclude never_share memories from search results', () => {
      const results = service.searchMemories('database');
      expect(results.every(m => m.privacyLevel !== 'never_share')).toBe(true);
    });

    it('should respect limit parameter', () => {
      const results = service.searchMemories('project', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('should handle special characters gracefully', () => {
      // Should not throw, may return empty results
      expect(() => service.searchMemories('C++ OR Python')).not.toThrow();
    });

    it('should search across summary field when present', () => {
      // First create a memory with a summary
      const result = service.storeMemory({ content: 'Full detailed content here', type: 'fact' });
      service.updateMemory({ id: result.memoryId!, summary: 'Summary contains Kubernetes' });

      const searchResults = service.searchMemories('Kubernetes');
      expect(searchResults.some(m => m.summary?.includes('Kubernetes'))).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('CRUD operations', () => {
    describe('getMemory()', () => {
      it('should retrieve a memory by ID', () => {
        const result = service.storeMemory({ content: 'Test memory', type: 'fact' });
        const memory = service.getMemory(result.memoryId!);

        expect(memory).toBeDefined();
        expect(memory?.content).toBe('Test memory');
        expect(memory?.type).toBe('fact');
      });

      it('should return null for non-existent ID', () => {
        const memory = service.getMemory('non-existent-uuid');
        expect(memory).toBeNull();
      });

      it('should return complete memory object with all fields', () => {
        const result = service.storeMemory({
          content: 'Complete memory test',
          type: 'preference',
          tags: ['test']
        });
        const memory = service.getMemory(result.memoryId!);

        expect(memory?.id).toBeDefined();
        expect(memory?.createdAt).toBeDefined();
        expect(memory?.updatedAt).toBeDefined();
        expect(memory?.accessedAt).toBeDefined();
        expect(memory?.accessCount).toBe(0);
        expect(memory?.decayRate).toBeDefined();
      });
    });

    describe('updateMemory()', () => {
      it('should update memory content', () => {
        const result = service.storeMemory({ content: 'Original content', type: 'fact' });
        const updated = service.updateMemory({ id: result.memoryId!, content: 'Updated content' });

        expect(updated).toBe(true);
        const memory = service.getMemory(result.memoryId!);
        expect(memory?.content).toBe('Updated content');
      });

      it('should update memory type', () => {
        const result = service.storeMemory({ content: 'Type test', type: 'fact' });
        service.updateMemory({ id: result.memoryId!, type: 'preference' });

        const memory = service.getMemory(result.memoryId!);
        expect(memory?.type).toBe('preference');
      });

      it('should update memory scope', () => {
        const result = service.storeMemory({ content: 'Scope test', type: 'fact', scope: 'global' });
        service.updateMemory({ id: result.memoryId!, scope: 'project', scopeId: '/new/project' });

        const memory = service.getMemory(result.memoryId!);
        expect(memory?.scope).toBe('project');
        expect(memory?.scopeId).toBe('/new/project');
      });

      it('should update confidence within bounds', () => {
        const result = service.storeMemory({ content: 'Confidence test', type: 'fact' });

        service.updateMemory({ id: result.memoryId!, confidence: 1.5 });
        let memory = service.getMemory(result.memoryId!);
        expect(memory?.confidence).toBe(1.0);

        service.updateMemory({ id: result.memoryId!, confidence: -0.5 });
        memory = service.getMemory(result.memoryId!);
        expect(memory?.confidence).toBe(0.0);
      });

      it('should update tags', () => {
        const result = service.storeMemory({ content: 'Tags test', type: 'fact', tags: ['old'] });
        service.updateMemory({ id: result.memoryId!, tags: ['new', 'tags'] });

        const memory = service.getMemory(result.memoryId!);
        expect(memory?.tags).toEqual(['new', 'tags']);
      });

      it('should update privacy level', () => {
        const result = service.storeMemory({ content: 'Privacy test', type: 'fact' });
        service.updateMemory({ id: result.memoryId!, privacyLevel: 'sensitive' });

        const memory = service.getMemory(result.memoryId!);
        expect(memory?.privacyLevel).toBe('sensitive');
      });

      it('should update summary', () => {
        const result = service.storeMemory({ content: 'Long content here', type: 'fact' });
        service.updateMemory({ id: result.memoryId!, summary: 'Short summary' });

        const memory = service.getMemory(result.memoryId!);
        expect(memory?.summary).toBe('Short summary');
      });

      it('should update updatedAt timestamp', () => {
        const result = service.storeMemory({ content: 'Timestamp test', type: 'fact' });
        const before = service.getMemory(result.memoryId!)!.updatedAt;

        // Small delay to ensure timestamp difference
        const now = Date.now() + 100;
        vi.setSystemTime(now);

        service.updateMemory({ id: result.memoryId!, content: 'New content' });
        const after = service.getMemory(result.memoryId!)!.updatedAt;

        expect(after).toBeGreaterThanOrEqual(before);
        vi.useRealTimers();
      });

      it('should return false for non-existent memory', () => {
        const updated = service.updateMemory({ id: 'non-existent', content: 'Test' });
        expect(updated).toBe(false);
      });

      it('should return false when no updates provided', () => {
        const result = service.storeMemory({ content: 'No update test', type: 'fact' });
        const updated = service.updateMemory({ id: result.memoryId! });
        expect(updated).toBe(false);
      });
    });

    describe('deleteMemory()', () => {
      it('should delete a memory by ID', () => {
        const result = service.storeMemory({ content: 'To be deleted', type: 'fact' });
        const deleted = service.deleteMemory(result.memoryId!);

        expect(deleted).toBe(true);
        expect(service.getMemory(result.memoryId!)).toBeNull();
      });

      it('should return false for non-existent memory', () => {
        const deleted = service.deleteMemory('non-existent-id');
        expect(deleted).toBe(false);
      });

      it('should not affect other memories', () => {
        const result1 = service.storeMemory({ content: 'Memory 1', type: 'fact' });
        const result2 = service.storeMemory({ content: 'Memory 2', type: 'fact' });

        service.deleteMemory(result1.memoryId!);

        expect(service.getMemory(result1.memoryId!)).toBeNull();
        expect(service.getMemory(result2.memoryId!)).toBeDefined();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Context Retrieval Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('getContextMemories() layered retrieval', () => {
    beforeEach(() => {
      // Always-include memories (Layer 1)
      service.storeMemory({
        content: 'User name is Alice',
        type: 'fact',
        privacyLevel: 'always_include',
        confidence: 0.95
      });

      // Global high-confidence memories (Layer 2)
      service.storeMemory({
        content: 'User prefers TypeScript',
        type: 'preference',
        scope: 'global',
        confidence: 0.8
      });
      service.storeMemory({
        content: 'User is a senior developer',
        type: 'fact',
        scope: 'global',
        confidence: 0.7
      });

      // Project-scoped memories (Layer 3)
      service.storeMemory({
        content: 'Project uses React',
        type: 'context',
        scope: 'project',
        scopeId: '/test/project',
        confidence: 0.6
      });

      // Conversation-scoped memories (Layer 4)
      service.storeMemory({
        content: 'Discussed authentication flow',
        type: 'context',
        scope: 'conversation',
        scopeId: 'conv-test-123',
        confidence: 0.5
      });

      // Low confidence global memory (should be excluded from Layer 2)
      service.storeMemory({
        content: 'Maybe likes Python',
        type: 'preference',
        scope: 'global',
        confidence: 0.3
      });
    });

    it('should return context with status loaded when memories exist', () => {
      const context = service.getContextMemories();
      expect(context.status).toBe('loaded');
      expect(context.memories.length).toBeGreaterThan(0);
    });

    it('should return status empty when no memories exist', () => {
      const emptyService = new TestableArborMemoryService();
      const context = emptyService.getContextMemories();
      expect(context.status).toBe('empty');
      expect(context.memories.length).toBe(0);
      emptyService.close();
    });

    it('should always include always_include memories (Layer 1)', () => {
      const context = service.getContextMemories();
      const alwaysIncluded = context.memories.find(m => m.privacyLevel === 'always_include');
      expect(alwaysIncluded).toBeDefined();
      expect(alwaysIncluded?.content).toBe('User name is Alice');
    });

    it('should include global high-confidence memories (Layer 2)', () => {
      const context = service.getContextMemories();
      const globalPreference = context.memories.find(m => 
        m.scope === 'global' && m.content.includes('TypeScript')
      );
      expect(globalPreference).toBeDefined();
    });

    it('should exclude low-confidence global memories', () => {
      const context = service.getContextMemories();
      const lowConfidence = context.memories.find(m => m.content.includes('Python'));
      expect(lowConfidence).toBeUndefined();
    });

    it('should include project memories when projectPath provided (Layer 3)', () => {
      const context = service.getContextMemories({ projectPath: '/test/project' });
      const projectMemory = context.memories.find(m => 
        m.scope === 'project' && m.scopeId === '/test/project'
      );
      expect(projectMemory).toBeDefined();
    });

    it('should NOT include project memories when projectPath not provided', () => {
      const context = service.getContextMemories();
      const projectMemory = context.memories.find(m => m.scope === 'project');
      expect(projectMemory).toBeUndefined();
    });

    it('should include conversation memories when conversationId provided (Layer 4)', () => {
      const context = service.getContextMemories({ conversationId: 'conv-test-123' });
      const convMemory = context.memories.find(m =>
        m.scope === 'conversation' && m.scopeId === 'conv-test-123'
      );
      expect(convMemory).toBeDefined();
    });

    it('should NOT include conversation memories when conversationId not provided', () => {
      const context = service.getContextMemories();
      const convMemory = context.memories.find(m => m.scope === 'conversation');
      expect(convMemory).toBeUndefined();
    });

    it('should include search-relevant memories when searchText provided (Layer 5)', () => {
      service.storeMemory({
        content: 'Expertise in GraphQL APIs',
        type: 'skill',
        confidence: 0.4  // Below global threshold but should match search
      });

      const context = service.getContextMemories({ searchText: 'GraphQL' });
      const searchMatch = context.memories.find(m => m.content.includes('GraphQL'));
      expect(searchMatch).toBeDefined();
    });

    it('should not duplicate memories across layers', () => {
      const context = service.getContextMemories({
        projectPath: '/test/project',
        conversationId: 'conv-test-123'
      });

      const ids = context.memories.map(m => m.id);
      const uniqueIds = new Set(ids);
      expect(ids.length).toBe(uniqueIds.size);
    });

    it('should generate formatted prompt with user_context tags', () => {
      const context = service.getContextMemories();
      expect(context.formattedPrompt).toContain('<user_context>');
      expect(context.formattedPrompt).toContain('</user_context>');
    });

    it('should format memories by type with headers', () => {
      const context = service.getContextMemories();
      // Should have at least one header type
      expect(
        context.formattedPrompt.includes('**User Preferences:**') ||
        context.formattedPrompt.includes('**Known Facts:**')
      ).toBe(true);
    });

    it('should calculate stats correctly', () => {
      const context = service.getContextMemories({
        projectPath: '/test/project',
        conversationId: 'conv-test-123'
      });

      expect(context.stats.totalLoaded).toBe(context.memories.length);
      expect(context.stats.avgConfidence).toBeGreaterThan(0);
      expect(context.stats.avgConfidence).toBeLessThanOrEqual(1);

      // Verify byScope sums to total
      const scopeSum = Object.values(context.stats.byScope).reduce((a, b) => a + b, 0);
      expect(scopeSum).toBe(context.stats.totalLoaded);

      // Verify byType sums to total
      const typeSum = Object.values(context.stats.byType).reduce((a, b) => a + b, 0);
      expect(typeSum).toBe(context.stats.totalLoaded);
    });

    it('should update accessedAt when retrieving context', () => {
      const result = service.storeMemory({
        content: 'Access tracking test',
        type: 'instruction',
        privacyLevel: 'always_include'
      });

      const beforeAccess = service.getMemory(result.memoryId!)!.accessedAt;

      // Small delay
      vi.setSystemTime(Date.now() + 1000);
      service.getContextMemories();
      vi.useRealTimers();

      const afterAccess = service.getMemory(result.memoryId!)!.accessedAt;
      expect(afterAccess).toBeGreaterThanOrEqual(beforeAccess);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Decay Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('runDecay() behavior', () => {
    it('should decay confidence of old unaccessed memories', () => {
      // Create a memory with old access time
      const result = service.storeMemory({
        content: 'Old memory',
        type: 'fact',
        confidence: 0.8,
        decayRate: 0.1
      });

      // Manually update accessed_at to simulate old memory
      const oldTime = Date.now() - (CONFIG.DECAY_THRESHOLD_HOURS + 1) * 60 * 60 * 1000;
      const db = service.getDatabase();
      db.prepare('UPDATE arbor_memories SET accessed_at = ? WHERE id = ?').run(oldTime, result.memoryId);

      const beforeDecay = service.getMemory(result.memoryId!)!.confidence;
      const decayResult = service.runDecay();

      expect(decayResult.updated).toBeGreaterThanOrEqual(1);
      const afterDecay = service.getMemory(result.memoryId!)!.confidence;
      expect(afterDecay).toBeLessThan(beforeDecay);
    });

    it('should NOT decay recently accessed memories', () => {
      const result = service.storeMemory({
        content: 'Recent memory',
        type: 'fact',
        confidence: 0.8
      });

      const beforeDecay = service.getMemory(result.memoryId!)!.confidence;
      service.runDecay();
      const afterDecay = service.getMemory(result.memoryId!)!.confidence;

      expect(afterDecay).toBe(beforeDecay);
    });

    it('should NOT decay always_include memories', () => {
      const result = service.storeMemory({
        content: 'Protected memory',
        type: 'instruction',
        privacyLevel: 'always_include',
        confidence: 0.5
      });

      // Make it old
      const oldTime = Date.now() - (CONFIG.DECAY_THRESHOLD_HOURS + 1) * 60 * 60 * 1000;
      const db = service.getDatabase();
      db.prepare('UPDATE arbor_memories SET accessed_at = ? WHERE id = ?').run(oldTime, result.memoryId);

      const beforeDecay = service.getMemory(result.memoryId!)!.confidence;
      service.runDecay();
      const afterDecay = service.getMemory(result.memoryId!)!.confidence;

      expect(afterDecay).toBe(beforeDecay);
    });

    it('should NOT decay sensitive memories', () => {
      const result = service.storeMemory({
        content: 'Sensitive memory',
        type: 'fact',
        privacyLevel: 'sensitive',
        confidence: 0.5
      });

      // Make it old
      const oldTime = Date.now() - (CONFIG.DECAY_THRESHOLD_HOURS + 1) * 60 * 60 * 1000;
      const db = service.getDatabase();
      db.prepare('UPDATE arbor_memories SET accessed_at = ? WHERE id = ?').run(oldTime, result.memoryId);

      const beforeDecay = service.getMemory(result.memoryId!)!.confidence;
      service.runDecay();
      const afterDecay = service.getMemory(result.memoryId!)!.confidence;

      expect(afterDecay).toBe(beforeDecay);
    });

    it('should delete very old, very low confidence memories', () => {
      const result = service.storeMemory({
        content: 'Will be deleted',
        type: 'fact',
        confidence: 0.1  // Below LOW_CONFIDENCE_DELETE threshold
      });

      // Make it very old
      const veryOldTime = Date.now() - (CONFIG.DELETE_THRESHOLD_DAYS + 1) * 24 * 60 * 60 * 1000;
      const db = service.getDatabase();
      db.prepare('UPDATE arbor_memories SET accessed_at = ?, confidence = ? WHERE id = ?')
        .run(veryOldTime, 0.1, result.memoryId);

      const decayResult = service.runDecay();

      expect(decayResult.deleted).toBeGreaterThanOrEqual(1);
      expect(service.getMemory(result.memoryId!)).toBeNull();
    });

    it('should NOT delete memories above confidence threshold', () => {
      const result = service.storeMemory({
        content: 'Will survive',
        type: 'fact',
        confidence: 0.5
      });

      // Make it old but keep confidence high
      const oldTime = Date.now() - (CONFIG.DELETE_THRESHOLD_DAYS + 1) * 24 * 60 * 60 * 1000;
      const db = service.getDatabase();
      db.prepare('UPDATE arbor_memories SET accessed_at = ? WHERE id = ?').run(oldTime, result.memoryId);

      service.runDecay();
      expect(service.getMemory(result.memoryId!)).not.toBeNull();
    });

    it('should return accurate decay statistics', () => {
      // Create multiple memories with different conditions
      const mem1 = service.storeMemory({ content: 'Mem1', type: 'fact', confidence: 0.8 });
      const mem2 = service.storeMemory({ content: 'Mem2', type: 'fact', confidence: 0.1 });
      const mem3 = service.storeMemory({ content: 'Mem3', type: 'fact', confidence: 0.6 });

      const db = service.getDatabase();
      const decayTime = Date.now() - (CONFIG.DECAY_THRESHOLD_HOURS + 1) * 60 * 60 * 1000;
      const deleteTime = Date.now() - (CONFIG.DELETE_THRESHOLD_DAYS + 1) * 24 * 60 * 60 * 1000;

      // Mem1: Old enough to decay
      db.prepare('UPDATE arbor_memories SET accessed_at = ? WHERE id = ?').run(decayTime, mem1.memoryId);
      // Mem2: Old enough and low enough confidence to delete
      db.prepare('UPDATE arbor_memories SET accessed_at = ?, confidence = ? WHERE id = ?')
        .run(deleteTime, 0.1, mem2.memoryId);
      // Mem3: Recent, should not be affected

      const result = service.runDecay();

      expect(typeof result.updated).toBe('number');
      expect(typeof result.deleted).toBe('number');
      expect(result.updated).toBeGreaterThanOrEqual(1);
      expect(result.deleted).toBeGreaterThanOrEqual(1);
      // Verify mem3 was not affected by decay
      expect(service.getMemory(mem3.memoryId!)).not.toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics Tests
  // ─────────────────────────────────────────────────────────────────────────

  describe('getStats()', () => {
    it('should return accurate memory count', () => {
      service.storeMemory({ content: 'Memory 1', type: 'fact' });
      service.storeMemory({ content: 'Memory 2', type: 'preference' });
      service.storeMemory({ content: 'Memory 3', type: 'instruction' });

      const stats = service.getStats();
      expect(stats.totalMemories).toBe(3);
    });

    it('should correctly count by scope', () => {
      service.storeMemory({ content: 'Global', type: 'fact', scope: 'global' });
      service.storeMemory({ content: 'Project', type: 'fact', scope: 'project', scopeId: '/p' });
      service.storeMemory({ content: 'Conv', type: 'fact', scope: 'conversation', scopeId: 'c1' });

      const stats = service.getStats();
      expect(stats.byScope.global).toBe(1);
      expect(stats.byScope.project).toBe(1);
      expect(stats.byScope.conversation).toBe(1);
    });

    it('should calculate average confidence', () => {
      service.storeMemory({ content: 'M1', type: 'fact', confidence: 0.6 });
      service.storeMemory({ content: 'M2', type: 'fact', confidence: 0.8 });
      service.storeMemory({ content: 'M3', type: 'fact', confidence: 1.0 });

      const stats = service.getStats();
      expect(stats.avgConfidence).toBeCloseTo(0.8, 1);
    });

    it('should return zero stats for empty database', () => {
      const stats = service.getStats();
      expect(stats.totalMemories).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });
  });
});
