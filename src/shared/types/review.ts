/**
 * Review Agent Types
 * 
 * Type definitions for the automated Review Agent (Sentinel) system.
 * Enables autonomous evaluation of agent session outcomes.
 * 
 * Based on Swarm Sentinel patterns for automated code review.
 * 
 * @module shared/types/review
 */

// ============================================================================
// Review Result Types
// ============================================================================

/**
 * Severity levels for identified issues
 */
export type IssueSeverity = 'critical' | 'major' | 'minor' | 'suggestion';

/**
 * Categories for issues and scores
 */
export type ReviewCategory = 
  | 'taskAccomplishment'
  | 'codeQuality'
  | 'safetyCompliance'
  | 'efficiency';

/**
 * Score for a specific category with reasoning
 */
export interface CategoryScore {
  score: number;  // 0.0 - 1.0
  reasoning: string;
}

/**
 * A specific issue identified during review
 */
export interface ReviewIssue {
  severity: IssueSeverity;
  category: ReviewCategory | string;
  description: string;
  evidence: string;  // Snippet from execution trace
}

/**
 * Complete review result from the Review Agent
 */
export interface ReviewResult {
  id: string;
  sessionId: string;
  timestamp: number;
  
  // Overall assessment
  overallScore: number;  // 0.0 - 1.0
  taskCompleted: boolean;
  
  // Detailed breakdown by category
  categories: {
    taskAccomplishment: CategoryScore;
    codeQuality: CategoryScore;
    safetyCompliance: CategoryScore;
    efficiency: CategoryScore;
  };
  
  // Specific findings
  issues: ReviewIssue[];
  strengths: string[];
  
  // Direct lessons extracted by Review Agent
  suggestedStrategies: string[];
  suggestedMistakes: string[];
  
  // Metadata
  reviewDurationMs?: number;
  modelUsed?: string;
}

/**
 * Database row representation of a review
 */
export interface ReviewResultRow {
  id: string;
  session_id: string;
  timestamp: number;
  overall_score: number;
  task_completed: number;  // SQLite boolean
  categories: string;      // JSON
  issues: string;          // JSON
  strengths: string;       // JSON
  suggested_strategies: string;  // JSON
  suggested_mistakes: string;    // JSON
  review_duration_ms: number | null;
  model_used: string | null;
}


// ============================================================================
// Review Agent Configuration
// ============================================================================

/**
 * Configuration for the Review Agent
 */
export interface ReviewAgentConfig {
  /** Model to use for review (defaults to a capable but cost-effective model) */
  model?: string;
  
  /** Temperature for review generation (lower = more consistent) */
  temperature?: number;
  
  /** Maximum tokens for review response */
  maxTokens?: number;
  
  /** Minimum tool calls required to warrant review */
  minToolCallsForReview?: number;
  
  /** Sampling rate for normal sessions (0.0 - 1.0) */
  samplingRate?: number;
  
  /** Always review sessions longer than this duration (ms) */
  alwaysReviewAboveDurationMs?: number;
  
  /** Skip review for similar recent sessions */
  skipSimilarRecentCount?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_REVIEW_CONFIG: Required<ReviewAgentConfig> = {
  model: 'gemini-2.0-flash',
  temperature: 0.2,
  maxTokens: 2000,
  minToolCallsForReview: 2,
  samplingRate: 0.3,
  alwaysReviewAboveDurationMs: 300000,  // 5 minutes
  skipSimilarRecentCount: 3
};


// ============================================================================
// Review Context Types
// ============================================================================

/**
 * Execution trace entry for review context
 */
export interface TraceEntry {
  index: number;
  toolName: string;
  input: Record<string, unknown>;
  success: boolean;
  output?: string;
  error?: string;
  durationMs?: number;
}

/**
 * Context provided to the Review Agent
 */
export interface ReviewContext {
  task: string;
  workingDirectory?: string;
  toolCalls: TraceEntry[];
  sessionStatus: 'completed' | 'aborted' | 'error';
  sessionDurationMs: number;
  errors: string[];
}


// ============================================================================
// User Feedback Types
// ============================================================================

/**
 * User feedback on a session (optional override for automated review)
 */
export interface UserSessionFeedback {
  sessionId: string;
  rating: 'helpful' | 'unhelpful';
  comment?: string;
  timestamp: number;
}

/**
 * Database row for user feedback
 */
export interface UserSessionFeedbackRow {
  id: string;
  session_id: string;
  rating: string;
  comment: string | null;
  timestamp: number;
}


// ============================================================================
// Reflector Types
// ============================================================================

/**
 * Output from the reflection process
 */
export interface ReflectionResult {
  sessionId: string;
  review: ReviewResult;
  userFeedback?: UserSessionFeedback;
  entriesCreated: number;
  entriesMerged: number;
  timestamp: number;
}

/**
 * Statistics about the learning system
 */
export interface LearningStats {
  totalSessionsReviewed: number;
  totalEntriesCreated: number;
  avgSessionScore: number;
  reviewsToday: number;
  lastReviewTimestamp: number;
}
