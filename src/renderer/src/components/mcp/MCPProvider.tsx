// src/renderer/src/components/mcp/MCPProvider.tsx

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import type {
  MCPToolDefinition,
  MCPApprovalRequest,
  MCPToolResult,
  MCPConfig
} from '../../../../preload/index.d'

interface MCPContextValue {
  // State
  initialized: boolean
  connected: boolean
  tools: MCPToolDefinition[]
  pendingApprovals: MCPApprovalRequest[]
  config: MCPConfig | null
  error: string | null
  systemPrompt: string

  // Actions
  initialize: () => Promise<void>
  reconnect: () => Promise<void>
  getSystemPrompt: () => Promise<string>
  requestTool: (
    toolName: string,
    args: Record<string, unknown>,
    explanation?: string,
    skipApproval?: boolean
  ) => Promise<MCPToolResult>
  approve: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<MCPToolResult>
  alwaysApprove: (id: string, modifiedArgs?: Record<string, unknown>) => Promise<MCPToolResult>
  reject: (id: string) => Promise<void>
  updateConfig: (updates: Partial<MCPConfig>) => Promise<void>
}

const MCPContext = createContext<MCPContextValue | null>(null)

export function useMCP() {
  const context = useContext(MCPContext)
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider')
  }
  return context
}

interface MCPProviderProps {
  children: ReactNode
  autoInit?: boolean
}

export function MCPProvider({ children, autoInit = true }: MCPProviderProps) {
  const [initialized, setInitialized] = useState(false)
  const [connected, setConnected] = useState(false)
  const [tools, setTools] = useState<MCPToolDefinition[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<MCPApprovalRequest[]>([])
  const [config, setConfig] = useState<MCPConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [systemPrompt, setSystemPrompt] = useState<string>('')

  // Initialize MCP
  const initialize = useCallback(async () => {
    try {
      console.log('[MCP Provider] Initializing...')
      setError(null)

      const result = await window.api.mcp.init()

      if (result.success) {
        setTools(result.tools || [])
        setConnected(Object.values(result.connectionStatus || {}).some(Boolean))
        setInitialized(true)
        console.log('[MCP Provider] Initialized with', result.tools?.length, 'tools')

        // Load config
        const configResult = await window.api.mcp.getConfig()
        setConfig(configResult)

        // Load system prompt
        const prompt = await window.api.mcp.getSystemPrompt()
        setSystemPrompt(prompt)
      } else {
        setError(result.error || 'Failed to initialize MCP')
        console.error('[MCP Provider] Init failed:', result.error)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
      console.error('[MCP Provider] Init error:', err)
    }
  }, [])

  // Reconnect to servers
  const reconnect = useCallback(async () => {
    try {
      setError(null)
      const result = await window.api.mcp.reconnect()
      setTools(result.tools || [])
      setConnected(Object.values(result.connectionStatus || {}).some(Boolean))

      // Reload system prompt
      const prompt = await window.api.mcp.getSystemPrompt()
      setSystemPrompt(prompt)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(message)
    }
  }, [])

  // Get system prompt (refreshes from server)
  const getSystemPrompt = useCallback(async (): Promise<string> => {
    const prompt = await window.api.mcp.getSystemPrompt()
    setSystemPrompt(prompt)
    return prompt
  }, [])

  // Request tool execution
  const requestTool = useCallback(
    async (
      toolName: string,
      args: Record<string, unknown>,
      explanation?: string,
      skipApproval?: boolean
    ): Promise<MCPToolResult> => {
      // Find the server for this tool
      const tool = tools.find((t) => t.name === toolName)
      const serverName = tool?.server || 'desktop-commander'

      return window.api.mcp.requestTool(serverName, toolName, args, explanation, skipApproval)
    },
    [tools]
  )

  // Approve pending tool
  const approve = useCallback(
    async (id: string, modifiedArgs?: Record<string, unknown>): Promise<MCPToolResult> => {
      const result = await window.api.mcp.approve(id, modifiedArgs)
      // Remove from pending
      setPendingApprovals((prev) => prev.filter((p) => p.id !== id))
      return result
    },
    []
  )

  // Always approve pending tool (adds to always-approve list)
  const alwaysApprove = useCallback(
    async (id: string, modifiedArgs?: Record<string, unknown>): Promise<MCPToolResult> => {
      const result = await window.api.mcp.alwaysApprove(id, modifiedArgs)
      // Remove from pending
      setPendingApprovals((prev) => prev.filter((p) => p.id !== id))
      return result
    },
    []
  )

  // Reject pending tool
  const reject = useCallback(async (id: string): Promise<void> => {
    await window.api.mcp.reject(id)
    setPendingApprovals((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Update config
  const updateConfig = useCallback(async (updates: Partial<MCPConfig>): Promise<void> => {
    const updated = await window.api.mcp.updateConfig(updates)
    setConfig(updated)
  }, [])

  // Setup event listeners
  useEffect(() => {
    const cleanupApproval = window.api.mcp.onApprovalRequired((data) => {
      console.log('[MCP Provider] Approval required:', data)
      setPendingApprovals((prev) => [...prev, data])
    })

    const cleanupCompleted = window.api.mcp.onToolCompleted((data) => {
      console.log('[MCP Provider] Tool completed:', data)
      // Remove from pending if it was there
      setPendingApprovals((prev) => prev.filter((p) => p.id !== data.id))
    })

    const cleanupRejected = window.api.mcp.onToolRejected((data) => {
      console.log('[MCP Provider] Tool rejected:', data)
      setPendingApprovals((prev) => prev.filter((p) => p.id !== data.id))
    })

    const cleanupConfigUpdated = window.api.mcp.onConfigUpdated((updatedConfig) => {
      console.log('[MCP Provider] Config updated:', updatedConfig)
      setConfig(updatedConfig)
    })

    return () => {
      cleanupApproval()
      cleanupCompleted()
      cleanupRejected()
      cleanupConfigUpdated()
    }
  }, [])

  // Auto-initialize on mount
  useEffect(() => {
    if (autoInit && !initialized) {
      initialize()
    }
  }, [autoInit, initialized, initialize])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.api.mcp.removeAllListeners()
    }
  }, [])

  const value: MCPContextValue = {
    initialized,
    connected,
    tools,
    pendingApprovals,
    config,
    error,
    systemPrompt,
    initialize,
    reconnect,
    getSystemPrompt,
    requestTool,
    approve,
    alwaysApprove,
    reject,
    updateConfig
  }

  return <MCPContext.Provider value={value}>{children}</MCPContext.Provider>
}

export default MCPProvider
