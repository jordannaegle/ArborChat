// src/renderer/src/hooks/useToolChat.ts
/**
 * useToolChat Hook
 * 
 * Integrates MCP tool execution and ArborMemoryService context
 * into the chat flow with approval workflows and memory injection.
 * 
 * @module renderer/hooks/useToolChat
 */

import { useState, useCallback } from 'react'
import { useMCP } from '../components/mcp'
import { useMCPTools, ToolExecution } from './useMCPTools'
import { parseToolCalls, stripToolCalls, formatToolResult, ToolCall } from '../lib/toolParser'
import type { MemoryStatus } from '../components/mcp'

export interface PendingToolCall extends ToolCall {
  id: string
  originalContent: string // Full AI response including tool_use block
  cleanContent: string // Content without tool_use block
}

export interface MemoryFetchResult {
  context: string | null
  itemCount: number
  status: MemoryStatus
}

export interface UseToolChatResult {
  // MCP State
  mcpConnected: boolean
  mcpSystemPrompt: string

  // Tool State
  pendingToolCall: PendingToolCall | null
  toolExecutions: ToolExecution[]
  isProcessingTool: boolean
  
  // Memory State
  memoryStatus: MemoryStatus
  memoryItemCount: number

  // Actions
  buildSystemPrompt: (basePrompt: string, memoryContext?: string) => string
  parseToolCall: (content: string) => {
    hasToolCall: boolean
    cleanContent: string
    toolName?: string
    toolArgs?: Record<string, unknown>
    toolExplanation?: string
  }
  showToolApprovalCard: (
    content: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolExplanation?: string
  ) => string
  executeToolDirectly: (
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolExplanation?: string
  ) => Promise<string>
  handleToolApprove: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<string>
  handleToolReject: (id: string) => void
  clearPendingTool: () => void
  getToolResultContext: () => string
  // Memory pre-fetch for session start (uses ArborMemoryService)
  fetchMemoryContext: (conversationId?: string, projectPath?: string) => Promise<MemoryFetchResult>
  resetMemoryStatus: () => void
  isMemoryAutoLoadEnabled: () => Promise<boolean>
}

let toolIdCounter = 0

export function useToolChat(): UseToolChatResult {
  const { connected, systemPrompt } = useMCP()
  const { executeTool, toolExecutions, isProcessingTool, getToolResultsForContext } = useMCPTools()

  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null)
  const [memoryStatus, setMemoryStatus] = useState<MemoryStatus>('idle')
  const [memoryItemCount, setMemoryItemCount] = useState(0)

  // Build enhanced system prompt with memory context and tool instructions
  // Memory context is injected BEFORE MCP tool instructions
  const buildSystemPrompt = useCallback(
    (basePrompt: string, memoryContext?: string): string => {
      let prompt = basePrompt

      // Inject memory context first (if available)
      // This ensures user context is present before tool instructions
      if (memoryContext) {
        prompt = `${prompt}

${memoryContext}`
      }

      // Then add MCP tool instructions
      if (connected && systemPrompt) {
        prompt = `${prompt}

${systemPrompt}`
      }

      return prompt
    },
    [connected, systemPrompt]
  )

  // Parse tool calls from content WITHOUT setting state (for checking auto-approve first)
  const parseToolCall = useCallback(
    (
      content: string
    ): {
      hasToolCall: boolean
      cleanContent: string
      toolName?: string
      toolArgs?: Record<string, unknown>
      toolExplanation?: string
    } => {
      const toolCalls = parseToolCalls(content)

      if (toolCalls.length > 0) {
        const firstCall = toolCalls[0]
        return {
          hasToolCall: true,
          cleanContent: stripToolCalls(content),
          toolName: firstCall.tool,
          toolArgs: firstCall.args,
          toolExplanation: firstCall.explanation
        }
      }

      return { hasToolCall: false, cleanContent: content }
    },
    []
  )

  // Show the approval card by setting pending tool call state
  const showToolApprovalCard = useCallback(
    (
      content: string,
      toolName: string,
      toolArgs: Record<string, unknown>,
      toolExplanation?: string
    ): string => {
      const toolId = `tool-${++toolIdCounter}`
      setPendingToolCall({
        id: toolId,
        tool: toolName,
        args: toolArgs,
        explanation: toolExplanation || '',
        originalContent: content,
        cleanContent: stripToolCalls(content)
      })
      return toolId
    },
    []
  )

  // Execute a tool directly without showing the approval card (for auto-approved tools)
  const executeToolDirectly = useCallback(
    async (
      toolName: string,
      toolArgs: Record<string, unknown>,
      toolExplanation?: string
    ): Promise<string> => {
      const result = await executeTool(toolName, toolArgs, toolExplanation)
      return formatToolResult(toolName, result.result, result.error)
    },
    [executeTool]
  )

  // Handle tool approval - execute and return result context for continuation
  const handleToolApprove = useCallback(
    async (id: string, modifiedArgs?: Record<string, unknown>): Promise<string> => {
      if (!pendingToolCall || pendingToolCall.id !== id) {
        throw new Error('No matching pending tool call')
      }

      const args = modifiedArgs || pendingToolCall.args
      const result = await executeTool(pendingToolCall.tool, args, pendingToolCall.explanation)

      // Format result for AI context
      const resultContext = formatToolResult(pendingToolCall.tool, result.result, result.error)

      setPendingToolCall(null)

      return resultContext
    },
    [pendingToolCall, executeTool]
  )

  // Handle tool rejection
  const handleToolReject = useCallback(
    (id: string) => {
      if (pendingToolCall?.id === id) {
        setPendingToolCall(null)
      }
    },
    [pendingToolCall]
  )

  // Clear pending tool
  const clearPendingTool = useCallback(() => {
    setPendingToolCall(null)
  }, [])

  // Get accumulated tool results for context
  const getToolResultContext = useCallback(() => {
    return getToolResultsForContext()
  }, [getToolResultsForContext])

  // Check if memory auto-load is enabled in config
  const isMemoryAutoLoadEnabled = useCallback(async (): Promise<boolean> => {
    try {
      const config = await window.api.mcp.getConfig()
      return config.memory?.autoLoadOnSessionStart ?? true
    } catch (error) {
      console.warn('[useToolChat] Failed to check memory config:', error)
      return true // Default to enabled
    }
  }, [])

  // Reset memory status (for new conversations)
  const resetMemoryStatus = useCallback(() => {
    setMemoryStatus('idle')
    setMemoryItemCount(0)
  }, [])

  /**
   * Fetch memory context at session start using ArborMemoryService.
   * This is the PRIMARY method for loading user memories into AI context.
   * 
   * @param conversationId - Optional conversation ID for conversation-scoped memories
   * @param projectPath - Optional project path for project-scoped memories
   * @returns Memory context formatted for system prompt injection
   */
  const fetchMemoryContext = useCallback(async (
    conversationId?: string,
    projectPath?: string
  ): Promise<MemoryFetchResult> => {
    // Check if auto-load is enabled
    const autoLoadEnabled = await isMemoryAutoLoadEnabled()
    if (!autoLoadEnabled) {
      console.log('[useToolChat] Memory auto-load disabled in settings')
      return { context: null, itemCount: 0, status: 'idle' }
    }

    setMemoryStatus('loading')

    try {
      console.log('[useToolChat] Fetching memory context from ArborMemoryService...')
      
      // Use ArborMemoryService instead of MCP Memory Server
      const memoryContext = await window.api.arborMemory.getContext({
        conversationId,
        projectPath,
        maxTokens: 2000
      })

      if (memoryContext.status === 'error') {
        console.warn('[useToolChat] Memory context error:', memoryContext.error)
        setMemoryStatus('error')
        setMemoryItemCount(0)
        return { context: null, itemCount: 0, status: 'error' }
      }

      if (memoryContext.status === 'empty' || !memoryContext.formattedPrompt) {
        console.log('[useToolChat] No memory content found')
        setMemoryStatus('empty')
        setMemoryItemCount(0)
        return { context: null, itemCount: 0, status: 'empty' }
      }

      console.log(`[useToolChat] Memory context loaded: ${memoryContext.stats.totalLoaded} items`)
      setMemoryStatus('loaded')
      setMemoryItemCount(memoryContext.stats.totalLoaded)
      
      return {
        context: memoryContext.formattedPrompt,
        itemCount: memoryContext.stats.totalLoaded,
        status: 'loaded'
      }
    } catch (error) {
      console.warn('[useToolChat] Failed to fetch memory context:', error)
      setMemoryStatus('error')
      setMemoryItemCount(0)
      return { context: null, itemCount: 0, status: 'error' }
    }
  }, [isMemoryAutoLoadEnabled])

  return {
    mcpConnected: connected,
    mcpSystemPrompt: systemPrompt,
    pendingToolCall,
    toolExecutions,
    isProcessingTool,
    memoryStatus,
    memoryItemCount,
    buildSystemPrompt,
    parseToolCall,
    showToolApprovalCard,
    executeToolDirectly,
    handleToolApprove,
    handleToolReject,
    clearPendingTool,
    getToolResultContext,
    fetchMemoryContext,
    resetMemoryStatus,
    isMemoryAutoLoadEnabled
  }
}

export default useToolChat
