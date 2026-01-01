// src/renderer/src/hooks/useToolCallState.ts
// Phase 7: Shared state management for tool call components
// Extracted from InlineToolCall and InlineToolCallV2

import { useState, useCallback } from 'react'

export interface UseToolCallStateOptions {
  /** Initial arguments to display/edit */
  initialArgs: Record<string, unknown>
  /** Tool call ID for approval callbacks */
  id: string
  /** Tool name for always-approve callback */
  toolName: string
  /** Callback when approved */
  onApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  /** Callback for always-approve */
  onAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  /** Callback when rejected */
  onReject?: (id: string) => void
}

export interface UseToolCallStateReturn {
  /** Whether currently in edit mode */
  isEditing: boolean
  /** Toggle edit mode */
  toggleEditing: () => void
  /** Current edited args as JSON string */
  editedArgs: string
  /** Update edited args */
  setEditedArgs: (value: string) => void
  /** JSON parse error message */
  parseError: string | null
  /** Clear parse error */
  clearParseError: () => void
  /** Whether content was recently copied */
  copied: boolean
  /** Copy content to clipboard */
  handleCopy: (content: string) => Promise<void>
  /** Whether full result is shown */
  showFullResult: boolean
  /** Toggle full result visibility */
  toggleShowFullResult: () => void
  /** Handle approve with optional edited args */
  handleApprove: () => void
  /** Handle always-approve with optional edited args */
  handleAlwaysApprove: () => void
  /** Handle reject */
  handleReject: () => void
  /** Parse and validate current edited args */
  parseEditedArgs: () => Record<string, unknown> | null
}

/**
 * Hook for managing tool call component state
 * 
 * Consolidates shared logic from InlineToolCall and InlineToolCallV2:
 * - JSON editing with validation
 * - Clipboard operations
 * - Approval flow handling
 * 
 * @example
 * ```tsx
 * const {
 *   isEditing,
 *   toggleEditing,
 *   editedArgs,
 *   setEditedArgs,
 *   parseError,
 *   handleApprove
 * } = useToolCallState({
 *   initialArgs: args,
 *   id: toolCallId,
 *   toolName: 'read_file',
 *   onApprove: handleToolApprove
 * })
 * ```
 */
export function useToolCallState(options: UseToolCallStateOptions): UseToolCallStateReturn {
  const {
    initialArgs,
    id,
    toolName,
    onApprove,
    onAlwaysApprove,
    onReject
  } = options

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editedArgs, setEditedArgs] = useState(() => JSON.stringify(initialArgs, null, 2))
  const [parseError, setParseError] = useState<string | null>(null)

  // Copy state
  const [copied, setCopied] = useState(false)

  // Result expansion state
  const [showFullResult, setShowFullResult] = useState(false)

  // Toggle edit mode
  const toggleEditing = useCallback(() => {
    setIsEditing(prev => !prev)
  }, [])

  // Clear parse error
  const clearParseError = useCallback(() => {
    setParseError(null)
  }, [])

  // Handle args change with error clearing
  const handleArgsChange = useCallback((value: string) => {
    setEditedArgs(value)
    setParseError(null)
  }, [])

  // Parse edited args, returning null on error
  const parseEditedArgs = useCallback((): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(editedArgs)
      setParseError(null)
      return parsed
    } catch {
      setParseError('Invalid JSON. Please fix the syntax.')
      return null
    }
  }, [editedArgs])

  // Copy to clipboard
  const handleCopy = useCallback(async (content: string) => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  // Toggle full result
  const toggleShowFullResult = useCallback(() => {
    setShowFullResult(prev => !prev)
  }, [])

  // Approval handler
  const handleApprove = useCallback(() => {
    if (!onApprove) return

    if (isEditing) {
      const parsed = parseEditedArgs()
      if (parsed === null) return
      onApprove(id, parsed)
    } else {
      onApprove(id)
    }
  }, [onApprove, id, isEditing, parseEditedArgs])

  // Always-approve handler
  const handleAlwaysApprove = useCallback(() => {
    if (!onAlwaysApprove) return

    if (isEditing) {
      const parsed = parseEditedArgs()
      if (parsed === null) return
      onAlwaysApprove(id, toolName, parsed)
    } else {
      onAlwaysApprove(id, toolName)
    }
  }, [onAlwaysApprove, id, toolName, isEditing, parseEditedArgs])

  // Reject handler
  const handleReject = useCallback(() => {
    if (onReject) {
      onReject(id)
    }
  }, [onReject, id])

  return {
    isEditing,
    toggleEditing,
    editedArgs,
    setEditedArgs: handleArgsChange,
    parseError,
    clearParseError,
    copied,
    handleCopy,
    showFullResult,
    toggleShowFullResult,
    handleApprove,
    handleAlwaysApprove,
    handleReject,
    parseEditedArgs
  }
}

export default useToolCallState
