// src/main/mcp/ipc.ts

import { ipcMain, BrowserWindow } from 'electron'
import { randomUUID } from 'crypto'
import { mcpManager } from './manager'
import {
  loadMCPConfig,
  saveMCPConfig,
  updateMCPConfig,
  isToolBlocked,
  isToolAlwaysApproved,
  addAlwaysApproveTool
} from './config'
import { getToolRiskLevel } from './servers/desktop-commander'
import { getGitHubToolRiskLevel, GITHUB_MCP_CONFIG } from './servers/github'
import { getSSHToolRiskLevel, SSH_MCP_CONFIG, buildSSHArgs, getSSHServerName, isSSHServer } from './servers/ssh-mcp'
import {
  saveGitHubToken,
  deleteGitHubToken,
  isGitHubConfigured,
  // SSH credentials types and functions
  SSHCredentials,
  SSHConnection,
  getSSHConnections,
  getSSHConnectionById,
  getSSHConnectionByName,
  addSSHConnection,
  updateSSHConnection,
  deleteSSHConnection,
  hasSSHConnections
} from './credentials'
import {
  PendingToolCall,
  ToolCallResult,
  MCPConfig,
  GitHubStatus,
  GitHubConfigureResult
} from './types'
// Internal Arbor tools
import {
  isArborInternalTool,
  getArborInternalTools,
  executeArborMemoryTool
} from './tools'
import type { ArborMemoryToolParams } from './tools'

// Pending tool calls awaiting user approval
const pendingCalls = new Map<string, PendingToolCall>()

/**
 * Setup all MCP-related IPC handlers
 */
export function setupMCPHandlers(): void {
  console.log('[MCP IPC] Setting up handlers...')

  // Initialize MCP and connect to servers
  ipcMain.handle('mcp:init', async () => {
    try {
      console.log('[MCP IPC] Initializing MCP...')
      await mcpManager.connectAllServers()

      const tools = mcpManager.getAvailableTools()
      const status = mcpManager.getConnectionStatus()

      return {
        success: true,
        tools,
        connectionStatus: status
      }
    } catch (error) {
      console.error('[MCP IPC] Init failed:', error)
      return {
        success: false,
        error: String(error)
      }
    }
  })

  // Get available tools (includes internal Arbor tools)
  ipcMain.handle('mcp:get-tools', async () => {
    const mcpTools = mcpManager.getAvailableTools()
    
    // Add internal Arbor tools
    const internalTools = getArborInternalTools().map(tool => ({
      ...tool,
      server: 'arbor' // Internal tools use 'arbor' as the server name
    }))
    
    return [...internalTools, ...mcpTools]
  })

  // Get connection status
  ipcMain.handle('mcp:get-status', async () => {
    return {
      connectionStatus: mcpManager.getConnectionStatus(),
      config: mcpManager.getConfig()
    }
  })

  // Request tool execution (may require approval)
  ipcMain.handle(
    'mcp:request-tool',
    async (
      event,
      request: {
        serverName: string
        toolName: string
        args: Record<string, unknown>
        explanation?: string
        skipApproval?: boolean // Skip approval if frontend already approved
        context?: { conversationId?: string; projectPath?: string } // Context for internal tools
      }
    ) => {
      const { serverName, toolName, args, explanation, skipApproval, context } = request
      const id = randomUUID()
      const config = mcpManager.getConfig()

      // Check if tool is blocked
      if (isToolBlocked(toolName, config)) {
        return {
          id,
          success: false,
          error: `Tool '${toolName}' is blocked by configuration`,
          blocked: true
        }
      }

      // Handle internal Arbor tools (always auto-approve, execute directly)
      if (isArborInternalTool(toolName) || serverName === 'arbor') {
        console.log(`[MCP IPC] Executing internal Arbor tool: ${toolName}`)
        const startTime = Date.now()

        try {
          let result: unknown
          
          if (toolName === 'arbor_store_memory') {
            result = await executeArborMemoryTool(
              args as unknown as ArborMemoryToolParams,
              context || {}
            )
          } else {
            throw new Error(`Unknown internal tool: ${toolName}`)
          }

          return {
            id,
            success: true,
            approved: true,
            autoApproved: true,
            result,
            duration: Date.now() - startTime
          }
        } catch (error) {
          return {
            id,
            success: false,
            approved: true,
            autoApproved: true,
            error: String(error)
          }
        }
      }

      // Check if tool is blocked
      if (isToolBlocked(toolName, config)) {
        return {
          id,
          success: false,
          error: `Tool '${toolName}' is blocked by configuration`,
          blocked: true
        }
      }

      // If skipApproval is set, the frontend already showed approval card
      // Execute immediately without re-queuing for approval
      if (skipApproval) {
        console.log(`[MCP IPC] Executing pre-approved ${toolName} (frontend approved)`)
        const startTime = Date.now()

        try {
          const result = await mcpManager.callTool(serverName, toolName, args)
          return {
            id,
            success: true,
            approved: true,
            autoApproved: false,
            result,
            duration: Date.now() - startTime
          }
        } catch (error) {
          return {
            id,
            success: false,
            approved: true,
            autoApproved: false,
            error: String(error)
          }
        }
      }

      // Get risk level based on server
      let riskLevel: 'safe' | 'moderate' | 'dangerous'
      switch (serverName) {
        case 'github':
          riskLevel = getGitHubToolRiskLevel(toolName)
          break
        default:
          // Check if it's an SSH server (ssh-{name} format)
          if (isSSHServer(serverName)) {
            riskLevel = getSSHToolRiskLevel(toolName)
          } else {
            riskLevel = getToolRiskLevel(toolName)
          }
      }
      const win = BrowserWindow.fromWebContents(event.sender)

      // Check if we should auto-approve based on risk level or always-approve list
      const shouldAutoApprove =
        isToolAlwaysApproved(toolName, config) ||
        (riskLevel === 'safe' && config.autoApprove.safe) ||
        (riskLevel === 'moderate' && config.autoApprove.moderate)

      if (shouldAutoApprove) {
        // Execute immediately without approval
        console.log(`[MCP IPC] Auto-approving ${toolName} (risk: ${riskLevel})`)
        const startTime = Date.now()

        try {
          const result = await mcpManager.callTool(serverName, toolName, args)
          return {
            id,
            success: true,
            approved: true,
            autoApproved: true,
            result,
            duration: Date.now() - startTime
          }
        } catch (error) {
          return {
            id,
            success: false,
            approved: true,
            autoApproved: true,
            error: String(error)
          }
        }
      }

      // Queue for manual approval
      console.log(`[MCP IPC] Queuing ${toolName} for approval (risk: ${riskLevel})`)

      return new Promise<ToolCallResult>((resolve) => {
        const pending: PendingToolCall = {
          id,
          serverName,
          toolName,
          args,
          riskLevel,
          explanation,
          timestamp: new Date(),
          resolve: (result) => resolve(result),
          reject: (error) =>
            resolve({
              id,
              success: false,
              error: error.message
            })
        }

        pendingCalls.set(id, pending)

        // Notify renderer that approval is required
        win?.webContents.send('mcp:approval-required', {
          id,
          toolName,
          args,
          riskLevel,
          explanation
        })

        // Return immediately with pending status
        // The actual result will come through approve/reject handlers
      })
    }
  )

  // User approves tool execution
  ipcMain.handle(
    'mcp:approve',
    async (
      event,
      {
        id,
        modifiedArgs
      }: {
        id: string
        modifiedArgs?: Record<string, unknown>
      }
    ) => {
      const pending = pendingCalls.get(id)
      if (!pending) {
        return { success: false, error: 'Pending call not found or expired' }
      }

      const startTime = Date.now()
      const win = BrowserWindow.fromWebContents(event.sender)

      try {
        const result = await mcpManager.callTool(
          pending.serverName,
          pending.toolName,
          modifiedArgs || pending.args
        )

        const duration = Date.now() - startTime

        const callResult: ToolCallResult = {
          id,
          success: true,
          result,
          duration
        }

        // Notify the original promise
        pending.resolve(callResult)
        pendingCalls.delete(id)

        // Also send completion event
        win?.webContents.send('mcp:tool-completed', callResult)

        return callResult
      } catch (error) {
        const callResult: ToolCallResult = {
          id,
          success: false,
          error: String(error),
          duration: Date.now() - startTime
        }

        pending.resolve(callResult)
        pendingCalls.delete(id)

        win?.webContents.send('mcp:tool-completed', callResult)

        return callResult
      }
    }
  )

  // User rejects tool execution
  ipcMain.handle('mcp:reject', async (event, { id }: { id: string }) => {
    const pending = pendingCalls.get(id)
    const win = BrowserWindow.fromWebContents(event.sender)

    if (pending) {
      const result: ToolCallResult = {
        id,
        success: false,
        error: 'User rejected tool execution'
      }

      pending.resolve(result)
      pendingCalls.delete(id)

      win?.webContents.send('mcp:tool-rejected', { id })
    }

    return { rejected: true }
  })

  // User approves tool and adds to always-approve list
  ipcMain.handle(
    'mcp:always-approve',
    async (
      event,
      {
        id,
        modifiedArgs
      }: {
        id: string
        modifiedArgs?: Record<string, unknown>
      }
    ) => {
      const pending = pendingCalls.get(id)
      if (!pending) {
        return { success: false, error: 'Pending call not found or expired' }
      }

      // Add tool to always-approve list
      const updatedConfig = addAlwaysApproveTool(pending.toolName)
      mcpManager.reloadConfig()
      console.log(`[MCP IPC] Added ${pending.toolName} to always-approve list`)

      const startTime = Date.now()
      const win = BrowserWindow.fromWebContents(event.sender)

      try {
        const result = await mcpManager.callTool(
          pending.serverName,
          pending.toolName,
          modifiedArgs || pending.args
        )

        const duration = Date.now() - startTime

        const callResult: ToolCallResult = {
          id,
          success: true,
          result,
          duration
        }

        // Notify the original promise
        pending.resolve(callResult)
        pendingCalls.delete(id)

        // Also send completion event
        win?.webContents.send('mcp:tool-completed', callResult)

        // Send config updated event so UI can refresh
        win?.webContents.send('mcp:config-updated', updatedConfig)

        return { ...callResult, alwaysApproved: true }
      } catch (error) {
        const callResult: ToolCallResult = {
          id,
          success: false,
          error: String(error),
          duration: Date.now() - startTime
        }

        pending.resolve(callResult)
        pendingCalls.delete(id)

        win?.webContents.send('mcp:tool-completed', callResult)

        return callResult
      }
    }
  )

  // Get pending approvals
  ipcMain.handle('mcp:get-pending', async () => {
    return Array.from(pendingCalls.values()).map((p) => ({
      id: p.id,
      toolName: p.toolName,
      args: p.args,
      riskLevel: p.riskLevel,
      explanation: p.explanation,
      timestamp: p.timestamp.toISOString()
    }))
  })

  // Cancel a pending call (timeout or user navigated away)
  ipcMain.handle('mcp:cancel-pending', async (_, { id }: { id: string }) => {
    const pending = pendingCalls.get(id)
    if (pending) {
      pending.reject(new Error('Cancelled'))
      pendingCalls.delete(id)
    }
    return { cancelled: true }
  })

  // Get/update MCP configuration
  ipcMain.handle('mcp:get-config', async () => {
    return loadMCPConfig()
  })

  ipcMain.handle('mcp:update-config', async (_, updates: Partial<MCPConfig>) => {
    const updated = updateMCPConfig(updates)
    mcpManager.reloadConfig()
    return updated
  })

  // Reconnect to servers
  ipcMain.handle('mcp:reconnect', async () => {
    await mcpManager.disconnectAll()
    await mcpManager.connectAllServers()
    return {
      connectionStatus: mcpManager.getConnectionStatus(),
      tools: mcpManager.getAvailableTools()
    }
  })

  // Shutdown MCP (called on app quit)
  ipcMain.handle('mcp:shutdown', async () => {
    console.log('[MCP IPC] Shutting down...')

    // Reject all pending calls
    for (const pending of pendingCalls.values()) {
      pending.reject(new Error('MCP shutdown'))
    }
    pendingCalls.clear()

    await mcpManager.disconnectAll()
    return { success: true }
  })

  // Get tool system prompt for AI context (includes internal Arbor tools)
  // Enhanced with project intelligence when working directory is provided
  ipcMain.handle('mcp:get-system-prompt', async (_event, workingDirectory?: string) => {
    console.log('[MCP IPC] get-system-prompt called with workingDirectory:', workingDirectory)
    const { generateEnhancedSystemPrompt } = await import('./prompts')
    const mcpTools = mcpManager.getAvailableTools()
    
    // Add internal Arbor tools
    const internalTools = getArborInternalTools().map(tool => ({
      ...tool,
      server: 'arbor'
    }))
    
    return generateEnhancedSystemPrompt([...internalTools, ...mcpTools], workingDirectory)
  })

  // =====================
  // GitHub-specific handlers
  // =====================

  /**
   * Check if GitHub is configured
   */
  ipcMain.handle('mcp:github:is-configured', async (): Promise<boolean> => {
    return await isGitHubConfigured()
  })

  /**
   * Configure GitHub with a new PAT
   */
  ipcMain.handle(
    'mcp:github:configure',
    async (_, { token }: { token: string }): Promise<GitHubConfigureResult> => {
      try {
        console.log('[MCP GitHub] Configuring with new token...')

        // Validate token by making a test API call
        const validationResult = await validateGitHubToken(token)
        if (!validationResult.valid) {
          return {
            success: false,
            error: validationResult.error || 'Invalid token or insufficient permissions'
          }
        }

        // Save the token securely
        await saveGitHubToken(token)

        // Update config to enable GitHub server
        const config = loadMCPConfig()
        const githubServer = config.servers.find((s) => s.name === 'github')
        if (githubServer) {
          githubServer.enabled = true
        }
        saveMCPConfig(config)

        // Connect to the server with the token injected
        await mcpManager.connectServer({
          ...GITHUB_MCP_CONFIG,
          enabled: true,
          env: { GITHUB_PERSONAL_ACCESS_TOKEN: token }
        })

        const tools = mcpManager.getServerTools('github')
        console.log(`[MCP GitHub] Connected with ${tools.length} tools`)

        return {
          success: true,
          tools,
          username: validationResult.username
        }
      } catch (error) {
        console.error('[MCP GitHub] Configuration failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Disconnect GitHub and remove credentials
   */
  ipcMain.handle('mcp:github:disconnect', async (): Promise<{ success: boolean }> => {
    try {
      console.log('[MCP GitHub] Disconnecting...')

      // Delete the stored token
      await deleteGitHubToken()

      // Disconnect the server
      await mcpManager.disconnectServer('github')

      // Update config to disable GitHub server
      const config = loadMCPConfig()
      const githubServer = config.servers.find((s) => s.name === 'github')
      if (githubServer) {
        githubServer.enabled = false
      }
      saveMCPConfig(config)

      console.log('[MCP GitHub] Disconnected successfully')
      return { success: true }
    } catch (error) {
      console.error('[MCP GitHub] Disconnect failed:', error)
      return { success: false }
    }
  })

  /**
   * Get GitHub connection status
   */
  ipcMain.handle('mcp:github:status', async (): Promise<GitHubStatus> => {
    const configured = await isGitHubConfigured()
    const connected = mcpManager.isServerConnected('github')
    const tools = mcpManager.getServerTools('github')

    return {
      isConfigured: configured,
      isConnected: connected,
      toolCount: tools.length
    }
  })

  // =====================
  // SSH-specific handlers (Multi-connection support)
  // =====================

  /**
   * Check if any SSH connections are configured
   */
  ipcMain.handle('mcp:ssh:is-configured', async (): Promise<boolean> => {
    return await hasSSHConnections()
  })

  /**
   * Get all SSH connections
   */
  ipcMain.handle('mcp:ssh:list-connections', async (): Promise<SSHConnection[]> => {
    return await getSSHConnections()
  })

  /**
   * Get a single SSH connection by ID
   */
  ipcMain.handle('mcp:ssh:get-connection', async (_, id: string): Promise<SSHConnection | null> => {
    return await getSSHConnectionById(id)
  })

  /**
   * Add a new SSH connection
   */
  ipcMain.handle(
    'mcp:ssh:add-connection',
    async (_, connection: Omit<SSHConnection, 'id' | 'createdAt'>): Promise<{ 
      success: boolean
      connection?: SSHConnection
      error?: string 
    }> => {
      try {
        console.log(`[MCP SSH] Adding connection: ${connection.name}`)
        const newConnection = await addSSHConnection(connection)
        
        // If enabled, connect immediately
        if (newConnection.enabled) {
          await connectSSHServer(newConnection)
        }
        
        return { success: true, connection: newConnection }
      } catch (error) {
        console.error('[MCP SSH] Add connection failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Update an existing SSH connection
   */
  ipcMain.handle(
    'mcp:ssh:update-connection',
    async (_, { id, updates }: { 
      id: string
      updates: Partial<Omit<SSHConnection, 'id' | 'createdAt'>> 
    }): Promise<{ 
      success: boolean
      connection?: SSHConnection
      error?: string 
    }> => {
      try {
        const existingConnection = await getSSHConnectionById(id)
        if (!existingConnection) {
          return { success: false, error: 'Connection not found' }
        }

        console.log(`[MCP SSH] Updating connection: ${existingConnection.name}`)
        
        // Disconnect old server if name changed or connection details changed
        const serverName = getSSHServerName(existingConnection.name)
        if (mcpManager.isServerConnected(serverName)) {
          await mcpManager.disconnectServer(serverName)
        }
        
        const updatedConnection = await updateSSHConnection(id, updates)
        if (!updatedConnection) {
          return { success: false, error: 'Failed to update connection' }
        }
        
        // Reconnect if enabled
        if (updatedConnection.enabled) {
          await connectSSHServer(updatedConnection)
        }
        
        return { success: true, connection: updatedConnection }
      } catch (error) {
        console.error('[MCP SSH] Update connection failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Delete an SSH connection
   */
  ipcMain.handle(
    'mcp:ssh:delete-connection',
    async (_, id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const connection = await getSSHConnectionById(id)
        if (!connection) {
          return { success: false, error: 'Connection not found' }
        }

        console.log(`[MCP SSH] Deleting connection: ${connection.name}`)
        
        // Disconnect the server first
        const serverName = getSSHServerName(connection.name)
        if (mcpManager.isServerConnected(serverName)) {
          await mcpManager.disconnectServer(serverName)
        }
        
        const deleted = await deleteSSHConnection(id)
        return { success: deleted }
      } catch (error) {
        console.error('[MCP SSH] Delete connection failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Connect a specific SSH connection
   */
  ipcMain.handle(
    'mcp:ssh:connect',
    async (_, id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const connection = await getSSHConnectionById(id)
        if (!connection) {
          return { success: false, error: 'Connection not found' }
        }

        await connectSSHServer(connection)
        
        // Update enabled status
        await updateSSHConnection(id, { enabled: true })
        
        return { success: true }
      } catch (error) {
        console.error('[MCP SSH] Connect failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Disconnect a specific SSH connection
   */
  ipcMain.handle(
    'mcp:ssh:disconnect-connection',
    async (_, id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const connection = await getSSHConnectionById(id)
        if (!connection) {
          return { success: false, error: 'Connection not found' }
        }

        console.log(`[MCP SSH] Disconnecting: ${connection.name}`)
        
        const serverName = getSSHServerName(connection.name)
        if (mcpManager.isServerConnected(serverName)) {
          await mcpManager.disconnectServer(serverName)
        }
        
        // Update enabled status
        await updateSSHConnection(id, { enabled: false })
        
        return { success: true }
      } catch (error) {
        console.error('[MCP SSH] Disconnect failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Get status of all SSH connections
   */
  ipcMain.handle('mcp:ssh:status', async (): Promise<{
    connections: Array<{
      id: string
      name: string
      host: string
      username: string
      isConnected: boolean
      toolCount: number
    }>
  }> => {
    const connections = await getSSHConnections()
    
    const connectionStatus = connections.map(conn => {
      const serverName = getSSHServerName(conn.name)
      const isConnected = mcpManager.isServerConnected(serverName)
      const tools = mcpManager.getServerTools(serverName)
      
      return {
        id: conn.id,
        name: conn.name,
        host: conn.host,
        username: conn.username,
        isConnected,
        toolCount: tools.length
      }
    })
    
    return { connections: connectionStatus }
  })

  // Legacy handlers for backward compatibility
  /**
   * Configure SSH with credentials (legacy - creates a "Default" connection)
   */
  ipcMain.handle(
    'mcp:ssh:configure',
    async (_, creds: SSHCredentials): Promise<{ success: boolean; error?: string }> => {
      try {
        console.log('[MCP SSH] Legacy configure - creating Default connection')
        
        // Check if Default connection already exists
        const existing = await getSSHConnectionByName('Default')
        if (existing) {
          // Update existing
          await updateSSHConnection(existing.id, {
            host: creds.host,
            port: creds.port,
            username: creds.username,
            authType: creds.authType,
            password: creds.password,
            keyPath: creds.keyPath,
            enabled: true
          })
          
          // Reconnect
          const serverName = getSSHServerName('Default')
          if (mcpManager.isServerConnected(serverName)) {
            await mcpManager.disconnectServer(serverName)
          }
          
          const updatedConn = await getSSHConnectionByName('Default')
          if (updatedConn) {
            await connectSSHServer(updatedConn)
          }
        } else {
          // Create new
          const newConnection = await addSSHConnection({
            name: 'Default',
            host: creds.host,
            port: creds.port,
            username: creds.username,
            authType: creds.authType,
            password: creds.password,
            keyPath: creds.keyPath,
            enabled: true
          })
          
          await connectSSHServer(newConnection)
        }

        return { success: true }
      } catch (error) {
        console.error('[MCP SSH] Legacy configure failed:', error)
        return { success: false, error: String(error) }
      }
    }
  )

  /**
   * Disconnect SSH (legacy - disconnects all)
   */
  ipcMain.handle('mcp:ssh:disconnect', async (): Promise<{ success: boolean }> => {
    try {
      console.log('[MCP SSH] Legacy disconnect - disconnecting all SSH connections')
      
      const connections = await getSSHConnections()
      for (const conn of connections) {
        const serverName = getSSHServerName(conn.name)
        if (mcpManager.isServerConnected(serverName)) {
          await mcpManager.disconnectServer(serverName)
        }
        await updateSSHConnection(conn.id, { enabled: false })
      }
      
      return { success: true }
    } catch (error) {
      console.error('[MCP SSH] Legacy disconnect failed:', error)
      return { success: false }
    }
  })

  console.log('[MCP IPC] Handlers ready')
}

/**
 * Helper: Connect an SSH server for a connection
 */
async function connectSSHServer(connection: SSHConnection): Promise<void> {
  const serverName = getSSHServerName(connection.name)
  
  // Build the args for the SSH server
  const sshArgs = buildSSHArgs({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.authType === 'password' ? connection.password : undefined,
    key: connection.authType === 'key' ? connection.keyPath : undefined,
    maxChars: 'none'
  })

  console.log(`[MCP SSH] Connecting server: ${serverName}`)
  
  // Connect to the server
  await mcpManager.connectServer({
    ...SSH_MCP_CONFIG,
    name: serverName,
    enabled: true,
    args: sshArgs
  })

  const tools = mcpManager.getServerTools(serverName)
  console.log(`[MCP SSH] ${serverName} connected with ${tools.length} tools`)
}

/**
 * Clear all pending calls (useful for cleanup)
 */
export function clearPendingCalls(): void {
  for (const pending of pendingCalls.values()) {
    pending.reject(new Error('Cleared'))
  }
  pendingCalls.clear()
}

/**
 * Get count of pending calls
 */
export function getPendingCallCount(): number {
  return pendingCalls.size
}

// =====================
// GitHub Helper Functions
// =====================

interface TokenValidationResult {
  valid: boolean
  username?: string
  error?: string
}

/**
 * Validate a GitHub PAT by making a test API call
 * Returns the username if valid
 */
async function validateGitHubToken(token: string): Promise<TokenValidationResult> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'ArborChat-MCP'
      }
    })

    if (response.ok) {
      const user = (await response.json()) as { login: string }
      console.log(`[MCP GitHub] Token validated for user: ${user.login}`)
      return { valid: true, username: user.login }
    }

    // Handle specific error cases
    if (response.status === 401) {
      return { valid: false, error: 'Invalid or expired token' }
    }
    if (response.status === 403) {
      // Check for rate limiting
      const remaining = response.headers.get('X-RateLimit-Remaining')
      if (remaining === '0') {
        return { valid: false, error: 'Rate limit exceeded. Please try again later.' }
      }
      return { valid: false, error: 'Access forbidden. Check token permissions.' }
    }

    return { valid: false, error: `GitHub API error: ${response.status}` }
  } catch (error) {
    console.error('[MCP GitHub] Token validation error:', error)
    return { valid: false, error: 'Network error while validating token' }
  }
}
