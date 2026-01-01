/**
 * useWorkJournal Hook
 *
 * Main hook for accessing work journal functionality.
 * Wraps the WorkJournalProvider context with convenience methods.
 */

import { useCallback, useMemo } from 'react'
import { useWorkJournalContext } from '../components/workJournal'

// Entry content type helpers for type-safe logging
// Index signatures added for Record<string, unknown> compatibility
export interface ThinkingContent {
  type: 'thinking'
  reasoning: string
  planSteps?: string[]
  [key: string]: unknown
}

export interface ToolRequestContent {
  type: 'tool_request'
  toolName: string
  toolInput: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  [key: string]: unknown
}

export interface ToolResultContent {
  type: 'tool_result'
  toolName: string
  success: boolean
  output: string
  truncated: boolean
  errorMessage?: string
  duration?: number
  [key: string]: unknown
}

export interface DecisionContent {
  type: 'decision'
  question: string
  chosenOption: string
  alternatives?: string[]
  reasoning: string
  [key: string]: unknown
}

export interface ErrorContent {
  type: 'error'
  errorType: string
  message: string
  recoverable: boolean
  stackTrace?: string
  [key: string]: unknown
}

export interface FileOperationContent {
  type: 'file_read' | 'file_written'
  filePath: string
  operation: 'read' | 'create' | 'modify' | 'delete'
  contentPreview?: string
  linesAffected?: number
  [key: string]: unknown
}

export function useWorkJournal() {
  const context = useWorkJournalContext()

  // Convenience methods for typed entry logging
  const logThinking = useCallback(
    (sessionId: string, reasoning: string, planSteps?: string[]) => {
      return context.logEntry(sessionId, 'thinking', {
        type: 'thinking',
        reasoning,
        planSteps
      } as ThinkingContent)
    },
    [context]
  )

  const logToolRequest = useCallback(
    (
      sessionId: string,
      toolName: string,
      toolInput: Record<string, unknown>,
      riskLevel: 'safe' | 'moderate' | 'dangerous'
    ) => {
      return context.logEntry(sessionId, 'tool_request', {
        type: 'tool_request',
        toolName,
        toolInput,
        riskLevel
      } as ToolRequestContent)
    },
    [context]
  )

  const logToolResult = useCallback(
    (
      sessionId: string,
      toolName: string,
      success: boolean,
      output: string,
      options?: { truncated?: boolean; errorMessage?: string; duration?: number }
    ) => {
      return context.logEntry(
        sessionId,
        'tool_result',
        {
          type: 'tool_result',
          toolName,
          success,
          output,
          truncated: options?.truncated ?? false,
          errorMessage: options?.errorMessage,
          duration: options?.duration
        } as ToolResultContent,
        success ? 'normal' : 'high'
      )
    },
    [context]
  )

  const logDecision = useCallback(
    (
      sessionId: string,
      question: string,
      chosenOption: string,
      reasoning: string,
      alternatives?: string[]
    ) => {
      return context.logEntry(
        sessionId,
        'decision',
        {
          type: 'decision',
          question,
          chosenOption,
          alternatives,
          reasoning
        } as DecisionContent,
        'high'
      )
    },
    [context]
  )

  const logError = useCallback(
    (
      sessionId: string,
      errorType: string,
      message: string,
      recoverable: boolean,
      stackTrace?: string
    ) => {
      return context.logEntry(
        sessionId,
        'error',
        {
          type: 'error',
          errorType,
          message,
          recoverable,
          stackTrace
        } as ErrorContent,
        'critical'
      )
    },
    [context]
  )

  const logFileOperation = useCallback(
    (
      sessionId: string,
      operation: 'read' | 'create' | 'modify' | 'delete',
      filePath: string,
      contentPreview?: string,
      linesAffected?: number
    ) => {
      const entryType = operation === 'read' ? 'file_read' : 'file_written'
      return context.logEntry(
        sessionId,
        entryType,
        {
          type: entryType,
          filePath,
          operation,
          contentPreview,
          linesAffected
        } as FileOperationContent,
        operation === 'delete' ? 'high' : 'normal'
      )
    },
    [context]
  )

  // Get the active session object
  const activeSession = useMemo(() => {
    if (!context.activeSessionId) return null
    return context.sessions.get(context.activeSessionId) ?? null
  }, [context.activeSessionId, context.sessions])

  // Get entries for active session
  const activeSessionEntries = useMemo(() => {
    if (!context.activeSessionId) return []
    return context.entries.get(context.activeSessionId) ?? []
  }, [context.activeSessionId, context.entries])

  return {
    // Original context
    ...context,

    // Computed properties
    activeSession,
    activeSessionEntries,

    // Typed logging helpers
    logThinking,
    logToolRequest,
    logToolResult,
    logDecision,
    logError,
    logFileOperation
  }
}

export default useWorkJournal
