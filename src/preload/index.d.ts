import { ElectronAPI } from '@electron-toolkit/preload'

// MCP Types
interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: string
    properties?: Record<string, unknown>
    required?: string[]
    [key: string]: unknown
  }
  server: string
}

interface MCPApprovalRequest {
  id: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  explanation?: string
}

interface MCPToolResult {
  id: string
  success: boolean
  result?: unknown
  error?: string
  duration?: number
  approved?: boolean
  autoApproved?: boolean
  blocked?: boolean
  pending?: boolean
}

interface MCPPendingCall {
  id: string
  toolName: string
  args: Record<string, unknown>
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  explanation?: string
  timestamp: string
}

interface MCPConfig {
  enabled: boolean
  autoApprove: {
    safe: boolean
    moderate: boolean
  }
  alwaysApproveTools: string[]
  allowedDirectories: string[]
  blockedTools: string[]
  timeout: number
  servers: Array<{
    name: string
    command: string
    args: string[]
    enabled: boolean
  }>
}

// GitHub-specific types
interface GitHubStatus {
  isConfigured: boolean
  isConnected: boolean
  toolCount: number
  username?: string
}

interface GitHubConfigureResult {
  success: boolean
  tools?: MCPToolDefinition[]
  username?: string
  error?: string
}

interface GitHubAPI {
  isConfigured: () => Promise<boolean>
  configure: (token: string) => Promise<GitHubConfigureResult>
  disconnect: () => Promise<{ success: boolean }>
  getStatus: () => Promise<GitHubStatus>
}

// Persona Types
interface PersonaMetadata {
  id: string
  name: string
  emoji: string
  description: string
  created: string
  modified: string
  tags: string[]
}

interface Persona extends PersonaMetadata {
  content: string
}

interface CreatePersonaInput {
  name: string
  emoji?: string
  description?: string
  content: string
  tags?: string[]
}

interface UpdatePersonaInput {
  name?: string
  emoji?: string
  description?: string
  content?: string
  tags?: string[]
}

interface PersonaGenerationResult {
  name: string
  emoji: string
  description: string
  content: string
  tags: string[]
}

interface PersonaAPI {
  list: () => Promise<PersonaMetadata[]>
  get: (id: string) => Promise<Persona | null>
  create: (input: CreatePersonaInput) => Promise<Persona>
  update: (id: string, updates: UpdatePersonaInput) => Promise<Persona>
  delete: (id: string) => Promise<{ success: boolean }>
  getPrompt: (id: string) => Promise<string | null>
  generate: (description: string, name: string) => Promise<PersonaGenerationResult>
  getDirectory: () => Promise<string>
}

// Credentials API Types
interface CredentialsAPI {
  getConfigured: () => Promise<Record<string, boolean>>
  hasKey: (providerId: string) => Promise<boolean>
  getKey: (providerId: string) => Promise<string | null>
  setKey: (providerId: string, apiKey: string) => Promise<{ success: boolean }>
  deleteKey: (providerId: string) => Promise<{ success: boolean }>
  validateKey: (providerId: string, apiKey: string) => Promise<boolean>
}

interface MCPInitResult {
  success: boolean
  tools?: MCPToolDefinition[]
  connectionStatus?: Record<string, boolean>
  error?: string
}

interface MCPStatusResult {
  connectionStatus: Record<string, boolean>
  config: MCPConfig
}

interface MCPAPI {
  init: () => Promise<MCPInitResult>
  getTools: () => Promise<MCPToolDefinition[]>
  getStatus: () => Promise<MCPStatusResult>
  getSystemPrompt: () => Promise<string>
  requestTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string
  ) => Promise<MCPToolResult>
  approve: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<MCPToolResult>
  alwaysApprove: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<MCPToolResult & { alwaysApproved?: boolean }>
  reject: (id: string) => Promise<{ rejected: boolean }>
  getPending: () => Promise<MCPPendingCall[]>
  cancelPending: (id: string) => Promise<{ cancelled: boolean }>
  getConfig: () => Promise<MCPConfig>
  updateConfig: (updates: Partial<MCPConfig>) => Promise<MCPConfig>
  reconnect: () => Promise<MCPInitResult>
  shutdown: () => Promise<{ success: boolean }>
  onApprovalRequired: (callback: (data: MCPApprovalRequest) => void) => () => void
  onToolCompleted: (callback: (data: MCPToolResult) => void) => () => void
  onToolRejected: (callback: (data: { id: string }) => void) => () => void
  onConfigUpdated: (callback: (config: MCPConfig) => void) => () => void
  removeAllListeners: () => void
  // GitHub-specific API
  github: GitHubAPI
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      // Dialog APIs
      selectDirectory: () => Promise<string | null>
      
      getConversations: () => Promise<import('../renderer/src/types').Conversation[]>
      createConversation: (title: string) => Promise<import('../renderer/src/types').Conversation>
      deleteConversation: (id: string) => Promise<void>
      updateConversationTitle: (id: string, title: string) => Promise<void>
      getMessages: (conversationId: string) => Promise<import('../renderer/src/types').Message[]>
      addMessage: (
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        parentId: string | null
      ) => Promise<import('../renderer/src/types').Message>
      saveApiKey: (key: string) => Promise<void>
      getApiKey: () => Promise<string | undefined>
      getSelectedModel: () => Promise<string>
      setSelectedModel: (model: string) => Promise<void>
      getOllamaServerUrl: () => Promise<string>
      setOllamaServerUrl: (url: string) => Promise<void>
      getAvailableModels: (apiKey?: string) => Promise<import('../renderer/src/types').Model[]>
      checkOllamaConnection: () => Promise<boolean>
      askAI: (apiKey: string, messages: any[], model: string) => void
      onToken: (callback: (token: string) => void) => void
      onDone: (callback: () => void) => void
      onError: (callback: (err: string) => void) => void
      offAI: () => void
      // MCP API
      mcp: MCPAPI
      // Credentials API
      credentials: CredentialsAPI
      // Personas API
      personas: PersonaAPI
    }
  }
}

// Export types for use in renderer
export type {
  MCPToolDefinition,
  MCPApprovalRequest,
  MCPToolResult,
  MCPPendingCall,
  MCPConfig,
  MCPInitResult,
  MCPStatusResult,
  MCPAPI,
  GitHubStatus,
  GitHubConfigureResult,
  GitHubAPI,
  CredentialsAPI,
  PersonaMetadata,
  Persona,
  CreatePersonaInput,
  UpdatePersonaInput,
  PersonaGenerationResult,
  PersonaAPI
}
