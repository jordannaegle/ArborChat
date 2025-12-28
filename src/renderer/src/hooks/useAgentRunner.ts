// src/renderer/src/hooks/useAgentRunner.ts
// Core Agent Execution Engine - Phase 2
// Author: Alex Chen (Distinguished Software Architect)

import { useCallback, useRef, useEffect, useState } from 'react'
import { useAgentContext } from '../contexts/AgentContext'
import { useMCP } from '../components/mcp'
import { parseToolCalls, stripToolCalls, formatToolResult } from '../lib/toolParser'
import type { Agent, AgentToolPermission, ToolRiskLevel } from '../types/agent'

/**
 * Tool Risk Classification
 * Based on Desktop Commander tool categorization
 */
const TOOL_RISK_LEVELS: Record<string, ToolRiskLevel> = {
  // Safe operations - read-only, no side effects
  'read_file': 'safe',
  'read_multiple_files': 'safe',
  'list_directory': 'safe',
  'get_file_info': 'safe',
  'get_config': 'safe',
  'list_sessions': 'safe',
  'list_processes': 'safe',
  'list_searches': 'safe',
  'get_more_search_results': 'safe',
  'start_search': 'safe',
  'get_usage_stats': 'safe',
  'get_recent_tool_calls': 'safe',
  
  // Moderate operations - write operations, reversible
  'write_file': 'moderate',
  'create_directory': 'moderate',
  'move_file': 'moderate',
  'edit_block': 'moderate',
  'str_replace': 'moderate',
  'start_process': 'moderate',
  'interact_with_process': 'moderate',
  'read_process_output': 'moderate',
  
  // Dangerous operations - destructive, system-level
  'force_terminate': 'dangerous',
  'kill_process': 'dangerous',
  'stop_search': 'moderate',
  'set_config_value': 'dangerous'
}

function getToolRiskLevel(toolName: string): ToolRiskLevel {
  return TOOL_RISK_LEVELS[toolName] || 'moderate'
}

/**
 * Determine if a tool should be auto-approved based on permission level
 */
function shouldAutoApprove(
  toolName: string,
  permission: AgentToolPermission,
  alwaysApproveTools: string[]
): boolean {
  // Always-approved tools bypass all checks
  if (alwaysApproveTools.includes(toolName)) {
    return true
  }
  
  const riskLevel = getToolRiskLevel(toolName)
  
  switch (permission) {
    case 'autonomous':
      // Auto-approve safe and moderate
      return riskLevel === 'safe' || riskLevel === 'moderate'
    case 'standard':
      // Auto-approve only safe
      return riskLevel === 'safe'
    case 'restricted':
      // Never auto-approve
      return false
    default:
      return false
  }
}

export interface AgentRunnerState {
  isRunning: boolean
  isStreaming: boolean
  streamingContent: string
  error: string | null
}

export interface UseAgentRunnerResult {
  state: AgentRunnerState
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  stop: () => void
  sendMessage: (content: string) => Promise<void>
  approveTool: (modifiedArgs?: Record<string, unknown>) => Promise<void>
  rejectTool: () => void
}


/**
 * useAgentRunner - Core execution loop for autonomous agents
 * 
 * Handles:
 * - Building conversation context with system prompts
 * - Streaming AI responses
 * - Tool call detection and parsing
 * - Auto-approval based on permission levels
 * - Tool execution and result handling
 * - Agent state updates
 */
export function useAgentRunner(agentId: string): UseAgentRunnerResult {
  const {
    getAgent,
    updateAgentStatus,
    addAgentMessage,
    updateAgentMessage,
    addAgentStep,
    updateAgentStep,
    setPendingTool
  } = useAgentContext()
  
  const { connected: mcpConnected, tools: mcpTools } = useMCP()
  
  // Local state
  const [runnerState, setRunnerState] = useState<AgentRunnerState>({
    isRunning: false,
    isStreaming: false,
    streamingContent: '',
    error: null
  })
  
  // Refs for managing execution
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBufferRef = useRef('')
  const currentMessageIdRef = useRef<string | null>(null)
  const isExecutingRef = useRef(false)
  const pendingToolResultRef = useRef<string | null>(null)
  
  // Get agent helper
  const getAgentSafe = useCallback((): Agent | null => {
    return getAgent(agentId) || null
  }, [agentId, getAgent])

  /**
   * Build messages array for AI context
   */
  const buildContextMessages = useCallback((agent: Agent): Array<{ role: string; content: string }> => {
    const messages: Array<{ role: string; content: string }> = []
    
    // System prompt
    messages.push({ role: 'system', content: agent.systemPrompt })
    
    // Seed messages from context
    for (const seedMsg of agent.config.context.seedMessages) {
      messages.push({ role: seedMsg.role, content: seedMsg.content })
    }
    
    // Initial instruction as first user message
    messages.push({ role: 'user', content: agent.config.instructions })
    
    // Agent conversation history
    for (const msg of agent.messages) {
      messages.push({ role: msg.role, content: msg.content })
    }
    
    // Add pending tool result if any
    if (pendingToolResultRef.current) {
      messages.push({ 
        role: 'user', 
        content: `Tool execution result:\n\n${pendingToolResultRef.current}\n\nPlease continue based on this result.` 
      })
      pendingToolResultRef.current = null
    }
    
    return messages
  }, [])

  /**
   * Execute the agent loop - core AI interaction
   */
  const executeLoop = useCallback(async () => {
    const agent = getAgentSafe()
    if (!agent || isExecutingRef.current) return
    
    isExecutingRef.current = true
    abortControllerRef.current = new AbortController()
    
    try {
      // Update status to running
      updateAgentStatus(agentId, 'running')
      setRunnerState(prev => ({ ...prev, isRunning: true, isStreaming: true, error: null }))
      
      // Build context
      const messages = buildContextMessages(agent)
      
      // Get API key (for Gemini provider)
      const apiKey = await window.api.credentials.getKey('gemini')
      if (!apiKey) {
        throw new Error('No API key configured for Gemini')
      }
      
      // Reset stream buffer
      streamBufferRef.current = ''
      setRunnerState(prev => ({ ...prev, streamingContent: '' }))
      
      // Create placeholder message for streaming
      const placeholderMsg = addAgentMessage(agentId, 'assistant', '')
      currentMessageIdRef.current = placeholderMsg.id
      
      // Setup stream handlers
      const cleanup = () => {
        window.api.offAI()
      }
      
      // Token handler
      window.api.onToken((token) => {
        streamBufferRef.current += token
        setRunnerState(prev => ({ ...prev, streamingContent: streamBufferRef.current }))
      })
      
      // Done handler
      window.api.onDone(async () => {
        cleanup()
        
        const finalContent = streamBufferRef.current
        setRunnerState(prev => ({ ...prev, isStreaming: false }))
        
        if (!finalContent) {
          isExecutingRef.current = false
          setRunnerState(prev => ({ ...prev, isRunning: false }))
          return
        }
        
        // Parse tool calls
        const toolCalls = parseToolCalls(finalContent)
        const cleanContent = stripToolCalls(finalContent)
        
        // Update message with final content
        if (currentMessageIdRef.current) {
          updateAgentMessage(agentId, currentMessageIdRef.current, cleanContent)
        }
        
        if (toolCalls.length > 0) {
          // Process first tool call
          const toolCall = toolCalls[0]
          await handleToolCall(agent, toolCall, finalContent, cleanContent)
        } else {
          // Check for completion
          if (isCompletionMessage(finalContent)) {
            updateAgentStatus(agentId, 'completed')
            setRunnerState(prev => ({ ...prev, isRunning: false }))
          } else {
            // Continue running for next iteration
            // Agent is waiting for continuation or is done thinking
            updateAgentStatus(agentId, 'waiting')
            setRunnerState(prev => ({ ...prev, isRunning: false }))
          }
        }
        
        isExecutingRef.current = false
      })
      
      // Error handler
      window.api.onError((err) => {
        cleanup()
        console.error('[AgentRunner] AI Error:', err)
        
        addAgentStep(agentId, {
          type: 'error',
          content: err,
          timestamp: Date.now()
        })
        
        updateAgentStatus(agentId, 'failed', err)
        setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false, error: err }))
        isExecutingRef.current = false
      })
      
      // Start the AI request
      console.log('[AgentRunner] Starting AI request with', messages.length, 'messages')
      window.api.askAI(apiKey, messages, agent.config.modelId)
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('[AgentRunner] Execution error:', error)
      
      updateAgentStatus(agentId, 'failed', errorMsg)
      setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false, error: errorMsg }))
      isExecutingRef.current = false
    }
  }, [agentId, getAgentSafe, buildContextMessages, updateAgentStatus, addAgentMessage, updateAgentMessage, addAgentStep])


  /**
   * Handle a detected tool call
   */
  const handleToolCall = useCallback(async (
    agent: Agent,
    toolCall: { tool: string; args: Record<string, unknown>; explanation: string },
    originalContent: string,
    cleanContent: string
  ) => {
    // Get config for always-approve list
    let alwaysApproveTools: string[] = []
    try {
      const config = await window.api.mcp.getConfig()
      alwaysApproveTools = config.alwaysApproveTools || []
    } catch (e) {
      console.warn('[AgentRunner] Failed to get MCP config:', e)
    }
    
    // Check if should auto-approve
    const autoApprove = shouldAutoApprove(
      toolCall.tool,
      agent.config.toolPermission,
      alwaysApproveTools
    )
    
    // Add step for tool call
    const step = addAgentStep(agentId, {
      type: 'tool_call',
      content: `Calling ${toolCall.tool}`,
      timestamp: Date.now(),
      toolCall: {
        name: toolCall.tool,
        args: toolCall.args,
        status: autoApprove ? 'approved' : 'pending',
        explanation: toolCall.explanation
      }
    })
    
    if (autoApprove) {
      console.log(`[AgentRunner] Auto-approving tool: ${toolCall.tool}`)
      
      // Execute tool directly
      try {
        const result = await executeToolInternal(toolCall.tool, toolCall.args, toolCall.explanation)
        
        // Update step with result
        updateAgentStep(agentId, step.id, {
          toolCall: {
            name: toolCall.tool,
            args: toolCall.args,
            status: result.success ? 'completed' : 'failed',
            result: result.result,
            error: result.error,
            explanation: toolCall.explanation
          }
        })
        
        // Add tool result step
        addAgentStep(agentId, {
          type: 'tool_result',
          content: formatToolResult(toolCall.tool, result.result, result.error),
          timestamp: Date.now()
        })
        
        // Set pending result for next iteration
        pendingToolResultRef.current = formatToolResult(toolCall.tool, result.result, result.error)
        
        // Continue execution
        setRunnerState(prev => ({ ...prev, isRunning: true }))
        isExecutingRef.current = false
        
        // Small delay before continuing
        setTimeout(() => {
          executeLoop()
        }, 100)
        
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        
        updateAgentStep(agentId, step.id, {
          toolCall: {
            name: toolCall.tool,
            args: toolCall.args,
            status: 'failed',
            error: errorMsg,
            explanation: toolCall.explanation
          }
        })
        
        addAgentStep(agentId, {
          type: 'error',
          content: `Tool execution failed: ${errorMsg}`,
          timestamp: Date.now()
        })
        
        updateAgentStatus(agentId, 'failed', errorMsg)
        setRunnerState(prev => ({ ...prev, isRunning: false, error: errorMsg }))
        isExecutingRef.current = false
      }
    } else {
      console.log(`[AgentRunner] Awaiting approval for tool: ${toolCall.tool}`)
      
      // Set pending tool for UI
      const toolId = `agent-tool-${Date.now()}`
      setPendingTool(agentId, {
        id: toolId,
        tool: toolCall.tool,
        args: toolCall.args,
        explanation: toolCall.explanation,
        originalContent,
        cleanContent
      })
      
      // Update status to waiting
      updateAgentStatus(agentId, 'waiting')
      setRunnerState(prev => ({ ...prev, isRunning: false }))
      isExecutingRef.current = false
    }
  }, [agentId, addAgentStep, updateAgentStep, updateAgentStatus, setPendingTool, executeLoop])

  /**
   * Internal tool execution
   */
  const executeToolInternal = useCallback(async (
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string
  ) => {
    // Find tool server
    const tool = mcpTools.find(t => t.name === toolName)
    const serverName = tool?.server || 'desktop-commander'
    
    return await window.api.mcp.requestTool(serverName, toolName, args, explanation)
  }, [mcpTools])

  /**
   * Check if message indicates task completion
   */
  const isCompletionMessage = useCallback((content: string): boolean => {
    const completionPatterns = [
      /TASK COMPLETED/i,
      /task is complete/i,
      /completed successfully/i,
      /finished the task/i,
      /all done/i
    ]
    return completionPatterns.some(pattern => pattern.test(content))
  }, [])

  /**
   * Start agent execution
   */
  const start = useCallback(async () => {
    const agent = getAgentSafe()
    if (!agent) return
    
    if (!mcpConnected) {
      console.warn('[AgentRunner] MCP not connected, starting anyway')
    }
    
    await executeLoop()
  }, [getAgentSafe, mcpConnected, executeLoop])

  /**
   * Pause agent execution
   */
  const pause = useCallback(() => {
    abortControllerRef.current?.abort()
    window.api.offAI()
    
    updateAgentStatus(agentId, 'paused')
    setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false }))
    isExecutingRef.current = false
  }, [agentId, updateAgentStatus])


  /**
   * Resume paused agent
   */
  const resume = useCallback(async () => {
    await executeLoop()
  }, [executeLoop])

  /**
   * Stop agent execution
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    window.api.offAI()
    
    updateAgentStatus(agentId, 'completed')
    setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false }))
    isExecutingRef.current = false
    
    // Clear any pending tool
    setPendingTool(agentId, null)
  }, [agentId, updateAgentStatus, setPendingTool])

  /**
   * Send a message to the agent (user intervention)
   */
  const sendMessage = useCallback(async (content: string) => {
    const agent = getAgentSafe()
    if (!agent) return
    
    // Add user message
    addAgentMessage(agentId, 'user', content)
    
    // Continue execution
    await executeLoop()
  }, [agentId, getAgentSafe, addAgentMessage, executeLoop])

  /**
   * Approve a pending tool call
   */
  const approveTool = useCallback(async (modifiedArgs?: Record<string, unknown>) => {
    const agent = getAgentSafe()
    if (!agent || !agent.pendingToolCall) return
    
    const toolCall = agent.pendingToolCall
    const args = modifiedArgs || toolCall.args
    
    // Find the pending step and update it
    const pendingStep = agent.steps.find(
      s => s.type === 'tool_call' && s.toolCall?.status === 'pending'
    )
    
    if (pendingStep) {
      updateAgentStep(agentId, pendingStep.id, {
        toolCall: {
          ...pendingStep.toolCall!,
          args,
          status: 'approved'
        }
      })
    }
    
    // Clear pending tool from UI
    setPendingTool(agentId, null)
    
    // Execute the tool
    try {
      const result = await executeToolInternal(toolCall.tool, args, toolCall.explanation)
      
      // Update step with result
      if (pendingStep) {
        updateAgentStep(agentId, pendingStep.id, {
          toolCall: {
            ...pendingStep.toolCall!,
            args,
            status: result.success ? 'completed' : 'failed',
            result: result.result,
            error: result.error
          }
        })
      }
      
      // Add tool result step
      addAgentStep(agentId, {
        type: 'tool_result',
        content: formatToolResult(toolCall.tool, result.result, result.error),
        timestamp: Date.now()
      })
      
      // Set pending result for next iteration
      pendingToolResultRef.current = formatToolResult(toolCall.tool, result.result, result.error)
      
      // Continue execution
      await executeLoop()
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      
      if (pendingStep) {
        updateAgentStep(agentId, pendingStep.id, {
          toolCall: {
            ...pendingStep.toolCall!,
            status: 'failed',
            error: errorMsg
          }
        })
      }
      
      addAgentStep(agentId, {
        type: 'error',
        content: `Tool execution failed: ${errorMsg}`,
        timestamp: Date.now()
      })
      
      updateAgentStatus(agentId, 'failed', errorMsg)
      setRunnerState(prev => ({ ...prev, isRunning: false, error: errorMsg }))
    }
  }, [agentId, getAgentSafe, updateAgentStep, addAgentStep, setPendingTool, executeToolInternal, executeLoop, updateAgentStatus])

  /**
   * Reject a pending tool call
   */
  const rejectTool = useCallback(() => {
    const agent = getAgentSafe()
    if (!agent || !agent.pendingToolCall) return
    
    // Find the pending step and update it
    const pendingStep = agent.steps.find(
      s => s.type === 'tool_call' && s.toolCall?.status === 'pending'
    )
    
    if (pendingStep) {
      updateAgentStep(agentId, pendingStep.id, {
        toolCall: {
          ...pendingStep.toolCall!,
          status: 'denied'
        }
      })
    }
    
    // Clear pending tool
    setPendingTool(agentId, null)
    
    // Add rejection step
    addAgentStep(agentId, {
      type: 'tool_result',
      content: `<tool_result name="${agent.pendingToolCall.tool}" status="rejected">
User rejected the tool execution.
</tool_result>`,
      timestamp: Date.now()
    })
    
    // Set pending result for next iteration
    pendingToolResultRef.current = `<tool_result name="${agent.pendingToolCall.tool}" status="rejected">
User rejected the tool execution. Please acknowledge and continue with an alternative approach.
</tool_result>`
    
    // Continue execution
    executeLoop()
  }, [agentId, getAgentSafe, updateAgentStep, addAgentStep, setPendingTool, executeLoop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      window.api.offAI()
    }
  }, [])

  return {
    state: runnerState,
    start,
    pause,
    resume,
    stop,
    sendMessage,
    approveTool,
    rejectTool
  }
}

export default useAgentRunner
