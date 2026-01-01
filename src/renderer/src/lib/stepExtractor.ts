// src/renderer/src/lib/stepExtractor.ts
// Utility for extracting thinking/verification patterns from AI messages
// and mapping tool executions to ToolStep format for grouped display

import type { ToolStep, ToolCallData, ToolCallStatus, RiskLevel } from '../components/mcp/types'

// Re-export ToolExecution type reference for consumers
export type { ToolStep }

/**
 * Result of extracting steps from AI message content
 */
export interface ExtractedSteps {
  /** Thinking/planning steps found in the content */
  thinkingSteps: Array<{ id: string; content: string; timestamp: number }>
  /** Verification steps found in the content */
  verificationSteps: Array<{ id: string; content: string; timestamp: number }>
  /** Content after removing extracted patterns */
  remainingContent: string
  /** Whether any patterns were found */
  hasSteps: boolean
}

/**
 * Tool execution data from useMCPTools hook
 * Matches the ToolExecution interface
 */
export interface ToolExecutionInput {
  id: string
  toolName: string
  args: Record<string, unknown>
  explanation?: string
  status: string
  result?: unknown
  error?: string
  duration?: number
  autoApproved?: boolean
  serverName?: string
  riskLevel?: RiskLevel
}

/**
 * Pending tool call data from useToolChat hook
 */
export interface PendingToolInput {
  id: string
  tool: string
  args: Record<string, unknown>
  explanation?: string
  serverName?: string
  riskLevel?: RiskLevel
}

// Pattern matchers for thinking content
const THINKING_PATTERNS = [
  // Planning phrases
  /^(Let me|I'll|I will|First,? I'll|First,? let me|Now I'll|Now let me)/i,
  // Numbered steps
  /^\d+\.\s+(First|Then|Next|Finally|Now)/i,
  // Analysis phrases
  /^(Looking at|Analyzing|Examining|Checking|Reading|Reviewing)/i,
  // Decision phrases
  /^(I need to|I should|I'm going to|I am going to)/i
]

// Pattern matchers for verification content
const VERIFICATION_PATTERNS = [
  // Success indicators
  /^(I've verified|I have verified|Successfully|The result shows|Verified that)/i,
  // Completion indicators
  /^(Done|Completed|Finished|That's done|The .+ (is|are) (now|complete))/i,
  // Confirmation indicators
  /^(As we can see|The output shows|This confirms|Looking at the result)/i,
  // Error acknowledgment
  /^(Unfortunately|However,? the|The error indicates|It seems|There was)/i
]

let stepIdCounter = 0

/**
 * Generate a unique step ID
 */
function generateStepId(prefix: string = 'step'): string {
  return `${prefix}-${Date.now()}-${++stepIdCounter}`
}

/**
 * Test if a line matches thinking patterns
 */
function isThinkingLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return THINKING_PATTERNS.some(pattern => pattern.test(trimmed))
}

/**
 * Test if a line matches verification patterns
 */
function isVerificationLine(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  return VERIFICATION_PATTERNS.some(pattern => pattern.test(trimmed))
}


/**
 * Extract thinking and verification steps from AI message content
 * 
 * This parses AI responses looking for patterns that indicate:
 * - Planning/reasoning before tool execution
 * - Verification/confirmation after tool execution
 * 
 * @param content The AI message content to parse
 * @returns Extracted steps and remaining content
 */
export function extractStepsFromMessage(content: string): ExtractedSteps {
  const lines = content.split('\n')
  const thinkingSteps: ExtractedSteps['thinkingSteps'] = []
  const verificationSteps: ExtractedSteps['verificationSteps'] = []
  const remainingLines: string[] = []
  const timestamp = Date.now()
  
  let currentThinking: string[] = []
  let currentVerification: string[] = []
  
  for (const line of lines) {
    if (isThinkingLine(line)) {
      // Start or continue thinking block
      if (currentVerification.length > 0) {
        // Flush verification block
        verificationSteps.push({
          id: generateStepId('verify'),
          content: currentVerification.join('\n').trim(),
          timestamp
        })
        currentVerification = []
      }
      currentThinking.push(line)
    } else if (isVerificationLine(line)) {
      // Start or continue verification block
      if (currentThinking.length > 0) {
        // Flush thinking block
        thinkingSteps.push({
          id: generateStepId('think'),
          content: currentThinking.join('\n').trim(),
          timestamp
        })
        currentThinking = []
      }
      currentVerification.push(line)
    } else {
      // Regular content - flush any in-progress blocks
      if (currentThinking.length > 0) {
        // Check if this line continues the thinking
        if (line.trim() && !line.trim().startsWith('#')) {
          currentThinking.push(line)
        } else {
          thinkingSteps.push({
            id: generateStepId('think'),
            content: currentThinking.join('\n').trim(),
            timestamp
          })
          currentThinking = []
          remainingLines.push(line)
        }
      } else if (currentVerification.length > 0) {
        // Check if this line continues the verification
        if (line.trim() && !line.trim().startsWith('#')) {
          currentVerification.push(line)
        } else {
          verificationSteps.push({
            id: generateStepId('verify'),
            content: currentVerification.join('\n').trim(),
            timestamp
          })
          currentVerification = []
          remainingLines.push(line)
        }
      } else {
        remainingLines.push(line)
      }
    }
  }
  
  // Flush any remaining blocks
  if (currentThinking.length > 0) {
    thinkingSteps.push({
      id: generateStepId('think'),
      content: currentThinking.join('\n').trim(),
      timestamp
    })
  }
  if (currentVerification.length > 0) {
    verificationSteps.push({
      id: generateStepId('verify'),
      content: currentVerification.join('\n').trim(),
      timestamp
    })
  }
  
  return {
    thinkingSteps,
    verificationSteps,
    remainingContent: remainingLines.join('\n').trim(),
    hasSteps: thinkingSteps.length > 0 || verificationSteps.length > 0
  }
}


/**
 * Map tool execution status to ToolCallStatus
 */
function mapStatus(status: string): ToolCallStatus {
  const statusMap: Record<string, ToolCallStatus> = {
    pending: 'pending',
    approved: 'approved',
    rejected: 'rejected',
    executing: 'executing',
    completed: 'completed',
    error: 'error'
  }
  return statusMap[status] || 'pending'
}

/**
 * Convert a ToolExecution to ToolStep format
 */
export function toolExecutionToStep(
  execution: ToolExecutionInput,
  serverName: string = 'desktop-commander'
): ToolStep {
  const toolCall: ToolCallData = {
    name: execution.toolName,
    serverName: execution.serverName || serverName,
    args: execution.args,
    result: execution.result,
    error: execution.error,
    status: mapStatus(execution.status),
    duration: execution.duration,
    autoApproved: execution.autoApproved,
    explanation: execution.explanation,
    riskLevel: execution.riskLevel
  }
  
  return {
    id: execution.id,
    type: 'tool_call',
    content: execution.explanation || `Execute ${execution.toolName}`,
    timestamp: Date.now(),
    toolCall
  }
}

/**
 * Convert a PendingToolCall to ToolStep format
 */
export function pendingToolToStep(
  pending: PendingToolInput,
  serverName: string = 'desktop-commander'
): ToolStep {
  const toolCall: ToolCallData = {
    name: pending.tool,
    serverName: pending.serverName || serverName,
    args: pending.args,
    status: 'pending',
    explanation: pending.explanation,
    riskLevel: pending.riskLevel
  }
  
  return {
    id: pending.id,
    type: 'tool_call',
    content: pending.explanation || `Execute ${pending.tool}`,
    timestamp: Date.now(),
    toolCall
  }
}


/**
 * Create thinking step from extracted content
 */
export function createThinkingStep(
  content: string,
  id?: string
): ToolStep {
  return {
    id: id || generateStepId('think'),
    type: 'thinking',
    content,
    timestamp: Date.now()
  }
}

/**
 * Create verification step from extracted content
 */
export function createVerificationStep(
  content: string,
  id?: string
): ToolStep {
  return {
    id: id || generateStepId('verify'),
    type: 'verification',
    content,
    timestamp: Date.now()
  }
}

/**
 * Create thought process step (for AI reasoning summaries)
 */
export function createThoughtProcessStep(
  content: string,
  id?: string
): ToolStep {
  return {
    id: id || generateStepId('thought'),
    type: 'thought_process',
    content,
    timestamp: Date.now()
  }
}

/**
 * Data structure for a tool step group in the timeline
 */
export interface ToolStepGroupData {
  groupId: string
  steps: ToolStep[]
  collapsed: boolean
}

let groupIdCounter = 0

/**
 * Generate a unique group ID
 */
function generateGroupId(): string {
  return `group-${Date.now()}-${++groupIdCounter}`
}

/**
 * Create a ToolStepGroup data structure from executions and context
 * 
 * This is the main function for building grouped tool displays:
 * - Optionally adds thinking steps from preceding AI message
 * - Converts tool executions to tool call steps
 * - Optionally adds verification steps from following AI message
 * 
 * @param executions Array of tool executions to group
 * @param options Configuration for step extraction
 */
export function createToolStepGroup(
  executions: ToolExecutionInput[],
  options: {
    precedingMessage?: string
    followingMessage?: string
    serverName?: string
    includeThinking?: boolean
    includeVerification?: boolean
  } = {}
): ToolStepGroupData {
  const {
    precedingMessage,
    followingMessage,
    serverName = 'desktop-commander',
    includeThinking = true,
    includeVerification = true
  } = options
  
  const steps: ToolStep[] = []
  
  // 1. Extract thinking steps from preceding message
  if (includeThinking && precedingMessage) {
    const extracted = extractStepsFromMessage(precedingMessage)
    for (const thinking of extracted.thinkingSteps) {
      steps.push(createThinkingStep(thinking.content, thinking.id))
    }
  }
  
  // 2. Convert tool executions to steps
  for (const exec of executions) {
    steps.push(toolExecutionToStep(exec, serverName))
  }
  
  // 3. Extract verification steps from following message
  if (includeVerification && followingMessage) {
    const extracted = extractStepsFromMessage(followingMessage)
    for (const verification of extracted.verificationSteps) {
      steps.push(createVerificationStep(verification.content, verification.id))
    }
  }
  
  // Determine initial collapsed state
  // Expand if any step is pending approval
  const hasPending = steps.some(
    s => s.type === 'tool_call' && s.toolCall?.status === 'pending'
  )
  
  return {
    groupId: generateGroupId(),
    steps,
    collapsed: !hasPending
  }
}


/**
 * Create a simple tool step group from a single pending tool call
 * Used when a tool call is awaiting approval
 */
export function createPendingToolStepGroup(
  pending: PendingToolInput,
  precedingContent?: string,
  serverName?: string
): ToolStepGroupData {
  const steps: ToolStep[] = []
  
  // Optionally add thinking from preceding content
  if (precedingContent) {
    const extracted = extractStepsFromMessage(precedingContent)
    for (const thinking of extracted.thinkingSteps) {
      steps.push(createThinkingStep(thinking.content, thinking.id))
    }
  }
  
  // Add the pending tool call
  steps.push(pendingToolToStep(pending, serverName))
  
  return {
    groupId: generateGroupId(),
    steps,
    collapsed: false // Always show pending approvals
  }
}

/**
 * Merge consecutive tool step groups that belong together
 * Useful for batching rapid-fire tool calls
 */
export function mergeToolStepGroups(
  groups: ToolStepGroupData[]
): ToolStepGroupData[] {
  if (groups.length <= 1) return groups
  
  const merged: ToolStepGroupData[] = []
  let current: ToolStepGroupData | null = null
  
  for (const group of groups) {
    if (!current) {
      current = { ...group, steps: [...group.steps] }
    } else {
      // Merge if groups are close in time (all steps within 30 seconds)
      const lastStepTime = current.steps[current.steps.length - 1]?.timestamp || 0
      const firstStepTime = group.steps[0]?.timestamp || 0
      
      if (firstStepTime - lastStepTime < 30000) {
        // Merge steps
        current.steps.push(...group.steps)
        // Preserve expanded state if any group has pending
        if (!group.collapsed) {
          current.collapsed = false
        }
      } else {
        // Start new group
        merged.push(current)
        current = { ...group, steps: [...group.steps] }
      }
    }
  }
  
  if (current) {
    merged.push(current)
  }
  
  return merged
}

/**
 * Helper to determine server name from tool name
 * Maps common tools to their MCP server
 */
export function inferServerFromTool(toolName: string): string {
  // Desktop Commander tools
  const dcTools = [
    'read_file', 'read_multiple_files', 'write_file', 'write_pdf',
    'create_directory', 'list_directory', 'move_file', 'get_file_info',
    'edit_block', 'start_search', 'get_more_search_results', 'stop_search',
    'list_searches', 'start_process', 'read_process_output', 'interact_with_process',
    'force_terminate', 'list_sessions', 'list_processes', 'kill_process',
    'get_config', 'set_config_value', 'get_usage_stats', 'get_recent_tool_calls',
    'get_prompts', 'give_feedback_to_desktop_commander'
  ]
  
  // GitHub MCP tools
  const ghTools = [
    'create_or_update_file', 'search_repositories', 'create_repository',
    'get_file_contents', 'push_files', 'create_issue', 'create_pull_request',
    'fork_repository', 'create_branch', 'list_commits', 'list_branches',
    'search_code', 'search_issues', 'search_users', 'get_issue', 'update_issue',
    'add_issue_comment', 'get_pull_request', 'list_pull_requests'
  ]
  
  // Memory MCP tools
  const memTools = [
    'create_entities', 'create_relations', 'add_observations',
    'delete_entities', 'delete_observations', 'delete_relations',
    'read_graph', 'search_nodes', 'open_nodes'
  ]
  
  // SSH MCP tools
  const sshTools = ['ssh_execute', 'ssh_disconnect']
  
  if (dcTools.includes(toolName)) return 'desktop-commander'
  if (ghTools.includes(toolName)) return 'github'
  if (memTools.includes(toolName)) return 'memory'
  if (sshTools.includes(toolName)) return 'ssh-mcp'
  
  return 'unknown'
}
