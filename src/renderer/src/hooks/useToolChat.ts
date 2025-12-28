// src/renderer/src/hooks/useToolChat.ts

import { useState, useCallback } from 'react'
import { useMCP } from '../components/mcp'
import { useMCPTools, ToolExecution } from './useMCPTools'
import { parseToolCalls, stripToolCalls, formatToolResult, ToolCall } from '../lib/toolParser'

export interface PendingToolCall extends ToolCall {
  id: string
  originalContent: string  // Full AI response including tool_use block
  cleanContent: string     // Content without tool_use block
}

export interface UseToolChatResult {
  // MCP State
  mcpConnected: boolean
  mcpSystemPrompt: string
  
  // Tool State
  pendingToolCall: PendingToolCall | null
  toolExecutions: ToolExecution[]
  isProcessingTool: boolean
  
  // Actions
  buildSystemPrompt: (basePrompt: string) => string
  parseToolCall: (content: string) => { hasToolCall: boolean; cleanContent: string; toolName?: string; toolArgs?: Record<string, unknown>; toolExplanation?: string }
  showToolApprovalCard: (content: string, toolName: string, toolArgs: Record<string, unknown>, toolExplanation?: string) => string
  executeToolDirectly: (toolName: string, toolArgs: Record<string, unknown>, toolExplanation?: string) => Promise<string>
  handleToolApprove: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<string>
  handleToolReject: (id: string) => void
  clearPendingTool: () => void
  getToolResultContext: () => string
}

let toolIdCounter = 0

export function useToolChat(): UseToolChatResult {
  const { connected, systemPrompt } = useMCP()
  const { executeTool, toolExecutions, isProcessingTool, getToolResultsForContext } = useMCPTools()
  
  const [pendingToolCall, setPendingToolCall] = useState<PendingToolCall | null>(null)

  // Build enhanced system prompt with tool instructions
  const buildSystemPrompt = useCallback((basePrompt: string): string => {
    if (!connected || !systemPrompt) {
      return basePrompt
    }
    
    return `${basePrompt}

${systemPrompt}`
  }, [connected, systemPrompt])

  // Parse tool calls from content WITHOUT setting state (for checking auto-approve first)
  const parseToolCall = useCallback((content: string): { hasToolCall: boolean; cleanContent: string; toolName?: string; toolArgs?: Record<string, unknown>; toolExplanation?: string } => {
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
  }, [])

  // Show the approval card by setting pending tool call state
  const showToolApprovalCard = useCallback((content: string, toolName: string, toolArgs: Record<string, unknown>, toolExplanation?: string): string => {
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
  }, [])

  // Execute a tool directly without showing the approval card (for auto-approved tools)
  const executeToolDirectly = useCallback(async (
    toolName: string,
    toolArgs: Record<string, unknown>,
    toolExplanation?: string
  ): Promise<string> => {
    const result = await executeTool(toolName, toolArgs, toolExplanation)
    return formatToolResult(toolName, result.result, result.error)
  }, [executeTool])

  // Handle tool approval - execute and return result context for continuation
  const handleToolApprove = useCallback(async (
    id: string, 
    modifiedArgs?: Record<string, unknown>
  ): Promise<string> => {
    if (!pendingToolCall || pendingToolCall.id !== id) {
      throw new Error('No matching pending tool call')
    }

    const args = modifiedArgs || pendingToolCall.args
    const result = await executeTool(pendingToolCall.tool, args, pendingToolCall.explanation)
    
    // Format result for AI context
    const resultContext = formatToolResult(
      pendingToolCall.tool,
      result.result,
      result.error
    )
    
    setPendingToolCall(null)
    
    return resultContext
  }, [pendingToolCall, executeTool])

  // Handle tool rejection
  const handleToolReject = useCallback((id: string) => {
    if (pendingToolCall?.id === id) {
      setPendingToolCall(null)
    }
  }, [pendingToolCall])

  // Clear pending tool
  const clearPendingTool = useCallback(() => {
    setPendingToolCall(null)
  }, [])

  // Get accumulated tool results for context
  const getToolResultContext = useCallback(() => {
    return getToolResultsForContext()
  }, [getToolResultsForContext])

  return {
    mcpConnected: connected,
    mcpSystemPrompt: systemPrompt,
    pendingToolCall,
    toolExecutions,
    isProcessingTool,
    buildSystemPrompt,
    parseToolCall,
    showToolApprovalCard,
    executeToolDirectly,
    handleToolApprove,
    handleToolReject,
    clearPendingTool,
    getToolResultContext
  }
}

export default useToolChat
