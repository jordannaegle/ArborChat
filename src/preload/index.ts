import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// MCP API types for the renderer
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
}

// Persona API types
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

// Work Journal API types for agent work persistence
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

// Git API types
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

// Git API for repository detection and information
const gitApi = {
  // Get comprehensive git repo info for a directory
  getRepoInfo: (directory: string) =>
    ipcRenderer.invoke('git:get-repo-info', directory) as Promise<GitRepoInfo>,

  // Get list of uncommitted/changed files
  getUncommittedFiles: (directory: string) =>
    ipcRenderer.invoke('git:get-uncommitted-files', directory) as Promise<GitChangedFile[]>,

  // Get files changed since a specific branch
  getChangedFilesSinceBranch: (directory: string, baseBranch: string) =>
    ipcRenderer.invoke('git:get-changed-files-since-branch', { directory, baseBranch }) as Promise<GitChangedFile[]>,

  // Get diff statistics
  getDiffStats: (directory: string, baseBranch?: string) =>
    ipcRenderer.invoke('git:get-diff-stats', { directory, baseBranch }) as Promise<GitDiffInfo>
}

// Persona API for managing AI personalities
const personaApi = {
  // List all personas (metadata only)
  list: () => ipcRenderer.invoke('personas:list') as Promise<PersonaMetadata[]>,

  // Get a single persona by ID (includes content)
  get: (id: string) => ipcRenderer.invoke('personas:get', id) as Promise<Persona | null>,

  // Create a new persona
  create: (input: CreatePersonaInput) =>
    ipcRenderer.invoke('personas:create', input) as Promise<Persona>,

  // Update an existing persona
  update: (id: string, updates: UpdatePersonaInput) =>
    ipcRenderer.invoke('personas:update', { id, updates }) as Promise<Persona>,

  // Delete a persona
  delete: (id: string) =>
    ipcRenderer.invoke('personas:delete', id) as Promise<{ success: boolean }>,

  // Get the prompt content for a persona (for chat context injection)
  getPrompt: (id: string) =>
    ipcRenderer.invoke('personas:get-prompt', id) as Promise<string | null>,

  // Generate a persona using AI
  generate: (description: string, name: string) =>
    ipcRenderer.invoke('personas:generate', { description, name }) as Promise<PersonaGenerationResult>,

  // Get the personas directory path
  getDirectory: () => ipcRenderer.invoke('personas:get-directory') as Promise<string>
}

// Credentials API for managing provider API keys
const credentialsApi = {
  // Get which providers have keys configured
  getConfigured: () =>
    ipcRenderer.invoke('credentials:get-configured') as Promise<Record<string, boolean>>,

  // Check if a specific provider has a key
  hasKey: (providerId: string) =>
    ipcRenderer.invoke('credentials:has-key', providerId) as Promise<boolean>,

  // Get the API key for a provider (use sparingly - prefer backend usage)
  getKey: (providerId: string) =>
    ipcRenderer.invoke('credentials:get-key', providerId) as Promise<string | null>,

  // Set API key for a provider
  setKey: (providerId: string, apiKey: string) =>
    ipcRenderer.invoke('credentials:set-key', { providerId, apiKey }) as Promise<{
      success: boolean
    }>,

  // Delete API key for a provider
  deleteKey: (providerId: string) =>
    ipcRenderer.invoke('credentials:delete-key', providerId) as Promise<{ success: boolean }>,

  // Validate an API key with the provider
  validateKey: (providerId: string, apiKey: string) =>
    ipcRenderer.invoke('credentials:validate-key', { providerId, apiKey }) as Promise<boolean>
}

// MCP API for tool execution
const mcpApi = {
  // Initialize MCP servers
  init: () => ipcRenderer.invoke('mcp:init'),

  // Get available tools from connected servers
  getTools: () => ipcRenderer.invoke('mcp:get-tools'),

  // Get connection status
  getStatus: () => ipcRenderer.invoke('mcp:get-status'),

  // Get tool system prompt for AI context
  getSystemPrompt: () => ipcRenderer.invoke('mcp:get-system-prompt') as Promise<string>,

  // Request tool execution (may require approval)
  requestTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string
  ) => ipcRenderer.invoke('mcp:request-tool', { serverName, toolName, args, explanation }),

  // Approve a pending tool call
  approve: (id: string, modifiedArgs?: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:approve', { id, modifiedArgs }),

  // Approve and add to always-approve list
  alwaysApprove: (id: string, modifiedArgs?: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:always-approve', { id, modifiedArgs }),

  // Reject a pending tool call
  reject: (id: string) => ipcRenderer.invoke('mcp:reject', { id }),

  // Get all pending approvals
  getPending: () => ipcRenderer.invoke('mcp:get-pending'),

  // Cancel a pending call
  cancelPending: (id: string) => ipcRenderer.invoke('mcp:cancel-pending', { id }),

  // Get MCP configuration
  getConfig: () => ipcRenderer.invoke('mcp:get-config'),

  // Update MCP configuration
  updateConfig: (updates: Record<string, unknown>) =>
    ipcRenderer.invoke('mcp:update-config', updates),

  // Reconnect to all servers
  reconnect: () => ipcRenderer.invoke('mcp:reconnect'),

  // Shutdown MCP
  shutdown: () => ipcRenderer.invoke('mcp:shutdown'),

  // Event listeners
  onApprovalRequired: (callback: (data: MCPApprovalRequest) => void) => {
    const handler = (_: unknown, data: MCPApprovalRequest) => callback(data)
    ipcRenderer.on('mcp:approval-required', handler)
    return () => ipcRenderer.removeListener('mcp:approval-required', handler)
  },

  onToolCompleted: (callback: (data: MCPToolResult) => void) => {
    const handler = (_: unknown, data: MCPToolResult) => callback(data)
    ipcRenderer.on('mcp:tool-completed', handler)
    return () => ipcRenderer.removeListener('mcp:tool-completed', handler)
  },

  onToolRejected: (callback: (data: { id: string }) => void) => {
    const handler = (_: unknown, data: { id: string }) => callback(data)
    ipcRenderer.on('mcp:tool-rejected', handler)
    return () => ipcRenderer.removeListener('mcp:tool-rejected', handler)
  },

  onConfigUpdated: (callback: (config: unknown) => void) => {
    const handler = (_: unknown, config: unknown) => callback(config)
    ipcRenderer.on('mcp:config-updated', handler)
    return () => ipcRenderer.removeListener('mcp:config-updated', handler)
  },

  // Remove all MCP event listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('mcp:approval-required')
    ipcRenderer.removeAllListeners('mcp:tool-completed')
    ipcRenderer.removeAllListeners('mcp:tool-rejected')
    ipcRenderer.removeAllListeners('mcp:config-updated')
  },

  // GitHub-specific API
  github: {
    isConfigured: () => ipcRenderer.invoke('mcp:github:is-configured') as Promise<boolean>,
    configure: (token: string) =>
      ipcRenderer.invoke('mcp:github:configure', { token }) as Promise<{
        success: boolean
        tools?: unknown[]
        username?: string
        error?: string
      }>,
    disconnect: () =>
      ipcRenderer.invoke('mcp:github:disconnect') as Promise<{ success: boolean }>,
    getStatus: () =>
      ipcRenderer.invoke('mcp:github:status') as Promise<{
        isConfigured: boolean
        isConnected: boolean
        toolCount: number
        username?: string
      }>
  }
}

// Notification API types
interface DesktopNotificationPayload {
  title: string
  body: string
  urgency?: 'low' | 'normal' | 'critical'
  agentId?: string
}

// Notification API for desktop notifications and badges
const notificationApi = {
  // Show a desktop notification
  show: (payload: DesktopNotificationPayload) =>
    ipcRenderer.invoke('notifications:show', payload),

  // Update badge count (dock on macOS, taskbar on Windows)
  setBadge: (count: number) => ipcRenderer.invoke('notifications:setBadge', count),

  // Request window attention (flash taskbar/dock)
  requestAttention: () => ipcRenderer.invoke('notifications:requestAttention'),

  // Clear badge
  clearBadge: () => ipcRenderer.invoke('notifications:clearBadge'),

  // Listen for notification clicks that target an agent
  onAgentClick: (callback: (agentId: string) => void) => {
    const handler = (_: unknown, agentId: string) => callback(agentId)
    ipcRenderer.on('notification:agent-click', handler)
    return () => ipcRenderer.removeListener('notification:agent-click', handler)
  },

  // Remove notification listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('notification:agent-click')
  }
}

// Work Journal API for agent work persistence
const workJournalApi = {
  // Session Management
  createSession: (conversationId: string, originalPrompt: string) =>
    ipcRenderer.invoke('work-journal:create-session', {
      conversationId,
      originalPrompt
    }) as Promise<WorkSession>,

  getSession: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-session', sessionId) as Promise<WorkSession | null>,

  getActiveSession: (conversationId: string) =>
    ipcRenderer.invoke('work-journal:get-active-session', conversationId) as Promise<WorkSession | null>,

  updateSessionStatus: (
    sessionId: string,
    status: 'active' | 'paused' | 'completed' | 'crashed'
  ) =>
    ipcRenderer.invoke('work-journal:update-session-status', {
      sessionId,
      status
    }) as Promise<{ success: boolean }>,

  // Entry Logging
  logEntry: (
    sessionId: string,
    entryType: string,
    content: Record<string, unknown>,
    importance?: 'low' | 'normal' | 'high' | 'critical'
  ) =>
    ipcRenderer.invoke('work-journal:log-entry', {
      sessionId,
      entryType,
      content,
      importance
    }) as Promise<WorkEntry>,

  getEntries: (
    sessionId: string,
    options?: {
      since?: number
      limit?: number
      importance?: ('low' | 'normal' | 'high' | 'critical')[]
      types?: string[]
    }
  ) =>
    ipcRenderer.invoke('work-journal:get-entries', {
      sessionId,
      options
    }) as Promise<WorkEntry[]>,

  // Checkpointing
  createCheckpoint: (sessionId: string, options?: { manual?: boolean }) =>
    ipcRenderer.invoke('work-journal:create-checkpoint', {
      sessionId,
      options
    }) as Promise<WorkCheckpoint>,

  getLatestCheckpoint: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-latest-checkpoint', sessionId) as Promise<WorkCheckpoint | null>,

  // Resumption
  generateResumptionContext: (sessionId: string, targetTokens?: number) =>
    ipcRenderer.invoke('work-journal:generate-resumption-context', {
      sessionId,
      targetTokens
    }) as Promise<ResumptionContext>,

  // Utilities
  getSessionTokens: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-session-tokens', sessionId) as Promise<number>,

  isApproachingLimit: (sessionId: string, threshold?: number) =>
    ipcRenderer.invoke('work-journal:is-approaching-limit', {
      sessionId,
      threshold
    }) as Promise<boolean>,

  // Real-time Subscriptions
  subscribe: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:subscribe', sessionId) as Promise<{
      success: boolean
      sessionId: string
    }>,

  unsubscribe: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:unsubscribe', sessionId) as Promise<{ success: boolean }>,

  // Event listeners (returns unsubscribe function)
  onNewEntry: (callback: (data: WorkJournalEntryEvent) => void) => {
    const handler = (_: unknown, data: WorkJournalEntryEvent) => callback(data)
    ipcRenderer.on('work-journal:new-entry', handler)
    return () => ipcRenderer.removeListener('work-journal:new-entry', handler)
  },

  onStatusChange: (callback: (data: WorkJournalStatusEvent) => void) => {
    const handler = (_: unknown, data: WorkJournalStatusEvent) => callback(data)
    ipcRenderer.on('work-journal:status-change', handler)
    return () => ipcRenderer.removeListener('work-journal:status-change', handler)
  },

  // Remove all event listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('work-journal:new-entry')
    ipcRenderer.removeAllListeners('work-journal:status-change')
  }
}

// Custom APIs for renderer
const api = {
  // File system dialogs
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory') as Promise<string | null>,
  
  getConversations: () => ipcRenderer.invoke('db:get-conversations'),
  createConversation: (title: string) => ipcRenderer.invoke('db:create-conversation', title),
  deleteConversation: (id: string) => ipcRenderer.invoke('db:delete-conversation', id),
  updateConversationTitle: (id: string, title: string) =>
    ipcRenderer.invoke('db:update-conversation-title', { id, title }),
  getMessages: (conversationId: string) => ipcRenderer.invoke('db:get-messages', conversationId),
  addMessage: (conversationId: string, role: string, content: string, parentId: string | null) =>
    ipcRenderer.invoke('db:add-message', { conversationId, role, content, parentId }),
  saveApiKey: (key: string) => ipcRenderer.invoke('settings:save-key', key),
  getApiKey: () => ipcRenderer.invoke('settings:get-key'),
  getSelectedModel: () => ipcRenderer.invoke('settings:get-model'),
  setSelectedModel: (model: string) => ipcRenderer.invoke('settings:set-model', model),
  getOllamaServerUrl: () => ipcRenderer.invoke('settings:get-ollama-url'),
  setOllamaServerUrl: (url: string) => ipcRenderer.invoke('settings:set-ollama-url', url),
  // Model Discovery
  getAvailableModels: (apiKey?: string) => ipcRenderer.invoke('models:get-available', { apiKey }),
  checkOllamaConnection: () => ipcRenderer.invoke('ollama:check-connection'),
  // AI Communication
  askAI: (apiKey: string, messages: any[], model: string) =>
    ipcRenderer.send('ai:ask', { apiKey, messages, model }),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('ai:token', (_, token) => callback(token)),
  onDone: (callback: () => void) => ipcRenderer.on('ai:done', () => callback()),
  onError: (callback: (err: string) => void) =>
    ipcRenderer.on('ai:error', (_, err) => callback(err)),
  offAI: () => {
    ipcRenderer.removeAllListeners('ai:token')
    ipcRenderer.removeAllListeners('ai:done')
    ipcRenderer.removeAllListeners('ai:error')
  },
  // MCP API
  mcp: mcpApi,
  // Credentials API
  credentials: credentialsApi,
  // Personas API
  personas: personaApi,
  // Notifications API
  notifications: notificationApi,
  // Work Journal API
  workJournal: workJournalApi,
  // Git API
  git: gitApi
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
