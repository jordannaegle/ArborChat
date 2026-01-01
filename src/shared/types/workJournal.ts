/**
 * Work Journal Types
 * 
 * Type definitions for the Agent Work Journal system.
 * Enables real-time logging, checkpointing, and resumption of AI agent work.
 * 
 * @module shared/types/workJournal
 */

// ============================================================================
// Status and Importance Enums
// ============================================================================

export type WorkSessionStatus = 'active' | 'paused' | 'completed' | 'crashed';

export type EntryImportance = 'low' | 'normal' | 'high' | 'critical';

export type EntryType =
  | 'session_start'      // Initial prompt and context
  | 'thinking'           // Agent's reasoning/planning
  | 'tool_request'       // Tool call initiated
  | 'tool_approved'      // User approved tool
  | 'tool_rejected'      // User rejected tool
  | 'tool_result'        // Tool execution result
  | 'code_generated'     // Code the agent wrote
  | 'file_read'          // File content retrieved
  | 'file_written'       // File created/modified
  | 'decision'           // Key decision point
  | 'error'              // Error encountered
  | 'recovery'           // Recovery from error
  | 'checkpoint'         // Manual or auto checkpoint
  | 'user_feedback'      // User interjection/correction
  | 'summary'            // Periodic work summary
  | 'session_end';       // Work completed or stopped


// ============================================================================
// Entry Content Types (Discriminated Union)
// ============================================================================

export interface SessionStartContent {
  type: 'session_start';
  originalPrompt: string;
  systemContext?: string;
  selectedModel: string;
  selectedPersona?: string;
}

export interface ThinkingContent {
  type: 'thinking';
  reasoning: string;
  planSteps?: string[];
}

export interface ToolRequestContent {
  type: 'tool_request';
  toolName: string;
  toolInput: Record<string, unknown>;
  riskLevel: 'safe' | 'moderate' | 'dangerous';
}

export interface ToolApprovalContent {
  type: 'tool_approved' | 'tool_rejected';
  toolName: string;
  requestId: string;
  modifiedArgs?: Record<string, unknown>;
  rejectionReason?: string;
}

export interface ToolResultContent {
  type: 'tool_result';
  toolName: string;
  success: boolean;
  output: string;
  truncated: boolean;
  errorMessage?: string;
  duration?: number;
}

export interface CodeGeneratedContent {
  type: 'code_generated';
  language: string;
  code: string;
  purpose: string;
  filePath?: string;
}


export interface FileOperationContent {
  type: 'file_read' | 'file_written';
  filePath: string;
  operation: 'read' | 'create' | 'modify' | 'delete';
  contentPreview?: string;
  linesAffected?: number;
}

export interface DecisionContent {
  type: 'decision';
  question: string;
  chosenOption: string;
  alternatives?: string[];
  reasoning: string;
}

export interface ErrorContent {
  type: 'error';
  errorType: string;
  message: string;
  recoverable: boolean;
  stackTrace?: string;
}

export interface RecoveryContent {
  type: 'recovery';
  errorRef?: number; // Reference to the error entry sequence number
  recoveryAction: string;
  success: boolean;
}


export interface CheckpointContent {
  type: 'checkpoint';
  checkpointId: string;
  summary: string;
  completedTasks: string[];
  pendingTasks: string[];
}

export interface SummaryContent {
  type: 'summary';
  periodCovered: { start: number; end: number };
  accomplishments: string[];
  currentStatus: string;
  nextSteps: string[];
}

export interface UserFeedbackContent {
  type: 'user_feedback';
  feedback: string;
  feedbackType: 'correction' | 'approval' | 'rejection' | 'guidance' | 'clarification';
}

export interface SessionEndContent {
  type: 'session_end';
  reason: 'completed' | 'paused' | 'crashed' | 'user_stopped';
  finalSummary?: string;
}


// Discriminated union for type-safe entry content
export type EntryContent =
  | SessionStartContent
  | ThinkingContent
  | ToolRequestContent
  | ToolApprovalContent
  | ToolResultContent
  | CodeGeneratedContent
  | FileOperationContent
  | DecisionContent
  | ErrorContent
  | RecoveryContent
  | CheckpointContent
  | SummaryContent
  | UserFeedbackContent
  | SessionEndContent;

// ============================================================================
// Main Entity Types
// ============================================================================

/**
 * A single logged entry in a work session
 */
export interface WorkEntry {
  id: number;
  sessionId: string;
  sequenceNum: number;
  entryType: EntryType;
  timestamp: number;
  content: EntryContent;
  tokenEstimate: number;
  importance: EntryImportance;
}


/**
 * A work session - top-level container for agent work
 */
export interface WorkSession {
  id: string;
  conversationId: string;
  originalPrompt: string;
  status: WorkSessionStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  tokenEstimate: number;
  entryCount: number;
}

/**
 * A checkpoint - periodic snapshot for efficient resumption
 */
export interface WorkCheckpoint {
  id: string;
  sessionId: string;
  createdAt: number;
  summary: string;
  keyDecisions: string[];
  currentState: string;
  filesModified: string[];
  pendingActions: string[];
}


/**
 * Resumption context - what gets passed to a new session to continue work
 */
export interface ResumptionContext {
  originalPrompt: string;
  workSummary: string;
  keyDecisions: string[];
  currentState: string;
  filesModified: string[];
  pendingActions: string[];
  errorHistory: string[];
  suggestedNextSteps: string[];
  tokenCount: number;
}

// ============================================================================
// Query and Filter Types
// ============================================================================

export interface GetEntriesOptions {
  since?: number;         // Get entries after this sequence number
  limit?: number;         // Max entries to return
  importance?: EntryImportance[];  // Filter by importance levels
  types?: EntryType[];    // Filter by entry types
}

export interface CreateCheckpointOptions {
  manual?: boolean;       // Was this manually triggered by user
  /** Use AI for summarization (default: true if enabled in settings) */
  useAISummarization?: boolean;
  /** Target token count for AI summary */
  targetTokens?: number;
}

/** Configuration for AI-powered summarization */
export interface SummarizationConfig {
  enabled: boolean;
  preferredModel?: string;
  targetTokens: number;
  includeErrorAnalysis: boolean;
}

// ============================================================================
// Database Row Types (for internal use)
// ============================================================================

export interface WorkSessionRow {
  id: string;
  conversation_id: string;
  original_prompt: string;
  status: string;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
  token_estimate: number;
  entry_count: number;
}


export interface WorkEntryRow {
  id: number;
  session_id: string;
  sequence_num: number;
  entry_type: string;
  timestamp: number;
  content: string;  // JSON string
  token_estimate: number;
  importance: string;
}

export interface WorkCheckpointRow {
  id: string;
  session_id: string;
  created_at: number;
  summary: string;
  key_decisions: string;   // JSON array string
  current_state: string;
  files_modified: string;  // JSON array string
  pending_actions: string; // JSON array string
}

// ============================================================================
// Subscription Types
// ============================================================================

export type WorkEntryCallback = (entry: WorkEntry) => void;
export type UnsubscribeFn = () => void;

// ============================================================================
// Event Types (for IPC)
// ============================================================================

export interface WorkJournalEntryEvent {
  sessionId: string;
  entry: WorkEntry;
}

export interface WorkJournalStatusEvent {
  sessionId: string;
  status: WorkSessionStatus;
}
