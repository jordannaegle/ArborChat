import { useState, useEffect } from 'react'
import { 
  Github, 
  Terminal, 
  Settings, 
  Check, 
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ToggleSwitch } from '../shared/ToggleSwitch'
import { GitHubConfigModal } from '../modals/GitHubConfigModal'

interface MCPServer {
  id: string
  name: string
  displayName: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  enabled: boolean
  connected: boolean
  requiresConfig: boolean
  configured: boolean
  toolCount: number
}

export function ToolsSection() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [configModal, setConfigModal] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState<string | null>(null)
  const [mcpEnabled, setMcpEnabled] = useState(true)

  useEffect(() => {
    loadServerStatus()
  }, [])

  const loadServerStatus = async () => {
    setLoading(true)
    try {
      const [status, githubStatus] = await Promise.all([
        window.api.mcp.getStatus(),
        window.api.mcp.github.getStatus()
      ])

      setMcpEnabled(status.config.enabled)

      const serverList: MCPServer[] = [
        {
          id: 'desktop-commander',
          name: 'desktop-commander',
          displayName: 'Desktop Commander',
          description: 'File system access, terminal commands, process management',
          icon: Terminal,
          enabled: status.config.servers.find(s => s.name === 'desktop-commander')?.enabled ?? false,
          connected: status.connectionStatus['desktop-commander'] ?? false,
          requiresConfig: false,
          configured: true,
          toolCount: 15
        },
        {
          id: 'github',
          name: 'github',
          displayName: 'GitHub',
          description: 'Repository management, issues, pull requests, code search',
          icon: Github,
          enabled: status.config.servers.find(s => s.name === 'github')?.enabled ?? false,
          connected: githubStatus.isConnected,
          requiresConfig: true,
          configured: githubStatus.isConfigured,
          toolCount: githubStatus.toolCount
        }
      ]

      setServers(serverList)
    } catch (error) {
      console.error('Failed to load server status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    const server = servers.find(s => s.id === serverId)
    
    // If enabling a server that requires config but isn't configured
    if (enabled && server?.requiresConfig && !server.configured) {
      setConfigModal(serverId)
      return
    }

    try {
      const config = await window.api.mcp.getConfig()
      const updatedServers = config.servers.map(s => 
        s.name === serverId ? { ...s, enabled } : s
      )
      await window.api.mcp.updateConfig({ servers: updatedServers })
      
      if (enabled) {
        setReconnecting(serverId)
        await window.api.mcp.reconnect()
        setReconnecting(null)
      }

      await loadServerStatus()
    } catch (error) {
      console.error('Failed to toggle server:', error)
      setReconnecting(null)
    }
  }

  const handleToggleMCP = async (enabled: boolean) => {
    try {
      await window.api.mcp.updateConfig({ enabled })
      setMcpEnabled(enabled)
      if (enabled) {
        await window.api.mcp.reconnect()
      }
      await loadServerStatus()
    } catch (error) {
      console.error('Failed to toggle MCP:', error)
    }
  }

  const handleConfigSave = async () => {
    setConfigModal(null)
    await loadServerStatus()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Tools</h2>
        <p className="text-sm text-text-muted mt-1">
          Enable AI tools via MCP servers. Each tool extends the AI's capabilities.
        </p>
      </div>

      {/* Global Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-secondary/50">
        <div>
          <h3 className="font-medium text-white">MCP Tools Enabled</h3>
          <p className="text-xs text-text-muted">Master switch for all tool integrations</p>
        </div>
        <ToggleSwitch
          checked={mcpEnabled}
          onChange={handleToggleMCP}
        />
      </div>

      {/* Server List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Available Servers
        </h3>

        {servers.map((server) => (
          <div
            key={server.id}
            className={cn(
              "p-4 rounded-xl border transition-all",
              !mcpEnabled
                ? "bg-secondary/20 border-secondary/30 opacity-60"
                : server.enabled && server.connected
                ? "bg-green-500/5 border-green-500/20"
                : server.enabled && !server.connected
                ? "bg-yellow-500/5 border-yellow-500/20"
                : "bg-secondary/30 border-secondary/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                  "p-2 rounded-lg",
                  server.enabled && mcpEnabled
                    ? "bg-primary/20 text-primary" 
                    : "bg-secondary text-text-muted"
                )}>
                  <server.icon size={20} />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-white">{server.displayName}</h4>
                    
                    {/* Status Badges */}
                    {mcpEnabled && server.enabled && server.connected && (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                    {mcpEnabled && server.enabled && !server.connected && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                        <AlertCircle size={12} />
                        Disconnected
                      </span>
                    )}
                    {server.requiresConfig && !server.configured && (
                      <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                        <Settings size={12} />
                        Setup Required
                      </span>
                    )}
                    {mcpEnabled && server.enabled && server.toolCount > 0 && (
                      <span className="text-xs text-text-muted bg-secondary px-2 py-0.5 rounded-full">
                        {server.toolCount} tools
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mt-0.5">{server.description}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {server.requiresConfig && (
                  <button
                    onClick={() => setConfigModal(server.id)}
                    disabled={!mcpEnabled}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      !mcpEnabled
                        ? "text-text-muted/50 cursor-not-allowed"
                        : server.configured
                        ? "text-text-muted hover:text-white hover:bg-secondary"
                        : "text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                    )}
                    title={server.configured ? 'Edit configuration' : 'Setup required'}
                  >
                    <Settings size={18} />
                  </button>
                )}

                <ToggleSwitch
                  checked={server.enabled}
                  onChange={(checked) => handleToggleServer(server.id, checked)}
                  disabled={!mcpEnabled || reconnecting === server.id}
                />
              </div>
            </div>

            {/* Reconnecting Indicator */}
            {reconnecting === server.id && (
              <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
                <RefreshCw className="animate-spin" size={14} />
                Connecting...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {configModal === 'github' && (
        <GitHubConfigModal
          onClose={() => setConfigModal(null)}
          onSave={handleConfigSave}
        />
      )}
    </div>
  )
}
