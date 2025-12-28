// src/renderer/src/contexts/AgentContext.tsx

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react'
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

    default:
      return state
  }
}


// Context type
interface AgentContextType {
  state: AgentState
  
  // Agent lifecycle
  createAgent: (options: CreateAgentOptions) => Agent
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
}

const AgentContext = createContext<AgentContextType | null>(null)


// Provider component
export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(agentReducer, initialState)

  // Create a new agent
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
    let systemPrompt = `You are an autonomous coding agent within ArborChat. Your task is to complete the user's request step by step.

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

  // Update agent status
  const updateAgentStatus = useCallback((agentId: string, status: AgentStatus, error?: string) => {
    dispatch({ type: 'UPDATE_AGENT_STATUS', payload: { agentId, status, error } })
  }, [])

  // Remove agent
  const removeAgent = useCallback((agentId: string) => {
    dispatch({ type: 'REMOVE_AGENT', payload: agentId })
  }, [])

  // Clear all agents
  const clearAllAgents = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL_AGENTS' })
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
    hasActiveAgents
  }), [
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
    hasActiveAgents
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
