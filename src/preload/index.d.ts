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

// SSH-specific types (Multi-connection support)
interface SSHConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  keyPath?: string
  createdAt: string
  enabled: boolean
}

interface SSHConnectionStatus {
  id: string
  name: string
  host: string
  username: string
  isConnected: boolean
  toolCount: number
}

interface SSHCredentials {
  host: string
  port: number
  username: string
  authType: 'password' | 'key'
  password?: string
  keyPath?: string
}

interface SSHStatus {
  connections: SSHConnectionStatus[]
}

interface SSHConfigureResult {
  success: boolean
  error?: string
}

interface SSHAddConnectionResult {
  success: boolean
  connection?: SSHConnection
  error?: string
}

interface SSHUpdateConnectionResult {
  success: boolean
  connection?: SSHConnection
  error?: string
}

interface SSHDeleteResult {
  success: boolean
  error?: string
}

interface SSHAPI {
  isConfigured: () => Promise<boolean>
  
  // Multi-connection management
  listConnections: () => Promise<SSHConnection[]>
  getConnection: (id: string) => Promise<SSHConnection | null>
  addConnection: (connection: Omit<SSHConnection, 'id' | 'createdAt'>) => Promise<SSHAddConnectionResult>
  updateConnection: (id: string, updates: Partial<Omit<SSHConnection, 'id' | 'createdAt'>>) => Promise<SSHUpdateConnectionResult>
  deleteConnection: (id: string) => Promise<SSHDeleteResult>
  connect: (id: string) => Promise<{ success: boolean; error?: string }>
  disconnectConnection: (id: string) => Promise<{ success: boolean; error?: string }>
  getStatus: () => Promise<SSHStatus>
  
  // Legacy API for backward compatibility
  configure: (creds: SSHCredentials) => Promise<SSHConfigureResult>
  disconnect: () => Promise<{ success: boolean }>
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

// Work Journal Types
interface WorkSession {
  id: string
  conversationId: string
  originalPrompt: string
  status: 'active' | 'paused' | 'completed' | 'crashed'
  createdAt: number
  updatedAt: number
  completedAt?: number
  tokenEstimate: number
  entryCount: number
}

interface WorkEntry {
  id: number
  sessionId: string
  sequenceNum: number
  entryType: string
  timestamp: number
  content: Record<string, unknown>
  tokenEstimate: number
  importance: 'low' | 'normal' | 'high' | 'critical'
}

interface WorkCheckpoint {
  id: string
  sessionId: string
  createdAt: number
  summary: string
  keyDecisions: string[]
  currentState: string
  filesModified: string[]
  pendingActions: string[]
}

interface ResumptionContext {
  originalPrompt: string
  workSummary: string
  keyDecisions: string[]
  currentState: string
  filesModified: string[]
  pendingActions: string[]
  errorHistory: string[]
  suggestedNextSteps: string[]
  tokenCount: number
}

interface WorkJournalEntryEvent {
  sessionId: string
  entry: WorkEntry
}

interface WorkJournalStatusEvent {
  sessionId: string
  status: 'active' | 'paused' | 'completed' | 'crashed'
}

interface WorkJournalAPI {
  // Session Management
  createSession: (conversationId: string, originalPrompt: string) => Promise<WorkSession>
  getSession: (sessionId: string) => Promise<WorkSession | null>
  getActiveSession: (conversationId: string) => Promise<WorkSession | null>
  updateSessionStatus: (sessionId: string, status: 'active' | 'paused' | 'completed' | 'crashed') => Promise<{ success: boolean }>
  
  // Entry Logging
  logEntry: (
    sessionId: string,
    entryType: string,
    content: Record<string, unknown>,
    importance?: 'low' | 'normal' | 'high' | 'critical'
  ) => Promise<WorkEntry>
  getEntries: (
    sessionId: string,
    options?: {
      since?: number
      limit?: number
      importance?: ('low' | 'normal' | 'high' | 'critical')[]
      types?: string[]
    }
  ) => Promise<WorkEntry[]>
  
  // Checkpointing
  createCheckpoint: (sessionId: string, options?: { manual?: boolean }) => Promise<WorkCheckpoint>
  getLatestCheckpoint: (sessionId: string) => Promise<WorkCheckpoint | null>
  
  // Resumption
  generateResumptionContext: (sessionId: string, targetTokens?: number) => Promise<ResumptionContext>
  getResumableSessions: (limit?: number) => Promise<WorkSession[]>
  
  // Utilities
  getSessionTokens: (sessionId: string) => Promise<number>
  isApproachingLimit: (sessionId: string, threshold?: number) => Promise<boolean>
  
  // Subscriptions
  subscribe: (sessionId: string) => Promise<{ success: boolean; sessionId: string }>
  unsubscribe: (sessionId: string) => Promise<{ success: boolean }>
  
  // Event listeners
  onNewEntry: (callback: (data: WorkJournalEntryEvent) => void) => () => void
  onStatusChange: (callback: (data: WorkJournalStatusEvent) => void) => () => void
  removeAllListeners: () => void
}

// Notebook Types
interface Notebook {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  created_at: string
  updated_at: string
  entry_count: number
}

interface NotebookEntry {
  id: string
  notebook_id: string
  content: string
  source_message_id: string | null
  source_conversation_id: string | null
  source_role: 'user' | 'assistant' | null
  title: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

interface CreateNotebookInput {
  name: string
  description?: string
  emoji?: string
  color?: string
}

interface UpdateNotebookInput {
  name?: string
  description?: string
  emoji?: string
  color?: string
}

interface CreateEntryInput {
  notebook_id: string
  content: string
  source_message_id?: string
  source_conversation_id?: string
  source_role?: 'user' | 'assistant'
  title?: string
  tags?: string[]
}

interface UpdateEntryInput {
  content?: string
  title?: string
  tags?: string[]
}

interface NotebookSearchResult {
  entry: NotebookEntry
  notebook: Notebook
  snippet: string
  rank: number
}

interface NotebooksAPI {
  // Notebook operations
  list: () => Promise<Notebook[]>
  get: (id: string) => Promise<Notebook | null>
  create: (input: CreateNotebookInput) => Promise<Notebook>
  update: (id: string, input: UpdateNotebookInput) => Promise<Notebook | null>
  delete: (id: string) => Promise<boolean>

  // Entry operations
  entries: {
    list: (notebookId: string) => Promise<NotebookEntry[]>
    get: (id: string) => Promise<NotebookEntry | null>
    create: (input: CreateEntryInput) => Promise<NotebookEntry>
    update: (id: string, input: UpdateEntryInput) => Promise<NotebookEntry | null>
    delete: (id: string) => Promise<boolean>
  }

  // Search & Export
  search: (query: string) => Promise<NotebookSearchResult[]>
  export: (id: string) => Promise<string | null>
}

// Notification Types
interface DesktopNotificationPayload {
  title: string
  body: string
  urgency?: 'low' | 'normal' | 'critical'
  agentId?: string
}

interface NotificationsAPI {
  show: (payload: DesktopNotificationPayload) => Promise<{ success: boolean }>
  setBadge: (count: number) => Promise<{ success: boolean }>
  requestAttention: () => Promise<{ success: boolean }>
  clearBadge: () => Promise<{ success: boolean }>
  onAgentClick: (callback: (agentId: string) => void) => () => void
  removeAllListeners: () => void
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

// Git API Types
interface GitRepoInfo {
  isGitRepo: boolean
  repoRoot?: string
  currentBranch?: string
  branches?: string[]
  hasUncommittedChanges?: boolean
  uncommittedFileCount?: number
  remoteUrl?: string
}

interface GitChangedFile {
  path: string
  status: 'added' | 'modified' | 'deleted' | 'renamed' | 'untracked'
}

interface GitDiffInfo {
  changedFiles: GitChangedFile[]
  totalAdditions: number
  totalDeletions: number
}

interface GitAPI {
  getRepoInfo: (directory: string) => Promise<GitRepoInfo>
  getUncommittedFiles: (directory: string) => Promise<GitChangedFile[]>
  getChangedFilesSinceBranch: (directory: string, baseBranch: string) => Promise<GitChangedFile[]>
  getDiffStats: (directory: string, baseBranch?: string) => Promise<GitDiffInfo>
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
    explanation?: string,
    skipApproval?: boolean
  ) => Promise<MCPToolResult>
  approve: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<MCPToolResult>
  alwaysApprove: (
    id: string,
    modifiedArgs?: Record<string, unknown>
  ) => Promise<MCPToolResult & { alwaysApproved?: boolean }>
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
  // SSH-specific API
  ssh: SSHAPI
  // Filesystem-specific API
  filesystem: {
    selectDirectory: () => Promise<string | null>
    getAllowedDirectory: () => Promise<string | null>
    setAllowedDirectory: (directory: string) => Promise<void>
  }
  // Brave Search-specific API
  braveSearch: {
    validateKey: (apiKey: string) => Promise<{ valid: boolean; error?: string }>
  }
  // Memory-specific API
  memory: {
    clearAll: () => Promise<{ success: boolean; message?: string }>
    getStats: () => Promise<{ count: number; size: number; message?: string }>
  }
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
      // Notifications API
      notifications: NotificationsAPI
      // Work Journal API
      workJournal: WorkJournalAPI
      // Git API
      git: GitAPI
      // Notebooks API
      notebooks: NotebooksAPI
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
  // SSH types
  SSHConnection,
  SSHConnectionStatus,
  SSHCredentials,
  SSHStatus,
  SSHConfigureResult,
  SSHAddConnectionResult,
  SSHUpdateConnectionResult,
  SSHDeleteResult,
  SSHAPI,
  CredentialsAPI,
  GitRepoInfo,
  GitChangedFile,
  GitDiffInfo,
  GitAPI,
  PersonaMetadata,
  Persona,
  CreatePersonaInput,
  UpdatePersonaInput,
  PersonaGenerationResult,
  PersonaAPI,
  DesktopNotificationPayload,
  NotificationsAPI,
  // Work Journal types
  WorkSession,
  WorkEntry,
  WorkCheckpoint,
  ResumptionContext,
  WorkJournalEntryEvent,
  WorkJournalStatusEvent,
  WorkJournalAPI,
  // Notebook types
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput,
  NotebookSearchResult,
  NotebooksAPI
}
