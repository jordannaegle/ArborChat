// src/main/mcp/servers/memory.ts

import { MCPServerConfig } from '../types'

/**
 * Memory MCP Server Configuration
 *
 * DEPRECATED: ArborMemoryService is now the primary memory system.
 * This MCP server is disabled by default. ArborMemoryService provides:
 * - Automatic context injection at conversation start
 * - arbor_store_memory tool for AI to persist information
 * - Native SQLite storage with decay/cleanup scheduling
 *
 * No credentials required - memory is stored locally.
 */
export const MEMORY_MCP_CONFIG: MCPServerConfig = {
  name: 'memory',
  // Uses npx to run without requiring global install
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-memory'],
  enabled: false, // DISABLED - ArborMemoryService is now the primary memory system
  env: {}
}

/**
 * Tool categories for UI grouping and filtering
 */
export const MEMORY_TOOL_CATEGORIES: Record<string, string[]> = {
  storage: ['store_memory', 'create_entities', 'create_relations'],
  retrieval: ['search_memories', 'get_entities', 'get_relations', 'open_nodes'],
  management: ['delete_entities', 'delete_relations', 'delete_observations']
}

/**
 * Risk levels for Memory tools
 *
 * - safe: Read operations
 * - moderate: Write/create operations
 * - dangerous: Delete operations
 */
export const MEMORY_TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Safe - read operations
  search_memories: 'safe',
  get_entities: 'safe',
  get_relations: 'safe',
  open_nodes: 'safe',

  // Moderate - create/store operations
  store_memory: 'moderate',
  create_entities: 'moderate',
  create_relations: 'moderate',

  // Dangerous - delete operations
  delete_entities: 'dangerous',
  delete_relations: 'dangerous',
  delete_observations: 'dangerous'
}

/**
 * Get the category for a memory tool
 */
export function getMemoryToolCategory(toolName: string): string | undefined {
  for (const [category, tools] of Object.entries(MEMORY_TOOL_CATEGORIES)) {
    if (tools.includes(toolName)) {
      return category
    }
  }
  return undefined
}

/**
 * Get the risk level for a memory tool (defaults to 'moderate' if unknown)
 */
export function getMemoryToolRiskLevel(toolName: string): 'safe' | 'moderate' | 'dangerous' {
  return MEMORY_TOOL_RISK_LEVELS[toolName] || 'moderate'
}

/**
 * Get human-readable description for a memory tool category
 */
export function getMemoryCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    storage: 'Memory Storage',
    retrieval: 'Memory Retrieval',
    management: 'Memory Management'
  }
  return descriptions[category] || category
}
