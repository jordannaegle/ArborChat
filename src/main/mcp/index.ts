// src/main/mcp/index.ts

export { mcpManager } from './manager'
export { setupMCPHandlers, clearPendingCalls, getPendingCallCount } from './ipc'
export { loadMCPConfig, saveMCPConfig, updateMCPConfig, isDirectoryAllowed, isToolBlocked } from './config'
export { DESKTOP_COMMANDER_CONFIG, TOOL_CATEGORIES, TOOL_RISK_LEVELS, getToolCategory, getToolRiskLevel } from './servers/desktop-commander'
export {
  GITHUB_MCP_CONFIG,
  GITHUB_MCP_DOCKER_CONFIG,
  GITHUB_TOOL_CATEGORIES,
  GITHUB_TOOL_RISK_LEVELS,
  getGitHubToolCategory,
  getGitHubToolRiskLevel,
  getGitHubCategoryDescription,
  REQUIRED_GITHUB_SCOPES,
  READONLY_GITHUB_SCOPES
} from './servers/github'
export {
  isSecureStorageAvailable,
  saveGitHubToken,
  getGitHubToken,
  getGitHubTokenScopes,
  deleteGitHubToken,
  isGitHubConfigured,
  getGitHubTokenCreatedAt
} from './credentials'
export { generateToolSystemPrompt, generateToolList } from './prompts'
export * from './types'
