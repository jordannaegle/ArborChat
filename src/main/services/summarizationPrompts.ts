/**
 * Summarization Prompts
 * 
 * Prompt templates for AI-powered work journal summarization.
 * These prompts are designed to produce coherent narratives that
 * help AI agents understand context when resuming work.
 * 
 * @module main/services/summarizationPrompts
 */

import type { WorkEntry, WorkSession } from '../../shared/types/workJournal'

/**
 * Main checkpoint summary prompt - generates structured JSON output
 */
export const CHECKPOINT_SUMMARY_PROMPT = `You are summarizing an AI coding agent's work session for future resumption. Your summary should help another AI agent quickly understand what was accomplished and what remains.

## Work Session Context
Original Task: {originalPrompt}
Session Duration: {duration}
Total Actions: {entryCount}

## Work Entries (chronological)
{entriesFormatted}

## Instructions
Create a concise summary (target: {targetTokens} tokens) that includes:

1. **Progress Summary** (2-3 sentences): What was accomplished in plain language
2. **Key Decisions**: Important choices made and their reasoning (bullet points)
3. **Current State**: Where the work left off (1 sentence)
4. **Modified Files**: List of files created/modified with brief descriptions
5. **Pending Actions**: What still needs to be done (if apparent)
6. **Blockers/Errors**: Any issues encountered that should be avoided

Format your response as JSON:
{
  "summary": "Progress summary paragraph...",
  "keyDecisions": ["Decision 1: reasoning", "Decision 2: reasoning"],
  "currentState": "Current state description",
  "filesModified": [{"path": "file.ts", "description": "what was done"}],
  "pendingActions": ["Action 1", "Action 2"],
  "blockers": ["Error/blocker if any"]
}`

/**
 * Resumption narrative prompt - generates human-readable context for resuming work
 */
export const RESUMPTION_NARRATIVE_PROMPT = `You are preparing context for an AI agent to resume a previous work session. Create a narrative that helps the agent understand the work history and continue effectively.

## Previous Session Summary
{checkpointSummary}

## Recent Activity Since Checkpoint
{recentEntries}

## Instructions
Write a brief narrative (target: {targetTokens} tokens) that:
1. Explains what was being worked on
2. Summarizes key accomplishments
3. Highlights important decisions and their rationale
4. Notes any errors or blockers to avoid
5. Suggests where to pick up

Write in second person ("You were working on...") to directly address the resuming agent.`

/**
 * Format work entries into a readable string for the prompt
 */
export function formatEntriesForPrompt(entries: WorkEntry[]): string {
  return entries.map((entry, i) => {
    const timestamp = new Date(entry.timestamp).toISOString()
    const contentStr = formatEntryContent(entry)
    return `[${i + 1}] ${timestamp} - ${entry.entryType}\n${contentStr}`
  }).join('\n\n')
}

/**
 * Format entry content based on its type for readable output
 */
function formatEntryContent(entry: WorkEntry): string {
  const content = entry.content
  
  switch (content.type) {
    case 'session_start':
      return `Started: ${content.originalPrompt.substring(0, 200)}${content.originalPrompt.length > 200 ? '...' : ''}`
    
    case 'thinking':
      return `Reasoning: ${content.reasoning.substring(0, 300)}${content.reasoning.length > 300 ? '...' : ''}`
    
    case 'tool_request':
      return `Tool: ${content.toolName}\nInput: ${JSON.stringify(content.toolInput, null, 2).substring(0, 200)}`
    
    case 'tool_approved':
    case 'tool_rejected':
      return `${content.type === 'tool_approved' ? 'Approved' : 'Rejected'}: ${content.toolName}${content.rejectionReason ? ` - ${content.rejectionReason}` : ''}`
    
    case 'tool_result':
      const resultPreview = content.output.substring(0, 300)
      return `Tool: ${content.toolName}\nSuccess: ${content.success}\n${content.success ? `Output: ${resultPreview}` : `Error: ${content.errorMessage}`}`
    
    case 'code_generated':
      return `Language: ${content.language}\nPurpose: ${content.purpose}\nFile: ${content.filePath || 'inline'}`
    
    case 'file_read':
    case 'file_written':
      return `File: ${content.filePath}\nOperation: ${content.operation}${content.linesAffected ? `\nLines: ${content.linesAffected}` : ''}`
    
    case 'decision':
      return `Question: ${content.question}\nChosen: ${content.chosenOption}\nReasoning: ${content.reasoning}`
    
    case 'error':
      return `Type: ${content.errorType}\nMessage: ${content.message}\nRecoverable: ${content.recoverable}`
    
    case 'recovery':
      return `Action: ${content.recoveryAction}\nSuccess: ${content.success}`
    
    case 'checkpoint':
      return `Checkpoint: ${content.summary}`
    
    case 'summary':
      return `Status: ${content.currentStatus}\nAccomplishments: ${content.accomplishments.join(', ')}`
    
    case 'user_feedback':
      return `Type: ${content.feedbackType}\nFeedback: ${content.feedback}`
    
    case 'session_end':
      return `Reason: ${content.reason}${content.finalSummary ? `\nSummary: ${content.finalSummary}` : ''}`
    
    default:
      return JSON.stringify(content, null, 2).substring(0, 300)
  }
}

/**
 * Calculate human-readable duration between timestamps
 */
export function formatDuration(startTime: number, endTime: number): string {
  const durationMs = endTime - startTime
  const minutes = Math.floor(durationMs / 60000)
  const hours = Math.floor(minutes / 60)
  
  if (hours > 0) {
    const remainingMins = minutes % 60
    return `${hours}h ${remainingMins}m`
  }
  return `${minutes}m`
}

/**
 * Build the complete prompt with variables substituted
 */
export function buildCheckpointPrompt(
  session: WorkSession,
  entries: WorkEntry[],
  targetTokens: number
): string {
  const now = Date.now()
  const duration = formatDuration(session.createdAt, now)
  const entriesFormatted = formatEntriesForPrompt(entries)
  
  return CHECKPOINT_SUMMARY_PROMPT
    .replace('{originalPrompt}', session.originalPrompt)
    .replace('{duration}', duration)
    .replace('{entryCount}', String(entries.length))
    .replace('{entriesFormatted}', entriesFormatted)
    .replace('{targetTokens}', String(targetTokens))
}

/**
 * Build resumption narrative prompt
 */
export function buildResumptionPrompt(
  checkpointSummary: string,
  recentEntries: WorkEntry[],
  targetTokens: number
): string {
  const recentFormatted = formatEntriesForPrompt(recentEntries)
  
  return RESUMPTION_NARRATIVE_PROMPT
    .replace('{checkpointSummary}', checkpointSummary)
    .replace('{recentEntries}', recentFormatted)
    .replace('{targetTokens}', String(targetTokens))
}
