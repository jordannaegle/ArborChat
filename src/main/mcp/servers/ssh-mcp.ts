// src/main/mcp/servers/ssh-mcp.ts

import { MCPServerConfig } from '../types'

/**
 * SSH MCP Server Configuration (tufantunc/ssh-mcp)
 * 
 * Provides SSH access to remote servers, enabling LLMs to execute
 * shell commands securely via SSH on Linux and Windows systems.
 * 
 * Features:
 * - Password and SSH key authentication
 * - Sudo support with --suPassword flag
 * - Command timeout handling
 * - Output character limits
 * 
 * @see https://github.com/tufantunc/ssh-mcp
 */
export const SSH_MCP_CONFIG: MCPServerConfig = {
  name: 'ssh-mcp',
  command: 'npx',
  args: ['-y', 'ssh-mcp'],
  // Disabled by default - requires user to configure host/credentials
  enabled: false,
  env: {}
}

/**
 * SSH MCP connection options
 * These are passed as CLI arguments when starting the server
 */
export interface SSHConnectionOptions {
  host: string           // Hostname or IP address
  port?: number          // SSH port (default: 22)
  user: string           // SSH username
  password?: string      // Password authentication
  key?: string           // Path to private key file
  timeout?: number       // Command timeout in ms (default: 30000)
  maxChars?: number | 'none'  // Max output characters (default: unlimited with 'none')
  disableSudo?: boolean  // Disable sudo tool
  suPassword?: string    // Password for persistent root shell
}

/**
 * Build CLI args from connection options
 */
export function buildSSHArgs(options: SSHConnectionOptions): string[] {
  const args: string[] = ['-y', 'ssh-mcp', '--']

  args.push(`--host=${options.host}`)
  
  if (options.port) {
    args.push(`--port=${options.port}`)
  }
  
  args.push(`--user=${options.user}`)
  
  if (options.password) {
    args.push(`--password=${options.password}`)
  }
  
  if (options.key) {
    args.push(`--key=${options.key}`)
  }
  
  if (options.timeout) {
    args.push(`--timeout=${options.timeout}`)
  }
  
  if (options.maxChars !== undefined) {
    args.push(`--maxChars=${options.maxChars}`)
  }
  
  if (options.disableSudo) {
    args.push('--disableSudo')
  }
  
  if (options.suPassword) {
    args.push(`--suPassword=${options.suPassword}`)
  }

  return args
}

/**
 * Create an SSH MCP server config with connection options
 */
export function createSSHServerConfig(
  name: string, 
  options: SSHConnectionOptions
): MCPServerConfig {
  return {
    name,
    command: 'npx',
    args: buildSSHArgs(options),
    enabled: true,
    env: {}
  }
}

/**
 * Get the MCP server name for a named SSH connection
 * Format: ssh-{connectionName} (e.g., "ssh-DEV", "ssh-PROD")
 */
export function getSSHServerName(connectionName: string): string {
  return `ssh-${connectionName}`
}

/**
 * Check if a server name is an SSH connection server
 */
export function isSSHServer(serverName: string): boolean {
  return serverName.startsWith('ssh-') || serverName === 'ssh-mcp'
}

/**
 * Extract the connection name from an SSH server name
 */
export function getConnectionNameFromServer(serverName: string): string | null {
  if (serverName === 'ssh-mcp') {
    return 'Default'
  }
  if (serverName.startsWith('ssh-')) {
    return serverName.substring(4)
  }
  return null
}

/**
 * Tool categories for SSH MCP
 */
export const SSH_TOOL_CATEGORIES: Record<string, string[]> = {
  commands: [
    'run_command',
    'run_sudo_command'
  ]
}

/**
 * Risk levels for SSH MCP tools
 * 
 * All SSH operations are at least moderate risk since they
 * execute commands on remote systems
 */
export const SSH_TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Moderate - remote command execution
  run_command: 'moderate',
  
  // Dangerous - root access
  run_sudo_command: 'dangerous'
}

/**
 * Get the risk level for an SSH tool
 */
export function getSSHToolRiskLevel(toolName: string): 'safe' | 'moderate' | 'dangerous' {
  return SSH_TOOL_RISK_LEVELS[toolName] || 'dangerous'
}
