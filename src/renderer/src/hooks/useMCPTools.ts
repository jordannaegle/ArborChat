// src/renderer/src/hooks/useMCPTools.ts

import { useState, useCallback, useRef } from 'react'
import { useMCP } from '../components/mcp'
import { parseToolCalls, hasToolCalls, formatToolResult } from '../lib/toolParser'
import type { MCPToolResult } from '../../../preload/index.d'

export interface ToolExecution {
  id: string
  toolName: string
  args: Record<string, unknown>
  explanation: string
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'error'
  result?: unknown
  error?: string
  duration?: number
  autoApproved?: boolean
}

interface UseMCPToolsResult {
  // State
  toolExecutions: ToolExecution[]
  isProcessingTool: boolean

  // Actions
  processAIResponse: (content: string) => Promise<{
    cleanContent: string
    toolCalls: ReturnType<typeof parseToolCalls>
  }>
  executeTool: (
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string
  ) => Promise<MCPToolResult>
  clearExecutions: () => void

  // For context building
  getToolResultsForContext: () => string
}

export function useMCPTools(): UseMCPToolsResult {
  const { requestTool, connected } = useMCP()
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([])
  const [isProcessingTool, setIsProcessingTool] = useState(false)
  const executionIdRef = useRef(0)

  // Process AI response for tool calls
  const processAIResponse = useCallback(async (content: string) => {
    const toolCalls = parseToolCalls(content)
    const cleanContent = hasToolCalls(content)
      ? content.replace(/```tool_use\n[\s\S]*?\n```/g, '').trim()
      : content

    return { cleanContent, toolCalls }
  }, [])

  // Execute a tool and track its status
  // skipApproval defaults to true because this is called after frontend approval
  const executeTool = useCallback(
    async (
      toolName: string,
      args: Record<string, unknown>,
      explanation?: string,
      skipApproval: boolean = true
    ): Promise<MCPToolResult> => {
      if (!connected) {
        return {
          id: '',
          success: false,
          error: 'MCP not connected'
        }
      }

      const executionId = `exec-${++executionIdRef.current}`

      // Add pending execution
      setToolExecutions((prev) => [
        ...prev,
        {
          id: executionId,
          toolName,
          args,
          explanation: explanation || '',
          status: 'executing'
        }
      ])

      setIsProcessingTool(true)

      try {
        // Pass skipApproval to prevent backend from re-queuing for approval
        const result = await requestTool(toolName, args, explanation, skipApproval)

        // Update execution status
        setToolExecutions((prev) =>
          prev.map((exec) =>
            exec.id === executionId
              ? {
                  ...exec,
                  status: result.success ? 'completed' : 'error',
                  result: result.result,
                  error: result.error,
                  duration: result.duration,
                  autoApproved: result.autoApproved
                }
              : exec
          )
        )

        return result
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)

        setToolExecutions((prev) =>
          prev.map((exec) =>
            exec.id === executionId ? { ...exec, status: 'error', error: errorMsg } : exec
          )
        )

        return {
          id: executionId,
          success: false,
          error: errorMsg
        }
      } finally {
        setIsProcessingTool(false)
      }
    },
    [connected, requestTool]
  )

  // Clear all executions
  const clearExecutions = useCallback(() => {
    setToolExecutions([])
  }, [])

  // Get tool results formatted for AI context
  const getToolResultsForContext = useCallback(() => {
    return toolExecutions
      .filter((exec) => exec.status === 'completed' || exec.status === 'error')
      .map((exec) => formatToolResult(exec.toolName, exec.result, exec.error))
      .join('\n\n')
  }, [toolExecutions])

  return {
    toolExecutions,
    isProcessingTool,
    processAIResponse,
    executeTool,
    clearExecutions,
    getToolResultsForContext
  }
}

export default useMCPTools
