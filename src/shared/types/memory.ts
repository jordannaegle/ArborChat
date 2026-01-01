/**
 * Arbor Memory Service Types
 * 
 * Type definitions for the native memory system that provides
 * persistent, scoped, auto-injecting memory for AI conversations.
 * 
 * @module shared/types/memory
 */

// ============================================================================
// Enums & Literal Types
// ============================================================================

/**
 * Memory type classification determines how the memory is categorized
 * and affects prompt formatting priority.
 */
export type MemoryType = 
  | 'preference'    // User preferences (dark mode, coding style)
  | 'fact'          // Facts about user (name, role, projects)
  | 'context'       // Contextual info (current goals, recent work)
  | 'skill'         // User skills/expertise
  | 'instruction'   // Standing instructions ("always use TypeScript")
  | 'relationship'; // Relations to other entities

/**
 * Memory scope determines visibility and retrieval behavior.
 */
export type MemoryScope = 
  | 'global'        // Available everywhere
  | 'project'       // Specific to a project path
  | 'conversation'; // Specific to a conversation

/**
 * How the memory was created - affects confidence weighting.
 */
export type MemorySource = 
  | 'user_stated'   // User explicitly said this
  | 'ai_inferred'   // AI inferred from conversation
  | 'agent_stored'  // Agent explicitly stored via tool
  | 'system';       // System-generated (e.g., from imports)

/**
 * Privacy level controls injection behavior into AI context.
 */
export type MemoryPrivacyLevel = 
  | 'always_include' // Always inject into context
  | 'normal'         // Include when relevant
  | 'sensitive'      // Only include when directly relevant
  | 'never_share';   // Never include in AI context

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Core memory entity stored in the database.
 */
export interface ArborMemory {
  /** Unique identifier (UUID) */
  id: string;
  
  // Content
  /** The actual memory content */
  content: string;
  /** AI-generated summary for compacted memories */
  summary?: string;
  
  // Classification
  /** Category of the memory */
  type: MemoryType;
  /** Visibility scope */
  scope: MemoryScope;
  /** Project path or conversation ID (null for global) */
  scopeId?: string;
  
  // Attribution
  /** How this memory was created */
  source: MemorySource;
  /** Confidence score (0.0 - 1.0) */
  confidence: number;
  
  // Metadata
  /** Tags for filtering and organization */
  tags?: string[];
  /** IDs of related memories */
  relatedMemories?: string[];
  
  // Lifecycle timestamps (Unix ms)
  /** When the memory was created */
  createdAt: number;
  /** When the memory was last updated */
  updatedAt: number;
  /** When the memory was last accessed */
  accessedAt: number;
  /** Number of times this memory has been accessed */
  accessCount: number;
  
  // Decay & Compaction
  /** How fast confidence decays (0.0 - 1.0) */
  decayRate: number;
  /** When AI summary was generated */
  compactedAt?: number;
  /** Hard expiration timestamp */
  expiresAt?: number;
  
  // Privacy
  /** Controls how this memory is injected into context */
  privacyLevel: MemoryPrivacyLevel;
}

// ============================================================================
// Query & Filter Types
// ============================================================================

/**
 * Query parameters for memory retrieval.
 */
export interface MemoryQuery {
  // Scope filters
  /** Filter by scope type */
  scope?: MemoryScope;
  /** Filter by specific scope ID (project path or conversation ID) */
  scopeId?: string;
  /** Include global memories when querying project/conversation scope */
  includeGlobal?: boolean;
  
  // Type filters
  /** Filter by memory types */
  types?: MemoryType[];
  
  // Confidence threshold
  /** Minimum confidence score (0.0 - 1.0) */
  minConfidence?: number;
  
  // Privacy filter
  /** Filter by privacy levels */
  privacyLevels?: MemoryPrivacyLevel[];
  
  // Search
  /** Full-text search query */
  searchText?: string;
  /** Filter by tags */
  tags?: string[];
  
  // Pagination
  /** Maximum number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
  
  // Sorting
  /** Field to sort by */
  sortBy?: 'confidence' | 'accessedAt' | 'createdAt' | 'accessCount';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Context & Injection Types
// ============================================================================

/**
 * Context returned for conversation injection.
 * This is the primary return type for conversation start.
 */
export interface MemoryContext {
  /** Formatted prompt section to inject into system prompt */
  formattedPrompt: string;
  
  /** Raw memories for UI display */
  memories: ArborMemory[];
  
  /** Statistics about loaded memories */
  stats: {
    totalLoaded: number;
    byScope: Record<MemoryScope, number>;
    byType: Record<MemoryType, number>;
    avgConfidence: number;
  };
  
  /** Loading status */
  status: 'loaded' | 'empty' | 'error';
  /** Error message if status is 'error' */
  error?: string;
}

// ============================================================================
// Storage Types
// ============================================================================

/**
 * Request to store a new memory.
 */
export interface StoreMemoryRequest {
  /** The information to remember */
  content: string;
  /** Category of memory */
  type: MemoryType;
  
  // Optional overrides (defaults applied if not provided)
  /** Scope (default: 'global') */
  scope?: MemoryScope;
  /** Scope ID for project/conversation scope */
  scopeId?: string;
  /** Source attribution (default: 'ai_inferred') */
  source?: MemorySource;
  /** Initial confidence (default: 0.8) */
  confidence?: number;
  /** Tags for organization */
  tags?: string[];
  /** Privacy level (default: 'normal') */
  privacyLevel?: MemoryPrivacyLevel;
  /** Decay rate (default: 0.1) */
  decayRate?: number;
  /** Hard expiration timestamp */
  expiresAt?: number;
}

/**
 * Result of storing a memory.
 */
export interface StoreMemoryResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** ID of the created memory */
  memoryId?: string;
  /** Error message if failed */
  error?: string;
  /** Whether this was detected as a duplicate */
  duplicate?: boolean;
  /** ID of existing memory if duplicate */
  existingMemoryId?: string;
}

/**
 * Request to update an existing memory.
 */
export interface UpdateMemoryRequest {
  /** ID of the memory to update */
  id: string;
  /** New content */
  content?: string;
  /** New type */
  type?: MemoryType;
  /** New scope */
  scope?: MemoryScope;
  /** New scope ID */
  scopeId?: string;
  /** New confidence */
  confidence?: number;
  /** New tags */
  tags?: string[];
  /** New privacy level */
  privacyLevel?: MemoryPrivacyLevel;
  /** AI-generated summary */
  summary?: string;
}

// ============================================================================
// Compaction & Maintenance Types
// ============================================================================

/**
 * Memory candidate for AI-driven compaction/summarization.
 */
export interface CompactionCandidate {
  /** The memory to be compacted */
  memory: ArborMemory;
  /** Why this memory was selected for compaction */
  reason: 'age' | 'low_confidence' | 'low_access' | 'size';
  /** Recommended action */
  suggestedAction: 'summarize' | 'delete' | 'archive';
}

/**
 * Result of running the decay process.
 */
export interface DecayResult {
  /** Number of memories with updated confidence */
  updated: number;
  /** Number of memories deleted due to low confidence */
  deleted: number;
}

// ============================================================================
// Statistics Types
// ============================================================================

/**
 * Comprehensive memory statistics for UI display and monitoring.
 */
export interface MemoryStats {
  /** Total number of memories */
  totalMemories: number;
  /** Breakdown by scope */
  byScope: Record<MemoryScope, number>;
  /** Breakdown by type */
  byType: Record<MemoryType, number>;
  /** Breakdown by source */
  bySource: Record<MemorySource, number>;
  /** Average confidence across all memories */
  avgConfidence: number;
  /** Timestamp of oldest memory */
  oldestMemory: number;
  /** Timestamp of newest memory */
  newestMemory: number;
  /** Total access count across all memories */
  totalAccessCount: number;
  /** Number of compacted memories */
  compactedCount: number;
}

// ============================================================================
// Database Row Types (Internal)
// ============================================================================

/**
 * Raw database row shape for memory records.
 * @internal
 */
export interface MemoryRow {
  id: string;
  content: string;
  summary: string | null;
  type: string;
  scope: string;
  scope_id: string | null;
  source: string;
  confidence: number;
  tags: string | null;
  related_memories: string | null;
  created_at: number;
  updated_at: number;
  accessed_at: number;
  access_count: number;
  decay_rate: number;
  compacted_at: number | null;
  expires_at: number | null;
  privacy_level: string;
}

/**
 * Raw database row for access log entries.
 * @internal
 */
export interface AccessLogRow {
  id: number;
  memory_id: string;
  accessed_at: number;
  context: string;
  conversation_id: string | null;
}
