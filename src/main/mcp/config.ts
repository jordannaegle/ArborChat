// src/main/mcp/config.ts

import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { MCPConfig } from './types'
import { DESKTOP_COMMANDER_CONFIG } from './servers/desktop-commander'
import { GITHUB_MCP_CONFIG } from './servers/github'

const CONFIG_FILE = 'mcp-config.json'

/**
 * Default MCP configuration
 */
export const DEFAULT_MCP_CONFIG: MCPConfig = {
  enabled: true,
  autoApprove: {
    safe: true,      // Auto-approve read-only operations
    moderate: false  // Require approval for write operations
  },
  alwaysApproveTools: [],  // Tools that are always auto-approved regardless of risk level
  allowedDirectories: [
    // Will be populated with user's home directory at runtime
  ],
  blockedTools: [],
  timeout: 300000, // 5 minutes
  servers: [DESKTOP_COMMANDER_CONFIG, GITHUB_MCP_CONFIG]
}

/**
 * Get the config file path
 */
function getConfigPath(): string {
  return path.join(app.getPath('userData'), CONFIG_FILE)
}

/**
 * Load MCP configuration from disk
 */
export function loadMCPConfig(): MCPConfig {
  const configPath = getConfigPath()

  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8')
      const loaded = JSON.parse(data) as Partial<MCPConfig>

      // Merge with defaults to ensure all fields exist
      return {
        ...DEFAULT_MCP_CONFIG,
        ...loaded,
        autoApprove: {
          ...DEFAULT_MCP_CONFIG.autoApprove,
          ...loaded.autoApprove
        },
        alwaysApproveTools: loaded.alwaysApproveTools || DEFAULT_MCP_CONFIG.alwaysApproveTools,
        servers: loaded.servers || DEFAULT_MCP_CONFIG.servers
      }
    }
  } catch (error) {
    console.error('[MCP Config] Failed to load config:', error)
  }

  // Return default config with user's home directory
  const homeDir = app.getPath('home')
  return {
    ...DEFAULT_MCP_CONFIG,
    allowedDirectories: [homeDir, '/tmp']
  }
}

/**
 * Save MCP configuration to disk
 */
export function saveMCPConfig(config: MCPConfig): void {
  const configPath = getConfigPath()

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
    console.log('[MCP Config] Saved config to', configPath)
  } catch (error) {
    console.error('[MCP Config] Failed to save config:', error)
  }
}

/**
 * Update specific config values
 */
export function updateMCPConfig(updates: Partial<MCPConfig>): MCPConfig {
  const current = loadMCPConfig()
  const updated = {
    ...current,
    ...updates,
    autoApprove: {
      ...current.autoApprove,
      ...(updates.autoApprove || {})
    }
  }
  saveMCPConfig(updated)
  return updated
}

/**
 * Check if a directory is allowed for file operations
 */
export function isDirectoryAllowed(dirPath: string, config: MCPConfig): boolean {
  if (config.allowedDirectories.length === 0) {
    // Empty array means all directories allowed
    return true
  }

  const normalizedPath = path.normalize(dirPath)

  return config.allowedDirectories.some((allowed) => {
    const normalizedAllowed = path.normalize(allowed)
    return normalizedPath.startsWith(normalizedAllowed)
  })
}

/**
 * Check if a tool is blocked
 */
export function isToolBlocked(toolName: string, config: MCPConfig): boolean {
  return config.blockedTools.includes(toolName)
}

/**
 * Check if a tool is set to always approve
 */
export function isToolAlwaysApproved(toolName: string, config: MCPConfig): boolean {
  return config.alwaysApproveTools.includes(toolName)
}

/**
 * Add a tool to the always-approve list
 */
export function addAlwaysApproveTool(toolName: string): MCPConfig {
  const config = loadMCPConfig()
  if (!config.alwaysApproveTools.includes(toolName)) {
    config.alwaysApproveTools.push(toolName)
    saveMCPConfig(config)
  }
  return config
}

/**
 * Remove a tool from the always-approve list
 */
export function removeAlwaysApproveTool(toolName: string): MCPConfig {
  const config = loadMCPConfig()
  config.alwaysApproveTools = config.alwaysApproveTools.filter(t => t !== toolName)
  saveMCPConfig(config)
  return config
}
