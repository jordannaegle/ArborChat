// src/renderer/src/types/agent.ts

/**
 * Agent Status - Represents the current state of an agent
 */
export type AgentStatus = 
  | 'created'         // Agent initialized, awaiting first run
  | 'running'         // Actively processing/generating
  | 'waiting'         // Agent needs user input or tool approval
  | 'paused'          // Agent is paused by user
  | 'completed'       // Agent finished its task
  | 'failed'          // Agent encountered an error

/**
 * Agent Tool Permission - Controls auto-approval behavior
 */
export type AgentToolPermission = 
  | 'standard'      // Auto-approve safe, require approval for moderate+dangerous
  | 'restricted'    // Require approval for all tool operations
  | 'autonomous'    // Auto-approve safe+moderate, only require approval for dangerous

/**
 * Tool Risk Level - Categorization of tool operations
 */
export type ToolRiskLevel = 'safe' | 'moderate' | 'dangerous'

/**
 * Agent Context - Initial context seeding configuration
 */
export interface AgentContext {
  includeCurrentMessage: boolean
  includeParentContext: boolean
  parentContextDepth: number       // How many parent messages to include
  includeFullConversation: boolean
  includePersona: boolean
  seedMessages: AgentMessage[]     // Computed seed messages
  workingDirectory: string
}

/**
 * Agent Configuration - Settings for agent creation
 */
export interface AgentConfig {
  name: string
  instructions: string
  context: AgentContext
  toolPermission: AgentToolPermission
  modelId: string
  personaId?: string
  personaContent?: string
}

/**
 * Agent Message - Messages within an agent's context
 */
export interface AgentMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  isStreaming?: boolean
}

/**
 * Agent Step - A single step in agent execution
 */
export interface AgentStep {
  id: string
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error'
  content: string
  timestamp: number
  toolCall?: {
    name: string
    args: Record<string, unknown>
    status: 'pending' | 'approved' | 'denied' | 'completed' | 'failed'
    result?: unknown
    error?: string
    explanation?: string
  }
}

/**
 * Agent - The core agent entity
 */
export interface Agent {
  id: string
  config: AgentConfig
  status: AgentStatus
  
  // Conversation history
  messages: AgentMessage[]
  steps: AgentStep[]
  systemPrompt: string
  
  // Execution state
  currentStepIndex: number
  pendingApprovals: string[]       // Step IDs waiting for approval
  
  // Active tool call (for UI)
  pendingToolCall?: {
    id: string
    tool: string
    args: Record<string, unknown>
    explanation?: string
    originalContent: string
    cleanContent: string
  } | null
  
  // Timestamps
  createdAt: number
  startedAt?: number
  completedAt?: number
  
  // Progress tracking
  stepsCompleted: number
  estimatedStepsRemaining?: number
  
  // Error state
  error?: string
  
  // Source reference
  sourceConversationId: string
  sourceMessageId?: string
}

/**
 * Agent State - Global agent state for context
 */
export interface AgentState {
  agents: Record<string, Agent>
  activeAgentId: string | null
  isPanelOpen: boolean
  isMinimized: boolean
}

/**
 * Create Agent Options - Simplified options for agent creation
 */
export interface CreateAgentOptions {
  name?: string
  instructions: string
  conversationId: string
  sourceMessageId?: string
  sourceMessageContent?: string
  model: string
  toolPermission?: AgentToolPermission
  workingDirectory?: string
  personaId?: string
  personaContent?: string
  // Context seeding options
  includeCurrentMessage?: boolean
  includeParentContext?: boolean
  parentContextDepth?: number
  includeFullConversation?: boolean
  includePersona?: boolean
  conversationMessages?: AgentMessage[]
}

/**
 * Agent Summary - Lightweight representation for UI indicators
 */
export interface AgentSummary {
  id: string
  name: string
  status: AgentStatus
  stepsCompleted: number
  pendingApprovals: number
  hasError: boolean
}

/**
 * Agent Event Types - For real-time updates
 */
export type AgentEventType = 
  | 'status_changed'
  | 'message_added'
  | 'message_updated'
  | 'step_added'
  | 'step_updated'
  | 'tool_requested'
  | 'tool_completed'
  | 'error'
  | 'completed'

/**
 * Agent Template - Predefined configurations for common agent tasks (Phase 6)
 */
export interface AgentTemplate {
  id: string
  name: string
  description: string
  icon: string                       // Lucide icon name
  category: AgentTemplateCategory
  instructions: string               // Pre-filled instructions
  toolPermission: AgentToolPermission
  tags: string[]
  isBuiltIn: boolean                 // System templates vs user-created
  requiresDirectory?: boolean        // Whether a working directory must be selected
}

export type AgentTemplateCategory = 
  | 'development'
  | 'documentation'
  | 'analysis'
  | 'automation'
  | 'custom'

/**
 * Agent Statistics - Tracking agent performance over time (Phase 6)
 */
export interface AgentStats {
  totalAgents: number
  completedCount: number
  failedCount: number
  successRate: number               // 0-100 percentage
  avgDurationMs: number
  avgStepsPerAgent: number
  toolUsageByName: Record<string, number>
}

/**
 * Agent Retry Configuration (Phase 6)
 */
export interface AgentRetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
}

export const DEFAULT_RETRY_CONFIG: AgentRetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2
}
