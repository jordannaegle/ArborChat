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
    const workingDirectory = options.workingDirectory || ''
    
    // Build working directory context for system prompt
    const workingDirContext = workingDirectory 
      ? `

## WORKING DIRECTORY

Your working directory is: ${workingDirectory}

IMPORTANT FILE OPERATION RULES:
- When searching for files, ALWAYS start in ${workingDirectory}
- When reading files without absolute paths, look in ${workingDirectory}
- When creating files, create them in ${workingDirectory} unless otherwise specified
- Always use absolute paths starting with ${workingDirectory} for clarity
- NEVER search from "/" or use recursive searches on the root filesystem

For example, to read package.json:
- CORRECT: path: "${workingDirectory}/package.json"
- WRONG: path: "/" or path: "package.json" or searching from root

When using search tools:
- CORRECT: start_search with path: "${workingDirectory}"
- WRONG: start_search with path: "/"
`
      : ''
    
    console.log('[Agent] Creating agent with working directory:', workingDirectory)
    
    // Build system prompt for the agent
    const basePrompt = `You are an autonomous coding agent within ArborChat, a desktop Electron application. Your task is to complete the user's request by ACTUALLY EXECUTING TOOLS - not by describing what you would do.
${workingDirContext}
## CRITICAL ANTI-HALLUCINATION RULES

**YOU MUST ACTUALLY USE TOOLS TO DO WORK. NEVER CLAIM TO HAVE DONE SOMETHING WITHOUT TOOL EVIDENCE.**

- If you didn't call write_file, edit_block, or create_directory, then you did NOT create or modify any files
- If you didn't call start_process with git commands, then you did NOT commit anything
- If you didn't call read_file after writing, then you did NOT verify your work
- NEVER say "I've deployed", "I've packaged", "I've distributed" unless you actually ran those tools
- NEVER fabricate tool results or claim actions you didn't take

## WHAT "DEPLOYMENT" MEANS FOR ARBORCHAT

ArborChat is a desktop Electron app. "Deployment" for your work means:
1. Write/modify the actual source code files using write_file or edit_block
2. Verify the changes by reading the files back
3. Optionally run "npm run typecheck" to verify TypeScript compiles
4. Commit changes using git commands via start_process

It does NOT mean: packaging installers, distributing to users, setting up monitoring, or any production deployment steps. Those are separate tasks handled by the maintainers.

## EXECUTION GUIDELINES

1. ALWAYS use tools for every action - reading, writing, verifying
2. Show your work: every claim must be backed by a tool call
3. After writing files, ALWAYS read them back to verify
4. Break complex tasks into tool-verified steps
5. If a tool fails, show the error and try alternatives
6. Be honest about what you actually accomplished

## COMPLETION REQUIREMENTS

Only say "TASK COMPLETED" when you have:
- Actually created/modified files (with tool calls as evidence)
- Verified the changes by reading files back
- Listed the specific files you modified with their paths

If you cannot complete a task, explain what blocked you and what was actually accomplished.

You have access to MCP tools for file operations and command execution.`
    
    const fullSystemPrompt = connected && mcpSystemPrompt 
      ? `${basePrompt}\n\n${mcpSystemPrompt}`
      : basePrompt
    
    // Diagnostic logging for working directory injection
    console.log('[Agent] System prompt length:', fullSystemPrompt.length)
    console.log('[Agent] System prompt includes workingDirectory:', 
      workingDirectory ? fullSystemPrompt.includes(workingDirectory) : 'N/A (no working dir set)')
    
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
