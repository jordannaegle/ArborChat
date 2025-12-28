// src/main/mcp/manager.ts

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { ToolDefinition, MCPServerConfig, MCPConfig } from './types'
import { loadMCPConfig } from './config'

interface ConnectedServer {
  config: MCPServerConfig
  transport: StdioClientTransport
  client: Client
  tools: ToolDefinition[]
  connected: boolean
}

/**
 * MCPManager handles connections to MCP servers and routes tool calls
 */
class MCPManager {
  private servers: Map<string, ConnectedServer> = new Map()
  private config: MCPConfig

  constructor() {
    this.config = loadMCPConfig()
  }

  /**
   * Reload configuration from disk
   */
  reloadConfig(): void {
    this.config = loadMCPConfig()
  }

  /**
   * Get current configuration
   */
  getConfig(): MCPConfig {
    return this.config
  }

  /**
   * Connect to an MCP server
   */
  async connectServer(serverConfig: MCPServerConfig): Promise<void> {
    if (!serverConfig.enabled) {
      console.log(`[MCP] Server ${serverConfig.name} is disabled, skipping`)
      return
    }

    if (this.servers.has(serverConfig.name)) {
      console.log(`[MCP] Server ${serverConfig.name} already connected`)
      return
    }

    console.log(`[MCP] Connecting to ${serverConfig.name}...`)
    console.log(`[MCP] Command: ${serverConfig.command} ${serverConfig.args.join(' ')}`)

    try {
      // Create transport - SDK now handles process spawning internally
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: {
          ...process.env,
          ...serverConfig.env,
          // Ensure PATH includes common locations
          PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`
        },
        stderr: 'pipe'
      })

      // Handle transport errors
      transport.onerror = (error) => {
        console.error(`[MCP] Transport error for ${serverConfig.name}:`, error)
      }

      // Create client
      const client = new Client(
        {
          name: 'arborchat',
          version: '1.0.0'
        },
        {
          capabilities: {}
        }
      )

      // Connect to the server (this starts the process)
      await client.connect(transport)
      console.log(`[MCP] Connected to ${serverConfig.name}`)

      // Discover available tools
      const toolsResponse = await client.listTools()
      const tools: ToolDefinition[] = toolsResponse.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as ToolDefinition['inputSchema']
      }))

      console.log(
        `[MCP] ${serverConfig.name} provides ${tools.length} tools:`,
        tools.map((t) => t.name)
      )

      // Store the connected server
      this.servers.set(serverConfig.name, {
        config: serverConfig,
        transport,
        client,
        tools,
        connected: true
      })
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${serverConfig.name}:`, error)
      throw error
    }
  }

  /**
   * Connect to all enabled servers in config
   */
  async connectAllServers(): Promise<void> {
    const results = await Promise.allSettled(
      this.config.servers.filter((s) => s.enabled).map((server) => this.connectServer(server))
    )

    const failed = results.filter((r) => r.status === 'rejected')
    if (failed.length > 0) {
      console.warn(`[MCP] ${failed.length} server(s) failed to connect`)
    }
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    const server = this.servers.get(serverName)
    if (!server) {
      throw new Error(`Server ${serverName} not connected`)
    }

    if (!server.connected) {
      throw new Error(`Server ${serverName} is disconnected`)
    }

    console.log(`[MCP] Calling ${serverName}:${toolName} with args:`, args)

    const startTime = Date.now()

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args
      })

      const duration = Date.now() - startTime
      console.log(`[MCP] ${toolName} completed in ${duration}ms`)

      // Extract content from result
      if (result.content && Array.isArray(result.content)) {
        // MCP returns content as an array of content blocks
        const textContent = result.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)
          .join('\n')

        return textContent || result.content
      }

      return result
    } catch (error) {
      console.error(`[MCP] Tool ${toolName} failed:`, error)
      throw error
    }
  }

  /**
   * Get all available tools from all connected servers
   */
  getAvailableTools(): Array<ToolDefinition & { server: string }> {
    const allTools: Array<ToolDefinition & { server: string }> = []

    for (const [serverName, server] of this.servers) {
      if (server.connected) {
        for (const tool of server.tools) {
          allTools.push({
            ...tool,
            server: serverName
          })
        }
      }
    }

    return allTools
  }

  /**
   * Get tools from a specific server
   */
  getServerTools(serverName: string): ToolDefinition[] {
    const server = this.servers.get(serverName)
    return server?.tools || []
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(serverName: string): boolean {
    const server = this.servers.get(serverName)
    return server?.connected || false
  }

  /**
   * Get connection status for all servers
   */
  getConnectionStatus(): Record<string, boolean> {
    const status: Record<string, boolean> = {}
    for (const [name, server] of this.servers) {
      status[name] = server.connected
    }
    return status
  }

  /**
   * Disconnect from a specific server
   */
  async disconnectServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName)
    if (!server) return

    console.log(`[MCP] Disconnecting from ${serverName}...`)

    try {
      await server.client.close()
    } catch (error) {
      console.warn(`[MCP] Error closing client for ${serverName}:`, error)
    }

    try {
      await server.transport.close()
    } catch (error) {
      console.warn(`[MCP] Error closing transport for ${serverName}:`, error)
    }

    server.connected = false
    this.servers.delete(serverName)
    console.log(`[MCP] Disconnected from ${serverName}`)
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    console.log('[MCP] Disconnecting from all servers...')

    const disconnectPromises = Array.from(this.servers.keys()).map((name) =>
      this.disconnectServer(name)
    )

    await Promise.allSettled(disconnectPromises)
    this.servers.clear()
    console.log('[MCP] All servers disconnected')
  }

  /**
   * Reconnect to a server
   */
  async reconnectServer(serverName: string): Promise<void> {
    const serverConfig = this.config.servers.find((s) => s.name === serverName)
    if (!serverConfig) {
      throw new Error(`Server ${serverName} not found in config`)
    }

    await this.disconnectServer(serverName)
    await this.connectServer(serverConfig)
  }
}

// Export singleton instance
export const mcpManager = new MCPManager()
