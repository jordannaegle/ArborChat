// src/renderer/src/lib/agentStepAdapter.ts
// Adapter utility to convert AgentStep to ToolStep format for enhanced tool display
// Enables ToolStepGroup integration in AgentPanel

import type { AgentStep, Agent } from '../types/agent'
import type { ToolStep, ToolCallData, ToolCallStatus, RiskLevel } from '../components/mcp/types'
import { inferServerFromTool } from './stepExtractor'

/**
 * Map AgentStep.toolCall.status to ToolCallStatus
 * 
 * AgentStep uses: 'pending' | 'approved' | 'denied' | 'completed' | 'failed'
 * ToolStep uses: 'pending' | 'approved' | 'executing' | 'completed' | 'error' | 'rejected'
 */
function mapAgentToolStatus(status: string): ToolCallStatus {
  const statusMap: Record<string, ToolCallStatus> = {
    pending: 'pending',
    approved: 'executing',  // 'approved' in agent context means about to execute
    denied: 'rejected',
    completed: 'completed',
    failed: 'error'
  }
  return statusMap[status] || 'pending'
}

/**
 * Compute risk level for a tool based on its name
 * Uses the same classification logic as the tool approval system
 */
function computeToolRiskLevel(toolName: string): RiskLevel {
  // Dangerous tools - file modification, process control, system changes
  const dangerousTools = [
    'write_file', 'write_pdf', 'edit_block', 'move_file', 'create_directory',
    'start_process', 'interact_with_process', 'force_terminate', 'kill_process',
    'set_config_value', 'ssh_execute',
    'create_or_update_file', 'push_files', 'create_issue', 'create_pull_request',
    'fork_repository', 'create_branch', 'update_issue', 'add_issue_comment',
    'create_entities', 'create_relations', 'add_observations',
    'delete_entities', 'delete_observations', 'delete_relations'
  ]

  // Safe tools - read-only operations
  const safeTools = [
    'read_file', 'read_multiple_files', 'list_directory', 'get_file_info',
    'list_sessions', 'list_processes', 'list_searches', 'get_config',
    'get_usage_stats', 'get_recent_tool_calls', 'get_prompts',
    'read_process_output', 'get_more_search_results',
    'get_file_contents', 'search_repositories', 'search_code', 'search_issues',
    'search_users', 'get_issue', 'get_pull_request', 'list_pull_requests',
    'list_commits', 'list_branches',
    'read_graph', 'search_nodes', 'open_nodes'
  ]

  if (dangerousTools.includes(toolName)) return 'dangerous'
  if (safeTools.includes(toolName)) return 'safe'
  return 'moderate'
}

/**
 * Convert a single AgentStep to ToolStep format
 */
export function agentStepToToolStep(agentStep: AgentStep): ToolStep {
  // Handle tool_call type steps
  if (agentStep.type === 'tool_call' && agentStep.toolCall) {
    const toolCall: ToolCallData = {
      name: agentStep.toolCall.name,
      serverName: inferServerFromTool(agentStep.toolCall.name),
      args: agentStep.toolCall.args,
      result: agentStep.toolCall.result,
      error: agentStep.toolCall.error,
      status: mapAgentToolStatus(agentStep.toolCall.status),
      explanation: agentStep.toolCall.explanation,
      riskLevel: computeToolRiskLevel(agentStep.toolCall.name)
    }

    return {
      id: agentStep.id,
      type: 'tool_call',
      content: agentStep.toolCall.explanation || `Execute ${agentStep.toolCall.name}`,
      timestamp: agentStep.timestamp,
      toolCall
    }
  }

  // Map other step types
  const typeMap: Record<AgentStep['type'], ToolStep['type']> = {
    thinking: 'thinking',
    tool_call: 'tool_call',
    tool_result: 'verification',
    message: 'thought_process',
    error: 'verification'
  }

  return {
    id: agentStep.id,
    type: typeMap[agentStep.type] || 'thinking',
    content: agentStep.content,
    timestamp: agentStep.timestamp
  }
}

/**
 * Convert Agent's pendingToolCall to ToolStep format
 */
export function agentPendingToolToStep(
  pendingToolCall: NonNullable<Agent['pendingToolCall']>
): ToolStep {
  const toolCall: ToolCallData = {
    name: pendingToolCall.tool,
    serverName: inferServerFromTool(pendingToolCall.tool),
    args: pendingToolCall.args,
    status: 'pending',
    explanation: pendingToolCall.explanation,
    riskLevel: computeToolRiskLevel(pendingToolCall.tool)
  }

  return {
    id: pendingToolCall.id,
    type: 'tool_call',
    content: pendingToolCall.explanation || `Execute ${pendingToolCall.tool}`,
    timestamp: Date.now(),
    toolCall
  }
}

/**
 * Data structure for grouped tool display
 */
export interface AgentToolStepGroupData {
  groupId: string
  steps: ToolStep[]
  collapsed: boolean
}

let groupIdCounter = 0

/**
 * Generate a unique group ID for agent tool groups
 */
function generateAgentGroupId(): string {
  return `agent-group-${Date.now()}-${++groupIdCounter}`
}

/**
 * Group consecutive tool-related AgentSteps into ToolStepGroupData
 * 
 * This groups thinking → tool_call → tool_result sequences into
 * cohesive groups for enhanced display.
 * 
 * @param steps Array of AgentSteps to process
 * @param pendingToolCall Optional pending tool call from Agent
 * @returns Array of grouped display items
 */
export function groupAgentStepsForDisplay(
  steps: AgentStep[],
  pendingToolCall?: Agent['pendingToolCall']
): Array<{
  type: 'step_group' | 'message' | 'other'
  steps?: ToolStep[]
  groupId?: string
  agentStep?: AgentStep
}> {
  const result: Array<{
    type: 'step_group' | 'message' | 'other'
    steps?: ToolStep[]
    groupId?: string
    agentStep?: AgentStep
  }> = []

  let currentGroup: ToolStep[] = []
  let lastToolCallTime: number | null = null

  const flushGroup = () => {
    if (currentGroup.length > 0) {
      result.push({
        type: 'step_group',
        steps: [...currentGroup],
        groupId: generateAgentGroupId()
      })
      currentGroup = []
    }
    lastToolCallTime = null
  }

  for (const step of steps) {
    // Handle tool_call and related steps
    if (step.type === 'tool_call' || step.type === 'tool_result') {
      // If this is a new group (more than 60s since last tool call), flush
      if (lastToolCallTime && step.timestamp - lastToolCallTime > 60000) {
        flushGroup()
      }

      currentGroup.push(agentStepToToolStep(step))
      if (step.type === 'tool_call') {
        lastToolCallTime = step.timestamp
      }
    } else if (step.type === 'thinking') {
      // Thinking steps belong with the next tool call if close in time
      // For now, add to current group if we're building one
      if (currentGroup.length > 0 || lastToolCallTime) {
        currentGroup.push(agentStepToToolStep(step))
      } else {
        // Standalone thinking before any tools - start a new potential group
        currentGroup.push(agentStepToToolStep(step))
      }
    } else if (step.type === 'message') {
      // Message steps break the tool group sequence
      flushGroup()
      result.push({
        type: 'message',
        agentStep: step
      })
    } else if (step.type === 'error') {
      // Errors can be shown in the current group or standalone
      if (currentGroup.length > 0) {
        currentGroup.push(agentStepToToolStep(step))
        flushGroup()
      } else {
        result.push({
          type: 'other',
          agentStep: step
        })
      }
    } else {
      // Other step types
      flushGroup()
      result.push({
        type: 'other',
        agentStep: step
      })
    }
  }

  // Flush any remaining group
  flushGroup()

  // Add pending tool call as its own group if present
  if (pendingToolCall) {
    result.push({
      type: 'step_group',
      steps: [agentPendingToolToStep(pendingToolCall)],
      groupId: generateAgentGroupId()
    })
  }

  return result
}

/**
 * Create a single step group from a set of agent steps
 * Simpler API for when you just want to wrap steps into a group
 */
export function createAgentToolStepGroup(
  steps: AgentStep[],
  pendingToolCall?: Agent['pendingToolCall']
): AgentToolStepGroupData {
  const toolSteps = steps
    .filter(s => s.type === 'tool_call' || s.type === 'tool_result' || s.type === 'thinking')
    .map(agentStepToToolStep)

  // Add pending tool call
  if (pendingToolCall) {
    toolSteps.push(agentPendingToolToStep(pendingToolCall))
  }

  // Determine collapsed state
  const hasPending = toolSteps.some(
    s => s.type === 'tool_call' && s.toolCall?.status === 'pending'
  )

  return {
    groupId: generateAgentGroupId(),
    steps: toolSteps,
    collapsed: !hasPending
  }
}

/**
 * Check if agent steps should use enhanced display
 * Returns true if there are tool calls that would benefit from grouping
 */
export function shouldUseEnhancedDisplay(steps: AgentStep[]): boolean {
  // Use enhanced display if there's at least one tool call
  return steps.some(s => s.type === 'tool_call' && s.toolCall)
}
