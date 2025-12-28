// src/renderer/src/hooks/useAgent.ts

import { useState, useCallback, useRef, useEffect } from 'react'
import { useMCP } from '../components/mcp'
import { parseToolCalls, stripToolCalls, formatToolResult } from '../lib/toolParser'
import type { 
  Agent, 
  AgentMessage, 
  AgentStatus, 
  AgentStep,
  AgentConfig,
  AgentContext,
  CreateAgentOptions
} from '../types/agent'

let agentIdCounter = 0
let messageIdCounter = 0
let stepIdCounter = 0

function generateAgentId(): string {
  return `agent-${++agentIdCounter}-${Date.now()}`
}

function generateMessageId(): string {
  return `agent-msg-${++messageIdCounter}`
}

function generateStepId(): string {
  return `step-${++stepIdCounter}`
}

function generateAgentName(): string {
  const adjectives = ['Swift', 'Smart', 'Diligent', 'Clever', 'Quick', 'Focused', 'Sharp', 'Bright']
  const nouns = ['Coder', 'Builder', 'Worker', 'Helper', 'Agent', 'Assistant']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}

export interface UseAgentResult {
  agent: Agent | null
  
  // Actions
  createAgent: (options: CreateAgentOptions) => Agent
  startAgent: (apiKey: string, model: string) => void
  sendMessage: (content: string, apiKey: string, model: string) => void
  pauseAgent: () => void
  resumeAgent: (apiKey: string, model: string) => void
  
  // Tool Actions
  approveToolCall: (id: string, modifiedArgs?: Record<string, unknown>, apiKey?: string, model?: string) => Promise<void>
  rejectToolCall: (id: string) => void
  
  // State
  isStreaming: boolean
  streamingContent: string
  
  // Cleanup
  destroyAgent: () => void
}

export function useAgent(): UseAgentResult {
  const { connected, systemPrompt: mcpSystemPrompt, requestTool } = useMCP()
  
  const [agent, setAgent] = useState<Agent | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  
  const streamBufferRef = useRef('')
  const contextRef = useRef<any[]>([])
  const apiKeyRef = useRef<string>('')
  const modelRef = useRef<string>('')
  const isPausedRef = useRef(false)


  // Create a new agent - properly aligned with Agent type
  const createAgent = useCallback((options: CreateAgentOptions): Agent => {
    const now = Date.now()
    
    // Build system prompt for the agent
    const basePrompt = `You are an autonomous coding agent within ArborChat. Your task is to complete the user's request step by step.

IMPORTANT GUIDELINES:
1. Work methodically - break complex tasks into smaller steps
2. Use tools to read files, write code, and execute commands
3. Always verify your work by reading files after writing them
4. If you encounter an error, analyze it and try a different approach
5. Explain what you're doing at each step
6. When you complete the task, clearly state "TASK COMPLETED" and summarize what you did

You have access to MCP tools for file operations and command execution.`
    
    const fullSystemPrompt = connected && mcpSystemPrompt 
      ? `${basePrompt}\n\n${mcpSystemPrompt}`
      : basePrompt
    
    // Build agent context from options
    const agentContext: AgentContext = {
      includeCurrentMessage: options.includeCurrentMessage ?? true,
      includeParentContext: options.includeParentContext ?? false,
      parentContextDepth: options.parentContextDepth ?? 3,
      includeFullConversation: options.includeFullConversation ?? false,
      includePersona: options.includePersona ?? false,
      seedMessages: options.conversationMessages || [],
      workingDirectory: options.workingDirectory || '~'
    }
    
    // Build agent config
    const agentConfig: AgentConfig = {
      name: options.name || generateAgentName(),
      instructions: options.instructions,
      context: agentContext,
      toolPermission: options.toolPermission || 'standard',
      modelId: options.model,
      personaId: options.personaId,
      personaContent: options.personaContent
    }
    
    const newAgent: Agent = {
      id: generateAgentId(),
      config: agentConfig,
      status: 'created',
      messages: [],
      steps: [],
      systemPrompt: fullSystemPrompt,
      currentStepIndex: 0,
      pendingApprovals: [],
      pendingToolCall: null,
      createdAt: now,
      stepsCompleted: 0,
      sourceConversationId: options.conversationId,
      sourceMessageId: options.sourceMessageId
    }
    
    setAgent(newAgent)
    return newAgent
  }, [connected, mcpSystemPrompt])


  // Add a message to the agent's context
  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    const message: AgentMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: new Date().toISOString()
    }
    
    setAgent(prev => prev ? {
      ...prev,
      messages: [...prev.messages, message],
      stepsCompleted: role === 'assistant' ? prev.stepsCompleted + 1 : prev.stepsCompleted
    } : null)
    
    return message
  }, [])

  // Add a step to the agent's execution history
  const addStep = useCallback((
    type: AgentStep['type'],
    content: string,
    toolCall?: AgentStep['toolCall']
  ): AgentStep => {
    const step: AgentStep = {
      id: generateStepId(),
      type,
      content,
      timestamp: Date.now(),
      toolCall
    }
    
    setAgent(prev => prev ? {
      ...prev,
      steps: [...prev.steps, step],
      currentStepIndex: prev.steps.length
    } : null)
    
    return step
  }, [])

  // Update agent status
  const updateStatus = useCallback((status: AgentStatus, error?: string) => {
    setAgent(prev => prev ? {
      ...prev,
      status,
      error,
      ...(status === 'running' && !prev.startedAt ? { startedAt: Date.now() } : {}),
      ...(status === 'completed' || status === 'failed' ? { completedAt: Date.now() } : {})
    } : null)
  }, [])


  // Stream AI response
  const streamAI = useCallback(async (context: any[]) => {
    if (isPausedRef.current) return
    
    setIsStreaming(true)
    setStreamingContent('')
    streamBufferRef.current = ''
    contextRef.current = context
    updateStatus('running')
    addStep('thinking', 'Processing request...')

    const cleanup = () => {
      window.api.offAI()
    }

    window.api.onToken((token) => {
      if (isPausedRef.current) return
      streamBufferRef.current += token
      setStreamingContent(streamBufferRef.current)
    })

    window.api.onDone(async () => {
      const finalContent = streamBufferRef.current
      cleanup()
      
      if (!finalContent || isPausedRef.current) {
        setIsStreaming(false)
        return
      }

      // Parse for tool calls
      const toolCalls = parseToolCalls(finalContent)
      
      if (toolCalls.length > 0) {
        const firstCall = toolCalls[0]
        const cleanContent = stripToolCalls(finalContent)
        
        // Check if auto-approved
        try {
          const config = await window.api.mcp.getConfig()
          const alwaysApproveTools = config.alwaysApproveTools || []
          
          if (alwaysApproveTools.includes(firstCall.tool)) {
            // Auto-approve and execute
            addMessage('assistant', finalContent)
            addStep('tool_call', `Auto-executing: ${firstCall.tool}`, {
              name: firstCall.tool,
              args: firstCall.args,
              status: 'approved',
              explanation: firstCall.explanation
            })
            
            const result = await requestTool(firstCall.tool, firstCall.args, firstCall.explanation)
            const toolResultContext = formatToolResult(firstCall.tool, result.result, result.error)
            
            addStep('tool_result', toolResultContext, {
              name: firstCall.tool,
              args: firstCall.args,
              status: 'completed',
              result: result.result,
              error: result.error
            })
            
            // Continue conversation with tool result
            const continueContext = [
              ...contextRef.current,
              { role: 'assistant', content: finalContent },
              { role: 'user', content: `Tool execution result:\n\n${toolResultContext}\n\nPlease continue with the next step.` }
            ]
            
            setStreamingContent('')
            setIsStreaming(false)
            
            // Small delay then continue
            setTimeout(() => streamAI(continueContext), 100)
          } else {
            // Need approval - set waiting status
            addMessage('assistant', finalContent)
            addStep('tool_call', `Waiting for approval: ${firstCall.tool}`, {
              name: firstCall.tool,
              args: firstCall.args,
              status: 'pending',
              explanation: firstCall.explanation
            })

            
            setAgent(prev => prev ? {
              ...prev,
              status: 'waiting',
              pendingToolCall: {
                id: `tool-${Date.now()}`,
                tool: firstCall.tool,
                args: firstCall.args,
                explanation: firstCall.explanation,
                originalContent: finalContent,
                cleanContent
              },
              pendingApprovals: [...prev.pendingApprovals, `tool-${Date.now()}`]
            } : null)
            setIsStreaming(false)
            setStreamingContent('')
          }
        } catch (error) {
          console.error('[Agent] Tool check error:', error)
          updateStatus('failed', String(error))
          addStep('error', String(error))
          setIsStreaming(false)
        }
      } else {
        // No tool call - save message and check if task completed
        addMessage('assistant', finalContent)
        addStep('message', finalContent)
        setStreamingContent('')
        setIsStreaming(false)
        
        // Check if agent signaled completion
        if (finalContent.includes('TASK COMPLETED') || finalContent.includes('Task completed')) {
          updateStatus('completed')
        } else {
          // Agent waiting for next instruction or user input
          updateStatus('waiting')
        }
      }
    })

    window.api.onError((err) => {
      console.error('[Agent] AI Error:', err)
      cleanup()
      setIsStreaming(false)
      updateStatus('failed', err)
      addStep('error', err)
      addMessage('assistant', `⚠️ Error: ${err}`)
    })

    window.api.askAI(apiKeyRef.current, context, modelRef.current)
  }, [addMessage, addStep, updateStatus, requestTool])


  // Start the agent with initial instructions
  const startAgent = useCallback((apiKey: string, model: string) => {
    if (!agent) return
    
    apiKeyRef.current = apiKey
    modelRef.current = model
    isPausedRef.current = false
    
    // Build initial context
    const systemMessage = { role: 'system', content: agent.systemPrompt }
    
    let userContent = agent.config.instructions
    
    // Add seed context if available
    if (agent.config.context.seedMessages.length > 0) {
      const contextSummary = agent.config.context.seedMessages
        .map(m => `${m.role}: ${m.content}`)
        .join('\n')
      userContent = `Context from previous conversation:\n"${contextSummary}"\n\n---\n\nTask: ${agent.config.instructions}`
    }
    
    addMessage('user', userContent)
    addStep('message', `Starting task: ${agent.config.instructions}`)
    
    const context = [
      systemMessage,
      { role: 'user', content: userContent }
    ]
    
    streamAI(context)
  }, [agent, addMessage, addStep, streamAI])


  // Send additional message to agent
  const sendMessage = useCallback((content: string, apiKey: string, model: string) => {
    if (!agent || isStreaming) return
    
    apiKeyRef.current = apiKey
    modelRef.current = model
    isPausedRef.current = false
    
    addMessage('user', content)
    addStep('message', `User input: ${content}`)
    
    // Build context from all messages
    const context = [
      { role: 'system', content: agent.systemPrompt },
      ...agent.messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content }
    ]
    
    streamAI(context)
  }, [agent, isStreaming, addMessage, addStep, streamAI])

  // Pause the agent
  const pauseAgent = useCallback(() => {
    isPausedRef.current = true
    updateStatus('paused')
    addStep('message', 'Agent paused by user')
  }, [updateStatus, addStep])

  // Resume the agent
  const resumeAgent = useCallback((apiKey: string, model: string) => {
    if (!agent) return
    
    apiKeyRef.current = apiKey
    modelRef.current = model
    isPausedRef.current = false
    
    addStep('message', 'Agent resumed')
    
    // Resume with current context
    const context = [
      { role: 'system', content: agent.systemPrompt },
      ...agent.messages.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: 'Please continue where you left off.' }
    ]
    
    addMessage('user', 'Continue')
    streamAI(context)
  }, [agent, addMessage, addStep, streamAI])


  // Approve a tool call
  const approveToolCall = useCallback(async (
    id: string,
    modifiedArgs?: Record<string, unknown>,
    apiKey?: string,
    model?: string
  ) => {
    if (!agent?.pendingToolCall || agent.pendingToolCall.id !== id) return
    
    if (apiKey) apiKeyRef.current = apiKey
    if (model) modelRef.current = model
    
    const toolCall = agent.pendingToolCall
    const args = modifiedArgs || toolCall.args
    
    try {
      addStep('tool_call', `Executing: ${toolCall.tool}`, {
        name: toolCall.tool,
        args,
        status: 'approved',
        explanation: toolCall.explanation
      })
      
      const result = await requestTool(toolCall.tool, args, toolCall.explanation)
      const toolResultContext = formatToolResult(toolCall.tool, result.result, result.error)
      
      addStep('tool_result', toolResultContext, {
        name: toolCall.tool,
        args,
        status: 'completed',
        result: result.result,
        error: result.error
      })
      
      // Clear pending tool and approvals
      setAgent(prev => prev ? { 
        ...prev, 
        pendingToolCall: null,
        pendingApprovals: prev.pendingApprovals.filter(a => a !== id)
      } : null)
      
      // Continue conversation
      const context = [
        { role: 'system', content: agent.systemPrompt },
        ...agent.messages.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: `Tool execution result:\n\n${toolResultContext}\n\nPlease continue with the next step.` }
      ]
      
      addMessage('user', `[Tool ${toolCall.tool} executed]`)
      streamAI(context)
    } catch (error) {
      console.error('[Agent] Tool execution failed:', error)
      updateStatus('failed', String(error))
      addStep('error', `Tool failed: ${String(error)}`)
    }
  }, [agent, requestTool, addMessage, addStep, streamAI, updateStatus])

  // Reject a tool call
  const rejectToolCall = useCallback((id: string) => {
    if (!agent?.pendingToolCall || agent.pendingToolCall.id !== id) return
    
    addStep('tool_call', `Tool rejected: ${agent.pendingToolCall.tool}`, {
      name: agent.pendingToolCall.tool,
      args: agent.pendingToolCall.args,
      status: 'denied'
    })
    
    setAgent(prev => prev ? {
      ...prev,
      pendingToolCall: null,
      pendingApprovals: prev.pendingApprovals.filter(a => a !== id),
      status: 'waiting'
    } : null)
    
    addMessage('user', '[Tool request rejected by user]')
  }, [agent, addMessage, addStep])


  // Cleanup agent
  const destroyAgent = useCallback(() => {
    isPausedRef.current = true
    window.api.offAI()
    setAgent(null)
    setIsStreaming(false)
    setStreamingContent('')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.api.offAI()
    }
  }, [])

  return {
    agent,
    createAgent,
    startAgent,
    sendMessage,
    pauseAgent,
    resumeAgent,
    approveToolCall,
    rejectToolCall,
    isStreaming,
    streamingContent,
    destroyAgent
  }
}

export default useAgent
