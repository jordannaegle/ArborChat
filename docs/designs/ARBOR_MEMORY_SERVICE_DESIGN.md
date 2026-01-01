# ArborChat Native Memory Service Design
## Persistent, Scoped, Auto-Injecting Memory for AI Conversations

**Author:** Alex Chen, Distinguished Software Architect  
**Date:** December 30, 2025  
**Status:** Design Document - Ready for Review  
**Version:** 1.0

---

## Executive Summary

This design document specifies a native memory service for ArborChat that provides persistent, context-aware memory with **automatic injection** into AI conversations. Unlike the current Memory MCP integration (which requires manual tool calls), Arbor Memory loads relevant memories automatically at conversation start and injects them into the system prompt.

### Core Value Propositions

1. **Automatic Context Injection** — Memories load without AI intervention
2. **Hierarchical Scoping** — Global → Project → Conversation memory layers
3. **Access-Pattern Decay** — Memories fade based on usage, not just time
4. **Source Attribution** — Track origin (user stated, AI inferred, agent stored)
5. **Native Integration** — SQLite backend matching ArborChat's existing architecture
6. **UI Feedback** — Real-time memory status via existing `MemoryIndicator.tsx`

### Success Metrics

| Metric | Current State | Target State |
|--------|---------------|--------------|
| Memory available at conversation start | 0% (requires tool call) | 100% (automatic) |
| Token overhead for memory loading | ~500 tokens (tool call + response) | ~50-200 tokens (direct injection) |
| User preference retention across sessions | Manual | Automatic |
| Memory relevance (user satisfaction) | Unknown | >80% helpful memories |

---

## 1. Problem Statement

### 1.1 Current Architecture Limitations

The existing Memory MCP integration has fundamental friction:

```
Current Flow:
┌─────────────────────────────────────────────────────────────────┐
│ 1. User sends message                                           │
│ 2. AI receives message (no memory context)                      │
│ 3. AI must decide to call open_nodes or search_memories         │
│ 4. Tool call requires approval (if not auto-approved)           │
│ 5. MCP server processes request                                 │
│ 6. Result returns to AI                                         │
│ 7. AI incorporates memory into response                         │
│                                                                 │
│ Problems:                                                       │
│ • AI often forgets to check memory                              │
│ • Extra round-trip adds latency                                 │
│ • Token overhead from tool_use blocks                           │
│ • No scoping (all memories are global)                          │
│ • No decay (memories accumulate forever)                        │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Desired Architecture

```
Proposed Flow:
┌─────────────────────────────────────────────────────────────────┐
│ 1. User sends message                                           │
│ 2. ArborChat loads relevant memories (automatic)                │
│ 3. Memories injected into system prompt                         │
│ 4. AI receives message WITH memory context                      │
│ 5. AI responds with full awareness                              │
│                                                                 │
│ Benefits:                                                       │
│ • Zero-friction memory access                                   │
│ • Reduced latency (no tool round-trip)                          │
│ • Lower token usage                                             │
│ • Scoped memories (project, conversation)                       │
│ • Automatic decay and compaction                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Overview

### 2.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        RENDERER PROCESS                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ useArborMemory  │  │ MemoryIndicator │  │  MemoryPanel   │  │
│  │     (hook)      │  │   (existing)    │  │    (new UI)    │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │ IPC                            │
├────────────────────────────────┼────────────────────────────────┤
│                        MAIN PROCESS                             │
│                                │                                │
│  ┌─────────────────────────────┴─────────────────────────────┐  │
│  │                   ArborMemoryService                       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐  │  │
│  │  │   Storage   │  │  Retrieval  │  │    Compaction     │  │  │
│  │  │   Manager   │  │   Engine    │  │     Service       │  │  │
│  │  └──────┬──────┘  └──────┬──────┘  └─────────┬─────────┘  │  │
│  │         │                │                    │            │  │
│  │         └────────────────┼────────────────────┘            │  │
│  │                          │                                 │  │
│  │              ┌───────────┴───────────┐                     │  │
│  │              │   SQLite Database     │                     │  │
│  │              │   (arbor_memory.db)   │                     │  │
│  │              └───────────────────────┘                     │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    MCP Manager                              │  │
│  │         (existing - Memory MCP as fallback)                 │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow: Conversation Start

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────────┐
│  User   │    │ Renderer │    │   Main   │    │ ArborMemory     │
│         │    │ Process  │    │ Process  │    │ Service         │
└────┬────┘    └────┬─────┘    └────┬─────┘    └───────┬─────────┘
     │              │               │                   │
     │ Opens chat   │               │                   │
     │─────────────>│               │                   │
     │              │               │                   │
     │              │ IPC: getMemoryContext             │
     │              │──────────────>│                   │
     │              │               │                   │
     │              │               │ Query memories    │
     │              │               │──────────────────>│
     │              │               │                   │
     │              │               │   Format & return │
     │              │               │<──────────────────│
     │              │               │                   │
     │              │ {memories, status, formattedPrompt}
     │              │<──────────────│                   │
     │              │               │                   │
     │ UI updates   │               │                   │
     │ (indicator)  │               │                   │
     │<─────────────│               │                   │
     │              │               │                   │
     │ Sends msg    │               │                   │
     │─────────────>│               │                   │
     │              │               │                   │
     │              │ AI stream (systemPrompt includes memory)
     │              │──────────────>│                   │
     │              │               │                   │
```

### 2.3 Data Flow: Memory Storage

```
┌─────────┐    ┌──────────┐    ┌──────────┐    ┌─────────────────┐
│   AI    │    │ Renderer │    │   Main   │    │ ArborMemory     │
│Response │    │ Process  │    │ Process  │    │ Service         │
└────┬────┘    └────┬─────┘    └────┬─────┘    └───────┬─────────┘
     │              │               │                   │
     │ "I'll       │               │                   │
     │  remember   │               │                   │
     │  that..."   │               │                   │
     │─────────────>│               │                   │
     │              │               │                   │
     │              │ IPC: storeMemory                  │
     │              │──────────────>│                   │
     │              │               │                   │
     │              │               │ Validate & store  │
     │              │               │──────────────────>│
     │              │               │                   │
     │              │               │   {success, id}   │
     │              │               │<──────────────────│
     │              │               │                   │
     │              │ Update indicator                  │
     │              │<──────────────│                   │
     │              │               │                   │
```

---

## 3. Data Model

### 3.1 Core Schema

```sql
-- Main memories table
CREATE TABLE arbor_memories (
    id TEXT PRIMARY KEY,
    
    -- Content
    content TEXT NOT NULL,
    summary TEXT,  -- AI-generated summary for compacted memories
    
    -- Classification
    type TEXT NOT NULL CHECK (type IN (
        'preference',    -- User preferences (dark mode, coding style)
        'fact',          -- Facts about user (name, role, projects)
        'context',       -- Contextual info (current goals, recent work)
        'skill',         -- User skills/expertise
        'instruction',   -- Standing instructions ("always use TypeScript")
        'relationship'   -- Relations to other entities
    )),
    
    -- Scoping
    scope TEXT NOT NULL DEFAULT 'global' CHECK (scope IN (
        'global',        -- Available everywhere
        'project',       -- Specific to a project path
        'conversation'   -- Specific to a conversation
    )),
    scope_id TEXT,       -- project path or conversation ID (null for global)
    
    -- Attribution
    source TEXT NOT NULL CHECK (source IN (
        'user_stated',   -- User explicitly said this
        'ai_inferred',   -- AI inferred from conversation
        'agent_stored',  -- Agent explicitly stored via tool
        'system'         -- System-generated (e.g., from imports)
    )),
    confidence REAL NOT NULL DEFAULT 1.0 CHECK (confidence >= 0 AND confidence <= 1),
    
    -- Metadata
    tags TEXT,           -- JSON array of tags for filtering
    related_memories TEXT, -- JSON array of related memory IDs
    
    -- Lifecycle
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    accessed_at INTEGER NOT NULL,
    access_count INTEGER NOT NULL DEFAULT 0,
    
    -- Decay & Compaction
    decay_rate REAL NOT NULL DEFAULT 0.1,  -- How fast confidence decays
    compacted_at INTEGER,                   -- When summary was generated
    expires_at INTEGER,                     -- Hard expiration (optional)
    
    -- Privacy
    privacy_level TEXT NOT NULL DEFAULT 'normal' CHECK (privacy_level IN (
        'always_include', -- Always inject into context
        'normal',         -- Include when relevant
        'sensitive',      -- Only include when directly relevant
        'never_share'     -- Never include in AI context (user reference only)
    ))
);

-- Indexes for common queries
CREATE INDEX idx_memories_scope ON arbor_memories(scope, scope_id);
CREATE INDEX idx_memories_type ON arbor_memories(type);
CREATE INDEX idx_memories_accessed ON arbor_memories(accessed_at DESC);
CREATE INDEX idx_memories_confidence ON arbor_memories(confidence DESC);
CREATE INDEX idx_memories_privacy ON arbor_memories(privacy_level);

-- Full-text search for content
CREATE VIRTUAL TABLE arbor_memories_fts USING fts5(
    content,
    summary,
    tags,
    content='arbor_memories',
    content_rowid='rowid'
);

-- Triggers to keep FTS in sync
CREATE TRIGGER arbor_memories_ai AFTER INSERT ON arbor_memories BEGIN
    INSERT INTO arbor_memories_fts(rowid, content, summary, tags)
    VALUES (NEW.rowid, NEW.content, NEW.summary, NEW.tags);
END;

CREATE TRIGGER arbor_memories_ad AFTER DELETE ON arbor_memories BEGIN
    INSERT INTO arbor_memories_fts(arbor_memories_fts, rowid, content, summary, tags)
    VALUES ('delete', OLD.rowid, OLD.content, OLD.summary, OLD.tags);
END;

CREATE TRIGGER arbor_memories_au AFTER UPDATE ON arbor_memories BEGIN
    INSERT INTO arbor_memories_fts(arbor_memories_fts, rowid, content, summary, tags)
    VALUES ('delete', OLD.rowid, OLD.content, OLD.summary, OLD.tags);
    INSERT INTO arbor_memories_fts(rowid, content, summary, tags)
    VALUES (NEW.rowid, NEW.content, NEW.summary, NEW.tags);
END;

-- Memory access log for analytics
CREATE TABLE memory_access_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT NOT NULL,
    accessed_at INTEGER NOT NULL,
    context TEXT,  -- 'conversation_start', 'search', 'explicit'
    conversation_id TEXT,
    FOREIGN KEY (memory_id) REFERENCES arbor_memories(id) ON DELETE CASCADE
);

CREATE INDEX idx_access_log_memory ON memory_access_log(memory_id);
CREATE INDEX idx_access_log_time ON memory_access_log(accessed_at DESC);
```


### 3.2 TypeScript Types

```typescript
// src/shared/types/memory.ts

/**
 * Memory type classification
 */
export type MemoryType = 
  | 'preference'    // User preferences (dark mode, coding style)
  | 'fact'          // Facts about user (name, role, projects)
  | 'context'       // Contextual info (current goals, recent work)
  | 'skill'         // User skills/expertise
  | 'instruction'   // Standing instructions ("always use TypeScript")
  | 'relationship'; // Relations to other entities

/**
 * Memory scope determines visibility
 */
export type MemoryScope = 
  | 'global'        // Available everywhere
  | 'project'       // Specific to a project path
  | 'conversation'; // Specific to a conversation

/**
 * How the memory was created
 */
export type MemorySource = 
  | 'user_stated'   // User explicitly said this
  | 'ai_inferred'   // AI inferred from conversation
  | 'agent_stored'  // Agent explicitly stored via tool
  | 'system';       // System-generated (e.g., from imports)

/**
 * Privacy level controls injection behavior
 */
export type MemoryPrivacyLevel = 
  | 'always_include' // Always inject into context
  | 'normal'         // Include when relevant
  | 'sensitive'      // Only include when directly relevant
  | 'never_share';   // Never include in AI context

/**
 * Core memory entity
 */
export interface ArborMemory {
  id: string;
  
  // Content
  content: string;
  summary?: string;
  
  // Classification
  type: MemoryType;
  scope: MemoryScope;
  scopeId?: string;
  
  // Attribution
  source: MemorySource;
  confidence: number; // 0.0 - 1.0
  
  // Metadata
  tags?: string[];
  relatedMemories?: string[];
  
  // Lifecycle
  createdAt: number;
  updatedAt: number;
  accessedAt: number;
  accessCount: number;
  
  // Decay & Compaction
  decayRate: number;
  compactedAt?: number;
  expiresAt?: number;
  
  // Privacy
  privacyLevel: MemoryPrivacyLevel;
}

/**
 * Query parameters for memory retrieval
 */
export interface MemoryQuery {
  // Scope filters
  scope?: MemoryScope;
  scopeId?: string;
  includeGlobal?: boolean; // Include global when querying project/conversation
  
  // Type filters
  types?: MemoryType[];
  
  // Confidence threshold
  minConfidence?: number;
  
  // Privacy filter
  privacyLevels?: MemoryPrivacyLevel[];
  
  // Search
  searchText?: string;
  tags?: string[];
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Sorting
  sortBy?: 'confidence' | 'accessedAt' | 'createdAt' | 'accessCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Context returned for conversation injection
 */
export interface MemoryContext {
  // Formatted prompt section to inject
  formattedPrompt: string;
  
  // Raw memories for UI display
  memories: ArborMemory[];
  
  // Statistics
  stats: {
    totalLoaded: number;
    byScope: Record<MemoryScope, number>;
    byType: Record<MemoryType, number>;
    avgConfidence: number;
  };
  
  // Status
  status: 'loaded' | 'empty' | 'error';
  error?: string;
}

/**
 * Request to store a new memory
 */
export interface StoreMemoryRequest {
  content: string;
  type: MemoryType;
  
  // Optional overrides
  scope?: MemoryScope;
  scopeId?: string;
  source?: MemorySource;
  confidence?: number;
  tags?: string[];
  privacyLevel?: MemoryPrivacyLevel;
  decayRate?: number;
  expiresAt?: number;
}

/**
 * Result of storing a memory
 */
export interface StoreMemoryResult {
  success: boolean;
  memoryId?: string;
  error?: string;
  duplicate?: boolean;
  existingMemoryId?: string;
}

/**
 * Memory update request
 */
export interface UpdateMemoryRequest {
  id: string;
  content?: string;
  type?: MemoryType;
  scope?: MemoryScope;
  scopeId?: string;
  confidence?: number;
  tags?: string[];
  privacyLevel?: MemoryPrivacyLevel;
  summary?: string;
}

/**
 * Compaction candidate for AI summarization
 */
export interface CompactionCandidate {
  memory: ArborMemory;
  reason: 'age' | 'low_confidence' | 'low_access' | 'size';
  suggestedAction: 'summarize' | 'delete' | 'archive';
}

/**
 * Memory statistics for UI display
 */
export interface MemoryStats {
  totalMemories: number;
  byScope: Record<MemoryScope, number>;
  byType: Record<MemoryType, number>;
  bySource: Record<MemorySource, number>;
  avgConfidence: number;
  oldestMemory: number; // timestamp
  newestMemory: number; // timestamp
  totalAccessCount: number;
  compactedCount: number;
}
```

---

## 4. Service Implementation

### 4.1 ArborMemoryService Class

```typescript
// src/main/services/ArborMemoryService.ts

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { app } from 'electron';
import {
  ArborMemory,
  MemoryQuery,
  MemoryContext,
  StoreMemoryRequest,
  StoreMemoryResult,
  UpdateMemoryRequest,
  CompactionCandidate,
  MemoryStats,
  MemoryScope,
  MemoryType
} from '../../shared/types/memory';

export class ArborMemoryService {
  private db: Database.Database;
  private static instance: ArborMemoryService;

  private constructor() {
    const dbPath = path.join(app.getPath('userData'), 'arbor_memory.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeSchema();
  }

  /**
   * Singleton access
   */
  static getInstance(): ArborMemoryService {
    if (!ArborMemoryService.instance) {
      ArborMemoryService.instance = new ArborMemoryService();
    }
    return ArborMemoryService.instance;
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(): void {
    this.db.exec(`
      -- Schema from section 3.1 goes here
      -- (omitted for brevity - see full schema above)
    `);
  }

  // ─────────────────────────────────────────────────────────────
  // CONTEXT RETRIEVAL (Primary method for conversation start)
  // ─────────────────────────────────────────────────────────────

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
      maxTokens = 2000
    } = options;

    const memories: ArborMemory[] = [];
    const now = Date.now();

    try {
      // Layer 1: Always-include memories
      const alwaysInclude = this.queryMemories({
        privacyLevels: ['always_include'],
        minConfidence: 0.1,
        sortBy: 'confidence',
        sortOrder: 'desc',
        limit: 20
      });
      memories.push(...alwaysInclude);

      // Layer 2: Global high-confidence memories
      const globalMemories = this.queryMemories({
        scope: 'global',
        minConfidence: 0.5,
        privacyLevels: ['normal', 'sensitive'],
        sortBy: 'accessedAt',
        sortOrder: 'desc',
        limit: 30
      });
      // Deduplicate
      const existingIds = new Set(memories.map(m => m.id));
      memories.push(...globalMemories.filter(m => !existingIds.has(m.id)));

      // Layer 3: Project-scoped memories
      if (projectPath) {
        const projectMemories = this.queryMemories({
          scope: 'project',
          scopeId: projectPath,
          minConfidence: 0.3,
          sortBy: 'accessedAt',
          sortOrder: 'desc',
          limit: 20
        });
        const currentIds = new Set(memories.map(m => m.id));
        memories.push(...projectMemories.filter(m => !currentIds.has(m.id)));
      }

      // Layer 4: Conversation-scoped memories
      if (conversationId) {
        const conversationMemories = this.queryMemories({
          scope: 'conversation',
          scopeId: conversationId,
          minConfidence: 0.2,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          limit: 10
        });
        const currentIds = new Set(memories.map(m => m.id));
        memories.push(...conversationMemories.filter(m => !currentIds.has(m.id)));
      }

      // Layer 5: Search-relevant memories
      if (searchText) {
        const searchResults = this.searchMemories(searchText, 10);
        const currentIds = new Set(memories.map(m => m.id));
        memories.push(...searchResults.filter(m => !currentIds.has(m.id)));
      }

      // Update access timestamps
      this.recordAccess(memories.map(m => m.id), 'conversation_start', conversationId);

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

  // ─────────────────────────────────────────────────────────────
  // STORAGE
  // ─────────────────────────────────────────────────────────────

  /**
   * Store a new memory with duplicate detection
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

    try {
      // Check for duplicates (simple content similarity)
      const duplicate = this.findDuplicate(content, scope, scopeId);
      if (duplicate) {
        // Update existing memory's confidence and access time
        this.updateMemoryAccess(duplicate.id);
        return {
          success: true,
          duplicate: true,
          existingMemoryId: duplicate.id
        };
      }

      const now = Date.now();
      const id = uuidv4();

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
        id, content, type, scope, scopeId || null, source, confidence,
        JSON.stringify(tags), privacyLevel, decayRate, expiresAt || null,
        now, now, now
      );

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
   * Find potential duplicate memory
   */
  private findDuplicate(
    content: string,
    scope: MemoryScope,
    scopeId?: string
  ): ArborMemory | null {
    // Normalize content for comparison
    const normalized = content.toLowerCase().trim();
    
    const stmt = this.db.prepare(`
      SELECT * FROM arbor_memories
      WHERE scope = ? AND (scope_id = ? OR (scope_id IS NULL AND ? IS NULL))
      AND LOWER(TRIM(content)) = ?
    `);

    const row = stmt.get(scope, scopeId, scopeId, normalized);
    return row ? this.rowToMemory(row) : null;
  }

  // ─────────────────────────────────────────────────────────────
  // QUERYING
  // ─────────────────────────────────────────────────────────────

  /**
   * Query memories with filters
   */
  queryMemories(query: MemoryQuery): ArborMemory[] {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (query.scope) {
      conditions.push('scope = ?');
      params.push(query.scope);
    }

    if (query.scopeId !== undefined) {
      conditions.push('scope_id = ?');
      params.push(query.scopeId);
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

    if (query.tags && query.tags.length > 0) {
      // JSON array contains check
      const tagConditions = query.tags.map(() => "tags LIKE ?");
      conditions.push(`(${tagConditions.join(' OR ')})`);
      params.push(...query.tags.map(t => `%"${t}"%`));
    }

    // Sort
    const sortBy = query.sortBy || 'accessedAt';
    const sortOrder = query.sortOrder || 'desc';
    const sortColumn = {
      confidence: 'confidence',
      accessedAt: 'accessed_at',
      createdAt: 'created_at',
      accessCount: 'access_count'
    }[sortBy];

    // Pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const sql = `
      SELECT * FROM arbor_memories
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params);

    return rows.map(row => this.rowToMemory(row));
  }

  /**
   * Full-text search across memories
   */
  searchMemories(searchText: string, limit: number = 20): ArborMemory[] {
    try {
      // Try FTS first
      const ftsStmt = this.db.prepare(`
        SELECT m.* FROM arbor_memories m
        JOIN arbor_memories_fts fts ON m.rowid = fts.rowid
        WHERE arbor_memories_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `);

      const rows = ftsStmt.all(searchText, limit);
      return rows.map(row => this.rowToMemory(row));

    } catch (error) {
      // Fallback to LIKE search
      const likeStmt = this.db.prepare(`
        SELECT * FROM arbor_memories
        WHERE content LIKE ? OR summary LIKE ?
        ORDER BY accessed_at DESC
        LIMIT ?
      `);

      const pattern = `%${searchText}%`;
      const rows = likeStmt.all(pattern, pattern, limit);
      return rows.map(row => this.rowToMemory(row));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // FORMATTING
  // ─────────────────────────────────────────────────────────────

  /**
   * Format memories for system prompt injection
   */
  formatMemoriesForPrompt(memories: ArborMemory[], maxTokens: number = 2000): string {
    if (memories.length === 0) return '';

    // Estimate ~4 chars per token
    const maxChars = maxTokens * 4;

    // Group by type for organized presentation
    const grouped = this.groupMemoriesByType(memories);

    const sections: string[] = [];
    let currentLength = 0;

    // Priority order for types
    const typeOrder: MemoryType[] = [
      'instruction',
      'preference', 
      'fact',
      'skill',
      'context',
      'relationship'
    ];

    for (const type of typeOrder) {
      const typeMemories = grouped[type] || [];
      if (typeMemories.length === 0) continue;

      const header = this.getTypeHeader(type);
      const items = typeMemories
        .sort((a, b) => b.confidence - a.confidence)
        .map(m => `- ${m.summary || m.content}`);

      const section = `${header}\n${items.join('\n')}`;
      
      if (currentLength + section.length > maxChars) {
        // Truncate this section
        const remaining = maxChars - currentLength - header.length - 10;
        if (remaining > 50) {
          const truncatedItems = [];
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

  private getTypeHeader(type: MemoryType): string {
    const headers: Record<MemoryType, string> = {
      instruction: '**Standing Instructions:**',
      preference: '**User Preferences:**',
      fact: '**Known Facts:**',
      skill: '**User Skills:**',
      context: '**Current Context:**',
      relationship: '**Relationships:**'
    };
    return headers[type];
  }

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

  // ─────────────────────────────────────────────────────────────
  // DECAY & COMPACTION
  // ─────────────────────────────────────────────────────────────

  /**
   * Run decay on memories not accessed recently.
   * Called periodically (e.g., daily via scheduler).
   */
  runDecay(): { updated: number; deleted: number } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Decay confidence for unaccessed memories
    const decayStmt = this.db.prepare(`
      UPDATE arbor_memories
      SET confidence = MAX(0, confidence - (decay_rate * 0.01)),
          updated_at = ?
      WHERE accessed_at < ?
      AND privacy_level NOT IN ('always_include', 'sensitive')
    `);

    const decayResult = decayStmt.run(now, oneDayAgo);

    // Delete very low confidence, old memories
    const deleteStmt = this.db.prepare(`
      DELETE FROM arbor_memories
      WHERE confidence < 0.15
      AND accessed_at < ?
      AND privacy_level NOT IN ('always_include', 'sensitive')
    `);

    const deleteResult = deleteStmt.run(sevenDaysAgo);

    return {
      updated: decayResult.changes,
      deleted: deleteResult.changes
    };
  }

  /**
   * Get memories that are candidates for AI-driven compaction/summarization
   */
  getCompactionCandidates(limit: number = 20): CompactionCandidate[] {
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(`
      SELECT * FROM arbor_memories
      WHERE compacted_at IS NULL
      AND created_at < ?
      AND LENGTH(content) > 200
      AND type IN ('context', 'fact')
      ORDER BY accessed_at ASC
      LIMIT ?
    `);

    const rows = stmt.all(thirtyDaysAgo, limit);

    return rows.map(row => ({
      memory: this.rowToMemory(row),
      reason: 'age' as const,
      suggestedAction: 'summarize' as const
    }));
  }

  /**
   * Apply compaction (AI-generated summary) to a memory
   */
  applyCompaction(memoryId: string, summary: string): boolean {
    const now = Date.now();

    const stmt = this.db.prepare(`
      UPDATE arbor_memories
      SET summary = ?,
          compacted_at = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const result = stmt.run(summary, now, now, memoryId);
    return result.changes > 0;
  }

  // ─────────────────────────────────────────────────────────────
  // ACCESS TRACKING
  // ─────────────────────────────────────────────────────────────

  private recordAccess(
    memoryIds: string[],
    context: string,
    conversationId?: string
  ): void {
    if (memoryIds.length === 0) return;

    const now = Date.now();

    // Update access time and count
    const updateStmt = this.db.prepare(`
      UPDATE arbor_memories
      SET accessed_at = ?,
          access_count = access_count + 1
      WHERE id = ?
    `);

    // Log access
    const logStmt = this.db.prepare(`
      INSERT INTO memory_access_log (memory_id, accessed_at, context, conversation_id)
      VALUES (?, ?, ?, ?)
    `);

    const updateMany = this.db.transaction((ids: string[]) => {
      for (const id of ids) {
        updateStmt.run(now, id);
        logStmt.run(id, now, context, conversationId || null);
      }
    });

    updateMany(memoryIds);
  }

  private updateMemoryAccess(memoryId: string): void {
    const now = Date.now();
    const stmt = this.db.prepare(`
      UPDATE arbor_memories
      SET accessed_at = ?,
          access_count = access_count + 1,
          confidence = MIN(1.0, confidence + 0.05)
      WHERE id = ?
    `);
    stmt.run(now, memoryId);
  }

  // ─────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────

  private rowToMemory(row: any): ArborMemory {
    return {
      id: row.id,
      content: row.content,
      summary: row.summary || undefined,
      type: row.type as MemoryType,
      scope: row.scope as MemoryScope,
      scopeId: row.scope_id || undefined,
      source: row.source,
      confidence: row.confidence,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      relatedMemories: row.related_memories ? JSON.parse(row.related_memories) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count,
      decayRate: row.decay_rate,
      compactedAt: row.compacted_at || undefined,
      expiresAt: row.expires_at || undefined,
      privacyLevel: row.privacy_level
    };
  }

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

  /**
   * Get overall memory statistics
   */
  getStats(): MemoryStats {
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

    const row = stmt.get() as any;

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
  }

  /**
   * Delete a memory by ID
   */
  deleteMemory(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM arbor_memories WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  /**
   * Update an existing memory
   */
  updateMemory(request: UpdateMemoryRequest): boolean {
    const updates: string[] = [];
    const params: any[] = [];

    if (request.content !== undefined) {
      updates.push('content = ?');
      params.push(request.content);
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
      params.push(request.scopeId);
    }
    if (request.confidence !== undefined) {
      updates.push('confidence = ?');
      params.push(request.confidence);
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

    const stmt = this.db.prepare(`
      UPDATE arbor_memories
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    const result = stmt.run(...params);
    return result.changes > 0;
  }

  /**
   * Get a single memory by ID
   */
  getMemory(id: string): ArborMemory | null {
    const stmt = this.db.prepare('SELECT * FROM arbor_memories WHERE id = ?');
    const row = stmt.get(id);
    return row ? this.rowToMemory(row) : null;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}
```


---

## 5. IPC Integration

### 5.1 IPC Handler Registration

```typescript
// src/main/ipc/memoryHandlers.ts

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { ArborMemoryService } from '../services/ArborMemoryService';
import {
  MemoryQuery,
  StoreMemoryRequest,
  UpdateMemoryRequest
} from '../../shared/types/memory';

export function registerMemoryHandlers(): void {
  const memoryService = ArborMemoryService.getInstance();

  /**
   * Get context memories for conversation injection
   * Called at conversation start
   */
  ipcMain.handle('memory:getContext', async (
    _event: IpcMainInvokeEvent,
    options: {
      conversationId?: string;
      projectPath?: string;
      searchText?: string;
      maxTokens?: number;
    }
  ) => {
    return memoryService.getContextMemories(options);
  });

  /**
   * Store a new memory
   */
  ipcMain.handle('memory:store', async (
    _event: IpcMainInvokeEvent,
    request: StoreMemoryRequest
  ) => {
    return memoryService.storeMemory(request);
  });

  /**
   * Query memories with filters
   */
  ipcMain.handle('memory:query', async (
    _event: IpcMainInvokeEvent,
    query: MemoryQuery
  ) => {
    return memoryService.queryMemories(query);
  });

  /**
   * Full-text search memories
   */
  ipcMain.handle('memory:search', async (
    _event: IpcMainInvokeEvent,
    searchText: string,
    limit?: number
  ) => {
    return memoryService.searchMemories(searchText, limit);
  });

  /**
   * Get a single memory by ID
   */
  ipcMain.handle('memory:get', async (
    _event: IpcMainInvokeEvent,
    id: string
  ) => {
    return memoryService.getMemory(id);
  });

  /**
   * Update an existing memory
   */
  ipcMain.handle('memory:update', async (
    _event: IpcMainInvokeEvent,
    request: UpdateMemoryRequest
  ) => {
    return memoryService.updateMemory(request);
  });

  /**
   * Delete a memory
   */
  ipcMain.handle('memory:delete', async (
    _event: IpcMainInvokeEvent,
    id: string
  ) => {
    return memoryService.deleteMemory(id);
  });

  /**
   * Get memory statistics
   */
  ipcMain.handle('memory:getStats', async () => {
    return memoryService.getStats();
  });

  /**
   * Get compaction candidates for AI summarization
   */
  ipcMain.handle('memory:getCompactionCandidates', async (
    _event: IpcMainInvokeEvent,
    limit?: number
  ) => {
    return memoryService.getCompactionCandidates(limit);
  });

  /**
   * Apply compaction to a memory
   */
  ipcMain.handle('memory:applyCompaction', async (
    _event: IpcMainInvokeEvent,
    memoryId: string,
    summary: string
  ) => {
    return memoryService.applyCompaction(memoryId, summary);
  });

  /**
   * Run decay process (called by scheduler)
   */
  ipcMain.handle('memory:runDecay', async () => {
    return memoryService.runDecay();
  });
}
```

### 5.2 Preload API Exposure

```typescript
// src/preload/memoryApi.ts (add to existing preload)

import { ipcRenderer } from 'electron';
import {
  MemoryContext,
  MemoryQuery,
  StoreMemoryRequest,
  StoreMemoryResult,
  UpdateMemoryRequest,
  ArborMemory,
  CompactionCandidate,
  MemoryStats
} from '../shared/types/memory';

export const memoryApi = {
  /**
   * Get context memories for conversation injection
   */
  getContext: (options: {
    conversationId?: string;
    projectPath?: string;
    searchText?: string;
    maxTokens?: number;
  }): Promise<MemoryContext> => {
    return ipcRenderer.invoke('memory:getContext', options);
  },

  /**
   * Store a new memory
   */
  store: (request: StoreMemoryRequest): Promise<StoreMemoryResult> => {
    return ipcRenderer.invoke('memory:store', request);
  },

  /**
   * Query memories with filters
   */
  query: (query: MemoryQuery): Promise<ArborMemory[]> => {
    return ipcRenderer.invoke('memory:query', query);
  },

  /**
   * Search memories by text
   */
  search: (searchText: string, limit?: number): Promise<ArborMemory[]> => {
    return ipcRenderer.invoke('memory:search', searchText, limit);
  },

  /**
   * Get single memory by ID
   */
  get: (id: string): Promise<ArborMemory | null> => {
    return ipcRenderer.invoke('memory:get', id);
  },

  /**
   * Update a memory
   */
  update: (request: UpdateMemoryRequest): Promise<boolean> => {
    return ipcRenderer.invoke('memory:update', request);
  },

  /**
   * Delete a memory
   */
  delete: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('memory:delete', id);
  },

  /**
   * Get statistics
   */
  getStats: (): Promise<MemoryStats> => {
    return ipcRenderer.invoke('memory:getStats');
  },

  /**
   * Get compaction candidates
   */
  getCompactionCandidates: (limit?: number): Promise<CompactionCandidate[]> => {
    return ipcRenderer.invoke('memory:getCompactionCandidates', limit);
  },

  /**
   * Apply compaction summary
   */
  applyCompaction: (memoryId: string, summary: string): Promise<boolean> => {
    return ipcRenderer.invoke('memory:applyCompaction', memoryId, summary);
  }
};

// Add to contextBridge exposure
// contextBridge.exposeInMainWorld('arborMemory', memoryApi);
```

---

## 6. React Integration

### 6.1 useArborMemory Hook

```typescript
// src/renderer/src/hooks/useArborMemory.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArborMemory,
  MemoryContext,
  MemoryQuery,
  StoreMemoryRequest,
  StoreMemoryResult,
  MemoryStats
} from '../../../shared/types/memory';

interface UseArborMemoryOptions {
  conversationId?: string;
  projectPath?: string;
  autoLoad?: boolean;
}

interface UseArborMemoryReturn {
  // State
  context: MemoryContext | null;
  memories: ArborMemory[];
  stats: MemoryStats | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadContext: (searchText?: string) => Promise<MemoryContext>;
  store: (request: StoreMemoryRequest) => Promise<StoreMemoryResult>;
  search: (searchText: string, limit?: number) => Promise<ArborMemory[]>;
  query: (query: MemoryQuery) => Promise<ArborMemory[]>;
  deleteMemory: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useArborMemory(
  options: UseArborMemoryOptions = {}
): UseArborMemoryReturn {
  const { conversationId, projectPath, autoLoad = true } = options;

  const [context, setContext] = useState<MemoryContext | null>(null);
  const [memories, setMemories] = useState<ArborMemory[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track if we've loaded for this conversation
  const loadedForRef = useRef<string | null>(null);

  /**
   * Load context memories for current conversation
   */
  const loadContext = useCallback(async (searchText?: string): Promise<MemoryContext> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.arborMemory.getContext({
        conversationId,
        projectPath,
        searchText
      });

      setContext(result);
      setMemories(result.memories);

      if (result.status === 'error') {
        setError(result.error || 'Failed to load memories');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, projectPath]);

  /**
   * Store a new memory
   */
  const store = useCallback(async (
    request: StoreMemoryRequest
  ): Promise<StoreMemoryResult> => {
    try {
      // Apply current scope if not specified
      const scopedRequest: StoreMemoryRequest = {
        ...request,
        scope: request.scope || (conversationId ? 'conversation' : projectPath ? 'project' : 'global'),
        scopeId: request.scopeId || conversationId || projectPath
      };

      const result = await window.arborMemory.store(scopedRequest);

      // Refresh context after storing
      if (result.success) {
        await loadContext();
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to store memory';
      setError(message);
      return { success: false, error: message };
    }
  }, [conversationId, projectPath, loadContext]);

  /**
   * Search memories
   */
  const search = useCallback(async (
    searchText: string,
    limit?: number
  ): Promise<ArborMemory[]> => {
    try {
      return await window.arborMemory.search(searchText, limit);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      return [];
    }
  }, []);

  /**
   * Query memories with filters
   */
  const query = useCallback(async (queryParams: MemoryQuery): Promise<ArborMemory[]> => {
    try {
      return await window.arborMemory.query(queryParams);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Query failed';
      setError(message);
      return [];
    }
  }, []);

  /**
   * Delete a memory
   */
  const deleteMemory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const result = await window.arborMemory.delete(id);
      if (result) {
        // Remove from local state
        setMemories(prev => prev.filter(m => m.id !== id));
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
      return false;
    }
  }, []);

  /**
   * Refresh context and stats
   */
  const refresh = useCallback(async () => {
    await Promise.all([
      loadContext(),
      window.arborMemory.getStats().then(setStats)
    ]);
  }, [loadContext]);

  // Auto-load on mount or conversation change
  useEffect(() => {
    const key = `${conversationId || 'none'}-${projectPath || 'none'}`;
    
    if (autoLoad && loadedForRef.current !== key) {
      loadedForRef.current = key;
      loadContext();
    }
  }, [autoLoad, conversationId, projectPath, loadContext]);

  // Load stats on mount
  useEffect(() => {
    window.arborMemory.getStats().then(setStats).catch(console.error);
  }, []);

  return {
    context,
    memories,
    stats,
    isLoading,
    error,
    loadContext,
    store,
    search,
    query,
    deleteMemory,
    refresh
  };
}
```

### 6.2 Memory Context Provider

```typescript
// src/renderer/src/components/memory/MemoryProvider.tsx

import React, { createContext, useContext, ReactNode } from 'react';
import { useArborMemory } from '../../hooks/useArborMemory';

type MemoryContextType = ReturnType<typeof useArborMemory>;

const MemoryContext = createContext<MemoryContextType | null>(null);

interface MemoryProviderProps {
  children: ReactNode;
  conversationId?: string;
  projectPath?: string;
}

export function MemoryProvider({ 
  children, 
  conversationId, 
  projectPath 
}: MemoryProviderProps): JSX.Element {
  const memory = useArborMemory({ conversationId, projectPath });

  return (
    <MemoryContext.Provider value={memory}>
      {children}
    </MemoryContext.Provider>
  );
}

export function useMemoryContext(): MemoryContextType {
  const context = useContext(MemoryContext);
  if (!context) {
    throw new Error('useMemoryContext must be used within a MemoryProvider');
  }
  return context;
}
```

---

## 7. UI Components

### 7.1 Updated MemoryIndicator

```typescript
// src/renderer/src/components/mcp/MemoryIndicator.tsx (updated)

import React from 'react';
import { Brain, ChevronRight, AlertCircle, Loader2 } from 'lucide-react';
import { useMemoryContext } from '../memory/MemoryProvider';

interface MemoryIndicatorProps {
  onClick?: () => void;
  compact?: boolean;
}

export function MemoryIndicator({ 
  onClick, 
  compact = false 
}: MemoryIndicatorProps): JSX.Element | null {
  const { context, isLoading, error, stats } = useMemoryContext();

  // Determine status
  const memoryCount = context?.memories.length ?? 0;
  const hasMemories = memoryCount > 0;
  const hasError = !!error;

  // Status color
  const statusColor = hasError 
    ? 'text-red-500' 
    : hasMemories 
      ? 'text-green-500' 
      : 'text-gray-400';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 
                   dark:hover:bg-gray-800 transition-colors ${statusColor}`}
        title={`${memoryCount} memories loaded`}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : hasError ? (
          <AlertCircle className="w-4 h-4" />
        ) : (
          <Brain className="w-4 h-4" />
        )}
        {hasMemories && (
          <span className="text-xs font-medium">{memoryCount}</span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border 
                 border-gray-200 dark:border-gray-700 hover:bg-gray-50 
                 dark:hover:bg-gray-800 transition-colors`}
    >
      <div className={`flex items-center gap-2 ${statusColor}`}>
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : hasError ? (
          <AlertCircle className="w-5 h-5" />
        ) : (
          <Brain className="w-5 h-5" />
        )}
        <div className="text-left">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Memory
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {isLoading 
              ? 'Loading...' 
              : hasError 
                ? 'Error' 
                : `${memoryCount} items loaded`}
          </div>
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}
```

### 7.2 MemoryPanel Component

```typescript
// src/renderer/src/components/memory/MemoryPanel.tsx

import React, { useState, useCallback } from 'react';
import { 
  Brain, 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  X,
  Filter,
  RefreshCw,
  ChevronDown,
  Tag
} from 'lucide-react';
import { useMemoryContext } from './MemoryProvider';
import { ArborMemory, MemoryType, MemoryScope } from '../../../../shared/types/memory';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MemoryPanel({ isOpen, onClose }: MemoryPanelProps): JSX.Element | null {
  const { 
    memories, 
    stats, 
    isLoading, 
    search, 
    store, 
    deleteMemory, 
    refresh 
  } = useMemoryContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ArborMemory[] | null>(null);
  const [selectedType, setSelectedType] = useState<MemoryType | 'all'>('all');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [newMemory, setNewMemory] = useState({ content: '', type: 'fact' as MemoryType });

  // Filter displayed memories
  const displayedMemories = searchResults ?? memories;
  const filteredMemories = selectedType === 'all' 
    ? displayedMemories 
    : displayedMemories.filter(m => m.type === selectedType);

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    const results = await search(searchQuery, 50);
    setSearchResults(results);
  }, [searchQuery, search]);

  // Handle add memory
  const handleAddMemory = useCallback(async () => {
    if (!newMemory.content.trim()) return;

    const result = await store({
      content: newMemory.content,
      type: newMemory.type,
      source: 'user_stated',
      confidence: 1.0
    });

    if (result.success) {
      setNewMemory({ content: '', type: 'fact' });
      setIsAddingMemory(false);
    }
  }, [newMemory, store]);

  // Handle delete
  const handleDelete = useCallback(async (id: string) => {
    if (window.confirm('Delete this memory?')) {
      await deleteMemory(id);
    }
  }, [deleteMemory]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white dark:bg-gray-900 
                    shadow-xl border-l border-gray-200 dark:border-gray-700 
                    flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b 
                      border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Memory
          </h2>
          {stats && (
            <span className="text-sm text-gray-500">
              ({stats.totalMemories} total)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            disabled={isLoading}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 
                       disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 
                               text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search memories..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 
                         dark:border-gray-700 bg-white dark:bg-gray-800 
                         text-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            onClick={() => setIsAddingMemory(true)}
            className="px-3 py-2 rounded-lg bg-purple-500 text-white 
                       hover:bg-purple-600 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {(['all', 'preference', 'fact', 'instruction', 'skill', 'context'] as const).map(type => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors
                ${selectedType === type
                  ? 'bg-purple-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Add Memory Form */}
      {isAddingMemory && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 
                        bg-gray-50 dark:bg-gray-800/50">
          <textarea
            value={newMemory.content}
            onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
            placeholder="Enter memory content..."
            className="w-full p-3 rounded-lg border border-gray-200 
                       dark:border-gray-700 bg-white dark:bg-gray-800 
                       text-gray-900 dark:text-gray-100 resize-none"
            rows={3}
          />
          <div className="flex items-center gap-2 mt-2">
            <select
              value={newMemory.type}
              onChange={(e) => setNewMemory(prev => ({ ...prev, type: e.target.value as MemoryType }))}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 
                         dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="instruction">Instruction</option>
              <option value="skill">Skill</option>
              <option value="context">Context</option>
            </select>
            <button
              onClick={handleAddMemory}
              className="px-4 py-2 rounded-lg bg-purple-500 text-white 
                         hover:bg-purple-600"
            >
              Save
            </button>
            <button
              onClick={() => setIsAddingMemory(false)}
              className="px-4 py-2 rounded-lg border border-gray-200 
                         dark:border-gray-700 hover:bg-gray-100 
                         dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Memory List */}
      <div className="flex-1 overflow-y-auto">
        {filteredMemories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No memories found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {filteredMemories.map(memory => (
              <MemoryItem 
                key={memory.id} 
                memory={memory}
                onDelete={() => handleDelete(memory.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stats Footer */}
      {stats && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 
                        bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Global: {stats.byScope.global}</span>
            <span>Project: {stats.byScope.project}</span>
            <span>Conversation: {stats.byScope.conversation}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Individual memory item component
function MemoryItem({ 
  memory, 
  onDelete 
}: { 
  memory: ArborMemory; 
  onDelete: () => void;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const typeColors: Record<MemoryType, string> = {
    preference: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    fact: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    instruction: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    skill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    context: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    relationship: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
  };

  const confidenceColor = memory.confidence >= 0.7 
    ? 'text-green-500' 
    : memory.confidence >= 0.4 
      ? 'text-yellow-500' 
      : 'text-red-500';

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Type badge and confidence */}
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColors[memory.type]}`}>
              {memory.type}
            </span>
            <span className={`text-xs ${confidenceColor}`}>
              {Math.round(memory.confidence * 100)}%
            </span>
            {memory.scope !== 'global' && (
              <span className="text-xs text-gray-400">
                {memory.scope}
              </span>
            )}
          </div>

          {/* Content */}
          <p className={`text-sm text-gray-900 dark:text-gray-100 
                        ${isExpanded ? '' : 'line-clamp-2'}`}>
            {memory.summary || memory.content}
          </p>

          {/* Expand toggle for long content */}
          {(memory.content.length > 150 || memory.summary) && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-purple-500 hover:text-purple-600 mt-1"
            >
              {isExpanded ? 'Show less' : 'Show more'}
            </button>
          )}

          {/* Metadata */}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>Accessed {memory.accessCount}x</span>
            <span>•</span>
            <span>{new Date(memory.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={onDelete}
          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 
                     text-gray-400 hover:text-red-500 transition-colors"
          title="Delete memory"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
```


---

## 8. Chat Flow Integration

### 8.1 System Prompt Injection

The key integration point is injecting memories into the system prompt before sending to the AI. This happens in the chat service:

```typescript
// src/main/services/ChatService.ts (relevant additions)

import { ArborMemoryService } from './ArborMemoryService';

export class ChatService {
  private memoryService: ArborMemoryService;

  constructor() {
    this.memoryService = ArborMemoryService.getInstance();
  }

  /**
   * Build the complete system prompt with memory context
   */
  async buildSystemPrompt(
    basePrompt: string,
    options: {
      conversationId?: string;
      projectPath?: string;
      includeMemory?: boolean;
    }
  ): Promise<string> {
    const { conversationId, projectPath, includeMemory = true } = options;

    if (!includeMemory) {
      return basePrompt;
    }

    // Load memory context
    const memoryContext = this.memoryService.getContextMemories({
      conversationId,
      projectPath,
      maxTokens: 2000 // Configurable
    });

    // If no memories, return base prompt
    if (!memoryContext.formattedPrompt) {
      return basePrompt;
    }

    // Inject memory context into system prompt
    // Place at the end of system prompt for best attention
    return `${basePrompt}

${memoryContext.formattedPrompt}`;
  }

  /**
   * Process AI response for memory extraction triggers
   */
  async processResponseForMemory(
    response: string,
    conversationId: string,
    projectPath?: string
  ): Promise<void> {
    // Look for explicit memory storage signals from AI
    const memoryPatterns = [
      /I'll remember that ([^.]+)\./gi,
      /I've noted that ([^.]+)\./gi,
      /Got it[,!] ([^.]+)\./gi,
      /Understood[,!] ([^.]+)\./gi
    ];

    for (const pattern of memoryPatterns) {
      const matches = response.matchAll(pattern);
      for (const match of matches) {
        const content = match[1].trim();
        if (content.length > 10 && content.length < 500) {
          await this.memoryService.storeMemory({
            content,
            type: 'fact',
            scope: conversationId ? 'conversation' : projectPath ? 'project' : 'global',
            scopeId: conversationId || projectPath,
            source: 'ai_inferred',
            confidence: 0.7
          });
        }
      }
    }
  }
}
```

### 8.2 Memory Storage Tool for AI

Provide the AI with a tool to explicitly store memories:

```typescript
// src/main/mcp/tools/memoryTool.ts

import { ArborMemoryService } from '../../services/ArborMemoryService';
import { MemoryType, MemoryScope } from '../../../shared/types/memory';

export const arborMemoryTool = {
  name: 'arbor_store_memory',
  description: `Store information about the user for future conversations.
Use this to remember:
- User preferences (coding style, communication preferences)
- Facts about the user (name, role, projects they work on)
- Standing instructions (how they want things done)
- Skills and expertise they've mentioned
- Important context for ongoing work

The memory will persist across conversations and be automatically included in future context.`,
  
  parameters: {
    type: 'object',
    properties: {
      content: {
        type: 'string',
        description: 'The information to remember (be specific and concise)'
      },
      type: {
        type: 'string',
        enum: ['preference', 'fact', 'instruction', 'skill', 'context'],
        description: 'Category of memory'
      },
      importance: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'How important is this to remember? High = always include in context'
      }
    },
    required: ['content', 'type']
  },

  async execute(params: {
    content: string;
    type: MemoryType;
    importance?: 'low' | 'medium' | 'high';
  }, context: { conversationId?: string; projectPath?: string }): Promise<string> {
    const memoryService = ArborMemoryService.getInstance();

    const privacyLevel = {
      low: 'normal' as const,
      medium: 'normal' as const,
      high: 'always_include' as const
    }[params.importance || 'medium'];

    const result = await memoryService.storeMemory({
      content: params.content,
      type: params.type,
      scope: context.projectPath ? 'project' : 'global',
      scopeId: context.projectPath,
      source: 'agent_stored',
      confidence: params.importance === 'high' ? 1.0 : 0.85,
      privacyLevel
    });

    if (result.success) {
      if (result.duplicate) {
        return `Memory already exists (updated access time): "${params.content}"`;
      }
      return `Stored memory: "${params.content}" as ${params.type}`;
    }

    return `Failed to store memory: ${result.error}`;
  }
};
```

### 8.3 Renderer Integration Example

```typescript
// Example usage in a Chat component

import { useArborMemory } from '../../hooks/useArborMemory';
import { MemoryProvider } from '../memory/MemoryProvider';
import { MemoryIndicator } from '../mcp/MemoryIndicator';
import { MemoryPanel } from '../memory/MemoryPanel';

function ChatWindow({ conversationId, projectPath }: ChatWindowProps) {
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  return (
    <MemoryProvider conversationId={conversationId} projectPath={projectPath}>
      <div className="flex flex-col h-full">
        {/* Header with memory indicator */}
        <header className="flex items-center justify-between p-4 border-b">
          <h1>Chat</h1>
          <MemoryIndicator 
            compact 
            onClick={() => setIsPanelOpen(true)} 
          />
        </header>

        {/* Chat messages */}
        <ChatMessages conversationId={conversationId} />

        {/* Input */}
        <ChatInput conversationId={conversationId} />

        {/* Memory panel */}
        <MemoryPanel 
          isOpen={isPanelOpen} 
          onClose={() => setIsPanelOpen(false)} 
        />
      </div>
    </MemoryProvider>
  );
}
```

---

## 9. Background Services

### 9.1 Decay Scheduler

```typescript
// src/main/services/MemoryScheduler.ts

import { ArborMemoryService } from './ArborMemoryService';

export class MemoryScheduler {
  private decayInterval: NodeJS.Timeout | null = null;
  private memoryService: ArborMemoryService;

  constructor() {
    this.memoryService = ArborMemoryService.getInstance();
  }

  /**
   * Start the decay scheduler
   * Runs daily to decay unused memories
   */
  start(): void {
    // Run immediately on start
    this.runDecay();

    // Then run every 24 hours
    const twentyFourHours = 24 * 60 * 60 * 1000;
    this.decayInterval = setInterval(() => {
      this.runDecay();
    }, twentyFourHours);

    console.log('[MemoryScheduler] Started decay scheduler');
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.decayInterval) {
      clearInterval(this.decayInterval);
      this.decayInterval = null;
    }
    console.log('[MemoryScheduler] Stopped decay scheduler');
  }

  /**
   * Run decay process
   */
  private runDecay(): void {
    try {
      const result = this.memoryService.runDecay();
      console.log(
        `[MemoryScheduler] Decay complete: ${result.updated} updated, ${result.deleted} deleted`
      );
    } catch (error) {
      console.error('[MemoryScheduler] Decay failed:', error);
    }
  }
}

// Initialize in main process
// const memoryScheduler = new MemoryScheduler();
// memoryScheduler.start();
// app.on('before-quit', () => memoryScheduler.stop());
```

### 9.2 Compaction Service (Agent-Driven)

```typescript
// src/main/services/MemoryCompactionService.ts

import { ArborMemoryService } from './ArborMemoryService';
import { CompactionCandidate } from '../../shared/types/memory';

export class MemoryCompactionService {
  private memoryService: ArborMemoryService;

  constructor() {
    this.memoryService = ArborMemoryService.getInstance();
  }

  /**
   * Get memories that need compaction
   * Called by agent when user requests memory maintenance
   */
  async getCompactionWork(): Promise<{
    candidates: CompactionCandidate[];
    prompt: string;
  }> {
    const candidates = this.memoryService.getCompactionCandidates(10);

    if (candidates.length === 0) {
      return {
        candidates: [],
        prompt: 'No memories need compaction at this time.'
      };
    }

    // Build prompt for AI to generate summaries
    const memoriesForSummary = candidates
      .filter(c => c.suggestedAction === 'summarize')
      .map((c, i) => `${i + 1}. [ID: ${c.memory.id}] ${c.memory.content}`)
      .join('\n\n');

    const prompt = `The following memories are old and could benefit from summarization 
to reduce token usage while preserving key information.

Please provide a concise summary (max 100 chars) for each memory that captures 
the essential information:

${memoriesForSummary}

Respond with a JSON array of objects: [{ "id": "...", "summary": "..." }, ...]`;

    return { candidates, prompt };
  }

  /**
   * Apply AI-generated summaries
   */
  async applyCompactionResults(
    results: Array<{ id: string; summary: string }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const { id, summary } of results) {
      const applied = this.memoryService.applyCompaction(id, summary);
      if (applied) {
        success++;
      } else {
        failed++;
      }
    }

    return { success, failed };
  }
}
```

---

## 10. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goal:** Core service with storage/retrieval working

- [ ] Create SQLite schema and migration
- [ ] Implement `ArborMemoryService` core class
  - [ ] `storeMemory()`
  - [ ] `queryMemories()`
  - [ ] `searchMemories()`
  - [ ] `getMemory()` / `deleteMemory()` / `updateMemory()`
- [ ] Register IPC handlers
- [ ] Add preload API exposure
- [ ] Basic unit tests for service

**Deliverable:** Can store and retrieve memories via IPC

### Phase 2: Context Injection (Week 2-3)

**Goal:** Automatic memory loading at conversation start

- [ ] Implement `getContextMemories()` with layered retrieval
- [ ] Implement `formatMemoriesForPrompt()`
- [ ] Integrate with `ChatService.buildSystemPrompt()`
- [ ] Add `useArborMemory` React hook
- [ ] Add `MemoryProvider` context

**Deliverable:** Memories automatically appear in AI context

### Phase 3: UI Integration (Week 3-4)

**Goal:** User can view and manage memories

- [ ] Update `MemoryIndicator.tsx` to use native memory
- [ ] Build `MemoryPanel` component
- [ ] Add memory count to chat header
- [ ] Implement search UI
- [ ] Implement add/edit/delete UI

**Deliverable:** Full memory management UI

### Phase 4: AI Storage (Week 4)

**Goal:** AI can store memories during conversation

- [ ] Implement `arbor_store_memory` tool
- [ ] Add to tool registry
- [ ] Implement response parsing for implicit storage
- [ ] Test with various AI providers

**Deliverable:** AI actively maintains memory

### Phase 5: Decay & Compaction (Week 5)

**Goal:** Memory maintenance automation

- [ ] Implement `runDecay()` 
- [ ] Add `MemoryScheduler`
- [ ] Implement compaction candidates selection
- [ ] Build agent-driven compaction flow
- [ ] Add maintenance UI/commands

**Deliverable:** Self-maintaining memory system

### Phase 6: Polish & Migration (Week 6)

**Goal:** Production-ready with migration from Memory MCP

- [ ] Migration tool from Memory MCP entities
- [ ] Performance optimization (indexes, caching)
- [ ] Error handling improvements
- [ ] Documentation
- [ ] Integration tests

**Deliverable:** Complete, documented, tested system

---

## 11. Testing Strategy

### 11.1 Unit Tests

```typescript
// src/main/services/__tests__/ArborMemoryService.test.ts

import { ArborMemoryService } from '../ArborMemoryService';

describe('ArborMemoryService', () => {
  let service: ArborMemoryService;

  beforeEach(() => {
    // Use in-memory database for tests
    service = new ArborMemoryService(':memory:');
  });

  describe('storeMemory', () => {
    it('should store a new memory', async () => {
      const result = await service.storeMemory({
        content: 'User prefers TypeScript',
        type: 'preference',
        source: 'user_stated'
      });

      expect(result.success).toBe(true);
      expect(result.memoryId).toBeDefined();
    });

    it('should detect duplicates', async () => {
      await service.storeMemory({
        content: 'User prefers TypeScript',
        type: 'preference'
      });

      const result = await service.storeMemory({
        content: 'User prefers TypeScript',
        type: 'preference'
      });

      expect(result.duplicate).toBe(true);
    });
  });

  describe('getContextMemories', () => {
    beforeEach(async () => {
      // Seed test data
      await service.storeMemory({
        content: 'Always use async/await',
        type: 'instruction',
        privacyLevel: 'always_include'
      });
      await service.storeMemory({
        content: 'User works on ArborChat',
        type: 'fact',
        scope: 'project',
        scopeId: '/path/to/arborchat'
      });
    });

    it('should include always_include memories', async () => {
      const context = service.getContextMemories({});
      
      expect(context.memories).toContainEqual(
        expect.objectContaining({ content: 'Always use async/await' })
      );
    });

    it('should include project-scoped memories when path matches', async () => {
      const context = service.getContextMemories({
        projectPath: '/path/to/arborchat'
      });

      expect(context.memories).toContainEqual(
        expect.objectContaining({ content: 'User works on ArborChat' })
      );
    });

    it('should format memories for prompt', async () => {
      const context = service.getContextMemories({});

      expect(context.formattedPrompt).toContain('<user_context>');
      expect(context.formattedPrompt).toContain('Standing Instructions');
    });
  });

  describe('runDecay', () => {
    it('should decay old unaccessed memories', async () => {
      // Store memory with old access time
      const result = await service.storeMemory({
        content: 'Old memory',
        type: 'context',
        confidence: 0.5
      });

      // Manually set old access time
      service['db'].prepare(`
        UPDATE arbor_memories 
        SET accessed_at = ? 
        WHERE id = ?
      `).run(Date.now() - 48 * 60 * 60 * 1000, result.memoryId);

      const decayResult = service.runDecay();

      expect(decayResult.updated).toBeGreaterThan(0);

      const memory = service.getMemory(result.memoryId!);
      expect(memory?.confidence).toBeLessThan(0.5);
    });
  });
});
```

### 11.2 Integration Tests

```typescript
// src/main/services/__tests__/MemoryIntegration.test.ts

describe('Memory Integration', () => {
  it('should inject memory into chat context', async () => {
    // Store a preference
    await memoryService.storeMemory({
      content: 'User prefers concise responses',
      type: 'instruction',
      privacyLevel: 'always_include'
    });

    // Build system prompt
    const chatService = new ChatService();
    const prompt = await chatService.buildSystemPrompt(
      'You are a helpful assistant.',
      { includeMemory: true }
    );

    expect(prompt).toContain('User prefers concise responses');
    expect(prompt).toContain('<user_context>');
  });

  it('should store memory via AI tool', async () => {
    const result = await arborMemoryTool.execute({
      content: 'User is working on a React project',
      type: 'fact',
      importance: 'medium'
    }, { projectPath: '/path/to/project' });

    expect(result).toContain('Stored memory');

    const memories = memoryService.queryMemories({
      scope: 'project',
      scopeId: '/path/to/project'
    });

    expect(memories).toContainEqual(
      expect.objectContaining({ content: 'User is working on a React project' })
    );
  });
});
```

---

## 12. Migration from Memory MCP

For users with existing Memory MCP data, provide a migration path:

```typescript
// src/main/services/MemoryMigration.ts

import { ArborMemoryService } from './ArborMemoryService';
import { MCPManager } from '../mcp/manager';

export class MemoryMigration {
  /**
   * Migrate entities from Memory MCP to Arbor Memory
   */
  async migrateFromMemoryMCP(): Promise<{
    migrated: number;
    skipped: number;
    errors: string[];
  }> {
    const memoryService = ArborMemoryService.getInstance();
    const mcpManager = MCPManager.getInstance();

    let migrated = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      // Get all entities from Memory MCP
      const result = await mcpManager.executeTool('memory', 'open_nodes', {
        names: ['*'] // Get all
      });

      if (!result.success || !result.data) {
        throw new Error('Failed to read Memory MCP data');
      }

      const entities = result.data.entities || [];

      for (const entity of entities) {
        try {
          // Map entity type to memory type
          const memoryType = this.mapEntityType(entity.entityType);

          // Check for existing
          const existing = memoryService.searchMemories(entity.name, 1);
          if (existing.length > 0) {
            skipped++;
            continue;
          }

          // Store as Arbor memory
          const storeResult = memoryService.storeMemory({
            content: `${entity.name}: ${entity.observations?.join('. ') || ''}`,
            type: memoryType,
            source: 'system',
            confidence: 0.9,
            tags: ['migrated-from-mcp']
          });

          if (storeResult.success) {
            migrated++;
          } else {
            errors.push(`Failed to migrate ${entity.name}: ${storeResult.error}`);
          }
        } catch (err) {
          errors.push(`Error processing ${entity.name}: ${err}`);
        }
      }
    } catch (err) {
      errors.push(`Migration failed: ${err}`);
    }

    return { migrated, skipped, errors };
  }

  private mapEntityType(entityType: string): MemoryType {
    const mapping: Record<string, MemoryType> = {
      'person': 'relationship',
      'project': 'context',
      'preference': 'preference',
      'skill': 'skill',
      'tool': 'fact',
      'concept': 'fact'
    };
    return mapping[entityType.toLowerCase()] || 'fact';
  }
}
```

---

## 13. Security Considerations

### 13.1 Data Protection

- **Local Storage Only:** All memory data stored in local SQLite database
- **No Cloud Sync:** Memories never leave the user's machine
- **Encryption Option:** Future enhancement to encrypt database at rest
- **Privacy Levels:** User can mark memories as `never_share` to exclude from AI context

### 13.2 Input Validation

```typescript
// All memory content should be validated
function validateMemoryContent(content: string): boolean {
  // Max length
  if (content.length > 10000) return false;
  
  // No injection attacks (basic)
  if (content.includes('<script>')) return false;
  
  // Must have meaningful content
  if (content.trim().length < 3) return false;
  
  return true;
}
```

### 13.3 Access Control

- Memories are scoped to conversations/projects
- Only accessible within ArborChat process
- IPC handlers validate requests come from renderer

---

## 14. Future Enhancements

### 14.1 Vector Search (Phase 2+)

Add embedding-based semantic search for better retrieval:

```typescript
// Future: Local embedding generation
interface EmbeddingConfig {
  model: 'all-MiniLM-L6-v2' | 'nomic-embed-text';
  dimensions: number;
}

// Store embeddings alongside memories
// Use vector similarity for context retrieval
```

### 14.2 Cross-Device Sync (Optional)

For users who want memory across devices:

```typescript
// Future: Optional encrypted sync
interface SyncConfig {
  enabled: boolean;
  provider: 'icloud' | 'dropbox' | 'custom';
  encryptionKey: string;
}
```

### 14.3 Memory Visualization

Graph view showing memory relationships:

- Connections between related memories
- Timeline view of memory creation
- Usage heatmap

---

## 15. Appendix

### A. Complete Type Definitions File

See `src/shared/types/memory.ts` for full type definitions.

### B. Database Schema SQL

See Section 3.1 for complete schema.

### C. API Reference

| Endpoint | Description |
|----------|-------------|
| `memory:getContext` | Load memories for conversation injection |
| `memory:store` | Store new memory |
| `memory:query` | Query with filters |
| `memory:search` | Full-text search |
| `memory:get` | Get single memory |
| `memory:update` | Update memory |
| `memory:delete` | Delete memory |
| `memory:getStats` | Get statistics |
| `memory:getCompactionCandidates` | Get memories needing summarization |
| `memory:applyCompaction` | Apply summary to memory |
| `memory:runDecay` | Run decay process |

---

## Approval & Sign-off

- [ ] Architecture Review
- [ ] Security Review  
- [ ] Implementation Approval
- [ ] Ready for Development

---

*Document generated by Alex Chen, Distinguished Software Architect*
*ArborChat Memory Service Design v1.0*
