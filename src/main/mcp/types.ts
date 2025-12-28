// src/main/mcp/types.ts

export interface ToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
}

export interface MCPServerConfig {
  name: string
  command: string
  args: string[]
  enabled: boolean
  env?: Record<string, string>
}

export interface MCPConfig {
  enabled: boolean
  autoApprove: {
    safe: boolean
    moderate: boolean
  }
  alwaysApproveTools: string[]  // Tools that are always auto-approved regardless of risk level
  allowedDirectories: string[]
  blockedTools: string[]
  timeout: number
  servers: MCPServerConfig[]
}

export interface PendingToolCall {
  id: string
  serverName: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  explanation?: string
  timestamp: Date
  resolve: (result: ToolCallResult) => void
  reject: (error: Error) => void
}

export interface ToolCallResult {
  id: string
  success: boolean
  result?: unknown
  error?: string
  duration?: number
}

export interface ToolCallRequest {
  serverName: string
  toolName: string
  args: Record<string, unknown>
  explanation?: string
}

export interface ApprovalRequest {
  id: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  explanation?: string
}


// =====================
// GitHub-specific types
// =====================

/**
 * GitHub connection status
 */
export interface GitHubStatus {
  isConfigured: boolean
  isConnected: boolean
  toolCount: number
  username?: string
}

/**
 * Result from GitHub configuration attempt
 */
export interface GitHubConfigureResult {
  success: boolean
  tools?: ToolDefinition[]
  username?: string
  error?: string
}

/**
 * GitHub user info (from token validation)
 */
export interface GitHubUserInfo {
  login: string
  name?: string
  email?: string
  avatarUrl?: string
}
