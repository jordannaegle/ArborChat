// src/renderer/src/hooks/useAgentRunner.ts
// Core Agent Execution Engine - Phase 2 + Phase 4 Work Journal Integration
// Author: Alex Chen (Distinguished Software Architect)

import { useCallback, useRef, useEffect, useState } from 'react'
import { useAgentContext } from '../contexts/AgentContext'
import { useMCP } from '../components/mcp'
import { parseToolCalls, stripToolCalls, formatToolResult } from '../lib/toolParser'
import { useWorkJournal } from './useWorkJournal'
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
  isRetrying: boolean
  streamingContent: string
  error: string | null
}

export interface UseAgentRunnerResult {
  state: AgentRunnerState
  workSessionId: string | null
  start: () => Promise<void>
  pause: () => void
  resume: () => Promise<void>
  stop: () => void
  retry: () => Promise<void>
  sendMessage: (content: string) => Promise<void>
  approveTool: (modifiedArgs?: Record<string, unknown>) => Promise<void>
  rejectTool: () => void
  canRetry: boolean
  forceCleanup: () => void
}

// Checkpoint configuration
const CHECKPOINT_INTERVAL = 20 // Create checkpoint every N entries

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
 * - Work journal integration for persistence and audit trail
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
  
  // Work Journal Integration
  const {
    createSession,
    logThinking,
    logToolRequest,
    logToolResult,
    logError,
    logFileOperation,
    updateSessionStatus,
    createCheckpoint
  } = useWorkJournal()
  
  // Track work session for this agent
  const workSessionIdRef = useRef<string | null>(null)
  const entryCountRef = useRef<number>(0)
  const isMountedRef = useRef(true)
  
  // Local state
  const [runnerState, setRunnerState] = useState<AgentRunnerState>({
    isRunning: false,
    isStreaming: false,
    isRetrying: false,
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
   * Helper: Maybe create checkpoint if entry count threshold reached
   */
  const maybeCreateCheckpoint = useCallback(async () => {
    if (!workSessionIdRef.current) return
    
    if (entryCountRef.current >= CHECKPOINT_INTERVAL) {
      try {
        await createCheckpoint(workSessionIdRef.current)
        entryCountRef.current = 0
        console.log('[AgentRunner] Created automatic checkpoint')
      } catch (err) {
        console.error('[AgentRunner] Failed to create checkpoint:', err)
      }
    }
  }, [createCheckpoint])

  /**
   * Helper: Detect and log file operations from tool results
   */
  const detectAndLogFileOperations = useCallback(async (
    toolName: string,
    args: Record<string, unknown>,
    result: { success: boolean; result?: string }
  ) => {
    if (!workSessionIdRef.current || !result.success) return
    
    // Map tool names to file operations
    const fileOpTools: Record<string, 'read' | 'create' | 'modify' | 'delete'> = {
      'read_file': 'read',
      'read_multiple_files': 'read',
      'write_file': 'create', // Could be create or modify
      'edit_block': 'modify',
      'str_replace': 'modify',
      'create_directory': 'create',
      'move_file': 'modify'
    }
    
    const operation = fileOpTools[toolName]
    if (!operation) return
    
    // Extract file path from args
    const filePath = (args.path || args.file_path || args.source) as string | undefined
    if (!filePath) return
    
    try {
      await logFileOperation(
        workSessionIdRef.current,
        operation,
        filePath,
        result.result?.substring(0, 200), // Preview
        undefined // lines affected - could parse from result
      )
      entryCountRef.current++
    } catch (err) {
      console.error('[AgentRunner] Failed to log file operation:', err)
    }
  }, [logFileOperation])

  /**
   * Build messages array for AI context
   * 
   * CRITICAL: Message ordering validation for strict models (DeepSeek R1, o1, o3)
   * These models require the last message to be 'user' or 'tool' role, never 'assistant'.
   * 
   * This function ensures valid message alternation by:
   * 1. Building the context from system prompt, seed messages, and history
   * 2. Adding pending tool results if present
   * 3. Validating and fixing ordering before returning
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
    
    // MESSAGE ORDERING VALIDATION
    // Some models (DeepSeek R1, o1, o3) require the last message to be 'user' role.
    // If the conversation ends with 'assistant', add a continuation prompt.
    const lastMessage = messages[messages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      console.warn('[AgentRunner] Message ordering fix: Last message was assistant, adding continuation prompt')
      messages.push({
        role: 'user',
        content: 'Please continue with your task. If you were in the middle of something, resume from where you left off. If you need to use a tool, proceed with the tool call.'
      })
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
      setRunnerState(prev => ({ ...prev, isRunning: true, isStreaming: true, isRetrying: false, error: null }))
      
      // Build context
      const messages = buildContextMessages(agent)
      
      // DIAGNOSTIC: Log message structure for debugging API errors
      const messageSummary = messages.map((m, i) => `${i}: ${m.role} (${m.content.length} chars)`).join('\n')
      console.log(`[AgentRunner] Message structure for ${agent.config.modelId}:\n${messageSummary}`)
      console.log(`[AgentRunner] Last message role: ${messages[messages.length - 1]?.role}`)
      
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
        
        if (!isMountedRef.current) {
          isExecutingRef.current = false
          return
        }
        
        const finalContent = streamBufferRef.current
        setRunnerState(prev => ({ ...prev, isStreaming: false }))
        
        if (!finalContent) {
          isExecutingRef.current = false
          setRunnerState(prev => ({ ...prev, isRunning: false }))
          return
        }
        
        // Log AI thinking/response to work journal
        if (workSessionIdRef.current && finalContent.length > 0) {
          try {
            await logThinking(workSessionIdRef.current, finalContent)
            entryCountRef.current++
            await maybeCreateCheckpoint()
          } catch (err) {
            console.error('[AgentRunner] Failed to log thinking:', err)
          }
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
        
        if (!isMountedRef.current) {
          isExecutingRef.current = false
          return
        }
        
        console.error('[AgentRunner] AI Error:', err)
        
        // Log error to work journal
        if (workSessionIdRef.current) {
          logError(
            workSessionIdRef.current,
            'ai_error',
            err,
            true // recoverable via retry
          ).catch(console.error)
        }
        
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
      
      // Log error to work journal
      if (workSessionIdRef.current) {
        logError(
          workSessionIdRef.current,
          'execution_error',
          errorMsg,
          false
        ).catch(console.error)
      }
      
      updateAgentStatus(agentId, 'failed', errorMsg)
      setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false, error: errorMsg }))
      isExecutingRef.current = false
    }
  }, [agentId, getAgentSafe, buildContextMessages, updateAgentStatus, addAgentMessage, updateAgentMessage, addAgentStep, logThinking, logError, maybeCreateCheckpoint])


  /**
   * Handle a detected tool call
   */
  const handleToolCall = useCallback(async (
    agent: Agent,
    toolCall: { tool: string; args: Record<string, unknown>; explanation: string },
    originalContent: string,
    cleanContent: string
  ) => {
    if (!isMountedRef.current) return
    
    // Log tool request to work journal
    if (workSessionIdRef.current) {
      try {
        const riskLevel = getToolRiskLevel(toolCall.tool)
        await logToolRequest(
          workSessionIdRef.current,
          toolCall.tool,
          toolCall.args,
          riskLevel
        )
        entryCountRef.current++
        await maybeCreateCheckpoint()
      } catch (err) {
        console.error('[AgentRunner] Failed to log tool request:', err)
      }
    }
    
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
      const executionStart = Date.now()
      
      // Execute tool directly
      try {
        const result = await executeToolInternal(toolCall.tool, toolCall.args, toolCall.explanation)
        const executionDuration = Date.now() - executionStart
        
        // Log tool result to work journal
        if (workSessionIdRef.current) {
          try {
            const resultStr = typeof result.result === 'string' ? result.result : String(result.result ?? '')
            await logToolResult(
              workSessionIdRef.current,
              toolCall.tool,
              result.success,
              resultStr,
              {
                truncated: resultStr.length > 5000,
                errorMessage: result.error,
                duration: executionDuration
              }
            )
            entryCountRef.current++
            
            // Check for file operations in the result
            await detectAndLogFileOperations(toolCall.tool, toolCall.args, {
              success: result.success,
              result: resultStr
            })
            
            await maybeCreateCheckpoint()
          } catch (err) {
            console.error('[AgentRunner] Failed to log tool result:', err)
          }
        }
        
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
        
        // Log error to work journal
        if (workSessionIdRef.current) {
          logError(
            workSessionIdRef.current,
            'tool_execution_error',
            errorMsg,
            true
          ).catch(console.error)
        }
        
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
  }, [agentId, addAgentStep, updateAgentStep, updateAgentStatus, setPendingTool, executeLoop, logToolRequest, logToolResult, logError, detectAndLogFileOperations, maybeCreateCheckpoint])

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
   * Perform cleanup (for crash scenarios)
   */
  const performCleanup = useCallback(() => {
    console.log(`[AgentRunner ${agentId}] Performing cleanup...`)
    
    // Mark work session as crashed if still active
    if (workSessionIdRef.current) {
      // Fire-and-forget - we're cleaning up
      updateSessionStatus(workSessionIdRef.current, 'crashed')
        .then(() => {
          if (workSessionIdRef.current) {
            return createCheckpoint(workSessionIdRef.current, true)
          }
          return undefined
        })
        .catch(console.error)
    }
    
    abortControllerRef.current?.abort()
    window.api.offAI()
    setPendingTool(agentId, null)
    isExecutingRef.current = false
    setRunnerState({
      isRunning: false,
      isStreaming: false,
      isRetrying: false,
      streamingContent: '',
      error: null
    })
  }, [agentId, updateSessionStatus, createCheckpoint, setPendingTool])

  /**
   * Start agent execution
   */
  const start = useCallback(async () => {
    const agent = getAgentSafe()
    if (!agent) return
    
    // Create work journal session
    if (!workSessionIdRef.current) {
      try {
        const session = await createSession(
          agent.sourceConversationId,
          agent.config.instructions
        )
        workSessionIdRef.current = session.id
        entryCountRef.current = 0
        console.log(`[AgentRunner] Created work session: ${session.id}`)
      } catch (err) {
        console.error('[AgentRunner] Failed to create work session:', err)
        // Continue anyway - journaling failure shouldn't block agent
      }
    }
    
    if (!mcpConnected) {
      console.warn('[AgentRunner] MCP not connected, starting anyway')
    }
    
    await executeLoop()
  }, [getAgentSafe, mcpConnected, executeLoop, createSession])

  /**
   * Pause agent execution
   */
  const pause = useCallback(() => {
    abortControllerRef.current?.abort()
    window.api.offAI()
    
    // Pause work session
    if (workSessionIdRef.current) {
      updateSessionStatus(workSessionIdRef.current, 'paused')
        .catch(console.error)
    }
    
    updateAgentStatus(agentId, 'paused')
    setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false }))
    isExecutingRef.current = false
  }, [agentId, updateAgentStatus, updateSessionStatus])


  /**
   * Resume paused agent
   */
  const resume = useCallback(async () => {
    // Resume work session
    if (workSessionIdRef.current) {
      try {
        await updateSessionStatus(workSessionIdRef.current, 'active')
      } catch (err) {
        console.error('[AgentRunner] Failed to resume work session:', err)
      }
    }
    
    await executeLoop()
  }, [executeLoop, updateSessionStatus])

  /**
   * Stop agent execution
   */
  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    window.api.offAI()
    
    // Complete work session
    if (workSessionIdRef.current) {
      updateSessionStatus(workSessionIdRef.current, 'completed')
        .then(() => {
          if (workSessionIdRef.current) {
            return createCheckpoint(workSessionIdRef.current, true)
          }
          return undefined
        })
        .catch(console.error)
    }
    
    updateAgentStatus(agentId, 'completed')
    setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false }))
    isExecutingRef.current = false
    
    // Clear any pending tool
    setPendingTool(agentId, null)
  }, [agentId, updateAgentStatus, setPendingTool, updateSessionStatus, createCheckpoint])

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
    const executionStart = Date.now()
    
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
      const executionDuration = Date.now() - executionStart
      
      // Log tool result to work journal
      if (workSessionIdRef.current) {
        try {
          const resultStr = typeof result.result === 'string' ? result.result : String(result.result ?? '')
          await logToolResult(
            workSessionIdRef.current,
            toolCall.tool,
            result.success,
            resultStr,
            {
              truncated: resultStr.length > 5000,
              errorMessage: result.error,
              duration: executionDuration
            }
          )
          entryCountRef.current++
          
          // Check for file operations in the result
          await detectAndLogFileOperations(toolCall.tool, args, {
            success: result.success,
            result: resultStr
          })
          
          await maybeCreateCheckpoint()
        } catch (err) {
          console.error('[AgentRunner] Failed to log tool result:', err)
        }
      }
      
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
      
      // Log error to work journal
      if (workSessionIdRef.current) {
        logError(
          workSessionIdRef.current,
          'tool_execution_error',
          errorMsg,
          true
        ).catch(console.error)
      }
      
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
  }, [agentId, getAgentSafe, updateAgentStep, addAgentStep, setPendingTool, executeToolInternal, executeLoop, updateAgentStatus, logToolResult, logError, detectAndLogFileOperations, maybeCreateCheckpoint])

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
    
    // Log rejection to work journal
    if (workSessionIdRef.current) {
      logToolResult(
        workSessionIdRef.current,
        agent.pendingToolCall.tool,
        false,
        'User rejected tool execution',
        { errorMessage: 'Rejected by user' }
      ).catch(console.error)
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
  }, [agentId, getAgentSafe, updateAgentStep, addAgentStep, setPendingTool, executeLoop, logToolResult])

  /**
   * Check if retry is possible
   */
  const canRetry = useCallback((): boolean => {
    const agent = getAgentSafe()
    return agent?.status === 'failed' && !runnerState.isRunning
  }, [getAgentSafe, runnerState.isRunning])

  /**
   * Retry a failed agent
   */
  const retry = useCallback(async () => {
    const agent = getAgentSafe()
    if (!agent || agent.status !== 'failed') return
    
    // Set retrying state
    setRunnerState(prev => ({ ...prev, error: null, isRetrying: true }))
    
    // Resume work session if exists, or continue with new session
    if (workSessionIdRef.current) {
      try {
        await updateSessionStatus(workSessionIdRef.current, 'active')
      } catch (err) {
        console.error('[AgentRunner] Failed to update session for retry:', err)
      }
    }
    
    // Restart execution (this will reset isRetrying via normal flow)
    await executeLoop()
  }, [getAgentSafe, executeLoop, updateSessionStatus])

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
      window.api.offAI()
      
      // Mark work session as crashed if still active on unmount
      if (workSessionIdRef.current) {
        updateSessionStatus(workSessionIdRef.current, 'crashed')
          .catch(console.error)
      }
    }
  }, [updateSessionStatus])

  return {
    state: runnerState,
    workSessionId: workSessionIdRef.current,
    start,
    pause,
    resume,
    stop,
    retry,
    sendMessage,
    approveTool,
    rejectTool,
    canRetry: canRetry(),
    forceCleanup: performCleanup
  }
}

export default useAgentRunner
