// src/main/mcp/servers/desktop-commander.ts

import { MCPServerConfig } from '../types'

/**
 * Desktop Commander MCP Server Configuration
 * 
 * Desktop Commander provides file system operations, process management,
 * and terminal execution capabilities through MCP.
 */
export const DESKTOP_COMMANDER_CONFIG: MCPServerConfig = {
  name: 'desktop-commander',
  // Uses npx to run without requiring global install
  command: 'npx',
  args: ['-y', '@wonderwhy-er/desktop-commander'],
  enabled: true,
  env: {
    // Desktop Commander respects these environment variables
    // NODE_ENV: 'production'
  }
}

/**
 * Tool categories for UI grouping and filtering
 */
export const TOOL_CATEGORIES: Record<string, string[]> = {
  filesystem: [
    'read_file',
    'read_multiple_files',
    'write_file',
    'create_directory',
    'list_directory',
    'move_file',
    'get_file_info',
    'edit_block'
  ],
  search: [
    'start_search',
    'get_more_search_results',
    'stop_search',
    'list_searches'
  ],
  process: [
    'start_process',
    'read_process_output',
    'interact_with_process',
    'force_terminate',
    'list_sessions',
    'list_processes',
    'kill_process'
  ],
  config: [
    'get_config',
    'set_config_value',
    'get_usage_stats',
    'get_recent_tool_calls'
  ]
}

/**
 * Risk levels for each Desktop Commander tool
 * 
 * - safe: Read-only operations, no side effects
 * - moderate: Write operations in user directories
 * - dangerous: System-wide effects, process termination, config changes
 */
export const TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Safe - read-only operations
  read_file: 'safe',
  read_multiple_files: 'safe',
  list_directory: 'safe',
  get_file_info: 'safe',
  list_sessions: 'safe',
  list_processes: 'safe',
  list_searches: 'safe',
  get_config: 'safe',
  read_process_output: 'safe',
  get_usage_stats: 'safe',
  get_recent_tool_calls: 'safe',
  get_more_search_results: 'safe',
  get_prompts: 'safe',
  give_feedback_to_desktop_commander: 'safe',

  // Moderate - writes to user directories
  write_file: 'moderate',
  write_pdf: 'moderate',
  create_directory: 'moderate',
  start_search: 'moderate',
  start_process: 'moderate',
  interact_with_process: 'moderate',
  edit_block: 'moderate',
  stop_search: 'moderate',

  // Dangerous - system-wide effects
  move_file: 'dangerous',
  force_terminate: 'dangerous',
  kill_process: 'dangerous',
  set_config_value: 'dangerous'
}

/**
 * Get the category for a tool
 */
export function getToolCategory(toolName: string): string | undefined {
  for (const [category, tools] of Object.entries(TOOL_CATEGORIES)) {
    if (tools.includes(toolName)) {
      return category
    }
  }
  return undefined
}

/**
 * Get the risk level for a tool (defaults to 'moderate' if unknown)
 */
export function getToolRiskLevel(toolName: string): 'safe' | 'moderate' | 'dangerous' {
  return TOOL_RISK_LEVELS[toolName] || 'moderate'
}
