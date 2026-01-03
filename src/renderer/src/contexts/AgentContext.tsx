// src/renderer/src/contexts/AgentContext.tsx
// Phase 6.5: Memory Cleanup & Resource Management
// Author: Alex Chen (Distinguished Software Architect)

import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react'
import type {
  Agent,
  AgentState,
  AgentStatus,
  AgentStep,
  AgentMessage,
  AgentSummary,
  CreateAgentOptions
} from '../types/agent'

// ID generation
let agentIdCounter = 0
let stepIdCounter = 0

function generateAgentId(): string {
  return `agent-${++agentIdCounter}-${Date.now()}`
}

function generateStepId(): string {
  return `step-${++stepIdCounter}-${Date.now()}`
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// Generate creative agent names
function generateAgentName(): string {
  const adjectives = ['Swift', 'Smart', 'Diligent', 'Clever', 'Quick', 'Focused', 'Sharp', 'Bright']
  const nouns = ['Coder', 'Builder', 'Worker', 'Helper', 'Agent', 'Assistant']
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]
  const noun = nouns[Math.floor(Math.random() * nouns.length)]
  return `${adj} ${noun}`
}

// Cleanup function type for resource management
type CleanupFunction = () => void

// Resumption types (matches WorkJournal types)
export interface ResumptionContext {
  originalPrompt: string
  workSummary: string
  keyDecisions: string[]
  currentState: string
  filesModified: string[]
  pendingActions: string[]
  errorHistory: string[]
  suggestedNextSteps: string[]
  tokenCount: number
}

export interface ResumedSession {
  id: string
  conversationId: string
  originalPrompt: string
  status: 'active' | 'paused' | 'completed' | 'crashed'
  createdAt: number
  updatedAt: number
  completedAt?: number
  tokenEstimate: number
  entryCount: number
}

// Action types
type AgentAction =
  | { type: 'CREATE_AGENT'; payload: Agent }
  | { type: 'UPDATE_AGENT_STATUS'; payload: { agentId: string; status: AgentStatus; error?: string } }
  | { type: 'ADD_AGENT_MESSAGE'; payload: { agentId: string; message: AgentMessage } }
  | { type: 'UPDATE_AGENT_MESSAGE'; payload: { agentId: string; messageId: string; content: string } }
  | { type: 'ADD_AGENT_STEP'; payload: { agentId: string; step: AgentStep } }
  | { type: 'UPDATE_STEP'; payload: { agentId: string; stepId: string; updates: Partial<AgentStep> } }
  | { type: 'SET_PENDING_TOOL'; payload: { agentId: string; toolCall: Agent['pendingToolCall'] } }
  | { type: 'SET_ACTIVE_AGENT'; payload: string | null }
  | { type: 'TOGGLE_PANEL'; payload?: boolean }
  | { type: 'TOGGLE_MINIMIZE'; payload?: boolean }
  | { type: 'REMOVE_AGENT'; payload: string }
  | { type: 'CLEAR_ALL_AGENTS' }
  | { type: 'TRIM_AGENT_HISTORY'; payload: { agentId: string; maxSteps: number; maxMessages: number } }

// Initial state
const initialState: AgentState = {
  agents: {},
  activeAgentId: null,
  isPanelOpen: false,
  isMinimized: false
}

// Reducer
function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case 'CREATE_AGENT': {
      const agent = action.payload
      return {
        ...state,
        agents: { ...state.agents, [agent.id]: agent },
        activeAgentId: agent.id,
        isPanelOpen: true,
        isMinimized: false
      }
    }

    case 'UPDATE_AGENT_STATUS': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      const updates: Partial<Agent> = { 
        status: action.payload.status,
        error: action.payload.error
      }
      
      if (action.payload.status === 'running' && !agent.startedAt) {
        updates.startedAt = Date.now()
      }
      if (action.payload.status === 'completed' || action.payload.status === 'failed') {
        updates.completedAt = Date.now()
      }

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: { ...agent, ...updates }
        }
      }
    }

    case 'ADD_AGENT_MESSAGE': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            messages: [...agent.messages, action.payload.message],
            stepsCompleted: action.payload.message.role === 'assistant' 
              ? agent.stepsCompleted + 1 
              : agent.stepsCompleted
          }
        }
      }
    }

    case 'UPDATE_AGENT_MESSAGE': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      const updatedMessages = agent.messages.map(msg =>
        msg.id === action.payload.messageId
          ? { ...msg, content: action.payload.content }
          : msg
      )

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: { ...agent, messages: updatedMessages }
        }
      }
    }

    case 'ADD_AGENT_STEP': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      const newPendingApprovals = action.payload.step.toolCall?.status === 'pending'
        ? [...agent.pendingApprovals, action.payload.step.id]
        : agent.pendingApprovals

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            steps: [...agent.steps, action.payload.step],
            pendingApprovals: newPendingApprovals
          }
        }
      }
    }

    case 'UPDATE_STEP': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      const updatedSteps = agent.steps.map(step =>
        step.id === action.payload.stepId
          ? { ...step, ...action.payload.updates }
          : step
      )

      // Remove from pending if approved/denied
      const stepUpdate = action.payload.updates
      const updatedPendingApprovals = 
        stepUpdate.toolCall?.status && stepUpdate.toolCall.status !== 'pending'
          ? agent.pendingApprovals.filter(id => id !== action.payload.stepId)
          : agent.pendingApprovals

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            steps: updatedSteps,
            pendingApprovals: updatedPendingApprovals
          }
        }
      }
    }

    case 'SET_PENDING_TOOL': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            pendingToolCall: action.payload.toolCall
          }
        }
      }
    }

    case 'SET_ACTIVE_AGENT':
      return { 
        ...state, 
        activeAgentId: action.payload,
        isPanelOpen: action.payload !== null ? true : state.isPanelOpen
      }

    case 'TOGGLE_PANEL':
      return {
        ...state,
        isPanelOpen: action.payload !== undefined ? action.payload : !state.isPanelOpen
      }

    case 'TOGGLE_MINIMIZE':
      return {
        ...state,
        isMinimized: action.payload !== undefined ? action.payload : !state.isMinimized
      }

    case 'REMOVE_AGENT': {
      const { [action.payload]: removed, ...remainingAgents } = state.agents
      return {
        ...state,
        agents: remainingAgents,
        activeAgentId: state.activeAgentId === action.payload ? null : state.activeAgentId,
        isPanelOpen: state.activeAgentId === action.payload ? false : state.isPanelOpen
      }
    }

    case 'CLEAR_ALL_AGENTS':
      return {
        ...initialState
      }

    // New action for trimming agent history to prevent memory bloat
    case 'TRIM_AGENT_HISTORY': {
      const agent = state.agents[action.payload.agentId]
      if (!agent) return state

      const { maxSteps, maxMessages } = action.payload
      
      // Trim steps - keep most recent, preserve pending approvals
      const pendingStepIds = new Set(agent.pendingApprovals)
      let trimmedSteps = agent.steps
      if (agent.steps.length > maxSteps) {
        // Keep pending steps and most recent steps
        const pendingSteps = agent.steps.filter(s => pendingStepIds.has(s.id))
        const nonPendingSteps = agent.steps.filter(s => !pendingStepIds.has(s.id))
        const recentNonPending = nonPendingSteps.slice(-maxSteps)
        trimmedSteps = [...recentNonPending, ...pendingSteps]
          .sort((a, b) => a.timestamp - b.timestamp)
      }

      // Trim messages - keep most recent
      const trimmedMessages = agent.messages.length > maxMessages
        ? agent.messages.slice(-maxMessages)
        : agent.messages

      return {
        ...state,
        agents: {
          ...state.agents,
          [action.payload.agentId]: {
            ...agent,
            steps: trimmedSteps,
            messages: trimmedMessages
          }
        }
      }
    }

    default:
      return state
  }
}


// Context type with cleanup registration
interface AgentContextType {
  state: AgentState
  
  // Agent lifecycle
  createAgent: (options: CreateAgentOptions) => Agent
  createAgentWithAdvancedContext: (options: CreateAgentOptions) => Promise<Agent>
  updateAgentStatus: (agentId: string, status: AgentStatus, error?: string) => void
  removeAgent: (agentId: string) => void
  clearAllAgents: () => void
  
  // Agent messages
  addAgentMessage: (agentId: string, role: 'user' | 'assistant', content: string) => AgentMessage
  updateAgentMessage: (agentId: string, messageId: string, content: string) => void
  
  // Agent steps
  addAgentStep: (agentId: string, step: Omit<AgentStep, 'id'>) => AgentStep
  updateAgentStep: (agentId: string, stepId: string, updates: Partial<AgentStep>) => void
  
  // Tool management
  setPendingTool: (agentId: string, toolCall: Agent['pendingToolCall']) => void
  
  // UI state
  setActiveAgent: (agentId: string | null) => void
  togglePanel: (open?: boolean) => void
  toggleMinimize: (minimized?: boolean) => void
  
  // Computed
  getAgent: (agentId: string) => Agent | undefined
  getActiveAgent: () => Agent | undefined
  getAgentSummaries: () => AgentSummary[]
  getPendingApprovals: () => Array<{ agent: Agent; step: AgentStep }>
  getRunningAgents: () => Agent[]
  hasActiveAgents: () => boolean

  // Phase 6.5: Cleanup registration for resource management
  registerCleanup: (agentId: string, cleanup: CleanupFunction) => void
  unregisterCleanup: (agentId: string) => void
  
  // Phase 6.5: History management for memory control
  trimAgentHistory: (agentId: string, maxSteps?: number, maxMessages?: number) => void

  // Phase 5: Session resumption support
  createAgentWithResumption: (
    conversationId: string,
    session: ResumedSession,
    context: ResumptionContext,
    options?: Partial<CreateAgentOptions>
  ) => Agent
}

const AgentContext = createContext<AgentContextType | null>(null)


// Provider component with cleanup management
export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, initialState)
  
  // Phase 6.5: Cleanup registry - stores cleanup functions per agent
  const cleanupRegistryRef = useRef<Map<string, CleanupFunction>>(new Map())

  // Create a new agent (async to support Phase 4 project analysis)
  const createAgent = useCallback((options: CreateAgentOptions): Agent => {
    const id = generateAgentId()
    const now = Date.now()

    // Build seed messages from context options
    const seedMessages: AgentMessage[] = []
    
    if (options.includeCurrentMessage && options.sourceMessageContent) {
      seedMessages.push({
        id: generateMessageId(),
        role: 'assistant',
        content: options.sourceMessageContent,
        timestamp: new Date().toISOString()
      })
    }
    
    if (options.includeFullConversation && options.conversationMessages) {
      seedMessages.push(...options.conversationMessages)
    } else if (options.includeParentContext && options.conversationMessages) {
      const depth = options.parentContextDepth || 3
      const recentMessages = options.conversationMessages.slice(-depth * 2)
      seedMessages.push(...recentMessages)
    }

    // Build system prompt
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
    
    console.log('[AgentContext] Creating agent with working directory:', workingDirectory)
    
    // Phase 4: Add multi-file orchestration guidance if enabled
    const orchestrationContext = options.enableMultiFileOrchestration
      ? `

## MULTI-FILE ORCHESTRATION

You have multi-file orchestration capabilities enabled. When performing complex refactoring:
1. Plan the execution order carefully - files that are imported should be updated first
2. Track dependencies between files
3. Verify each change compiles before moving to dependent files
4. Consider using checkpoints for large refactoring operations
`
      : ''
    
    let systemPrompt = `You are an autonomous coding agent within ArborChat. Your task is to complete the user's request step by step.
${workingDirContext}${orchestrationContext}
IMPORTANT GUIDELINES:
1. Work methodically - break complex tasks into smaller steps
2. Use tools to read files, write code, and execute commands
3. Always verify your work by reading files after writing them
4. If you encounter an error, analyze it and try a different approach
5. Explain what you're doing at each step
6. When you complete the task, clearly state "TASK COMPLETED" and summarize what you did

You have access to MCP tools for file operations and command execution.`

    if (options.personaContent) {
      systemPrompt = `${options.personaContent}\n\n---\n\n${systemPrompt}`
    }

    // Diagnostic logging for working directory injection
    console.log('[AgentContext] System prompt length:', systemPrompt.length)
    console.log('[AgentContext] System prompt includes workingDirectory:', 
      workingDirectory ? systemPrompt.includes(workingDirectory) : 'N/A (no working dir set)')
    
    // Phase 4: Log advanced capability flags
    if (options.autoAnalyzeProject || options.enableMultiFileOrchestration || options.checkpointToRestore) {
      console.log('[AgentContext] Phase 4 capabilities:', {
        autoAnalyzeProject: options.autoAnalyzeProject,
        enableMultiFileOrchestration: options.enableMultiFileOrchestration,
        contextTokenBudget: options.contextTokenBudget,
        checkpointToRestore: options.checkpointToRestore
      })
    }

    const agent: Agent = {
      id,
      config: {
        name: options.name || generateAgentName(),
        instructions: options.instructions,
        context: {
          includeCurrentMessage: options.includeCurrentMessage ?? true,
          includeParentContext: options.includeParentContext ?? true,
          parentContextDepth: options.parentContextDepth ?? 3,
          includeFullConversation: options.includeFullConversation ?? false,
          includePersona: options.includePersona ?? true,
          seedMessages,
          workingDirectory: options.workingDirectory || ''
        },
        toolPermission: options.toolPermission || 'standard',
        modelId: options.model,
        personaId: options.personaId,
        personaContent: options.personaContent
      },
      status: 'created',
      messages: [],
      steps: [],
      systemPrompt,
      currentStepIndex: 0,
      pendingApprovals: [],
      pendingToolCall: null,
      createdAt: now,
      stepsCompleted: 0,
      sourceConversationId: options.conversationId,
      sourceMessageId: options.sourceMessageId
    }

    dispatch({ type: 'CREATE_AGENT', payload: agent })
    return agent
  }, [])

  // Phase 5: Create agent with resumption context from previous session
  const createAgentWithResumption = useCallback((
    conversationId: string,
    session: ResumedSession,
    context: ResumptionContext,
    options?: Partial<CreateAgentOptions>
  ): Agent => {
    // Build resumption system prompt
    const resumptionPrompt = `
## Resuming Previous Work Session

You are resuming an interrupted work session. Here is the context:

**Original Task:**
${context.originalPrompt}

**Work Summary:**
${context.workSummary}

**Current State:**
${context.currentState}

${context.keyDecisions.length > 0 ? `**Key Decisions Made:**
${context.keyDecisions.map(d => `- ${d}`).join('\n')}` : ''}

${context.filesModified.length > 0 ? `**Files Modified:**
${context.filesModified.map(f => `- ${f}`).join('\n')}` : ''}

${context.pendingActions.length > 0 ? `**Pending Actions:**
${context.pendingActions.map(a => `- ${a}`).join('\n')}` : ''}

${context.errorHistory.length > 0 ? `**Previous Errors (avoid repeating):**
${context.errorHistory.map(e => `- ${e}`).join('\n')}` : ''}

${context.suggestedNextSteps.length > 0 ? `**Suggested Next Steps:**
${context.suggestedNextSteps.map(s => `- ${s}`).join('\n')}` : ''}

Please continue from where the previous session left off. Acknowledge the resumption briefly, then proceed with the remaining work.
`.trim()

    // Create agent with resumption as instructions
    const agent = createAgent({
      conversationId,
      name: `Resumed: ${session.originalPrompt.slice(0, 25)}...`,
      instructions: resumptionPrompt,
      toolPermission: options?.toolPermission || 'standard',
      model: options?.model || 'gemini-2.5-flash',
      personaId: options?.personaId,
      personaContent: options?.personaContent,
      includeCurrentMessage: false,
      includeFullConversation: false,
      includeParentContext: false,
      ...options
    })

    // Add resumption metadata to agent
    // (Note: metadata field would need to be added to Agent type for full implementation)
    console.log(`[AgentContext] Created resumed agent ${agent.id} from session ${session.id}`)

    return agent
  }, [createAgent])

  // Phase 4: Create agent with advanced context (project analysis, checkpoint restoration)
  const createAgentWithAdvancedContext = useCallback(async (
    options: CreateAgentOptions
  ): Promise<Agent> => {
    let enhancedOptions = { ...options }
    
    // Phase 4: Auto-analyze project if requested
    if (options.autoAnalyzeProject && options.workingDirectory) {
      try {
        console.log('[AgentContext] Analyzing project structure...')
        
        // Import dynamically to avoid circular dependencies
        const { analyzeProject, readProjectConfigs, buildProjectContextPrompt } = 
          await import('../lib/projectContext')
        
        const projectContext = await analyzeProject(options.workingDirectory)
        const configs = await readProjectConfigs(options.workingDirectory, projectContext)
        const projectContextPrompt = buildProjectContextPrompt(projectContext, configs)
        
        console.log('[AgentContext] Project context built:', {
          type: projectContext.type,
          framework: projectContext.framework,
          hasTypeScript: projectContext.hasTypeScript,
          sourceDirectories: projectContext.sourceDirectories.length,
          configFiles: projectContext.configFiles.length
        })
        
        // Append project context to personaContent or create new
        if (enhancedOptions.personaContent) {
          enhancedOptions.personaContent = `${enhancedOptions.personaContent}\n\n${projectContextPrompt}`
        } else {
          enhancedOptions.personaContent = projectContextPrompt
        }
      } catch (error) {
        console.warn('[AgentContext] Project analysis failed:', error)
        // Continue without project context
      }
    }
    
    // Phase 4: Handle checkpoint restoration
    if (options.checkpointToRestore) {
      try {
        console.log('[AgentContext] Restoring from checkpoint:', options.checkpointToRestore)
        
        // Access work journal API directly (can't use hooks in callbacks)
        const session = await window.api.workJournal.getSession(options.checkpointToRestore)
        if (session) {
          const resumptionContext = await window.api.workJournal.generateResumptionContext(
            options.checkpointToRestore,
            options.contextTokenBudget || 10000
          )
          
          // Build resumption context string
          const resumptionPrompt = `
## Session Resumption Context

You are resuming a previous work session. Here's what was accomplished:

### Original Task
${resumptionContext.originalPrompt}

### Work Summary
${resumptionContext.workSummary}

### Key Decisions Made
${resumptionContext.keyDecisions.map(d => `- ${d}`).join('\n') || '- None recorded'}

### Files Modified
${resumptionContext.filesModified.map(f => `- ${f}`).join('\n') || '- None yet'}

### Current State
${resumptionContext.currentState}

### Pending Actions
${resumptionContext.pendingActions.map(a => `- ${a}`).join('\n') || '- None pending'}

${resumptionContext.errorHistory.length > 0 ? `### Previous Errors to Avoid\n${resumptionContext.errorHistory.slice(-3).map(e => `- ${e}`).join('\n')}` : ''}

---
Resume from where you left off. Review the above context and continue the task.
`
          
          // Append resumption context
          if (enhancedOptions.personaContent) {
            enhancedOptions.personaContent = `${enhancedOptions.personaContent}\n\n${resumptionPrompt}`
          } else {
            enhancedOptions.personaContent = resumptionPrompt
          }
          
          console.log('[AgentContext] Checkpoint restoration context applied')
        }
      } catch (error) {
        console.warn('[AgentContext] Checkpoint restoration failed:', error)
        // Continue without checkpoint context
      }
    }
    
    // Agentic Memory: Inject playbook context if available
    if (window.api?.playbook) {
      try {
        console.log('[AgentContext] Fetching playbook context...')
        const playbookContext = await window.api.playbook.generateContext(
          options.workingDirectory,
          2000 // Max ~2000 tokens for playbook
        )
        
        if (playbookContext && playbookContext.trim()) {
          console.log('[AgentContext] Playbook context loaded, length:', playbookContext.length)
          
          // Prepend playbook context (learned knowledge) to system prompt
          if (enhancedOptions.personaContent) {
            enhancedOptions.personaContent = `${playbookContext}\n\n${enhancedOptions.personaContent}`
          } else {
            enhancedOptions.personaContent = playbookContext
          }
        } else {
          console.log('[AgentContext] No playbook entries available')
        }
      } catch (error) {
        console.warn('[AgentContext] Playbook context injection failed:', error)
        // Continue without playbook context - non-blocking
      }
    }
    
    // Create the agent with enhanced options
    return createAgent(enhancedOptions)
  }, [createAgent])

  // Update agent status
  const updateAgentStatus = useCallback((agentId: string, status: AgentStatus, error?: string) => {
    dispatch({ type: 'UPDATE_AGENT_STATUS', payload: { agentId, status, error } })
  }, [])

  // Phase 6.5: Remove agent with cleanup coordination
  const removeAgent = useCallback((agentId: string) => {
    console.log(`[AgentContext] Removing agent ${agentId}, triggering cleanup...`)
    
    // 1. Call registered cleanup function if it exists
    const cleanup = cleanupRegistryRef.current.get(agentId)
    if (cleanup) {
      try {
        cleanup()
        console.log(`[AgentContext] Cleanup completed for agent ${agentId}`)
      } catch (err) {
        console.error(`[AgentContext] Cleanup error for agent ${agentId}:`, err)
      }
      cleanupRegistryRef.current.delete(agentId)
    }
    
    // 2. Remove from state
    dispatch({ type: 'REMOVE_AGENT', payload: agentId })
  }, [])

  // Phase 6.5: Clear all agents with cleanup
  const clearAllAgents = useCallback(() => {
    console.log('[AgentContext] Clearing all agents, triggering cleanups...')
    
    // Call cleanup for each registered agent
    cleanupRegistryRef.current.forEach((cleanup, agentId) => {
      try {
        cleanup()
        console.log(`[AgentContext] Cleanup completed for agent ${agentId}`)
      } catch (err) {
        console.error(`[AgentContext] Cleanup error for agent ${agentId}:`, err)
      }
    })
    cleanupRegistryRef.current.clear()
    
    dispatch({ type: 'CLEAR_ALL_AGENTS' })
  }, [])

  // Phase 6.5: Register cleanup function for an agent
  const registerCleanup = useCallback((agentId: string, cleanup: CleanupFunction) => {
    console.log(`[AgentContext] Registering cleanup for agent ${agentId}`)
    cleanupRegistryRef.current.set(agentId, cleanup)
  }, [])

  // Phase 6.5: Unregister cleanup function (called on unmount without removal)
  const unregisterCleanup = useCallback((agentId: string) => {
    cleanupRegistryRef.current.delete(agentId)
  }, [])

  // Phase 6.5: Trim agent history to prevent memory bloat in long sessions
  const trimAgentHistory = useCallback((
    agentId: string,
    maxSteps: number = 100,
    maxMessages: number = 50
  ) => {
    dispatch({ 
      type: 'TRIM_AGENT_HISTORY', 
      payload: { agentId, maxSteps, maxMessages } 
    })
  }, [])

  // Add message to agent
  const addAgentMessage = useCallback((
    agentId: string, 
    role: 'user' | 'assistant', 
    content: string
  ): AgentMessage => {
    const message: AgentMessage = {
      id: generateMessageId(),
      role,
      content,
      timestamp: new Date().toISOString()
    }
    dispatch({ type: 'ADD_AGENT_MESSAGE', payload: { agentId, message } })
    return message
  }, [])

  // Update agent message
  const updateAgentMessage = useCallback((agentId: string, messageId: string, content: string) => {
    dispatch({ type: 'UPDATE_AGENT_MESSAGE', payload: { agentId, messageId, content } })
  }, [])

  // Add step to agent
  const addAgentStep = useCallback((agentId: string, step: Omit<AgentStep, 'id'>): AgentStep => {
    const fullStep: AgentStep = {
      ...step,
      id: generateStepId()
    }
    dispatch({ type: 'ADD_AGENT_STEP', payload: { agentId, step: fullStep } })
    return fullStep
  }, [])

  // Update agent step
  const updateAgentStep = useCallback((agentId: string, stepId: string, updates: Partial<AgentStep>) => {
    dispatch({ type: 'UPDATE_STEP', payload: { agentId, stepId, updates } })
  }, [])

  // Set pending tool
  const setPendingTool = useCallback((agentId: string, toolCall: Agent['pendingToolCall']) => {
    dispatch({ type: 'SET_PENDING_TOOL', payload: { agentId, toolCall } })
  }, [])

  // UI state management
  const setActiveAgent = useCallback((agentId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_AGENT', payload: agentId })
  }, [])

  const togglePanel = useCallback((open?: boolean) => {
    dispatch({ type: 'TOGGLE_PANEL', payload: open })
  }, [])

  const toggleMinimize = useCallback((minimized?: boolean) => {
    dispatch({ type: 'TOGGLE_MINIMIZE', payload: minimized })
  }, [])

  // Computed getters
  const getAgent = useCallback((agentId: string): Agent | undefined => {
    return state.agents[agentId]
  }, [state.agents])

  const getActiveAgent = useCallback((): Agent | undefined => {
    return state.activeAgentId ? state.agents[state.activeAgentId] : undefined
  }, [state.activeAgentId, state.agents])

  const getAgentSummaries = useCallback((): AgentSummary[] => {
    return Object.values(state.agents).map(agent => ({
      id: agent.id,
      name: agent.config.name,
      status: agent.status,
      stepsCompleted: agent.stepsCompleted,
      pendingApprovals: agent.pendingApprovals.length,
      hasError: agent.status === 'failed'
    }))
  }, [state.agents])

  const getPendingApprovals = useCallback((): Array<{ agent: Agent; step: AgentStep }> => {
    const approvals: Array<{ agent: Agent; step: AgentStep }> = []
    
    Object.values(state.agents).forEach(agent => {
      agent.pendingApprovals.forEach(stepId => {
        const step = agent.steps.find(s => s.id === stepId)
        if (step) {
          approvals.push({ agent, step })
        }
      })
    })
    
    return approvals
  }, [state.agents])

  const getRunningAgents = useCallback((): Agent[] => {
    return Object.values(state.agents).filter(
      agent => agent.status === 'running' || agent.status === 'waiting'
    )
  }, [state.agents])

  const hasActiveAgents = useCallback((): boolean => {
    return Object.values(state.agents).some(
      agent => agent.status === 'running' || agent.status === 'waiting' || agent.status === 'created'
    )
  }, [state.agents])

  // Memoized context value
  const contextValue = useMemo<AgentContextType>(() => ({
    state,
    createAgent,
    updateAgentStatus,
    removeAgent,
    clearAllAgents,
    addAgentMessage,
    updateAgentMessage,
    addAgentStep,
    updateAgentStep,
    setPendingTool,
    setActiveAgent,
    togglePanel,
    toggleMinimize,
    getAgent,
    getActiveAgent,
    getAgentSummaries,
    getPendingApprovals,
    getRunningAgents,
    hasActiveAgents,
    // Phase 6.5: Cleanup APIs
    registerCleanup,
    unregisterCleanup,
    trimAgentHistory,
    // Phase 5: Session resumption
    createAgentWithResumption,
    // Phase 4: Advanced capabilities
    createAgentWithAdvancedContext
  }), [
    state,
    createAgent,
    createAgentWithAdvancedContext,
    updateAgentStatus,
    removeAgent,
    clearAllAgents,
    addAgentMessage,
    updateAgentMessage,
    addAgentStep,
    updateAgentStep,
    setPendingTool,
    setActiveAgent,
    togglePanel,
    toggleMinimize,
    getAgent,
    getActiveAgent,
    getAgentSummaries,
    getPendingApprovals,
    getRunningAgents,
    hasActiveAgents,
    registerCleanup,
    unregisterCleanup,
    trimAgentHistory,
    createAgentWithResumption
  ])

  return (
    <AgentContext.Provider value={contextValue}>
      {children}
    </AgentContext.Provider>
  )
}

// Hook to use agent context
export function useAgentContext(): AgentContextType {
  const context = useContext(AgentContext)
  if (!context) {
    throw new Error('useAgentContext must be used within AgentProvider')
  }
  return context
}

export default AgentContext
