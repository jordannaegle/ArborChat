/**
 * Reflector Service
 * 
 * Orchestrates the autonomous learning loop:
 * Session Completion → Review Agent → Curator → Playbook
 * 
 * This is the main entry point for the agentic memory system.
 * Triggered asynchronously after agent sessions complete.
 * 
 * @module main/services/ReflectorService
 */

import type { ReviewResult, UserSessionFeedback, ReflectionResult, LearningStats } from '../../shared/types/review'
import { getReviewAgentService, ReviewAgentService } from './ReviewAgentService'
import { getCuratorService, CuratorService } from './CuratorService'
import { WorkJournalManager } from './WorkJournalManager'
import { getDb } from '../db'


// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Delay before processing (allows for user feedback)
  PROCESSING_DELAY_MS: 5000,
  
  // Maximum concurrent reflections
  MAX_CONCURRENT: 3,
  
  // Retry configuration
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 10000
} as const;


// ============================================================================
// Reflector Service Class
// ============================================================================

export class ReflectorService {
  private reviewAgent: ReviewAgentService;
  private curator: CuratorService;
  private workJournal: WorkJournalManager;
  
  // Track pending and in-progress reflections
  private pendingReflections: Map<string, NodeJS.Timeout> = new Map();
  private inProgressReflections: Set<string> = new Set();
  
  // Stats tracking
  private sessionStats = {
    totalReviewed: 0,
    totalEntriesCreated: 0,
    reviewErrors: 0
  };

  constructor(workJournal: WorkJournalManager) {
    this.reviewAgent = getReviewAgentService();
    this.curator = getCuratorService();
    this.workJournal = workJournal;
  }

  /**
   * Configure the AI provider for the Review Agent
   */
  setAIProvider(provider: any): void {
    this.reviewAgent.setAIProvider(provider);
  }

  /**
   * Schedule a session for reflection (with delay for user feedback)
   */
  scheduleReflection(sessionId: string): void {
    // Cancel any existing pending reflection for this session
    if (this.pendingReflections.has(sessionId)) {
      clearTimeout(this.pendingReflections.get(sessionId));
    }

    // Schedule reflection after delay
    const timeout = setTimeout(() => {
      this.pendingReflections.delete(sessionId);
      this.processSession(sessionId).catch(err => {
        console.error(`[Reflector] Failed to process session ${sessionId}:`, err);
      });
    }, CONFIG.PROCESSING_DELAY_MS);

    this.pendingReflections.set(sessionId, timeout);
    console.log(`[Reflector] Scheduled reflection for session ${sessionId} in ${CONFIG.PROCESSING_DELAY_MS}ms`);
  }

  /**
   * Process a completed session immediately
   */
  async processSession(sessionId: string): Promise<ReflectionResult | null> {
    // Check concurrency limit
    if (this.inProgressReflections.size >= CONFIG.MAX_CONCURRENT) {
      console.log(`[Reflector] Concurrency limit reached, queuing session ${sessionId}`);
      this.scheduleReflection(sessionId);
      return null;
    }

    // Mark as in-progress
    this.inProgressReflections.add(sessionId);

    try {
      const session = this.workJournal.getSession(sessionId);
      if (!session) {
        console.warn(`[Reflector] Session ${sessionId} not found`);
        return null;
      }

      const entries = this.workJournal.getEntries(sessionId);
      
      // Check if we should review this session
      const recentReviewCount = this.reviewAgent.getRecentReviewCount('', 24);
      if (!this.reviewAgent.shouldReview(session, entries, recentReviewCount)) {
        console.log(`[Reflector] Skipping review for session ${sessionId} (sampling decision)`);
        return null;
      }

      // Get user feedback if any
      const userFeedback = await this.getUserFeedback(sessionId);

      // Run the review
      const review = await this.reviewAgent.reviewSession(session, entries);
      this.sessionStats.totalReviewed++;

      // Process review into playbook
      const curationResult = await this.curator.processReview(review);
      this.sessionStats.totalEntriesCreated += curationResult.entriesCreated;

      // If user provided feedback, let curator process it
      if (userFeedback) {
        await this.curator.processUserFeedback(sessionId, userFeedback.rating, review);
      }

      const result: ReflectionResult = {
        sessionId,
        review,
        userFeedback: userFeedback ?? undefined,
        entriesCreated: curationResult.entriesCreated,
        entriesMerged: curationResult.entriesMerged,
        timestamp: Date.now()
      };

      console.log(
        `[Reflector] Completed reflection for session ${sessionId}: ` +
        `score=${review.overallScore.toFixed(2)}, entries=${curationResult.entriesCreated + curationResult.entriesMerged}`
      );

      return result;
    } catch (error) {
      this.sessionStats.reviewErrors++;
      console.error(`[Reflector] Error processing session ${sessionId}:`, error);
      throw error;
    } finally {
      this.inProgressReflections.delete(sessionId);
    }
  }

  /**
   * Process user feedback for a session
   */
  async processUserFeedback(sessionId: string, rating: 'helpful' | 'unhelpful', comment?: string): Promise<void> {
    // Store the feedback
    await this.storeUserFeedback({
      sessionId,
      rating,
      comment,
      timestamp: Date.now()
    });

    // Check if there's a pending reflection - if so, it will pick up the feedback
    if (this.pendingReflections.has(sessionId)) {
      console.log(`[Reflector] User feedback received for pending session ${sessionId}`);
      return;
    }

    // Check if reflection already completed
    const existingReview = await this.getReview(sessionId);
    if (existingReview) {
      // Process feedback adjustment
      await this.curator.processUserFeedback(sessionId, rating, existingReview);
      console.log(`[Reflector] Processed user feedback for already-reviewed session ${sessionId}`);
    } else {
      // Trigger immediate reflection with user feedback
      this.processSession(sessionId).catch(err => {
        console.error(`[Reflector] Failed to process feedback-triggered session ${sessionId}:`, err);
      });
    }
  }

  /**
   * Cancel a pending reflection
   */
  cancelPendingReflection(sessionId: string): boolean {
    const timeout = this.pendingReflections.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.pendingReflections.delete(sessionId);
      console.log(`[Reflector] Cancelled pending reflection for session ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get learning statistics
   */
  getStats(): LearningStats {
    const db = getDb();
    
    const reviewCount = db.prepare(`
      SELECT COUNT(*) as count FROM session_reviews
    `).get() as { count: number };

    const avgScore = db.prepare(`
      SELECT AVG(overall_score) as avg FROM session_reviews
    `).get() as { avg: number | null };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayReviews = db.prepare(`
      SELECT COUNT(*) as count FROM session_reviews WHERE timestamp >= ?
    `).get(today.getTime()) as { count: number };

    const lastReview = db.prepare(`
      SELECT MAX(timestamp) as last FROM session_reviews
    `).get() as { last: number | null };

    return {
      totalSessionsReviewed: reviewCount.count,
      totalEntriesCreated: this.sessionStats.totalEntriesCreated,
      avgSessionScore: avgScore.avg ?? 0,
      reviewsToday: todayReviews.count,
      lastReviewTimestamp: lastReview.last ?? 0
    };
  }

  /**
   * Run maintenance tasks (call periodically)
   */
  async runMaintenance(): Promise<void> {
    console.log('[Reflector] Running maintenance...');
    
    const maintenanceResult = await this.curator.runMaintenance();
    
    console.log(
      `[Reflector] Maintenance complete: pruned ${maintenanceResult.entriesPruned} entries, ` +
      `${maintenanceResult.totalEntries} total entries`
    );
  }


  // ==========================================================================
  // Database Operations
  // ==========================================================================

  /**
   * Store user feedback
   */
  private async storeUserFeedback(feedback: UserSessionFeedback): Promise<void> {
    const db = getDb();
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_session_feedback (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        rating TEXT NOT NULL,
        comment TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_feedback_session ON user_session_feedback(session_id);
    `);

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO user_session_feedback (id, session_id, rating, comment, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `);

    const { randomUUID } = require('crypto');
    stmt.run(randomUUID(), feedback.sessionId, feedback.rating, feedback.comment ?? null, feedback.timestamp);
  }

  /**
   * Get user feedback for a session
   */
  private async getUserFeedback(sessionId: string): Promise<UserSessionFeedback | null> {
    const db = getDb();
    
    try {
      const stmt = db.prepare(`
        SELECT * FROM user_session_feedback WHERE session_id = ?
      `);
      const row = stmt.get(sessionId) as any;
      
      if (!row) return null;
      
      return {
        sessionId: row.session_id,
        rating: row.rating,
        comment: row.comment ?? undefined,
        timestamp: row.timestamp
      };
    } catch {
      // Table might not exist yet
      return null;
    }
  }

  /**
   * Get existing review for a session
   */
  private async getReview(sessionId: string): Promise<ReviewResult | null> {
    const db = getDb();
    
    try {
      const stmt = db.prepare(`
        SELECT * FROM session_reviews WHERE session_id = ?
      `);
      const row = stmt.get(sessionId) as any;
      
      if (!row) return null;
      
      return {
        id: row.id,
        sessionId: row.session_id,
        timestamp: row.timestamp,
        overallScore: row.overall_score,
        taskCompleted: row.task_completed === 1,
        categories: JSON.parse(row.categories),
        issues: JSON.parse(row.issues),
        strengths: JSON.parse(row.strengths),
        suggestedStrategies: JSON.parse(row.suggested_strategies),
        suggestedMistakes: JSON.parse(row.suggested_mistakes),
        reviewDurationMs: row.review_duration_ms,
        modelUsed: row.model_used
      };
    } catch {
      return null;
    }
  }
}


// ============================================================================
// Singleton Export
// ============================================================================

let reflectorInstance: ReflectorService | null = null;

export function getReflectorService(workJournal: WorkJournalManager): ReflectorService {
  if (!reflectorInstance) {
    reflectorInstance = new ReflectorService(workJournal);
  }
  return reflectorInstance;
}

export function initReflectorService(workJournal: WorkJournalManager): ReflectorService {
  reflectorInstance = new ReflectorService(workJournal);
  return reflectorInstance;
}
