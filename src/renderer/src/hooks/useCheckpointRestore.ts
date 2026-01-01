// src/renderer/src/hooks/useCheckpointRestore.ts
// Checkpoint restoration for session resumption
// Phase 4: Advanced Capabilities
// Author: Alex Chen (Distinguished Software Architect)

import { useCallback } from 'react'
import type { AgentMessage } from '../types/agent'

export interface CheckpointSummary {
  sessionId: string
  checkpointId: string
  timestamp: number
  summary: string
  keyDecisions: string[]
  filesModified: string[]
  pendingActions: string[]
  tokenEstimate: number
  originalPrompt?: string
}

export interface RestoredState {
  messages: AgentMessage[]
  systemPromptAddition: string
  resumptionGuidance: string
  checkpoint: CheckpointSummary
}

export interface UseCheckpointRestoreResult {
  getResumableSessions: () => Promise<CheckpointSummary[]>
  getCheckpointsForSession: (sessionId: string) => Promise<CheckpointSummary[]>
  restoreFromCheckpoint: (sessionId: string) => Promise<RestoredState>
  generateResumptionPrompt: (checkpoint: CheckpointSummary) => string
}

/**
 * Hook for restoring agent state from work journal checkpoints
 */
export function useCheckpointRestore(): UseCheckpointRestoreResult {
  
  /**
   * Get all sessions that can be resumed (paused or crashed)
   */
  const getResumableSessions = useCallback(async (): Promise<CheckpointSummary[]> => {
    try {
      const sessions = await window.api.workJournal.getResumableSessions(20)
      
      const summaries: CheckpointSummary[] = []
      
      for (const session of sessions) {
        const checkpoint = await window.api.workJournal.getLatestCheckpoint(session.id)
        
        if (checkpoint) {
          summaries.push({
            sessionId: session.id,
            checkpointId: checkpoint.id,
            timestamp: checkpoint.createdAt,
            summary: checkpoint.summary,
            keyDecisions: checkpoint.keyDecisions,
            filesModified: checkpoint.filesModified,
            pendingActions: checkpoint.pendingActions,
            tokenEstimate: session.tokenEstimate,
            originalPrompt: session.originalPrompt
          })
        } else {
          // Session without checkpoint - still resumable
          summaries.push({
            sessionId: session.id,
            checkpointId: `session-${session.id}`,
            timestamp: session.updatedAt,
            summary: session.originalPrompt.slice(0, 100) + '...',
            keyDecisions: [],
            filesModified: [],
            pendingActions: [],
            tokenEstimate: session.tokenEstimate,
            originalPrompt: session.originalPrompt
          })
        }
      }
      
      return summaries.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('[CheckpointRestore] Failed to get resumable sessions:', error)
      return []
    }
  }, [])

  /**
   * Get all checkpoints for a specific session
   */
  const getCheckpointsForSession = useCallback(async (
    sessionId: string
  ): Promise<CheckpointSummary[]> => {
    try {
      // Get session info
      const session = await window.api.workJournal.getSession(sessionId)
      if (!session) return []
      
      // Get entries to reconstruct checkpoint history
      const entries = await window.api.workJournal.getEntries(sessionId, {
        types: ['checkpoint'],
        limit: 50
      })
      
      const summaries: CheckpointSummary[] = entries
        .filter(e => e.entryType === 'checkpoint')
        .map(e => ({
          sessionId,
          checkpointId: (e.content.checkpointId as string) || `cp-${e.id}`,
          timestamp: e.timestamp,
          summary: (e.content.summary as string) || 'Checkpoint',
          keyDecisions: (e.content.keyDecisions as string[]) || [],
          filesModified: (e.content.filesModified as string[]) || [],
          pendingActions: (e.content.pendingActions as string[]) || [],
          tokenEstimate: e.tokenEstimate,
          originalPrompt: session.originalPrompt
        }))
      
      return summaries.sort((a, b) => b.timestamp - a.timestamp)
    } catch (error) {
      console.error('[CheckpointRestore] Failed to get checkpoints:', error)
      return []
    }
  }, [])


  /**
   * Restore agent state from a session
   */
  const restoreFromCheckpoint = useCallback(async (
    sessionId: string
  ): Promise<RestoredState> => {
    try {
      // Get session
      const session = await window.api.workJournal.getSession(sessionId)
      if (!session) {
        throw new Error(`Session ${sessionId} not found`)
      }
      
      // Get latest checkpoint
      const checkpoint = await window.api.workJournal.getLatestCheckpoint(sessionId)
      
      // Generate resumption context
      const context = await window.api.workJournal.generateResumptionContext(
        sessionId,
        10000 // Target tokens for context
      )
      
      // Build restored messages from context
      const messages: AgentMessage[] = []
      
      // Add a summary message of previous work
      if (context.workSummary) {
        messages.push({
          id: `restored-summary-${Date.now()}`,
          role: 'assistant',
          content: `[Previous work summary]\n${context.workSummary}`,
          timestamp: new Date().toISOString()
        })
      }
      
      // Build system prompt addition for resumption
      const systemPromptAddition = `
## Session Resumption Context

You are resuming a previous work session. Here's what was accomplished:

### Original Task
${context.originalPrompt}

### Work Summary
${context.workSummary}

### Key Decisions Made
${context.keyDecisions.map(d => `- ${d}`).join('\n') || '- None recorded'}

### Files Modified
${context.filesModified.map(f => `- ${f}`).join('\n') || '- None yet'}

### Current State
${context.currentState}

### Pending Actions
${context.pendingActions.map(a => `- ${a}`).join('\n') || '- None pending'}

${context.errorHistory.length > 0 ? `### Previous Errors to Avoid\n${context.errorHistory.slice(-3).map(e => `- ${e}`).join('\n')}` : ''}

---
Resume from where you left off. Review the above context and continue the task.
`

      // Create checkpoint summary for response
      const checkpointSummary: CheckpointSummary = checkpoint 
        ? {
            sessionId,
            checkpointId: checkpoint.id,
            timestamp: checkpoint.createdAt,
            summary: checkpoint.summary,
            keyDecisions: checkpoint.keyDecisions,
            filesModified: checkpoint.filesModified,
            pendingActions: checkpoint.pendingActions,
            tokenEstimate: context.tokenCount,
            originalPrompt: context.originalPrompt
          }
        : {
            sessionId,
            checkpointId: `session-${sessionId}`,
            timestamp: session.updatedAt,
            summary: session.originalPrompt.slice(0, 100),
            keyDecisions: context.keyDecisions,
            filesModified: context.filesModified,
            pendingActions: context.pendingActions,
            tokenEstimate: context.tokenCount,
            originalPrompt: context.originalPrompt
          }

      const resumptionGuidance = generateResumptionPromptInternal(checkpointSummary)

      return {
        messages,
        systemPromptAddition,
        resumptionGuidance,
        checkpoint: checkpointSummary
      }
    } catch (error) {
      console.error('[CheckpointRestore] Failed to restore checkpoint:', error)
      throw error
    }
  }, [])

  /**
   * Generate a human-readable resumption prompt
   */
  const generateResumptionPrompt = useCallback((checkpoint: CheckpointSummary): string => {
    return generateResumptionPromptInternal(checkpoint)
  }, [])

  return {
    getResumableSessions,
    getCheckpointsForSession,
    restoreFromCheckpoint,
    generateResumptionPrompt
  }
}

/**
 * Internal function to generate resumption prompt (avoids hook dependency)
 */
function generateResumptionPromptInternal(checkpoint: CheckpointSummary): string {
  const lines: string[] = [
    '## Resumption Instructions',
    '',
    `Last checkpoint: ${new Date(checkpoint.timestamp).toLocaleString()}`,
    ''
  ]
  
  if (checkpoint.originalPrompt) {
    lines.push('### Original Task')
    lines.push(checkpoint.originalPrompt.slice(0, 200))
    if (checkpoint.originalPrompt.length > 200) lines.push('...')
    lines.push('')
  }
  
  lines.push('### Summary')
  lines.push(checkpoint.summary)
  lines.push('')
  
  if (checkpoint.keyDecisions.length > 0) {
    lines.push('### Key Decisions')
    checkpoint.keyDecisions.forEach(d => lines.push(`- ${d}`))
    lines.push('')
  }
  
  if (checkpoint.filesModified.length > 0) {
    lines.push('### Files Modified')
    checkpoint.filesModified.forEach(f => lines.push(`- ${f}`))
    lines.push('')
  }
  
  if (checkpoint.pendingActions.length > 0) {
    lines.push('### Pending Actions')
    checkpoint.pendingActions.forEach(a => lines.push(`- ${a}`))
    lines.push('')
  }
  
  lines.push('---')
  lines.push('Please continue from where you left off.')
  
  return lines.join('\n')
}

export default useCheckpointRestore
