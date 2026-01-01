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

// Phase 3: Git verification types
interface GitVerifyResult {
  verified: boolean
  changedFiles: string[]
  missingChanges: string[]
  unexpectedChanges: string[]
  details: Record<string, { status: string; lines?: number }>
}

interface GitDetailedStatus {
  staged: Array<{ path: string; additions: number; deletions: number }>
  modified: Array<{ path: string; additions: number; deletions: number }>
  untracked: Array<{ path: string }>
}

// Git commit result type
interface GitCommitResult {
  success: boolean
  commitHash?: string
  message?: string
  filesCommitted?: number
  error?: string
}

// Notebook API types for saved chat content
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

// ═══════════════════════════════════════════════════════════════════════════
// Arbor Memory API Types
// ═══════════════════════════════════════════════════════════════════════════

/** Memory type classification determines how the memory is categorized. */
type ArborMemoryType = 
  | 'preference'    // User preferences (dark mode, coding style)
  | 'fact'          // Facts about user (name, role, projects)
  | 'context'       // Contextual info (current goals, recent work)
  | 'skill'         // User skills/expertise
  | 'instruction'   // Standing instructions ("always use TypeScript")
  | 'relationship'  // Relations to other entities

/** Memory scope determines visibility and retrieval behavior. */
type ArborMemoryScope = 
  | 'global'        // Available everywhere
  | 'project'       // Specific to a project path
  | 'conversation'  // Specific to a conversation

/** How the memory was created - affects confidence weighting. */
type ArborMemorySource = 
  | 'user_stated'   // User explicitly said this
  | 'ai_inferred'   // AI inferred from conversation
  | 'agent_stored'  // Agent explicitly stored via tool
  | 'system'        // System-generated

/** Privacy level controls injection behavior into AI context. */
type ArborMemoryPrivacyLevel = 
  | 'always_include' // Always inject into context
  | 'normal'         // Include when relevant
  | 'sensitive'      // Only include when directly relevant
  | 'never_share'    // Never include in AI context

/** Core memory entity. */
interface ArborMemoryRecord {
  id: string
  content: string
  summary?: string
  type: ArborMemoryType
  scope: ArborMemoryScope
  scopeId?: string
  source: ArborMemorySource
  confidence: number
  tags?: string[]
  relatedMemories?: string[]
  createdAt: number
  updatedAt: number
  accessedAt: number
  accessCount: number
  decayRate: number
  compactedAt?: number
  expiresAt?: number
  privacyLevel: ArborMemoryPrivacyLevel
}

/** Query parameters for memory retrieval. */
interface ArborMemoryQuery {
  scope?: ArborMemoryScope
  scopeId?: string
  includeGlobal?: boolean
  types?: ArborMemoryType[]
  minConfidence?: number
  privacyLevels?: ArborMemoryPrivacyLevel[]
  searchText?: string
  tags?: string[]
  limit?: number
  offset?: number
  sortBy?: 'confidence' | 'accessedAt' | 'createdAt' | 'accessCount'
  sortOrder?: 'asc' | 'desc'
}

/** Context returned for conversation injection. */
interface ArborMemoryContext {
  formattedPrompt: string
  memories: ArborMemoryRecord[]
  stats: {
    totalLoaded: number
    byScope: Record<ArborMemoryScope, number>
    byType: Record<ArborMemoryType, number>
    avgConfidence: number
  }
  status: 'loaded' | 'empty' | 'error'
  error?: string
}

/** Request to store a new memory. */
interface StoreArborMemoryRequest {
  content: string
  type: ArborMemoryType
  scope?: ArborMemoryScope
  scopeId?: string
  source?: ArborMemorySource
  confidence?: number
  tags?: string[]
  privacyLevel?: ArborMemoryPrivacyLevel
  decayRate?: number
  expiresAt?: number
}

/** Result of storing a memory. */
interface StoreArborMemoryResult {
  success: boolean
  memoryId?: string
  error?: string
  duplicate?: boolean
  existingMemoryId?: string
}

/** Request to update an existing memory. */
interface UpdateArborMemoryRequest {
  id: string
  content?: string
  type?: ArborMemoryType
  scope?: ArborMemoryScope
  scopeId?: string
  confidence?: number
  tags?: string[]
  privacyLevel?: ArborMemoryPrivacyLevel
  summary?: string
}

/** Memory candidate for AI-driven compaction. */
interface ArborCompactionCandidate {
  memory: ArborMemoryRecord
  reason: 'age' | 'low_confidence' | 'low_access' | 'size'
  suggestedAction: 'summarize' | 'delete' | 'archive'
}

/** Result of running the decay process. */
interface ArborDecayResult {
  updated: number
  deleted: number
}

/** Comprehensive memory statistics. */
interface ArborMemoryStats {
  totalMemories: number
  byScope: Record<ArborMemoryScope, number>
  byType: Record<ArborMemoryType, number>
  bySource: Record<ArborMemorySource, number>
  avgConfidence: number
  oldestMemory: number
  newestMemory: number
  totalAccessCount: number
  compactedCount: number
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
    ipcRenderer.invoke('git:get-diff-stats', { directory, baseBranch }) as Promise<GitDiffInfo>,

  // Phase 3: Verification methods
  verifyChanges: (workingDir: string, expectedFiles: string[]) =>
    ipcRenderer.invoke('git:verify-changes', { workingDir, expectedFiles }) as Promise<GitVerifyResult>,

  getDiffSummary: (workingDir: string) =>
    ipcRenderer.invoke('git:get-diff-summary', { workingDir }) as Promise<string>,

  isRepository: (workingDir: string) =>
    ipcRenderer.invoke('git:is-repository', { workingDir }) as Promise<boolean>,

  getDetailedStatus: (workingDir: string) =>
    ipcRenderer.invoke('git:get-detailed-status', { workingDir }) as Promise<GitDetailedStatus>,

  // Commit operations - for /commit slash command
  commit: (workingDir: string, message?: string) =>
    ipcRenderer.invoke('git:commit', { workingDir, message }) as Promise<GitCommitResult>,

  getArborChatRoot: () =>
    ipcRenderer.invoke('git:get-arborchat-root') as Promise<string>
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
    ipcRenderer.invoke('personas:generate', {
      description,
      name
    }) as Promise<PersonaGenerationResult>,

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

  // Get tool system prompt for AI context (enhanced with project intelligence)
  getSystemPrompt: (workingDirectory?: string) => 
    ipcRenderer.invoke('mcp:get-system-prompt', workingDirectory) as Promise<string>,

  // Request tool execution (may require approval)
  // skipApproval: if true, bypasses approval queue (used when frontend already showed approval card)
  requestTool: (
    serverName: string,
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string,
    skipApproval?: boolean
  ) => ipcRenderer.invoke('mcp:request-tool', { serverName, toolName, args, explanation, skipApproval }),

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
    disconnect: () => ipcRenderer.invoke('mcp:github:disconnect') as Promise<{ success: boolean }>,
    getStatus: () =>
      ipcRenderer.invoke('mcp:github:status') as Promise<{
        isConfigured: boolean
        isConnected: boolean
        toolCount: number
        username?: string
      }>
  },

  // SSH-specific API (Multi-connection support)
  ssh: {
    isConfigured: () => ipcRenderer.invoke('mcp:ssh:is-configured') as Promise<boolean>,
    
    // Connection management
    listConnections: () => 
      ipcRenderer.invoke('mcp:ssh:list-connections') as Promise<Array<{
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
      }>>,
    
    getConnection: (id: string) =>
      ipcRenderer.invoke('mcp:ssh:get-connection', id) as Promise<{
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
      } | null>,
    
    addConnection: (connection: {
      name: string
      host: string
      port: number
      username: string
      authType: 'password' | 'key'
      password?: string
      keyPath?: string
      enabled: boolean
    }) =>
      ipcRenderer.invoke('mcp:ssh:add-connection', connection) as Promise<{
        success: boolean
        connection?: {
          id: string
          name: string
          host: string
          port: number
          username: string
          authType: 'password' | 'key'
          createdAt: string
          enabled: boolean
        }
        error?: string
      }>,
    
    updateConnection: (id: string, updates: {
      name?: string
      host?: string
      port?: number
      username?: string
      authType?: 'password' | 'key'
      password?: string
      keyPath?: string
      enabled?: boolean
    }) =>
      ipcRenderer.invoke('mcp:ssh:update-connection', { id, updates }) as Promise<{
        success: boolean
        connection?: {
          id: string
          name: string
          host: string
          port: number
          username: string
          authType: 'password' | 'key'
          createdAt: string
          enabled: boolean
        }
        error?: string
      }>,
    
    deleteConnection: (id: string) =>
      ipcRenderer.invoke('mcp:ssh:delete-connection', id) as Promise<{
        success: boolean
        error?: string
      }>,
    
    connect: (id: string) =>
      ipcRenderer.invoke('mcp:ssh:connect', id) as Promise<{
        success: boolean
        error?: string
      }>,
    
    disconnectConnection: (id: string) =>
      ipcRenderer.invoke('mcp:ssh:disconnect-connection', id) as Promise<{
        success: boolean
        error?: string
      }>,
    
    // Get status of all connections
    getStatus: () =>
      ipcRenderer.invoke('mcp:ssh:status') as Promise<{
        connections: Array<{
          id: string
          name: string
          host: string
          username: string
          isConnected: boolean
          toolCount: number
        }>
      }>,
    
    // Legacy API for backward compatibility
    configure: (creds: {
      host: string
      port: number
      username: string
      authType: 'password' | 'key'
      password?: string
      keyPath?: string
    }) =>
      ipcRenderer.invoke('mcp:ssh:configure', creds) as Promise<{
        success: boolean
        error?: string
      }>,
    disconnect: () =>
      ipcRenderer.invoke('mcp:ssh:disconnect') as Promise<{ success: boolean }>
  },

  // Filesystem-specific API
  filesystem: {
    selectDirectory: () =>
      ipcRenderer.invoke('mcp:filesystem:select-directory') as Promise<string | null>,
    getAllowedDirectory: () =>
      ipcRenderer.invoke('mcp:filesystem:get-allowed-directory') as Promise<string | null>,
    setAllowedDirectory: (directory: string) =>
      ipcRenderer.invoke('mcp:filesystem:set-allowed-directory', directory) as Promise<void>
  },

  // Brave Search-specific API
  braveSearch: {
    validateKey: (apiKey: string) =>
      ipcRenderer.invoke('mcp:brave-search:validate-key', apiKey) as Promise<{
        valid: boolean
        error?: string
      }>
  },

  // Memory-specific API
  memory: {
    clearAll: () =>
      ipcRenderer.invoke('mcp:memory:clear-all') as Promise<{
        success: boolean
        message?: string
      }>,
    getStats: () =>
      ipcRenderer.invoke('mcp:memory:get-stats') as Promise<{
        count: number
        size: number
        message?: string
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

  // Get sessions that can be resumed (paused or crashed)
  getResumableSessions: (limit?: number) =>
    ipcRenderer.invoke('work-journal:get-resumable-sessions', limit) as Promise<WorkSession[]>,

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
  createCheckpoint: (sessionId: string, options?: { manual?: boolean; useAISummarization?: boolean; targetTokens?: number }) =>
    ipcRenderer.invoke('work-journal:create-checkpoint', {
      sessionId,
      options
    }) as Promise<WorkCheckpoint>,

  getLatestCheckpoint: (sessionId: string) =>
    ipcRenderer.invoke('work-journal:get-latest-checkpoint', sessionId) as Promise<WorkCheckpoint | null>,

  // AI Summarization (Phase 6)
  /** Trigger AI summarization for a session (without creating checkpoint) */
  summarizeSession: (sessionId: string, options?: { targetTokens?: number; useAI?: boolean }) =>
    ipcRenderer.invoke('work-journal:summarize-session', { sessionId, options }) as Promise<{
      summary: string
      keyDecisions: string[]
      currentState: string
      suggestedNextSteps: string[]
      usedAI: boolean
    }>,

  /** Enable/disable AI summarization */
  setAISummarizationEnabled: (enabled: boolean) =>
    ipcRenderer.invoke('work-journal:set-ai-summarization', enabled) as Promise<{ success: boolean; enabled: boolean }>,

  /** Get AI summarization status */
  getAISummarizationStatus: () =>
    ipcRenderer.invoke('work-journal:get-ai-summarization-status') as Promise<{ enabled: boolean }>,

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

// Notebook API for managing saved chat content
const notebooksApi = {
  // Notebook operations
  list: () => ipcRenderer.invoke('notebooks:list') as Promise<Notebook[]>,

  get: (id: string) => ipcRenderer.invoke('notebooks:get', id) as Promise<Notebook | null>,

  create: (input: CreateNotebookInput) =>
    ipcRenderer.invoke('notebooks:create', input) as Promise<Notebook>,

  update: (id: string, input: UpdateNotebookInput) =>
    ipcRenderer.invoke('notebooks:update', { id, input }) as Promise<Notebook | null>,

  delete: (id: string) => ipcRenderer.invoke('notebooks:delete', id) as Promise<boolean>,

  // Entry operations
  entries: {
    list: (notebookId: string) =>
      ipcRenderer.invoke('notebooks:entries:list', notebookId) as Promise<NotebookEntry[]>,

    get: (id: string) =>
      ipcRenderer.invoke('notebooks:entries:get', id) as Promise<NotebookEntry | null>,

    create: (input: CreateEntryInput) =>
      ipcRenderer.invoke('notebooks:entries:create', input) as Promise<NotebookEntry>,

    update: (id: string, input: UpdateEntryInput) =>
      ipcRenderer.invoke('notebooks:entries:update', { id, input }) as Promise<NotebookEntry | null>,

    delete: (id: string) => ipcRenderer.invoke('notebooks:entries:delete', id) as Promise<boolean>,

    // Phase 6: Reorder and bulk operations
    reorder: (notebookId: string, orderedIds: string[]) =>
      ipcRenderer.invoke('notebooks:entries:reorder', { notebookId, orderedIds }) as Promise<boolean>,

    bulkDelete: (ids: string[]) =>
      ipcRenderer.invoke('notebooks:entries:bulk-delete', ids) as Promise<boolean>
  },

  // Search & Export
  search: (query: string) =>
    ipcRenderer.invoke('notebooks:search', query) as Promise<NotebookSearchResult[]>,

  // Phase 6: Enhanced export options
  export: {
    markdown: (id: string) =>
      ipcRenderer.invoke('notebooks:export', id) as Promise<string | null>,
    json: (id: string) =>
      ipcRenderer.invoke('notebooks:export:json', id) as Promise<string | null>,
    text: (id: string) =>
      ipcRenderer.invoke('notebooks:export:text', id) as Promise<string | null>
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Arbor Memory API - Native persistent memory for AI conversations
// ═══════════════════════════════════════════════════════════════════════════

const arborMemoryApi = {
  // ─────────────────────────────────────────────────────────────────────────
  // Context Retrieval (Primary method for conversation start)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get context memories for conversation injection.
   * Called at conversation start for automatic memory loading.
   */
  getContext: (options?: {
    conversationId?: string
    projectPath?: string
    searchText?: string
    maxTokens?: number
  }) => ipcRenderer.invoke('memory:getContext', options ?? {}) as Promise<ArborMemoryContext>,

  // ─────────────────────────────────────────────────────────────────────────
  // Storage
  // ─────────────────────────────────────────────────────────────────────────

  /** Store a new memory with duplicate detection. */
  store: (request: StoreArborMemoryRequest) =>
    ipcRenderer.invoke('memory:store', request) as Promise<StoreArborMemoryResult>,

  // ─────────────────────────────────────────────────────────────────────────
  // Querying
  // ─────────────────────────────────────────────────────────────────────────

  /** Query memories with flexible filters. */
  query: (query: ArborMemoryQuery) =>
    ipcRenderer.invoke('memory:query', query) as Promise<ArborMemoryRecord[]>,

  /** Full-text search across memory content. */
  search: (searchText: string, limit?: number) =>
    ipcRenderer.invoke('memory:search', searchText, limit) as Promise<ArborMemoryRecord[]>,

  // ─────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────

  /** Get a single memory by ID. */
  get: (id: string) =>
    ipcRenderer.invoke('memory:get', id) as Promise<ArborMemoryRecord | null>,

  /** Update an existing memory. */
  update: (request: UpdateArborMemoryRequest) =>
    ipcRenderer.invoke('memory:update', request) as Promise<boolean>,

  /** Delete a memory by ID. */
  delete: (id: string) =>
    ipcRenderer.invoke('memory:delete', id) as Promise<boolean>,

  // ─────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────

  /** Get comprehensive memory statistics. */
  getStats: () =>
    ipcRenderer.invoke('memory:getStats') as Promise<ArborMemoryStats>,

  /** Clear all memories from the database. */
  clearAll: () =>
    ipcRenderer.invoke('memory:clearAll') as Promise<{ success: boolean; deleted: number; error?: string }>,

  // ─────────────────────────────────────────────────────────────────────────
  // Decay & Compaction
  // ─────────────────────────────────────────────────────────────────────────

  /** Get memories that are candidates for AI-driven compaction/summarization. */
  getCompactionCandidates: (limit?: number) =>
    ipcRenderer.invoke('memory:getCompactionCandidates', limit) as Promise<ArborCompactionCandidate[]>,

  /** Apply compaction (AI-generated summary) to a memory. */
  applyCompaction: (memoryId: string, summary: string) =>
    ipcRenderer.invoke('memory:applyCompaction', memoryId, summary) as Promise<boolean>,

  /** Run decay on memories not accessed recently. */
  runDecay: () =>
    ipcRenderer.invoke('memory:runDecay') as Promise<ArborDecayResult>
}

// ═══════════════════════════════════════════════════════════════════════════
// Project Analyzer API - Project-aware context injection for agents
// ═══════════════════════════════════════════════════════════════════════════

const projectAnalyzerApi = {
  /** Get project intelligence context for a working directory */
  getContext: (workingDirectory: string) =>
    ipcRenderer.invoke('projectAnalyzer:getContext', workingDirectory) as Promise<string | null>,

  /** Check if a directory is a known project with custom patterns */
  isKnownProject: (workingDirectory: string) =>
    ipcRenderer.invoke('projectAnalyzer:isKnownProject', workingDirectory) as Promise<boolean>
}

// ═══════════════════════════════════════════════════════════════════════════
// Tokenizer API - Accurate token counting for context management
// ═══════════════════════════════════════════════════════════════════════════

const tokenizerApi = {
  /** Count tokens in text (async, accurate) */
  count: (text: string, modelId?: string): Promise<number> =>
    ipcRenderer.invoke('tokenizer:count', text, modelId),

  /** Count tokens synchronously (uses cache, faster for hot paths) */
  countSync: (text: string, modelId?: string): Promise<number> =>
    ipcRenderer.invoke('tokenizer:countSync', text, modelId),

  /** Truncate text to fit within token limit */
  truncate: (text: string, maxTokens: number, modelId?: string): Promise<string> =>
    ipcRenderer.invoke('tokenizer:truncate', text, maxTokens, modelId),

  /** Get tokenizer service statistics */
  getStats: (): Promise<{ loadedEncodings: string[]; initialized: boolean }> =>
    ipcRenderer.invoke('tokenizer:stats')
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
  // Native function call handler (for providers with native tool calling)
  onFunctionCall: (callback: (data: { name: string; args: Record<string, unknown> }) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: { name: string; args: Record<string, unknown> }) => {
      callback(data)
    }
    ipcRenderer.on('ai:function_call', listener)
    return () => ipcRenderer.removeListener('ai:function_call', listener)
  },
  offAI: () => {
    ipcRenderer.removeAllListeners('ai:token')
    ipcRenderer.removeAllListeners('ai:done')
    ipcRenderer.removeAllListeners('ai:error')
    ipcRenderer.removeAllListeners('ai:function_call')
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
  git: gitApi,
  // Notebooks API
  notebooks: notebooksApi,
  // Arbor Memory API
  arborMemory: arborMemoryApi,
  // Tokenizer API
  tokenizer: tokenizerApi,
  // Project Analyzer API
  projectAnalyzer: projectAnalyzerApi
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
