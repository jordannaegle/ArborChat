/**
 * Summarization Service
 * 
 * Provides AI-powered summarization for work journal entries.
 * Uses the configured AI provider to generate coherent narratives
 * from structured work entries.
 * 
 * Design principles:
 * - Graceful fallback to heuristic summarization on failure
 * - Token-aware output targeting
 * - Provider-agnostic implementation
 * - Caching to avoid redundant API calls
 * 
 * @module main/services/SummarizationService
 */

import { credentialManager } from '../credentials/manager'
import type { ProviderId } from '../credentials/types'
import type { 
  WorkEntry, 
  WorkSession, 
  WorkCheckpoint 
} from '../../shared/types/workJournal'
import {
  buildCheckpointPrompt,
  buildResumptionPrompt
} from './summarizationPrompts'

// ============================================================================
// Types
// ============================================================================

export interface SummarizationOptions {
  /** Target token count for the summary (default: 500) */
  targetTokens?: number
  /** Include error analysis in summary */
  includeErrors?: boolean
  /** Focus areas for the summary */
  focusAreas?: ('decisions' | 'files' | 'progress' | 'blockers')[]
  /** Model to use for summarization (uses default if not specified) */
  model?: string
  /** Provider to use (auto-detected if not specified) */
  provider?: ProviderId
}

export interface SummarizationResult {
  summary: string
  keyDecisions: string[]
  currentState: string
  suggestedNextSteps: string[]
  filesModified: Array<{ path: string; description: string }>
  blockers: string[]
  tokenCount: number
  generatedAt: number
  usedAI: boolean
}

export interface SummarizationConfig {
  enabled: boolean
  preferredProvider?: ProviderId
  preferredModel?: string
  targetTokens: number
  includeErrorAnalysis: boolean
  maxEntriesForAI: number
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CONFIG: SummarizationConfig = {
  enabled: true,
  targetTokens: 500,
  includeErrorAnalysis: true,
  maxEntriesForAI: 50  // Limit entries sent to AI to control costs
}

// Provider preference order for summarization (cheaper/faster models preferred)
const PROVIDER_PREFERENCE: ProviderId[] = ['gemini', 'openai', 'anthropic']

// Default models for summarization (optimized for cost/speed)
const DEFAULT_MODELS: Partial<Record<ProviderId, string>> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-haiku-4-5-20251001'
}

// ============================================================================
// SummarizationService
// ============================================================================

export class SummarizationService {
  private config: SummarizationConfig
  private summaryCache: Map<string, SummarizationResult> = new Map()

  constructor(config?: Partial<SummarizationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    console.log('[Summarization] Service initialized')
  }

  /**
   * Summarize a complete work session
   */
  async summarizeWorkSession(
    session: WorkSession,
    entries: WorkEntry[],
    options?: SummarizationOptions
  ): Promise<SummarizationResult> {
    const targetTokens = options?.targetTokens ?? this.config.targetTokens

    // Check cache first
    const cacheKey = `${session.id}-${entries.length}-${targetTokens}`
    const cached = this.summaryCache.get(cacheKey)
    if (cached && Date.now() - cached.generatedAt < 300000) { // 5 min cache
      console.log('[Summarization] Returning cached result')
      return cached
    }

    try {
      // Limit entries to prevent excessive API costs
      const entriesToSummarize = this.selectEntriesForSummarization(entries)
      
      // Try AI summarization
      const result = await this.generateAISummary(
        session,
        entriesToSummarize,
        options
      )

      // Cache result
      this.summaryCache.set(cacheKey, result)
      return result

    } catch (error) {
      console.warn('[Summarization] AI summarization failed, using heuristic:', error)
      return this.generateHeuristicSummary(session, entries)
    }
  }

  /**
   * Generate a resumption narrative for continuing work
   */
  async generateResumptionNarrative(
    checkpoint: WorkCheckpoint,
    recentEntries: WorkEntry[],
    options?: SummarizationOptions
  ): Promise<string> {
    const targetTokens = options?.targetTokens ?? this.config.targetTokens

    try {
      const provider = await this.selectProvider(options?.provider)
      if (!provider) {
        return this.buildHeuristicResumptionNarrative(checkpoint, recentEntries)
      }

      const prompt = buildResumptionPrompt(
        checkpoint.summary,
        recentEntries,
        targetTokens
      )

      const response = await this.callProvider(
        provider.providerId,
        provider.apiKey,
        prompt,
        options?.model || provider.model
      )

      return response

    } catch (error) {
      console.warn('[Summarization] Resumption narrative failed:', error)
      return this.buildHeuristicResumptionNarrative(checkpoint, recentEntries)
    }
  }

  /**
   * Check if AI summarization is available
   */
  async isAvailable(): Promise<boolean> {
    const provider = await this.selectProvider()
    return provider !== null
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SummarizationConfig>): void {
    this.config = { ...this.config, ...config }
    this.summaryCache.clear() // Clear cache when config changes
  }

  /**
   * Get current configuration
   */
  getConfig(): SummarizationConfig {
    return { ...this.config }
  }

  /**
   * Clear the summary cache
   */
  clearCache(): void {
    this.summaryCache.clear()
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Select entries for AI summarization (limit to control costs)
   */
  private selectEntriesForSummarization(entries: WorkEntry[]): WorkEntry[] {
    const maxEntries = this.config.maxEntriesForAI

    if (entries.length <= maxEntries) {
      return entries
    }

    // Keep first 10 + last 40 to capture context and recent work
    const firstEntries = entries.slice(0, 10)
    const lastEntries = entries.slice(-(maxEntries - 10))
    
    console.log(`[Summarization] Truncated ${entries.length} entries to ${maxEntries}`)
    return [...firstEntries, ...lastEntries]
  }

  /**
   * Select the best available provider for summarization
   */
  private async selectProvider(
    preferredProvider?: ProviderId
  ): Promise<{ providerId: ProviderId; apiKey: string; model: string } | null> {
    
    // Check preferred provider first
    if (preferredProvider) {
      const apiKey = await credentialManager.getApiKey(preferredProvider)
      if (apiKey) {
        return {
          providerId: preferredProvider,
          apiKey,
          model: DEFAULT_MODELS[preferredProvider] || ''
        }
      }
    }

    // Check config preferred provider
    if (this.config.preferredProvider) {
      const apiKey = await credentialManager.getApiKey(this.config.preferredProvider)
      if (apiKey) {
        return {
          providerId: this.config.preferredProvider,
          apiKey,
          model: this.config.preferredModel || DEFAULT_MODELS[this.config.preferredProvider] || ''
        }
      }
    }

    // Fall back to preference order
    for (const providerId of PROVIDER_PREFERENCE) {
      const apiKey = await credentialManager.getApiKey(providerId)
      if (apiKey) {
        return {
          providerId,
          apiKey,
          model: DEFAULT_MODELS[providerId] || ''
        }
      }
    }

    console.warn('[Summarization] No AI provider available')
    return null
  }


  /**
   * Generate AI-powered summary
   */
  private async generateAISummary(
    session: WorkSession,
    entries: WorkEntry[],
    options?: SummarizationOptions
  ): Promise<SummarizationResult> {
    const targetTokens = options?.targetTokens ?? this.config.targetTokens
    
    const provider = await this.selectProvider(options?.provider)
    if (!provider) {
      throw new Error('No AI provider available for summarization')
    }

    console.log(`[Summarization] Using ${provider.providerId} with model ${provider.model}`)

    // Build the prompt
    const prompt = buildCheckpointPrompt(session, entries, targetTokens)

    // Call the AI provider
    const response = await this.callProvider(
      provider.providerId,
      provider.apiKey,
      prompt,
      options?.model || provider.model
    )

    // Parse the JSON response
    const parsed = this.parseAIResponse(response)

    return {
      summary: parsed.summary,
      keyDecisions: parsed.keyDecisions,
      currentState: parsed.currentState,
      suggestedNextSteps: parsed.pendingActions,
      filesModified: parsed.filesModified,
      blockers: parsed.blockers,
      tokenCount: this.estimateTokens(parsed.summary),
      generatedAt: Date.now(),
      usedAI: true
    }
  }

  /**
   * Call AI provider for completion
   */
  private async callProvider(
    providerId: ProviderId,
    apiKey: string,
    prompt: string,
    model: string
  ): Promise<string> {
    // Import providers dynamically to avoid circular dependencies
    switch (providerId) {
      case 'gemini': {
        const { generateCompletion } = await import('../providers/gemini')
        return generateCompletion(apiKey, prompt, { model, maxTokens: 1000, temperature: 0.3 })
      }
      case 'anthropic': {
        const { generateCompletion } = await import('../providers/anthropic')
        return generateCompletion(apiKey, prompt, { model, maxTokens: 1000, temperature: 0.3 })
      }
      case 'openai': {
        const { generateCompletion } = await import('../providers/openai')
        return generateCompletion(apiKey, prompt, { model, maxTokens: 1000, temperature: 0.3 })
      }
      default:
        throw new Error(`Unsupported provider for summarization: ${providerId}`)
    }
  }

  /**
   * Parse AI response JSON
   */
  private parseAIResponse(response: string): {
    summary: string
    keyDecisions: string[]
    currentState: string
    filesModified: Array<{ path: string; description: string }>
    pendingActions: string[]
    blockers: string[]
  } {
    try {
      // Try to extract JSON from response (may have markdown code blocks)
      let jsonStr = response
      
      // Remove markdown code blocks if present
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }
      
      // Try to find JSON object
      const objectMatch = jsonStr.match(/\{[\s\S]*\}/)
      if (objectMatch) {
        jsonStr = objectMatch[0]
      }

      const parsed = JSON.parse(jsonStr)

      return {
        summary: parsed.summary || 'Summary generation failed',
        keyDecisions: Array.isArray(parsed.keyDecisions) ? parsed.keyDecisions : [],
        currentState: parsed.currentState || 'Unknown state',
        filesModified: Array.isArray(parsed.filesModified) ? parsed.filesModified : [],
        pendingActions: Array.isArray(parsed.pendingActions) ? parsed.pendingActions : [],
        blockers: Array.isArray(parsed.blockers) ? parsed.blockers : []
      }
    } catch (error) {
      console.error('[Summarization] Failed to parse AI response:', error)
      console.error('[Summarization] Raw response:', response.substring(0, 500))
      
      // Return a basic summary from the response text
      return {
        summary: response.substring(0, 500),
        keyDecisions: [],
        currentState: 'Unable to parse AI response',
        filesModified: [],
        pendingActions: [],
        blockers: ['AI response parsing failed']
      }
    }
  }

  /**
   * Generate heuristic-based summary (fallback)
   */
  private generateHeuristicSummary(
    _session: WorkSession,
    entries: WorkEntry[]
  ): SummarizationResult {
    const keyDecisions: string[] = []
    const filesModified: Array<{ path: string; description: string }> = []
    const blockers: string[] = []
    const pendingActions: string[] = []

    // Extract information from entries
    for (const entry of entries) {
      const content = entry.content

      if (content.type === 'decision') {
        keyDecisions.push(`${content.question}: ${content.chosenOption}`)
      }
      
      if (content.type === 'file_written') {
        const existing = filesModified.find(f => f.path === content.filePath)
        if (!existing) {
          filesModified.push({
            path: content.filePath,
            description: content.operation
          })
        }
      }
      
      if (content.type === 'error' && !content.recoverable) {
        blockers.push(content.message)
      }
    }

    // Build summary from recent entries
    const recentEntries = entries.slice(-10)
    const summaryParts = recentEntries
      .filter(e => ['tool_result', 'decision', 'error'].includes(e.entryType))
      .map(e => this.getEntrySummaryLine(e))
      .slice(-5)

    const summary = `Work session with ${entries.length} actions. Recent activity: ${summaryParts.join('; ')}`
    
    const currentState = recentEntries.length > 0
      ? `Last action: ${this.getEntrySummaryLine(recentEntries[recentEntries.length - 1])}`
      : 'Session just started'

    return {
      summary,
      keyDecisions,
      currentState,
      suggestedNextSteps: pendingActions,
      filesModified,
      blockers,
      tokenCount: this.estimateTokens(summary),
      generatedAt: Date.now(),
      usedAI: false
    }
  }

  /**
   * Build heuristic resumption narrative
   */
  private buildHeuristicResumptionNarrative(
    checkpoint: WorkCheckpoint,
    recentEntries: WorkEntry[]
  ): string {
    const parts: string[] = []

    parts.push(`Previous work summary: ${checkpoint.summary}`)
    
    if (checkpoint.keyDecisions.length > 0) {
      parts.push(`Key decisions made: ${checkpoint.keyDecisions.join('; ')}`)
    }
    
    parts.push(`Current state: ${checkpoint.currentState}`)
    
    if (checkpoint.filesModified.length > 0) {
      parts.push(`Files modified: ${checkpoint.filesModified.join(', ')}`)
    }
    
    if (recentEntries.length > 0) {
      const recentActions = recentEntries
        .slice(-5)
        .map(e => this.getEntrySummaryLine(e))
        .join('; ')
      parts.push(`Recent activity since checkpoint: ${recentActions}`)
    }
    
    if (checkpoint.pendingActions.length > 0) {
      parts.push(`Suggested next steps: ${checkpoint.pendingActions.join('; ')}`)
    }

    return parts.join('\n\n')
  }

  /**
   * Get a brief summary line for an entry
   */
  private getEntrySummaryLine(entry: WorkEntry): string {
    const content = entry.content
    
    switch (content.type) {
      case 'tool_result':
        return content.success 
          ? `${content.toolName} succeeded`
          : `${content.toolName} failed: ${content.errorMessage?.substring(0, 50)}`
      case 'decision':
        return `Decided: ${content.chosenOption}`
      case 'error':
        return `Error: ${content.message.substring(0, 50)}`
      case 'file_written':
        return `Wrote ${content.filePath}`
      case 'thinking':
        return content.reasoning.substring(0, 50)
      default:
        return entry.entryType
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    if (!text) return 0
    return Math.ceil(text.length / 4)
  }
}

// Singleton export
export const summarizationService = new SummarizationService()
