// src/renderer/src/lib/serverIconRegistry.ts
// Phase 7: Extensible server icon registry with multiple inference strategies
// Author: Alex Chen (Distinguished Software Architect)
//
// This module provides a scalable approach to server icon management that:
// 1. Eliminates the need for manual updates when adding new MCP tools
// 2. Uses prefix-based inference as the primary lookup strategy
// 3. Maintains explicit mapping as fallback for exceptions
// 4. Allows runtime registration for dynamic MCP server discovery

import type { ServerIconConfig } from '../components/mcp/types'

/**
 * Registry for MCP server icon configurations
 * 
 * Supports multiple lookup strategies in priority order:
 * 1. Direct server name match (when server name is provided)
 * 2. Tool name prefix matching (e.g., 'gh_create_issue' -> 'github')
 * 3. Explicit tool->server mapping (fallback for tools without prefixes)
 * 4. Runtime registration (for dynamic MCP server discovery)
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const icon = serverIconRegistry.getServerIcon('desktop-commander')
 * 
 * // Infer from tool name
 * const icon = serverIconRegistry.getIconFromTool('read_file')
 * 
 * // With server hint from MCP metadata
 * const icon = serverIconRegistry.getIconFromTool('custom_tool', 'my-server')
 * 
 * // Runtime registration for new MCP server
 * serverIconRegistry.registerServer('my-custom-mcp', {
 *   abbrev: 'MC',
 *   color: '#FF6B6B',
 *   name: 'My Custom MCP'
 * })
 * serverIconRegistry.registerToolPrefix('mc_', 'my-custom-mcp')
 * ```
 */
class ServerIconRegistry {
  /** Map of normalized server names to their icon configurations */
  private servers: Map<string, ServerIconConfig> = new Map()
  
  /** Map of tool prefixes to server names for inference */
  private toolPrefixes: Map<string, string> = new Map()
  
  /** Explicit tool name to server name mappings */
  private explicitToolMap: Map<string, string> = new Map()
  
  /** Default icon for unknown servers */
  private defaultIcon: ServerIconConfig = {
    abbrev: '⚡',
    color: '#6B7280', // Gray-500
    name: 'Unknown Server'
  }

  constructor() {
    this.initializeDefaults()
  }

  /**
   * Initialize with known MCP servers and their tool mappings
   * @private
   */
  private initializeDefaults(): void {
    // ========================================
    // Register Known MCP Servers
    // ========================================
    
    this.registerServer('desktop-commander', {
      abbrev: 'DC',
      color: '#10B981', // Emerald-500
      name: 'Desktop Commander'
    })
    
    this.registerServer('github', {
      abbrev: 'GH',
      color: '#6366F1', // Indigo-500
      name: 'GitHub'
    })
    
    this.registerServer('ssh-mcp', {
      abbrev: 'SSH',
      color: '#F59E0B', // Amber-500
      name: 'SSH'
    })
    
    this.registerServer('memory', {
      abbrev: 'MEM',
      color: '#8B5CF6', // Violet-500
      name: 'Memory'
    })
    
    this.registerServer('filesystem', {
      abbrev: 'FS',
      color: '#06B6D4', // Cyan-500
      name: 'File System'
    })
    
    this.registerServer('brave-search', {
      abbrev: 'BS',
      color: '#FB923C', // Orange-400
      name: 'Brave Search'
    })
    
    this.registerServer('puppeteer', {
      abbrev: 'PUP',
      color: '#22C55E', // Green-500
      name: 'Puppeteer'
    })
    
    this.registerServer('slack', {
      abbrev: 'SL',
      color: '#E11D48', // Rose-600
      name: 'Slack'
    })

    // ========================================
    // Register Tool Prefix Patterns
    // ========================================
    // Tools following the 'prefix_action' convention can be automatically
    // mapped to their server without explicit registration
    
    this.registerToolPrefix('gh_', 'github')
    this.registerToolPrefix('github_', 'github')
    this.registerToolPrefix('ssh_', 'ssh-mcp')
    this.registerToolPrefix('memory_', 'memory')
    this.registerToolPrefix('mem_', 'memory')
    this.registerToolPrefix('fs_', 'filesystem')
    this.registerToolPrefix('file_', 'filesystem')
    this.registerToolPrefix('brave_', 'brave-search')
    this.registerToolPrefix('pup_', 'puppeteer')
    this.registerToolPrefix('browser_', 'puppeteer')
    this.registerToolPrefix('slack_', 'slack')
    this.registerToolPrefix('dc_', 'desktop-commander')

    // ========================================
    // Explicit Tool Mappings (for tools without prefix convention)
    // ========================================
    
    // Desktop Commander tools (most common, typically no prefix)
    const dcTools = [
      'read_file', 'read_multiple_files', 'write_file', 'create_directory',
      'list_directory', 'move_file', 'get_file_info', 'edit_block',
      'start_search', 'get_more_search_results', 'stop_search', 'list_searches',
      'start_process', 'read_process_output', 'interact_with_process',
      'force_terminate', 'list_sessions', 'list_processes', 'kill_process',
      'get_config', 'set_config_value', 'write_pdf', 'get_usage_stats',
      'get_recent_tool_calls', 'give_feedback_to_desktop_commander', 'get_prompts'
    ]
    dcTools.forEach(tool => this.registerTool(tool, 'desktop-commander'))
    
    // GitHub tools without prefix
    const ghTools = [
      'create_or_update_file', 'search_repositories', 'create_repository',
      'get_file_contents', 'push_files', 'create_issue', 'create_pull_request',
      'fork_repository', 'create_branch', 'list_commits', 'list_branches',
      'search_code', 'search_issues', 'search_users', 'get_issue',
      'update_issue', 'add_issue_comment', 'list_tags', 'get_pull_request',
      'update_pull_request', 'merge_pull_request'
    ]
    ghTools.forEach(tool => this.registerTool(tool, 'github'))
    
    // SSH tools without prefix
    const sshTools = ['ssh_execute', 'ssh_connect', 'execute_command', 'connect']
    sshTools.forEach(tool => this.registerTool(tool, 'ssh-mcp'))
    
    // Memory tools without prefix
    const memTools = [
      'create_memory', 'search_memory', 'delete_memory',
      'list_memories', 'get_memory', 'update_memory',
      'create_entities', 'create_relations', 'search_nodes',
      'open_nodes', 'add_observations', 'delete_entities',
      'delete_observations', 'delete_relations', 'read_graph'
    ]
    memTools.forEach(tool => this.registerTool(tool, 'memory'))
  }

  // ========================================
  // Public Registration API
  // ========================================

  /**
   * Register a new MCP server with its icon configuration
   * 
   * @param name - Server name (will be normalized)
   * @param config - Icon configuration
   * 
   * @example
   * ```typescript
   * serverIconRegistry.registerServer('my-custom-mcp', {
   *   abbrev: 'MC',
   *   color: '#FF6B6B',
   *   name: 'My Custom MCP'
   * })
   * ```
   */
  registerServer(name: string, config: ServerIconConfig): void {
    const normalized = this.normalizeServerName(name)
    this.servers.set(normalized, config)
  }

  /**
   * Register a tool name prefix pattern for server inference
   * 
   * When a tool name starts with the given prefix, it will be
   * automatically mapped to the specified server.
   * 
   * @param prefix - Tool name prefix (e.g., 'gh_', 'custom_')
   * @param serverName - Server to map to
   * 
   * @example
   * ```typescript
   * // Tools like 'mc_do_something' will map to 'my-custom-mcp'
   * serverIconRegistry.registerToolPrefix('mc_', 'my-custom-mcp')
   * ```
   */
  registerToolPrefix(prefix: string, serverName: string): void {
    this.toolPrefixes.set(prefix.toLowerCase(), this.normalizeServerName(serverName))
  }

  /**
   * Register explicit tool name to server mapping
   * 
   * Use this for tools that don't follow prefix conventions
   * 
   * @param toolName - Full tool name
   * @param serverName - Server to map to
   */
  registerTool(toolName: string, serverName: string): void {
    this.explicitToolMap.set(toolName.toLowerCase(), this.normalizeServerName(serverName))
  }

  /**
   * Bulk register multiple tools for a server
   * 
   * @param tools - Array of tool names
   * @param serverName - Server to map to
   */
  registerTools(tools: string[], serverName: string): void {
    const normalized = this.normalizeServerName(serverName)
    tools.forEach(tool => {
      this.explicitToolMap.set(tool.toLowerCase(), normalized)
    })
  }

  // ========================================
  // Lookup & Inference API
  // ========================================

  /**
   * Get icon configuration for a server by name
   * 
   * @param serverName - Server name to look up
   * @returns Icon configuration, or default if not found
   */
  getServerIcon(serverName: string): ServerIconConfig {
    const normalized = this.normalizeServerName(serverName)
    return this.servers.get(normalized) ?? this.defaultIcon
  }

  /**
   * Infer server name from tool name using multiple strategies
   * 
   * Strategy order (first match wins):
   * 1. Use provided server hint if valid
   * 2. Check tool prefix patterns (e.g., 'gh_create_issue' -> 'github')
   * 3. Check explicit tool mapping
   * 4. Return undefined if unknown
   * 
   * @param toolName - Tool name to infer from
   * @param serverHint - Optional server name hint (e.g., from MCP metadata)
   * @returns Inferred server name, or undefined if unknown
   */
  inferServerFromTool(toolName: string, serverHint?: string): string | undefined {
    // Strategy 1: Use provided server hint if it's a known server
    if (serverHint) {
      const normalized = this.normalizeServerName(serverHint)
      if (this.servers.has(normalized)) {
        return normalized
      }
      // Server hint provided but not registered - register it dynamically
      // This allows new servers to work automatically
      console.debug(`[ServerIconRegistry] Auto-registering unknown server: ${serverHint}`)
      this.registerServer(serverHint, {
        abbrev: this.generateAbbreviation(serverHint),
        color: this.generateColor(serverHint),
        name: this.formatServerName(serverHint)
      })
      return normalized
    }

    const lowerTool = toolName.toLowerCase()

    // Strategy 2: Check prefix patterns
    for (const [prefix, server] of this.toolPrefixes) {
      if (lowerTool.startsWith(prefix)) {
        return server
      }
    }

    // Strategy 3: Check explicit mapping
    const explicit = this.explicitToolMap.get(lowerTool)
    if (explicit) {
      return explicit
    }

    return undefined
  }

  /**
   * Get icon directly from tool name
   * 
   * Convenience method combining server inference and icon lookup
   * 
   * @param toolName - Tool name
   * @param serverHint - Optional server name hint
   * @returns Icon configuration
   */
  getIconFromTool(toolName: string, serverHint?: string): ServerIconConfig {
    const serverName = this.inferServerFromTool(toolName, serverHint)
    return serverName ? this.getServerIcon(serverName) : this.defaultIcon
  }

  /**
   * Check if a server is registered
   */
  hasServer(serverName: string): boolean {
    return this.servers.has(this.normalizeServerName(serverName))
  }

  // ========================================
  // Utility Methods
  // ========================================

  /**
   * Set custom default icon for unknown servers
   */
  setDefaultIcon(config: ServerIconConfig): void {
    this.defaultIcon = config
  }

  /**
   * Get all registered servers
   */
  getAllServers(): Map<string, ServerIconConfig> {
    return new Map(this.servers)
  }

  /**
   * Get count of registered servers
   */
  getServerCount(): number {
    return this.servers.size
  }

  /**
   * Get count of registered tool mappings
   */
  getToolMappingCount(): number {
    return this.explicitToolMap.size
  }

  /**
   * Get count of registered prefixes
   */
  getPrefixCount(): number {
    return this.toolPrefixes.size
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * Normalize server name for consistent lookup
   * - Converts to lowercase
   * - Replaces underscores and spaces with hyphens
   */
  private normalizeServerName(name: string): string {
    return name.toLowerCase().replace(/[_\s]/g, '-')
  }

  /**
   * Generate a default abbreviation from server name
   * Takes first letters of words, up to 3 characters
   */
  private generateAbbreviation(serverName: string): string {
    const words = serverName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .filter(w => w.length > 0)
    
    if (words.length === 1) {
      // Single word: take first 2-3 letters
      return words[0].slice(0, 3).toUpperCase()
    }
    
    // Multiple words: take first letter of each, up to 3
    return words
      .slice(0, 3)
      .map(w => w[0])
      .join('')
      .toUpperCase()
  }

  /**
   * Generate a consistent color from server name
   * Uses simple hash to pick from a predefined palette
   */
  private generateColor(serverName: string): string {
    const colors = [
      '#10B981', // Emerald
      '#6366F1', // Indigo
      '#F59E0B', // Amber
      '#8B5CF6', // Violet
      '#06B6D4', // Cyan
      '#EC4899', // Pink
      '#14B8A6', // Teal
      '#F97316', // Orange
      '#84CC16', // Lime
      '#A855F7'  // Purple
    ]
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < serverName.length; i++) {
      hash = ((hash << 5) - hash) + serverName.charCodeAt(i)
      hash = hash & hash // Convert to 32bit integer
    }
    
    return colors[Math.abs(hash) % colors.length]
  }

  /**
   * Format server name for display
   * Converts 'my-server-name' to 'My Server Name'
   */
  private formatServerName(serverName: string): string {
    return serverName
      .replace(/[-_]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
}

// ========================================
// Singleton Instance
// ========================================

/**
 * Singleton instance of the server icon registry
 * 
 * Use this for all server icon operations throughout the application
 */
export const serverIconRegistry = new ServerIconRegistry()

// ========================================
// Convenience Function Exports
// ========================================

/**
 * Get icon configuration for a server by name
 * 
 * @deprecated Use `serverIconRegistry.getServerIcon()` for clearer intent
 */
export function getServerIcon(serverName: string): ServerIconConfig {
  return serverIconRegistry.getServerIcon(serverName)
}

/**
 * Infer server name from tool name
 * 
 * @deprecated Use `serverIconRegistry.inferServerFromTool()` for clearer intent
 */
export function getServerFromToolName(toolName: string): string | undefined {
  return serverIconRegistry.inferServerFromTool(toolName)
}

/**
 * Get icon directly from tool name
 * 
 * @deprecated Use `serverIconRegistry.getIconFromTool()` for clearer intent
 */
export function getServerIconFromToolName(toolName: string): ServerIconConfig {
  return serverIconRegistry.getIconFromTool(toolName)
}

// Re-export type for convenience
export type { ServerIconConfig }
