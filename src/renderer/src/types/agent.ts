// src/renderer/src/types/agent.ts

/**
 * Agent Status - Represents the current state of an agent
 */
export type AgentStatus =
  | 'created' // Agent initialized, awaiting first run
  | 'running' // Actively processing/generating
  | 'waiting' // Agent needs user input or tool approval
  | 'paused' // Agent is paused by user
  | 'completed' // Agent finished its task
  | 'failed' // Agent encountered an error

/**
 * Agent Tool Permission - Controls auto-approval behavior
 */
export type AgentToolPermission =
  | 'standard' // Auto-approve safe, require approval for moderate+dangerous
  | 'restricted' // Require approval for all tool operations
  | 'autonomous' // Auto-approve safe+moderate, only require approval for dangerous

/**
 * Tool Risk Level - Categorization of tool operations
 */
export type ToolRiskLevel = 'safe' | 'moderate' | 'dangerous'

/**
 * Git Scope - For code review and analysis agents
 */
export type GitScope = 
  | 'all'                 // Review all files in directory
  | 'uncommitted'         // Only uncommitted changes
  | 'branch'              // Changes since a specific branch

/**
 * Git Context - Git-specific configuration for agents
 */
export interface GitContext {
  isGitRepo: boolean
  scope: GitScope
  baseBranch?: string     // For 'branch' scope
  currentBranch?: string
  uncommittedFileCount?: number
}

/**
 * Agent Context - Initial context seeding configuration
 */
export interface AgentContext {
  includeCurrentMessage: boolean
  includeParentContext: boolean
  parentContextDepth: number // How many parent messages to include
  includeFullConversation: boolean
  includePersona: boolean
  seedMessages: AgentMessage[] // Computed seed messages
  workingDirectory: string
  gitContext?: GitContext          // Git-specific context for code agents
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
  pendingApprovals: string[] // Step IDs waiting for approval

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
  
  // Phase 4: Advanced capabilities
  /** Auto-analyze project structure for context injection */
  autoAnalyzeProject?: boolean
  /** Token budget for context (default: 50000) */
  contextTokenBudget?: number
  /** Enable multi-file orchestration for complex refactoring */
  enableMultiFileOrchestration?: boolean
  /** Session ID to restore from checkpoint */
  checkpointToRestore?: string
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
  
  // Phase 4: Advanced capabilities
  /** Auto-analyze project structure for context injection */
  autoAnalyzeProject?: boolean
  /** Token budget for context (default: 50000) */
  contextTokenBudget?: number
  /** Enable multi-file orchestration for complex refactoring */
  enableMultiFileOrchestration?: boolean
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

// ============================================================================
// Phase: Agent Execution Monitoring & Diagnostics Types
// ============================================================================

/**
 * Execution Phase - Granular execution state machine phases
 * 
 * State transitions:
 * idle → streaming_ai → executing_tool → idle/waiting_approval/verifying_completion
 */
export type ExecutionPhase =
  | 'idle'                 // Not actively processing
  | 'streaming_ai'         // Receiving AI response chunks
  | 'executing_tool'       // Running MCP tool call
  | 'waiting_approval'     // Tool pending user approval
  | 'verifying_completion' // Running completion checks

/**
 * Execution Activity - Real-time tracking of agent execution state
 */
export interface ExecutionActivity {
  phase: ExecutionPhase
  startedAt: number               // Timestamp when this phase started
  toolName?: string               // If executing a tool
  tokensSent?: number             // Estimated tokens in context
  tokensReceived?: number         // Tokens received so far
  lastProgressAt: number          // Last time progress was made
  progressIndicator: string       // Human-readable activity description
}

/**
 * Token Metrics - Context window utilization tracking
 */
export interface TokenMetrics {
  contextUsed: number             // Estimated tokens in context
  contextMax: number              // Model's max context
  usagePercent: number            // contextUsed / contextMax
  lastMessageTokens: number       // Tokens in the last message
  estimatedRemaining: number      // Tokens available
}

/**
 * Token Warning Level - Context window usage severity
 */
export type TokenWarningLevel = 'normal' | 'warning' | 'critical'

/**
 * Execution Diagnostics - Performance metrics for debugging
 */
export interface ExecutionDiagnostics {
  loopIterations: number          // Number of agent loop iterations
  toolCallsTotal: number          // Total tool calls attempted
  toolCallsSuccessful: number     // Successful tool calls
  toolCallsFailed: number         // Failed tool calls
  averageToolDuration: number     // Average tool execution time (ms)
  totalRuntime: number            // Total agent runtime (ms)
  lastToolDurations: number[]     // Last N tool execution durations for averaging
}

/**
 * Watchdog Configuration - Stall detection thresholds
 */
export interface WatchdogConfig {
  /** Warn if no progress for this duration (ms) */
  warnThreshold: number
  /** Consider stalled if no progress for this duration (ms) */
  stallThreshold: number
  /** Maximum tool execution time before timeout (ms) */
  toolTimeout: number
  /** How often to check for stalls (ms) */
  checkInterval: number
}

/**
 * Default watchdog configuration
 */
export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  warnThreshold: 30_000,    // 30 seconds
  stallThreshold: 120_000,  // 2 minutes
  toolTimeout: 300_000,     // 5 minutes
  checkInterval: 5_000      // Check every 5 seconds
}

/**
 * Model Context Limits - Maximum context window sizes by model
 * These are approximate values - actual limits vary by API version
 */
export const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  // Gemini models
  'gemini-2.5-pro-preview-05-06': 1_048_576,
  'gemini-2.5-flash-preview-05-20': 1_048_576,
  'gemini-2.0-flash': 1_048_576,
  'gemini-1.5-pro': 2_097_152,
  'gemini-1.5-flash': 1_048_576,
  
  // Anthropic models
  'claude-sonnet-4-20250514': 200_000,
  'claude-3-5-sonnet-20241022': 200_000,
  'claude-3-opus-20240229': 200_000,
  'claude-3-haiku-20240307': 200_000,
  
  // OpenAI models
  'gpt-4o': 128_000,
  'gpt-4o-mini': 128_000,
  'gpt-4-turbo': 128_000,
  'gpt-4': 8_192,
  
  // DeepSeek models
  'deepseek-r1': 128_000,
  'deepseek-chat': 128_000,
  
  // Default fallback
  'default': 100_000
}

/**
 * Get context limit for a model
 */
export function getModelContextLimit(modelId: string): number {
  return MODEL_CONTEXT_LIMITS[modelId] || MODEL_CONTEXT_LIMITS['default']
}
