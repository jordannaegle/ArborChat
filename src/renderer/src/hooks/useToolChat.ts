// src/renderer/src/hooks/useToolChat.ts

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
  buildSystemPrompt: (basePrompt: string) => string
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
  // Memory pre-fetch for session start
  fetchMemoryContext: () => Promise<MemoryFetchResult>
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

  // Build enhanced system prompt with tool instructions
  const buildSystemPrompt = useCallback(
    (basePrompt: string): string => {
      if (!connected || !systemPrompt) {
        return basePrompt
      }

      return `${basePrompt}

${systemPrompt}`
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

  // Fetch memory context at session start (pre-fetch for injection into context)
  const fetchMemoryContext = useCallback(async (): Promise<MemoryFetchResult> => {
    if (!connected) {
      console.log('[useToolChat] MCP not connected, skipping memory fetch')
      return { context: null, itemCount: 0, status: 'error' }
    }

    // Check if auto-load is enabled
    const autoLoadEnabled = await isMemoryAutoLoadEnabled()
    if (!autoLoadEnabled) {
      console.log('[useToolChat] Memory auto-load disabled in settings')
      return { context: null, itemCount: 0, status: 'idle' }
    }

    setMemoryStatus('loading')

    try {
      console.log('[useToolChat] Fetching memory context...')
      // Use open_nodes to get all stored memory - pass empty names array to get all nodes
      const result = await executeTool('open_nodes', { names: [] }, 'Fetching user memory for session context')
      
      if (result.success && result.result) {
        const memoryContent = typeof result.result === 'string' 
          ? result.result 
          : JSON.stringify(result.result, null, 2)
        
        // Try to count items (entities/relations) in the result
        let itemCount = 0
        try {
          const parsed = typeof result.result === 'string' 
            ? JSON.parse(result.result) 
            : result.result
          if (parsed.entities) itemCount += parsed.entities.length
          if (parsed.relations) itemCount += parsed.relations.length
        } catch {
          // If we can't parse, estimate based on content
          itemCount = memoryContent.split('\n').filter(l => l.trim()).length
        }
        
        // Only return if there's actual content
        if (memoryContent && memoryContent.trim() && memoryContent !== '{}' && memoryContent !== '[]') {
          console.log('[useToolChat] Memory context fetched successfully')
          setMemoryStatus('loaded')
          setMemoryItemCount(itemCount)
          return {
            context: `[Memory Context - Information recalled from previous sessions]\n${memoryContent}`,
            itemCount,
            status: 'loaded'
          }
        }
      }
      
      console.log('[useToolChat] No memory content found')
      setMemoryStatus('empty')
      setMemoryItemCount(0)
      return { context: null, itemCount: 0, status: 'empty' }
    } catch (error) {
      console.warn('[useToolChat] Failed to fetch memory context:', error)
      setMemoryStatus('error')
      setMemoryItemCount(0)
      return { context: null, itemCount: 0, status: 'error' }
    }
  }, [connected, executeTool, isMemoryAutoLoadEnabled])

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
