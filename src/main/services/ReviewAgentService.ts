/**
 * Review Agent Service (Sentinel)
 * 
 * Automated evaluation of agent session outcomes.
 * Analyzes execution traces and extracts lessons for the playbook.
 * 
 * Based on Swarm Sentinel patterns for autonomous code review.
 * 
 * @module main/services/ReviewAgentService
 */

import { randomUUID } from 'crypto'
import type {
  ReviewResult,
  ReviewContext,
  TraceEntry,
  ReviewAgentConfig
} from '../../shared/types/review'
import { DEFAULT_REVIEW_CONFIG } from '../../shared/types/review'
import type { WorkSession, WorkEntry } from '../../shared/types/workJournal'
import { getDb } from '../db'


// ============================================================================
// Review Agent System Prompt
// ============================================================================

const REVIEW_AGENT_PROMPT = `You are a code review agent evaluating an AI coding assistant's work.

Your job is to analyze the execution trace of an agent session and provide:
1. An objective assessment of whether the task was accomplished
2. Identification of any issues (security, quality, correctness)
3. Recognition of things done well
4. Concrete lessons for future agents

EVALUATION CRITERIA:

## Task Accomplishment (0-100)
- Did the agent complete what was asked?
- Were acceptance criteria met?
- Is the solution correct and functional?

## Code Quality (0-100)
- Is the code well-structured?
- Are there obvious bugs or issues?
- Does it follow language conventions?

## Safety Compliance (0-100)
- Were dangerous operations handled appropriately?
- Any hardcoded credentials or secrets?
- Proper error handling?

## Efficiency (0-100)
- Did the agent take unnecessary steps?
- Were tools used appropriately?
- Could this have been done more simply?

LESSON EXTRACTION GUIDELINES:

When extracting lessons, be SPECIFIC and ACTIONABLE:

GOOD lessons:
- "When editing TypeScript files, always run tsc --noEmit to verify compilation before committing"
- "For this codebase, API routes must be registered in src/routes/index.ts"
- "Use Desktop Commander's read_file instead of execute_command with cat"

BAD lessons (too vague):
- "Be careful with code"
- "Test things before committing"
- "Follow best practices"

OUTPUT FORMAT (JSON only):
{
  "taskCompleted": boolean,
  "overallScore": number (0.0-1.0),
  "categories": {
    "taskAccomplishment": { "score": number (0.0-1.0), "reasoning": "..." },
    "codeQuality": { "score": number (0.0-1.0), "reasoning": "..." },
    "safetyCompliance": { "score": number (0.0-1.0), "reasoning": "..." },
    "efficiency": { "score": number (0.0-1.0), "reasoning": "..." }
  },
  "issues": [
    { "severity": "critical|major|minor|suggestion", "category": "...", "description": "...", "evidence": "..." }
  ],
  "strengths": ["..."],
  "suggestedStrategies": ["Concrete lesson that worked well..."],
  "suggestedMistakes": ["Pattern to avoid in future..."]
}`;


// ============================================================================
// Review Agent Service Class
// ============================================================================

export class ReviewAgentService {
  private config: Required<ReviewAgentConfig>;
  private aiProvider: AIProviderInterface | null = null;

  constructor(config: Partial<ReviewAgentConfig> = {}) {
    this.config = { ...DEFAULT_REVIEW_CONFIG, ...config };
  }

  /**
   * Set the AI provider for review generation
   */
  setAIProvider(provider: AIProviderInterface): void {
    this.aiProvider = provider;
  }

  /**
   * Review a completed agent session
   */
  async reviewSession(
    session: WorkSession,
    entries: WorkEntry[]
  ): Promise<ReviewResult> {
    if (!this.aiProvider) {
      throw new Error('AI provider not configured for Review Agent');
    }

    const startTime = Date.now();
    
    // Build review context
    const context = this.buildReviewContext(session, entries);
    
    // Generate review via LLM
    const reviewContent = await this.generateReview(context);
    
    // Parse and validate the review
    const review = this.parseReviewResponse(reviewContent, session.id);
    review.reviewDurationMs = Date.now() - startTime;
    review.modelUsed = this.config.model;

    // Store the review
    await this.storeReview(review);

    console.log(`[ReviewAgent] Reviewed session ${session.id}: score=${review.overallScore.toFixed(2)}`);
    return review;
  }

  /**
   * Determine if a session should be reviewed
   */
  shouldReview(
    session: WorkSession,
    entries: WorkEntry[],
    recentReviewCount: number
  ): boolean {
    // Always review if session had errors
    if (session.status === 'crashed' || session.status === 'error' as any) {
      return true;
    }

    // Count tool calls
    const toolCalls = entries.filter(e => e.entryType === 'tool_result').length;
    
    // Skip trivial sessions
    if (toolCalls < this.config.minToolCallsForReview) {
      return false;
    }

    // Skip if we've recently reviewed similar work
    if (recentReviewCount >= this.config.skipSimilarRecentCount) {
      return false;
    }

    // Always review long sessions
    const duration = (session.completedAt ?? Date.now()) - session.createdAt;
    if (duration >= this.config.alwaysReviewAboveDurationMs) {
      return true;
    }

    // Sample based on configured rate
    return Math.random() < this.config.samplingRate;
  }

  /**
   * Build the context for review
   */
  private buildReviewContext(session: WorkSession, entries: WorkEntry[]): ReviewContext {
    const toolCalls: TraceEntry[] = [];
    const errors: string[] = [];
    let index = 0;

    for (const entry of entries) {
      if (entry.content.type === 'tool_result') {
        const content = entry.content as any;
        toolCalls.push({
          index: index++,
          toolName: content.toolName,
          input: {},  // Truncated for privacy
          success: content.success,
          output: content.output?.slice(0, 500),
          error: content.errorMessage,
          durationMs: content.duration
        });
      }

      if (entry.content.type === 'error') {
        const content = entry.content as any;
        errors.push(`${content.errorType}: ${content.message}`);
      }
    }

    return {
      task: session.originalPrompt,
      workingDirectory: undefined,  // Could be extracted from entries
      toolCalls,
      sessionStatus: session.status as 'completed' | 'aborted' | 'error',
      sessionDurationMs: (session.completedAt ?? Date.now()) - session.createdAt,
      errors
    };
  }

  /**
   * Generate review using AI provider
   */
  private async generateReview(context: ReviewContext): Promise<string> {
    const prompt = this.formatReviewPrompt(context);

    const response = await this.aiProvider!.generateResponse({
      model: this.config.model,
      systemPrompt: REVIEW_AGENT_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    });

    return response;
  }

  /**
   * Format the review prompt with context
   */
  private formatReviewPrompt(context: ReviewContext): string {
    const toolCallsSection = context.toolCalls.map(tc => `
### [${tc.index + 1}] Tool: ${tc.toolName}
**Result:** ${tc.success ? 'SUCCESS' : 'FAILED'}
${tc.error ? `**Error:** ${tc.error}` : ''}
${tc.output ? `**Output (truncated):**\n\`\`\`\n${tc.output.slice(0, 300)}\n\`\`\`` : ''}
`).join('\n');

    return `
## ORIGINAL TASK
${context.task}

## AGENT EXECUTION TRACE
${toolCallsSection}

## SESSION OUTCOME
Status: ${context.sessionStatus}
Duration: ${Math.round(context.sessionDurationMs / 1000)}s
Total Tool Calls: ${context.toolCalls.length}
Errors Encountered: ${context.errors.length}

${context.errors.length > 0 ? `
## ERRORS
${context.errors.join('\n')}
` : ''}

Please evaluate this agent session and provide your structured review as JSON.
`;
  }

  /**
   * Parse and validate the review response
   */
  private parseReviewResponse(response: string, sessionId: string): ReviewResult {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    try {
      const parsed = JSON.parse(jsonStr.trim());
      
      return {
        id: randomUUID(),
        sessionId,
        timestamp: Date.now(),
        taskCompleted: parsed.taskCompleted ?? false,
        overallScore: Math.max(0, Math.min(1, parsed.overallScore ?? 0.5)),
        categories: {
          taskAccomplishment: this.normalizeCategory(parsed.categories?.taskAccomplishment),
          codeQuality: this.normalizeCategory(parsed.categories?.codeQuality),
          safetyCompliance: this.normalizeCategory(parsed.categories?.safetyCompliance),
          efficiency: this.normalizeCategory(parsed.categories?.efficiency)
        },
        issues: (parsed.issues ?? []).map(this.normalizeIssue),
        strengths: parsed.strengths ?? [],
        suggestedStrategies: parsed.suggestedStrategies ?? [],
        suggestedMistakes: parsed.suggestedMistakes ?? []
      };
    } catch (error) {
      console.error('[ReviewAgent] Failed to parse review response:', error);
      
      // Return a default review on parse failure
      return this.createDefaultReview(sessionId);
    }
  }

  /**
   * Normalize a category score
   */
  private normalizeCategory(cat: any): { score: number; reasoning: string } {
    return {
      score: Math.max(0, Math.min(1, cat?.score ?? 0.5)),
      reasoning: cat?.reasoning ?? 'Unable to evaluate'
    };
  }

  /**
   * Normalize an issue
   */
  private normalizeIssue(issue: any): any {
    return {
      severity: ['critical', 'major', 'minor', 'suggestion'].includes(issue?.severity) 
        ? issue.severity 
        : 'minor',
      category: issue?.category ?? 'general',
      description: issue?.description ?? 'Unknown issue',
      evidence: issue?.evidence ?? ''
    };
  }

  /**
   * Create a default review when parsing fails
   */
  private createDefaultReview(sessionId: string): ReviewResult {
    return {
      id: randomUUID(),
      sessionId,
      timestamp: Date.now(),
      taskCompleted: false,
      overallScore: 0.5,
      categories: {
        taskAccomplishment: { score: 0.5, reasoning: 'Review generation failed' },
        codeQuality: { score: 0.5, reasoning: 'Review generation failed' },
        safetyCompliance: { score: 0.5, reasoning: 'Review generation failed' },
        efficiency: { score: 0.5, reasoning: 'Review generation failed' }
      },
      issues: [],
      strengths: [],
      suggestedStrategies: [],
      suggestedMistakes: []
    };
  }

  /**
   * Store a review in the database
   */
  private async storeReview(review: ReviewResult): Promise<void> {
    const db = getDb();
    
    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_reviews (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        overall_score REAL NOT NULL,
        task_completed INTEGER NOT NULL,
        categories TEXT NOT NULL,
        issues TEXT NOT NULL,
        strengths TEXT NOT NULL,
        suggested_strategies TEXT NOT NULL,
        suggested_mistakes TEXT NOT NULL,
        review_duration_ms INTEGER,
        model_used TEXT,
        FOREIGN KEY (session_id) REFERENCES work_sessions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_reviews_session ON session_reviews(session_id);
      CREATE INDEX IF NOT EXISTS idx_reviews_timestamp ON session_reviews(timestamp DESC);
    `);

    const stmt = db.prepare(`
      INSERT INTO session_reviews 
      (id, session_id, timestamp, overall_score, task_completed, categories, issues, 
       strengths, suggested_strategies, suggested_mistakes, review_duration_ms, model_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      review.id,
      review.sessionId,
      review.timestamp,
      review.overallScore,
      review.taskCompleted ? 1 : 0,
      JSON.stringify(review.categories),
      JSON.stringify(review.issues),
      JSON.stringify(review.strengths),
      JSON.stringify(review.suggestedStrategies),
      JSON.stringify(review.suggestedMistakes),
      review.reviewDurationMs ?? null,
      review.modelUsed ?? null
    );
  }

  /**
   * Get recent reviews for a working directory (for sampling decisions)
   */
  getRecentReviewCount(_workingDirectory: string, withinHours: number = 24): number {
    const db = getDb();
    const cutoff = Date.now() - (withinHours * 60 * 60 * 1000);
    
    const stmt = db.prepare(`
      SELECT COUNT(*) as count FROM session_reviews WHERE timestamp > ?
    `);
    
    const result = stmt.get(cutoff) as { count: number };
    return result.count;
  }
}


// ============================================================================
// AI Provider Interface (simplified)
// ============================================================================

interface AIProviderInterface {
  generateResponse(options: {
    model: string;
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    temperature: number;
    maxTokens: number;
  }): Promise<string>;
}


// ============================================================================
// Singleton Export
// ============================================================================

let reviewAgentInstance: ReviewAgentService | null = null;

export function getReviewAgentService(): ReviewAgentService {
  if (!reviewAgentInstance) {
    reviewAgentInstance = new ReviewAgentService();
  }
  return reviewAgentInstance;
}
