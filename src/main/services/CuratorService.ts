/**
 * Curator Service
 * 
 * Processes Review Agent outputs and merges lessons into the Playbook.
 * Handles deduplication, scoring, and entry lifecycle management.
 * 
 * This is a deterministic service - no LLM calls required.
 * 
 * @module main/services/CuratorService
 */

import type { ReviewResult, ReviewIssue } from '../../shared/types/review'
import type { NewPlaybookEntry } from '../../shared/types/playbook'
import { getPlaybookService, PlaybookService } from './PlaybookService'


// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  // Weighting for helpful counts based on review scores
  SUCCESS_WEIGHT: 2,
  FAILURE_WEIGHT: 1,
  
  // Issue severity to helpful count mapping
  ISSUE_SEVERITY_WEIGHTS: {
    critical: 3,
    major: 2,
    minor: 1,
    suggestion: 1
  },
  
  // Rate limiting
  MAX_ENTRIES_PER_SESSION: 5,
  MIN_CONTENT_LENGTH: 20
} as const;


// ============================================================================
// Curator Service Class
// ============================================================================

export class CuratorService {
  private playbookService: PlaybookService;

  constructor() {
    this.playbookService = getPlaybookService();
  }

  /**
   * Process a review result and update the playbook
   */
  async processReview(review: ReviewResult): Promise<CurationResult> {
    const result: CurationResult = {
      sessionId: review.sessionId,
      entriesCreated: 0,
      entriesMerged: 0,
      entriesSkipped: 0
    };

    // Determine weighting based on task completion
    const baseWeight = review.taskCompleted ? CONFIG.SUCCESS_WEIGHT : CONFIG.FAILURE_WEIGHT;

    // 1. Process suggested strategies
    for (const strategy of review.suggestedStrategies.slice(0, CONFIG.MAX_ENTRIES_PER_SESSION)) {
      if (this.isValidEntry(strategy)) {
        const outcome = await this.addOrMergeEntry({
          entryType: 'strategy',
          content: this.sanitizeContent(strategy),
          helpfulCount: review.taskCompleted ? baseWeight : 1,
          harmfulCount: 0,
          sourceSessionId: review.sessionId
        });
        
        if (outcome === 'created') result.entriesCreated++;
        else if (outcome === 'merged') result.entriesMerged++;
        else result.entriesSkipped++;
      }
    }

    // 2. Process suggested mistakes
    for (const mistake of review.suggestedMistakes.slice(0, CONFIG.MAX_ENTRIES_PER_SESSION)) {
      if (this.isValidEntry(mistake)) {
        const outcome = await this.addOrMergeEntry({
          entryType: 'mistake',
          content: this.sanitizeContent(mistake),
          helpfulCount: review.taskCompleted ? 1 : baseWeight,  // Weight mistakes more on failure
          harmfulCount: 0,
          sourceSessionId: review.sessionId
        });
        
        if (outcome === 'created') result.entriesCreated++;
        else if (outcome === 'merged') result.entriesMerged++;
        else result.entriesSkipped++;
      }
    }

    // 3. Convert critical/major issues to mistake entries
    const significantIssues = review.issues.filter(
      i => i.severity === 'critical' || i.severity === 'major'
    );

    for (const issue of significantIssues.slice(0, 3)) {
      const content = this.formatIssueAsEntry(issue);
      if (this.isValidEntry(content)) {
        const weight = CONFIG.ISSUE_SEVERITY_WEIGHTS[issue.severity];
        const outcome = await this.addOrMergeEntry({
          entryType: 'mistake',
          content: this.sanitizeContent(content),
          helpfulCount: weight,
          harmfulCount: 0,
          sourceSessionId: review.sessionId
        });
        
        if (outcome === 'created') result.entriesCreated++;
        else if (outcome === 'merged') result.entriesMerged++;
        else result.entriesSkipped++;
      }
    }

    console.log(
      `[Curator] Processed review for session ${review.sessionId}: ` +
      `${result.entriesCreated} created, ${result.entriesMerged} merged, ${result.entriesSkipped} skipped`
    );

    return result;
  }

  /**
   * Process user feedback to adjust playbook
   */
  async processUserFeedback(
    sessionId: string,
    rating: 'helpful' | 'unhelpful',
    review?: ReviewResult
  ): Promise<void> {
    if (!review) {
      console.log(`[Curator] No review for session ${sessionId}, skipping user feedback processing`);
      return;
    }

    const isPositive = rating === 'helpful';
    const adjustment = isPositive ? 1 : -1;

    // Boost or penalize entries from this session
    const entries = this.playbookService.getEntries({ limit: 100 });
    const sessionEntries = entries.filter(e => e.sourceSessionId === sessionId);

    for (const entry of sessionEntries) {
      if (adjustment > 0) {
        this.playbookService.updateEntryScore(entry.id, true);
      } else {
        this.playbookService.updateEntryScore(entry.id, false);
      }
    }

    // If user disagreed with automated assessment, add corrective entries
    if (!isPositive && review.overallScore > 0.7) {
      // Automated review was too positive - the lessons might be wrong
      for (const entry of sessionEntries) {
        this.playbookService.updateEntryScore(entry.id, false);
      }
      console.log(`[Curator] User disagreed with positive review - penalized ${sessionEntries.length} entries`);
    } else if (isPositive && review.overallScore < 0.5) {
      // Automated review was too harsh - boost the strategies
      for (const entry of sessionEntries.filter(e => e.entryType === 'strategy')) {
        this.playbookService.updateEntryScore(entry.id, true);
        this.playbookService.updateEntryScore(entry.id, true);  // Double boost
      }
      console.log(`[Curator] User disagreed with negative review - boosted ${sessionEntries.length} entries`);
    }
  }

  /**
   * Add or merge an entry into the playbook
   */
  private async addOrMergeEntry(entry: NewPlaybookEntry): Promise<'created' | 'merged' | 'skipped'> {
    try {
      // Check for similar existing entry
      const existing = this.playbookService.findSimilarEntry(entry.content, entry.entryType);
      
      if (existing) {
        this.playbookService.updateEntryScore(existing.id, true);
        return 'merged';
      }

      await this.playbookService.addEntry(entry);
      return 'created';
    } catch (error) {
      console.error('[Curator] Failed to add entry:', error);
      return 'skipped';
    }
  }

  /**
   * Validate that an entry is worth storing
   */
  private isValidEntry(content: string): boolean {
    if (!content || content.length < CONFIG.MIN_CONTENT_LENGTH) {
      return false;
    }

    // Filter out generic/vague entries
    const genericPatterns = [
      /^be careful/i,
      /^follow best practices/i,
      /^test things/i,
      /^write good code/i,
      /^be thorough/i
    ];

    for (const pattern of genericPatterns) {
      if (pattern.test(content)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Sanitize content for storage
   */
  private sanitizeContent(content: string): string {
    return content
      .trim()
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .slice(0, 2000);       // Enforce max length
  }

  /**
   * Format a review issue as a playbook entry
   */
  private formatIssueAsEntry(issue: ReviewIssue): string {
    return `[${issue.severity.toUpperCase()}] ${issue.description}`;
  }

  /**
   * Run periodic maintenance on the playbook
   */
  async runMaintenance(): Promise<MaintenanceResult> {
    const pruned = this.playbookService.pruneStaleEntries();
    const stats = this.playbookService.getStats();

    return {
      entriesPruned: pruned,
      totalEntries: stats.totalEntries,
      avgHelpfulScore: stats.avgHelpfulScore
    };
  }
}


// ============================================================================
// Result Types
// ============================================================================

export interface CurationResult {
  sessionId: string;
  entriesCreated: number;
  entriesMerged: number;
  entriesSkipped: number;
}

export interface MaintenanceResult {
  entriesPruned: number;
  totalEntries: number;
  avgHelpfulScore: number;
}


// ============================================================================
// Singleton Export
// ============================================================================

let curatorInstance: CuratorService | null = null;

export function getCuratorService(): CuratorService {
  if (!curatorInstance) {
    curatorInstance = new CuratorService();
  }
  return curatorInstance;
}
