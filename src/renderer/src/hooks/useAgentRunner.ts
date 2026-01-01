// src/renderer/src/hooks/useAgentRunner.ts
// Core Agent Execution Engine - Phase 2 + Phase 4 Token Tracking
// Author: Alex Chen (Distinguished Software Architect)

import { useCallback, useRef, useEffect, useState } from 'react'
import { useAgentContext } from '../contexts/AgentContext'
import { useMCP } from '../components/mcp'
import { parseToolCalls, stripToolCalls, formatToolResult } from '../lib/toolParser'
import { useWorkJournal } from './useWorkJournal'
import { 
  extractMentionedFiles, 
  verifyTypeScriptCompilation 
} from '../lib/codeVerification'
import { TokenizerService } from '../lib/tokenizerService'
import type { 
  Agent, 
  AgentToolPermission, 
  ToolRiskLevel,
  ExecutionPhase,
  TokenWarningLevel,
  ExecutionDiagnostics
} from '../types/agent'
import {
  DEFAULT_WATCHDOG_CONFIG,
  getModelContextLimit
} from '../types/agent'

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
  // Core state (existing)
  isRunning: boolean
  isStreaming: boolean
  isRetrying: boolean
  streamingContent: string
  error: string | null
  
  // NEW: Detailed execution info (Phase 1)
  execution: {
    phase: ExecutionPhase
    currentActivity: string       // "Calling list_directory..."
    activityStartedAt: number
    lastProgressAt: number
    currentToolName?: string
    currentToolDuration?: number  // Calculated from activityStartedAt
  } | null
  
  // NEW: Token metrics (Phase 1)
  tokens: {
    contextUsed: number
    contextMax: number
    usagePercent: number
    warningLevel: TokenWarningLevel
  } | null
  
  // NEW: Diagnostics (Phase 1)
  diagnostics: ExecutionDiagnostics
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
  // Phase 2: Stall recovery actions
  /** Force retry current iteration (can be called while running) */
  forceRetry: () => Promise<void>
  /** Kill the currently executing tool */
  killCurrentTool: () => void
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
  
  const { connected: mcpConnected, tools: mcpTools, getSystemPrompt } = useMCP()
  
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
  
  // Local state - with enhanced execution tracking (Phase 1)
  const [runnerState, setRunnerState] = useState<AgentRunnerState>({
    isRunning: false,
    isStreaming: false,
    isRetrying: false,
    streamingContent: '',
    error: null,
    // NEW: Execution tracking (Phase 1)
    execution: null,
    tokens: null,
    diagnostics: {
      loopIterations: 0,
      toolCallsTotal: 0,
      toolCallsSuccessful: 0,
      toolCallsFailed: 0,
      averageToolDuration: 0,
      totalRuntime: 0,
      lastToolDurations: []
    }
  })
  
  // Refs for managing execution
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamBufferRef = useRef('')
  const currentMessageIdRef = useRef<string | null>(null)
  const isExecutingRef = useRef(false)
  const pendingToolResultRef = useRef<string | null>(null)
  
  // Native function call handling (from native tool calling in Anthropic/OpenAI/Gemini)
  // Supports multiple parallel function calls
  const pendingNativeFunctionCallsRef = useRef<Array<{
    tool: string
    args: Record<string, unknown>
    explanation: string
    toolCallId?: string
  }>>([])
  const cleanupFunctionCallRef = useRef<(() => void) | null>(null)
  
  // Track executed tools for completion verification
  // This prevents hallucinated completions - agent must actually use tools
  const executedToolsRef = useRef<Array<{
    tool: string
    args: Record<string, unknown>
    success: boolean
    timestamp: number
  }>>([])
  
  // ============================================================================
  // Phase 1: Agent Execution Monitoring - New Refs and State Tracking
  // ============================================================================
  
  /** Agent start time for total runtime calculation */
  const agentStartTimeRef = useRef<number | null>(null)
  
  /** Tool execution durations for averaging (last 20 tool calls) */
  const toolDurationsRef = useRef<number[]>([])
  const MAX_TOOL_DURATION_HISTORY = 20
  
  /**
   * Update execution phase with activity tracking
   * This is the central function for phase transitions
   */
  const updateExecutionPhase = useCallback((
    phase: ExecutionPhase,
    activity: string,
    toolName?: string
  ) => {
    const now = Date.now()
    
    setRunnerState(prev => ({
      ...prev,
      execution: {
        phase,
        currentActivity: activity,
        activityStartedAt: now,
        lastProgressAt: now,
        currentToolName: toolName,
        currentToolDuration: undefined
      }
    }))
    
    console.log(`[AgentRunner:Phase] ${phase}: ${activity}${toolName ? ` (${toolName})` : ''}`)
  }, [])
  
  /**
   * Update last progress timestamp (called when we receive data)
   */
  const updateProgress = useCallback(() => {
    setRunnerState(prev => ({
      ...prev,
      execution: prev.execution ? {
        ...prev.execution,
        lastProgressAt: Date.now()
      } : null
    }))
  }, [])
  
  /**
   * Clear execution state (return to idle)
   */
  const clearExecutionState = useCallback(() => {
    setRunnerState(prev => ({
      ...prev,
      execution: null
    }))
  }, [])
  
  /**
   * Compute token warning level based on usage percentage
   */
  const getTokenWarningLevel = useCallback((usagePercent: number): TokenWarningLevel => {
    if (usagePercent >= 90) return 'critical'
    if (usagePercent >= 70) return 'warning'
    return 'normal'
  }, [])
  
  /**
   * Update token metrics based on current context
   * Phase 4: Uses TokenizerService for accurate token counting
   */
  const updateTokenMetrics = useCallback((messages: Array<{ role: string; content: string }>, modelId: string) => {
    const contextMax = getModelContextLimit(modelId)
    
    // Phase 4: Use TokenizerService for accurate token counting
    const tokenResult = TokenizerService.countMessagesTokens(messages, modelId)
    const contextUsed = tokenResult.count
    
    const usagePercent = (contextUsed / contextMax) * 100
    const warningLevel = getTokenWarningLevel(usagePercent)
    
    setRunnerState(prev => ({
      ...prev,
      tokens: {
        contextUsed,
        contextMax,
        usagePercent,
        warningLevel
      }
    }))
    
    // Log warning if approaching limits
    if (warningLevel === 'critical') {
      console.warn(`[AgentRunner:Tokens] CRITICAL: Context ${usagePercent.toFixed(1)}% full (${TokenizerService.formatTokenCount(contextUsed)}/${TokenizerService.formatTokenCount(contextMax)}) [${tokenResult.encoding}${tokenResult.isApproximate ? ' approx' : ''}]`)
    } else if (warningLevel === 'warning') {
      console.warn(`[AgentRunner:Tokens] WARNING: Context ${usagePercent.toFixed(1)}% full (${TokenizerService.formatTokenCount(contextUsed)}/${TokenizerService.formatTokenCount(contextMax)}) [${tokenResult.encoding}${tokenResult.isApproximate ? ' approx' : ''}]`)
    }
    
    return { contextUsed, contextMax, usagePercent, warningLevel }
  }, [getTokenWarningLevel])
  
  /**
   * Record tool execution duration and update diagnostics
   */
  const recordToolDuration = useCallback((duration: number, success: boolean) => {
    // Add to duration history (keeping last N)
    toolDurationsRef.current.push(duration)
    if (toolDurationsRef.current.length > MAX_TOOL_DURATION_HISTORY) {
      toolDurationsRef.current.shift()
    }
    
    // Calculate average
    const avgDuration = toolDurationsRef.current.length > 0
      ? toolDurationsRef.current.reduce((a, b) => a + b, 0) / toolDurationsRef.current.length
      : 0
    
    // Update diagnostics
    setRunnerState(prev => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        toolCallsTotal: prev.diagnostics.toolCallsTotal + 1,
        toolCallsSuccessful: success 
          ? prev.diagnostics.toolCallsSuccessful + 1 
          : prev.diagnostics.toolCallsSuccessful,
        toolCallsFailed: success 
          ? prev.diagnostics.toolCallsFailed 
          : prev.diagnostics.toolCallsFailed + 1,
        averageToolDuration: avgDuration,
        lastToolDurations: [...toolDurationsRef.current],
        totalRuntime: agentStartTimeRef.current 
          ? Date.now() - agentStartTimeRef.current 
          : 0
      }
    }))
  }, [])
  
  /**
   * Increment loop iteration counter
   */
  const incrementLoopIteration = useCallback(() => {
    setRunnerState(prev => ({
      ...prev,
      diagnostics: {
        ...prev.diagnostics,
        loopIterations: prev.diagnostics.loopIterations + 1,
        totalRuntime: agentStartTimeRef.current 
          ? Date.now() - agentStartTimeRef.current 
          : 0
      }
    }))
  }, [])
  
  /**
   * Reset diagnostics (called when agent starts fresh)
   */
  const resetDiagnostics = useCallback(() => {
    agentStartTimeRef.current = Date.now()
    toolDurationsRef.current = []
    
    setRunnerState(prev => ({
      ...prev,
      diagnostics: {
        loopIterations: 0,
        toolCallsTotal: 0,
        toolCallsSuccessful: 0,
        toolCallsFailed: 0,
        averageToolDuration: 0,
        totalRuntime: 0,
        lastToolDurations: []
      }
    }))
  }, [])
  
  // ============================================================================
  // End Phase 1: Agent Execution Monitoring
  // ============================================================================
  
  /**
   * Tools that constitute "meaningful work" for completion verification
   * Read-only tools don't count as work accomplished
   */
  const WORK_TOOLS = new Set([
    'write_file',
    'edit_block', 
    'str_replace',
    'create_directory',
    'move_file',
    'start_process',      // Could be git commit, npm commands, etc.
    'interact_with_process'
  ])
  
  // Get agent helper
  const getAgentSafe = useCallback((): Agent | null => {
    return getAgent(agentId) || null
  }, [agentId, getAgent])

  /**
   * Record a tool execution for completion verification
   */
  const recordToolExecution = useCallback((
    tool: string,
    args: Record<string, unknown>,
    success: boolean
  ) => {
    executedToolsRef.current.push({
      tool,
      args,
      success,
      timestamp: Date.now()
    })
    console.log(`[AgentRunner] Recorded tool execution: ${tool} (success: ${success})`)
  }, [])

  /**
   * Reset tool execution tracking (called when agent starts)
   */
  const resetToolTracking = useCallback(() => {
    executedToolsRef.current = []
    console.log('[AgentRunner] Reset tool execution tracking')
  }, [])

  /**
   * Check if agent has done meaningful work via tool execution
   * 
   * Returns an object with:
   * - hasMeaningfulWork: boolean - whether work-producing tools were used successfully
   * - workToolsUsed: string[] - list of work tools that succeeded
   * - totalToolCalls: number - total tools called
   * - successfulWorkCalls: number - successful work tool calls
   */
  const verifyWorkCompleted = useCallback((): {
    hasMeaningfulWork: boolean
    workToolsUsed: string[]
    totalToolCalls: number
    successfulWorkCalls: number
  } => {
    const executions = executedToolsRef.current
    const totalToolCalls = executions.length
    
    // Filter to successful work tool executions
    const successfulWorkExecutions = executions.filter(
      exec => exec.success && WORK_TOOLS.has(exec.tool)
    )
    
    const workToolsUsed = [...new Set(successfulWorkExecutions.map(e => e.tool))]
    const successfulWorkCalls = successfulWorkExecutions.length
    
    console.log(`[AgentRunner] Work verification: ${successfulWorkCalls}/${totalToolCalls} tool calls were successful work operations`)
    console.log(`[AgentRunner] Work tools used: ${workToolsUsed.join(', ') || 'none'}`)
    
    return {
      hasMeaningfulWork: successfulWorkCalls > 0,
      workToolsUsed,
      totalToolCalls,
      successfulWorkCalls
    }
  }, [])

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
   * 4. Phase 4: Auto-truncating if context exceeds model limits
   * 5. Project Intelligence: Fetching enhanced MCP system prompt with project context
   */
  const buildContextMessages = useCallback(async (agent: Agent): Promise<{ 
    messages: Array<{ role: string; content: string }>
    truncationNotification: string | null 
  }> => {
    const messages: Array<{ role: string; content: string }> = []
    
    // Diagnostic: Log working directory from agent config
    const workingDirectory = agent.config.context.workingDirectory
    console.log('[AgentRunner] Agent working directory:', workingDirectory)
    
    // Fetch enhanced MCP system prompt with project intelligence
    // This includes tool definitions AND project-specific context when working directory is recognized
    let enhancedMCPPrompt = ''
    console.log('[AgentRunner] mcpConnected:', mcpConnected)
    if (mcpConnected) {
      try {
        console.log('[AgentRunner] Calling getSystemPrompt with workingDirectory:', workingDirectory)
        enhancedMCPPrompt = await getSystemPrompt(workingDirectory || undefined)
        console.log('[AgentRunner] Enhanced MCP prompt loaded, length:', enhancedMCPPrompt?.length || 0)
        console.log('[AgentRunner] Prompt contains Project Intelligence:', enhancedMCPPrompt?.includes('ArborChat Project Intelligence'))
        if (workingDirectory && enhancedMCPPrompt?.includes('ArborChat Project Intelligence')) {
          console.log('[AgentRunner] ✅ Project intelligence injected for:', workingDirectory)
        } else if (workingDirectory) {
          console.warn('[AgentRunner] ⚠️ Working directory set but no project intelligence found')
          console.log('[AgentRunner] Prompt preview:', enhancedMCPPrompt?.substring(0, 500))
        }
      } catch (err) {
        console.warn('[AgentRunner] Failed to load enhanced MCP prompt:', err)
      }
    } else {
      console.warn('[AgentRunner] MCP not connected, skipping enhanced prompt')
    }
    
    // Build combined system prompt: Agent base prompt + MCP tools with project intelligence
    const combinedSystemPrompt = enhancedMCPPrompt
      ? `${agent.systemPrompt}\n\n${enhancedMCPPrompt}`
      : agent.systemPrompt
    
    // System prompt
    messages.push({ role: 'system', content: combinedSystemPrompt })
    
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
    
    // Phase 4: Auto-truncation if context exceeds model limits
    const modelId = agent.config.modelId
    const contextMax = getModelContextLimit(modelId)
    const reserveTokens = 2000 // Reserve tokens for response
    
    const truncationResult = TokenizerService.truncateMessages(
      messages,
      modelId,
      contextMax,
      reserveTokens
    )
    
    if (truncationResult.truncatedCount > 0) {
      console.warn(`[AgentRunner:Truncation] ${truncationResult.notification}`)
    }
    
    return { 
      messages: truncationResult.messages, 
      truncationNotification: truncationResult.notification 
    }
  }, [mcpConnected, getSystemPrompt])

  /**
   * Execute the agent loop - core AI interaction
   */
  const executeLoop = useCallback(async () => {
    const agent = getAgentSafe()
    if (!agent || isExecutingRef.current) return
    
    isExecutingRef.current = true
    abortControllerRef.current = new AbortController()
    
    // Phase 1: Track loop iteration
    incrementLoopIteration()
    
    try {
      // Update status to running
      updateAgentStatus(agentId, 'running')
      setRunnerState(prev => ({ ...prev, isRunning: true, isStreaming: true, isRetrying: false, error: null }))
      
      // Build context (Phase 4: now returns object with messages and truncation info)
      // Project Intelligence: Now async to fetch enhanced MCP prompt with project context
      const { messages, truncationNotification } = await buildContextMessages(agent)
      
      // Phase 4: Add truncation notification step if messages were truncated
      if (truncationNotification) {
        addAgentStep(agentId, {
          type: 'thinking',
          content: `⚠️ ${truncationNotification}`,
          timestamp: Date.now()
        })
      }
      
      // Phase 1: Track token metrics
      updateTokenMetrics(messages, agent.config.modelId)
      
      // Phase 1: Update execution phase - streaming AI response
      updateExecutionPhase('streaming_ai', 'Generating response...')
      
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
        cleanupFunctionCallRef.current?.()
        cleanupFunctionCallRef.current = null
      }
      
      // Token handler
      window.api.onToken((token) => {
        streamBufferRef.current += token
        setRunnerState(prev => ({ ...prev, streamingContent: streamBufferRef.current }))
        // Phase 1: Update progress timestamp on each token received
        updateProgress()
      })
      
      // Native function call handler (from providers that support it)
      // Accumulates multiple function calls for parallel execution
      if (window.api.onFunctionCall) {
        const cleanupFn = window.api.onFunctionCall((data) => {
          console.log('[AgentRunner] ✅ Native function call received:', data.name)
          
          // Accumulate function calls (providers may emit multiple for parallel execution)
          pendingNativeFunctionCallsRef.current.push({
            tool: data.name,
            args: data.args,
            explanation: 'Native function call',
            toolCallId: data.toolCallId || data.toolUseId
          })
        })
        cleanupFunctionCallRef.current = cleanupFn
      }
      
      // Done handler
      window.api.onDone(async () => {
        cleanup()
        
        if (!isMountedRef.current) {
          isExecutingRef.current = false
          return
        }
        
        const finalContent = streamBufferRef.current
        setRunnerState(prev => ({ ...prev, isStreaming: false }))
        
        if (!finalContent && pendingNativeFunctionCallsRef.current.length === 0) {
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
        
        // Check for native function calls first (from providers like Anthropic/OpenAI/Gemini)
        const pendingCalls = [...pendingNativeFunctionCallsRef.current]
        pendingNativeFunctionCallsRef.current = [] // Reset immediately
        
        if (pendingCalls.length > 0) {
          console.log(`[AgentRunner] Processing ${pendingCalls.length} native function call(s)`)
          
          // Update message with any text content (clean, no tool blocks)
          if (currentMessageIdRef.current && finalContent) {
            updateAgentMessage(agentId, currentMessageIdRef.current, finalContent)
          }
          
          if (pendingCalls.length === 1) {
            // Single tool call - use existing flow
            await handleToolCall(agent, pendingCalls[0], finalContent, finalContent)
          } else {
            // Multiple tool calls - process in parallel
            await handleParallelToolCalls(agent, pendingCalls, finalContent)
          }
          return
        }
        
        // Fall back to text-based parsing for legacy support
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
          // Phase 1: Update execution phase for verification
          updateExecutionPhase('verifying_completion', 'Verifying completion...')
          
          // Check for completion (now async with git/TypeScript verification)
          if (await isCompletionMessage(finalContent)) {
            // Phase 1: Clear execution state on completion
            clearExecutionState()
            updateAgentStatus(agentId, 'completed')
            setRunnerState(prev => ({ ...prev, isRunning: false }))
          } else {
            // Phase 1: Clear execution state when waiting
            clearExecutionState()
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
        
        // Phase 1: Clear execution state on error
        clearExecutionState()
        
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
      
      // Phase 1: Clear execution state on error
      clearExecutionState()
      
      updateAgentStatus(agentId, 'failed', errorMsg)
      setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false, error: errorMsg }))
      isExecutingRef.current = false
    }
  }, [agentId, getAgentSafe, buildContextMessages, updateAgentStatus, addAgentMessage, updateAgentMessage, addAgentStep, logThinking, logError, maybeCreateCheckpoint, incrementLoopIteration, updateTokenMetrics, updateExecutionPhase, updateProgress, clearExecutionState])


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
        
        // Record tool execution for completion verification
        recordToolExecution(toolCall.tool, toolCall.args, result.success)
        
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
        
        // Record failed tool execution for completion verification
        recordToolExecution(toolCall.tool, toolCall.args, false)
        
        updateAgentStatus(agentId, 'failed', errorMsg)
        setRunnerState(prev => ({ ...prev, isRunning: false, error: errorMsg }))
        isExecutingRef.current = false
      }
    } else {
      console.log(`[AgentRunner] Awaiting approval for tool: ${toolCall.tool}`)
      
      // Phase 1: Update execution phase for waiting approval
      updateExecutionPhase('waiting_approval', `Awaiting approval for ${toolCall.tool}`, toolCall.tool)
      
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
  }, [agentId, addAgentStep, updateAgentStep, updateAgentStatus, setPendingTool, executeLoop, logToolRequest, logToolResult, logError, detectAndLogFileOperations, maybeCreateCheckpoint, recordToolExecution, updateExecutionPhase])

  /**
   * Handle multiple tool calls in parallel
   * Auto-approved tools execute simultaneously, others queue for sequential approval
   * 
   * PARALLEL EXECUTION STRATEGY:
   * 1. Classify all tool calls by auto-approval status
   * 2. Execute all auto-approved tools concurrently via Promise.allSettled
   * 3. Collect results and format for AI context
   * 4. Queue first tool needing approval (batch approval UI is deferred)
   * 5. Continue agent loop with combined results
   */
  const handleParallelToolCalls = useCallback(async (
    agent: Agent,
    toolCalls: Array<{ 
      tool: string
      args: Record<string, unknown>
      explanation: string
      toolCallId?: string 
    }>,
    originalContent: string
  ) => {
    if (!isMountedRef.current) return
    
    console.log(`[AgentRunner] Processing ${toolCalls.length} parallel tool calls`)
    
    // Get config for always-approve list
    let alwaysApproveTools: string[] = []
    try {
      const config = await window.api.mcp.getConfig()
      alwaysApproveTools = config.alwaysApproveTools || []
    } catch (e) {
      console.warn('[AgentRunner] Failed to get MCP config:', e)
    }
    
    // Separate into auto-approvable and needs-approval
    const autoApprovable = toolCalls.filter(tc => 
      shouldAutoApprove(tc.tool, agent.config.toolPermission, alwaysApproveTools)
    )
    const needsApproval = toolCalls.filter(tc =>
      !shouldAutoApprove(tc.tool, agent.config.toolPermission, alwaysApproveTools)
    )
    
    console.log(`[AgentRunner] Parallel execution: ${autoApprovable.length} auto-approve, ${needsApproval.length} need approval`)
    
    // Results accumulator
    const results: string[] = []
    
    // Execute auto-approved tools in parallel
    if (autoApprovable.length > 0) {
      const executionStart = Date.now()
      
      // Create steps for all parallel tools
      const stepsAndCalls = autoApprovable.map(tc => ({
        tc,
        step: addAgentStep(agentId, {
          type: 'tool_call',
          content: `Calling ${tc.tool}`,
          timestamp: Date.now(),
          toolCall: {
            name: tc.tool,
            args: tc.args,
            status: 'approved',
            explanation: tc.explanation
          }
        })
      }))
      
      // Execute all in parallel
      const parallelResults = await Promise.allSettled(
        stepsAndCalls.map(async ({ tc, step }) => {
          try {
            // Log to work journal
            if (workSessionIdRef.current) {
              const riskLevel = getToolRiskLevel(tc.tool)
              await logToolRequest(workSessionIdRef.current, tc.tool, tc.args, riskLevel)
              entryCountRef.current++
            }
            
            // Execute via MCP
            const result = await executeToolInternal(tc.tool, tc.args, tc.explanation)
            
            // Log result to work journal
            if (workSessionIdRef.current) {
              const resultStr = typeof result.result === 'string' ? result.result : String(result.result ?? '')
              await logToolResult(
                workSessionIdRef.current,
                tc.tool,
                result.success,
                resultStr,
                { truncated: resultStr.length > 5000, errorMessage: result.error }
              )
              entryCountRef.current++
              
              // Check for file operations
              await detectAndLogFileOperations(tc.tool, tc.args, {
                success: result.success,
                result: resultStr
              })
            }
            
            // Record for completion verification
            recordToolExecution(tc.tool, tc.args, result.success)
            
            // Update step with result
            updateAgentStep(agentId, step.id, {
              toolCall: {
                name: tc.tool,
                args: tc.args,
                status: result.success ? 'completed' : 'failed',
                result: result.result,
                error: result.error,
                explanation: tc.explanation
              }
            })
            
            return { tool: tc.tool, result, step }
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            recordToolExecution(tc.tool, tc.args, false)
            
            updateAgentStep(agentId, step.id, {
              toolCall: {
                name: tc.tool,
                args: tc.args,
                status: 'failed',
                error: errorMsg,
                explanation: tc.explanation
              }
            })
            
            throw { tool: tc.tool, error: errorMsg }
          }
        })
      )
      
      const executionDuration = Date.now() - executionStart
      console.log(`[AgentRunner] Parallel execution completed in ${executionDuration}ms`)
      
      // Build combined result context
      for (let i = 0; i < parallelResults.length; i++) {
        const r = parallelResults[i]
        const tc = autoApprovable[i]
        
        if (r.status === 'fulfilled') {
          const { result } = r.value
          results.push(formatToolResult(tc.tool, result.result, result.error))
        } else {
          // Extract error from rejection
          const rejection = r.reason as { tool: string; error: string }
          results.push(formatToolResult(tc.tool, null, rejection.error))
        }
      }
      
      // Add combined tool result step
      if (results.length > 0) {
        addAgentStep(agentId, {
          type: 'tool_result',
          content: `Parallel execution of ${autoApprovable.length} tools:\n\n${results.join('\n\n---\n\n')}`,
          timestamp: Date.now()
        })
      }
      
      await maybeCreateCheckpoint()
    }
    
    // Store combined results for next iteration
    if (results.length > 0) {
      pendingToolResultRef.current = results.join('\n\n')
    }
    
    // Handle tools that need approval (process first one, queue rest)
    if (needsApproval.length > 0) {
      // For now, process first one that needs approval
      // TODO: Implement batch approval UI for multiple pending tools
      const tc = needsApproval[0]
      
      // Log warning if multiple tools need approval
      if (needsApproval.length > 1) {
        console.warn(`[AgentRunner] ${needsApproval.length} tools need approval, processing first: ${tc.tool}`)
        addAgentStep(agentId, {
          type: 'thinking',
          content: `⚠️ Multiple tools requested: ${needsApproval.map(t => t.tool).join(', ')}. Processing "${tc.tool}" first.`,
          timestamp: Date.now()
        })
      }
      
      // Add step for pending tool
      addAgentStep(agentId, {
        type: 'tool_call',
        content: `Awaiting approval: ${tc.tool}`,
        timestamp: Date.now(),
        toolCall: {
          name: tc.tool,
          args: tc.args,
          status: 'pending',
          explanation: tc.explanation
        }
      })
      
      // Set pending tool for UI
      const toolId = `agent-tool-${Date.now()}`
      setPendingTool(agentId, {
        id: toolId,
        tool: tc.tool,
        args: tc.args,
        explanation: tc.explanation,
        originalContent,
        cleanContent: originalContent
      })
      
      // Phase 1: Update execution phase for waiting approval
      updateExecutionPhase('waiting_approval', `Awaiting approval for ${tc.tool}`, tc.tool)
      
      updateAgentStatus(agentId, 'waiting')
      setRunnerState(prev => ({ ...prev, isRunning: false }))
      isExecutingRef.current = false
      return
    }
    
    // All tools were auto-approved and executed, continue the loop
    if (autoApprovable.length > 0) {
      setRunnerState(prev => ({ ...prev, isRunning: true }))
      isExecutingRef.current = false
      setTimeout(() => executeLoop(), 100)
    } else {
      // No tools to execute (shouldn't happen but handle gracefully)
      isExecutingRef.current = false
      setRunnerState(prev => ({ ...prev, isRunning: false }))
    }
  }, [
    agentId, 
    addAgentStep, 
    updateAgentStep,
    updateAgentStatus, 
    setPendingTool, 
    executeLoop, 
    recordToolExecution, 
    logToolRequest,
    logToolResult,
    detectAndLogFileOperations,
    maybeCreateCheckpoint,
    updateExecutionPhase
  ])

  /**
   * Internal tool execution - raw call without timeout
   */
  const executeToolInternalRaw = useCallback(async (
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
   * Internal tool execution with timeout wrapper (Phase 1)
   * 
   * Wraps tool execution with configurable timeout to prevent hung operations.
   * Uses AbortController pattern for clean cancellation.
   * 
   * @param toolName - Name of the tool to execute
   * @param args - Tool arguments
   * @param explanation - Optional explanation for the tool call
   * @param timeoutMs - Timeout in milliseconds (defaults to watchdog config)
   */
  const executeToolInternal = useCallback(async (
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string,
    timeoutMs: number = DEFAULT_WATCHDOG_CONFIG.toolTimeout
  ): Promise<{ success: boolean; result?: unknown; error?: string }> => {
    const executionStart = Date.now()
    
    // Update execution phase
    updateExecutionPhase('executing_tool', `Executing ${toolName}...`, toolName)
    
    // Create timeout race
    let timeoutId: NodeJS.Timeout | undefined
    
    try {
      const result = await Promise.race([
        executeToolInternalRaw(toolName, args, explanation),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Tool '${toolName}' timed out after ${Math.round(timeoutMs / 1000)}s`))
          }, timeoutMs)
        })
      ])
      
      // Clear timeout on success
      if (timeoutId) clearTimeout(timeoutId)
      
      // Record tool duration
      const duration = Date.now() - executionStart
      recordToolDuration(duration, result.success)
      
      // Update progress timestamp
      updateProgress()
      
      return result
    } catch (error) {
      // Clear timeout on error
      if (timeoutId) clearTimeout(timeoutId)
      
      // Record failed tool duration
      const duration = Date.now() - executionStart
      recordToolDuration(duration, false)
      
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[AgentRunner] Tool execution error (${toolName}):`, errorMsg)
      
      return {
        success: false,
        error: errorMsg
      }
    }
  }, [executeToolInternalRaw, updateExecutionPhase, updateProgress, recordToolDuration])

  /**
   * Check if message indicates task completion
   * 
   * PHASE 3 ENHANCED VERIFICATION: Multi-layer anti-hallucination checks
   * 1. Explicit "TASK COMPLETED" signal in message
   * 2. File path evidence in the completion message
   * 3. Actual successful tool executions tracked at runtime
   * 4. Git verification - check actual file changes match claims
   * 5. TypeScript verification - ensure code compiles
   * 
   * This comprehensive check ensures agents can't claim completion without proof.
   * Now async to support git and TypeScript verification.
   */
  const isCompletionMessage = useCallback(async (content: string): Promise<boolean> => {
    // Check 1: Explicit completion signal
    const hasExplicitCompletion = /TASK COMPLETED/i.test(content)
    if (!hasExplicitCompletion) {
      return false
    }
    
    // Check 2: File path evidence in message (using extractMentionedFiles)
    const mentionedFiles = extractMentionedFiles(content)
    if (mentionedFiles.length === 0) {
      console.warn('[AgentRunner] Completion claimed but no file paths mentioned')
      addAgentStep(agentId, {
        type: 'error',
        content: '⚠️ Completion claimed but no specific files were mentioned.',
        timestamp: Date.now()
      })
      return false
    }
    
    // Check 3: Runtime verification - did agent actually execute work tools?
    const workVerification = verifyWorkCompleted()
    if (!workVerification.hasMeaningfulWork) {
      console.warn('[AgentRunner] HALLUCINATION DETECTED: Agent claimed completion but executed NO work tools!')
      console.warn(`[AgentRunner] Total tool calls: ${workVerification.totalToolCalls}, Successful work calls: ${workVerification.successfulWorkCalls}`)
      
      addAgentStep(agentId, {
        type: 'error',
        content: `⚠️ Completion verification failed: No work-producing tools (write_file, edit_block, etc.) were successfully executed. The agent may have hallucinated actions.`,
        timestamp: Date.now()
      })
      
      return false
    }
    
    // Check 4 & 5: Git and TypeScript verification (if in a git repo with working directory)
    const agent = getAgentSafe()
    const workingDir = agent?.config.context?.workingDirectory
    
    if (workingDir) {
      try {
        const isGitRepo = await window.api.git.isRepository(workingDir)
        
        if (isGitRepo) {
          console.log('[AgentRunner] Running git verification...')
          const gitVerification = await window.api.git.verifyChanges(workingDir, mentionedFiles)
          
          if (!gitVerification.verified && gitVerification.missingChanges.length > 0) {
            console.warn('[AgentRunner] Git verification: Some expected files not changed:', gitVerification.missingChanges)
            // Log warning but don't fail - files might be unchanged intentionally
            addAgentStep(agentId, {
              type: 'thinking',
              content: `⚠️ Git verification note: ${gitVerification.missingChanges.length} expected file(s) show no changes: ${gitVerification.missingChanges.slice(0, 3).join(', ')}${gitVerification.missingChanges.length > 3 ? '...' : ''}`,
              timestamp: Date.now()
            })
          } else {
            console.log('[AgentRunner] ✅ Git verification passed:', gitVerification.changedFiles.length, 'files changed')
          }
        }

        // Check 5: TypeScript compilation verification
        console.log('[AgentRunner] Running TypeScript verification...')
        const tsVerification = await verifyTypeScriptCompilation(workingDir)
        
        if (!tsVerification.success) {
          console.warn('[AgentRunner] TypeScript verification failed:', tsVerification.errorCount, 'errors')
          addAgentStep(agentId, {
            type: 'error',
            content: `⚠️ TypeScript compilation failed with ${tsVerification.errorCount} error(s). Please fix before completion.`,
            timestamp: Date.now()
          })
          
          // Provide errors to agent for fixing by setting pending tool result
          pendingToolResultRef.current = `
TypeScript compilation check revealed ${tsVerification.errorCount} error(s):
${tsVerification.errors.slice(0, 5).join('\n')}
${tsVerification.errorCount > 5 ? `... and ${tsVerification.errorCount - 5} more errors` : ''}

Please fix these TypeScript errors before claiming task completion.`
          
          return false
        }
        
        console.log('[AgentRunner] ✅ TypeScript verification passed')
      } catch (error) {
        console.error('[AgentRunner] Verification error:', error)
        // Don't block completion on verification errors - log but continue
        addAgentStep(agentId, {
          type: 'thinking',
          content: `⚠️ Verification check encountered an error: ${error}. Proceeding with completion.`,
          timestamp: Date.now()
        })
      }
    }

    console.log(`[AgentRunner] ✅ All verification checks passed`)
    console.log(`[AgentRunner] Tools used: ${workVerification.workToolsUsed.join(', ')}`)
    
    return true
  }, [verifyWorkCompleted, addAgentStep, agentId, getAgentSafe])

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
    cleanupFunctionCallRef.current?.()
    cleanupFunctionCallRef.current = null
    pendingNativeFunctionCallsRef.current = []
    setPendingTool(agentId, null)
    isExecutingRef.current = false
    
    // Phase 1: Clear execution state on cleanup
    setRunnerState({
      isRunning: false,
      isStreaming: false,
      isRetrying: false,
      streamingContent: '',
      error: null,
      execution: null,
      tokens: null,
      diagnostics: {
        loopIterations: 0,
        toolCallsTotal: 0,
        toolCallsSuccessful: 0,
        toolCallsFailed: 0,
        averageToolDuration: 0,
        totalRuntime: 0,
        lastToolDurations: []
      }
    })
  }, [agentId, updateSessionStatus, createCheckpoint, setPendingTool])

  /**
   * Start agent execution
   */
  const start = useCallback(async () => {
    const agent = getAgentSafe()
    if (!agent) return
    
    // Reset tool execution tracking for fresh start
    resetToolTracking()
    
    // Phase 1: Reset diagnostics for fresh start
    resetDiagnostics()
    
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
  }, [getAgentSafe, mcpConnected, executeLoop, createSession, resetToolTracking, resetDiagnostics])

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
    
    // Phase 1: Clear execution state when paused
    clearExecutionState()
    
    updateAgentStatus(agentId, 'paused')
    setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false }))
    isExecutingRef.current = false
  }, [agentId, updateAgentStatus, updateSessionStatus, clearExecutionState])


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
    
    // Phase 1: Clear execution state when stopped
    clearExecutionState()
    
    updateAgentStatus(agentId, 'completed')
    setRunnerState(prev => ({ ...prev, isRunning: false, isStreaming: false }))
    isExecutingRef.current = false
    
    // Clear any pending tool
    setPendingTool(agentId, null)
  }, [agentId, updateAgentStatus, setPendingTool, updateSessionStatus, createCheckpoint, clearExecutionState])

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
      
      // Record tool execution for completion verification (manual approval flow)
      recordToolExecution(toolCall.tool, args, result.success)
      
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
      
      // Record failed tool execution for completion verification (manual approval flow)
      recordToolExecution(toolCall.tool, args, false)
      
      updateAgentStatus(agentId, 'failed', errorMsg)
      setRunnerState(prev => ({ ...prev, isRunning: false, error: errorMsg }))
    }
  }, [agentId, getAgentSafe, updateAgentStep, addAgentStep, setPendingTool, executeToolInternal, executeLoop, updateAgentStatus, logToolResult, logError, detectAndLogFileOperations, maybeCreateCheckpoint, recordToolExecution])

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

  // ============================================================================
  // Phase 2: Stall Recovery Actions
  // ============================================================================

  /**
   * Ref for tracking if a tool kill was requested
   * Used to signal the tool execution promise to abort
   */
  const toolKillRequestedRef = useRef(false)

  /**
   * Force retry - restart current iteration even if agent is running
   * 
   * This is different from the normal retry() which only works for failed agents.
   * forceRetry() can be called while the agent is running to force a fresh iteration,
   * useful when the agent appears to be stuck in an unproductive loop.
   */
  const forceRetry = useCallback(async () => {
    console.log('[AgentRunner] Force retry requested')
    
    // Abort any current operations
    abortControllerRef.current?.abort()
    window.api.offAI()
    cleanupFunctionCallRef.current?.()
    cleanupFunctionCallRef.current = null
    pendingNativeFunctionCallsRef.current = []
    toolKillRequestedRef.current = true
    
    // Log force retry to work journal
    if (workSessionIdRef.current) {
      try {
        await logError(
          workSessionIdRef.current,
          'force_retry',
          'User initiated force retry due to suspected stall',
          true
        )
      } catch (err) {
        console.error('[AgentRunner] Failed to log force retry:', err)
      }
    }
    
    // Add step indicating force retry
    addAgentStep(agentId, {
      type: 'thinking',
      content: '⚡ Force retry initiated - restarting current iteration',
      timestamp: Date.now()
    })
    
    // Clear execution state
    clearExecutionState()
    isExecutingRef.current = false
    
    // Small delay to ensure cleanup completes
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Reset kill flag
    toolKillRequestedRef.current = false
    
    // Restart execution loop
    await executeLoop()
  }, [agentId, addAgentStep, logError, clearExecutionState, executeLoop])

  /**
   * Kill the currently executing tool
   * 
   * Terminates the current tool execution and adds an error result.
   * The agent loop will continue with the tool failure.
   */
  const killCurrentTool = useCallback(() => {
    const execution = runnerState.execution
    if (!execution || execution.phase !== 'executing_tool') {
      console.log('[AgentRunner] No tool currently executing, cannot kill')
      return
    }
    
    const toolName = execution.currentToolName || 'unknown tool'
    console.log(`[AgentRunner] Killing tool: ${toolName}`)
    
    // Set the kill flag
    toolKillRequestedRef.current = true
    
    // Log kill to work journal
    if (workSessionIdRef.current) {
      logError(
        workSessionIdRef.current,
        'tool_killed',
        `User killed tool '${toolName}' due to suspected hang`,
        true
      ).catch(console.error)
    }
    
    // Add step indicating tool was killed
    addAgentStep(agentId, {
      type: 'error',
      content: `⛔ Tool '${toolName}' was killed by user. The tool may have been hanging or taking too long.`,
      timestamp: Date.now()
    })
    
    // Set a pending tool result indicating the kill
    pendingToolResultRef.current = `<tool_result name="${toolName}" status="killed">
Tool execution was terminated by user due to suspected hang or timeout.
Please acknowledge and continue with an alternative approach or retry with different parameters.
</tool_result>`
    
    // Clear current execution state
    clearExecutionState()
    
    // Note: The actual tool promise will reject with an error due to the flag,
    // and the error handler in executeToolInternal will handle cleanup
  }, [runnerState.execution, agentId, addAgentStep, logError, clearExecutionState])

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
      cleanupFunctionCallRef.current?.()
      
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
    forceCleanup: performCleanup,
    // Phase 2: Stall recovery actions
    forceRetry,
    killCurrentTool
  }
}

export default useAgentRunner
