// src/renderer/src/components/mcp/types.ts
// Shared type definitions for tool step display components
// Designed for Claude Desktop-style step grouping with accordion behavior

/**
 * Status of a tool call through its lifecycle
 */
export type ToolCallStatus =
  | 'pending'    // Awaiting user approval
  | 'approved'   // Approved, about to execute
  | 'executing'  // Currently running
  | 'completed'  // Successfully finished
  | 'error'      // Execution failed
  | 'rejected'   // User rejected execution

/**
 * Type of step in a tool execution sequence
 */
export type StepType =
  | 'thinking'        // AI planning/reasoning before tool call
  | 'tool_call'       // Actual tool execution
  | 'verification'    // AI verification after tool execution
  | 'thought_process' // AI reasoning summary (collapsible)

/**
 * Risk classification for tool operations
 * Used to determine approval requirements
 */
export type RiskLevel = 'safe' | 'moderate' | 'dangerous'

/**
 * Data specific to tool call steps
 */
export interface ToolCallData {
  /** Tool function name (e.g., 'read_file', 'start_process') */
  name: string
  /** MCP server name (e.g., 'desktop-commander', 'github') */
  serverName: string
  /** Arguments passed to the tool */
  args: Record<string, unknown>
  /** Tool execution result (if completed) */
  result?: unknown
  /** Error message (if failed) */
  error?: string
  /** Current status in lifecycle */
  status: ToolCallStatus
  /** Execution duration in milliseconds */
  duration?: number
  /** Whether this was auto-approved based on risk level */
  autoApproved?: boolean
  /** AI-provided explanation for why this tool is being called */
  explanation?: string
  /** Risk classification */
  riskLevel?: RiskLevel
}

/**
 * Individual step in a tool execution sequence
 */
export interface ToolStep {
  /** Unique identifier for this step */
  id: string
  /** Type of step */
  type: StepType
  /** Display content (thinking text, summary, etc.) */
  content: string
  /** When this step occurred */
  timestamp: number
  /** Tool-specific data (only for 'tool_call' type) */
  toolCall?: ToolCallData
}

/**
 * Group of related tool steps (for accordion container)
 */
export interface ToolStepGroupData {
  /** Unique identifier for this group */
  groupId: string
  /** Ordered list of steps in this group */
  steps: ToolStep[]
  /** Whether the group is collapsed (master toggle) */
  collapsed: boolean
}

/**
 * Callback signatures for tool approval actions
 */
export interface ToolApprovalCallbacks {
  /** Approve a pending tool execution */
  onApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  /** Approve and remember for future calls of this tool */
  onAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  /** Reject a pending tool execution */
  onReject?: (id: string) => void
}

/**
 * Server icon display configuration
 */
export interface ServerIconConfig {
  /** Short abbreviation (e.g., 'DC', 'GH') */
  abbrev: string
  /** Brand color for the icon */
  color: string
  /** Full server name */
  name: string
}

/**
 * Props for components that support accordion expansion
 */
export interface AccordionItemProps {
  /** Whether this item is currently expanded */
  isExpanded: boolean
  /** Callback to toggle expansion state */
  onToggleExpand: () => void
}

/**
 * Status styling configuration for visual feedback
 */
export interface StatusStyleConfig {
  /** Border color class */
  border: string
  /** Background color class */
  bg: string
  /** Icon element to display */
  icon: React.ReactNode
  /** Status label text */
  label: string
}
