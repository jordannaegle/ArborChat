import { useState, useEffect } from 'react'
import { 
  X, 
  Server, 
  Check, 
  AlertCircle,
  Trash2,
  RefreshCw,
  User,
  Lock,
  FileKey,
  FolderOpen,
  Plus,
  Edit2,
  Power,
  PowerOff,
  ChevronLeft
} from 'lucide-react'
import { cn } from '../../../lib/utils'

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

interface SSHConfigModalProps {
  onClose: () => void
  onSave: () => void
}

type ViewMode = 'list' | 'add' | 'edit'

export function SSHConfigModal({ onClose, onSave }: SSHConfigModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [connections, setConnections] = useState<SSHConnection[]>([])
  const [connectionStatus, setConnectionStatus] = useState<SSHConnectionStatus[]>([])
  const [editingConnection, setEditingConnection] = useState<SSHConnection | null>(null)
  
  // Form state
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<'password' | 'key'>('key')
  const [password, setPassword] = useState('')
  const [keyPath, setKeyPath] = useState('')
  
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    loadConnections()
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewMode !== 'list') {
          handleBack()
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, viewMode])

  const loadConnections = async () => {
    setCheckingStatus(true)
    try {
      const [conns, status] = await Promise.all([
        window.api.mcp.ssh.listConnections(),
        window.api.mcp.ssh.getStatus()
      ])
      setConnections(conns)
      setConnectionStatus(status.connections)
    } catch (error) {
      console.error('Failed to load SSH connections:', error)
    } finally {
      setCheckingStatus(false)
    }
  }

  const resetForm = () => {
    setName('')
    setHost('')
    setPort('22')
    setUsername('')
    setAuthType('key')
    setPassword('')
    setKeyPath('')
    setError(null)
    setSuccess(null)
  }

  const handleBack = () => {
    setViewMode('list')
    setEditingConnection(null)
    resetForm()
  }

  const handleAddNew = () => {
    resetForm()
    setViewMode('add')
  }

  const handleEdit = (connection: SSHConnection) => {
    setEditingConnection(connection)
    setName(connection.name)
    setHost(connection.host)
    setPort(String(connection.port))
    setUsername(connection.username)
    setAuthType(connection.authType)
    setPassword(connection.password || '')
    setKeyPath(connection.keyPath || '')
    setError(null)
    setSuccess(null)
    setViewMode('edit')
  }

  const handleSelectKeyFile = async () => {
    try {
      const path = await window.api.selectDirectory()
      if (path) {
        setKeyPath(path)
      }
    } catch (err) {
      console.error('Failed to select key file:', err)
    }
  }

  const validateForm = (): boolean => {
    if (!name.trim()) {
      setError('Connection name is required')
      return false
    }
    if (!host.trim()) {
      setError('Host is required')
      return false
    }
    if (!username.trim()) {
      setError('Username is required')
      return false
    }
    if (authType === 'password' && !password.trim()) {
      setError('Password is required')
      return false
    }
    if (authType === 'key' && !keyPath.trim()) {
      setError('SSH key path is required')
      return false
    }
    return true
  }

  const handleSave = async () => {
    if (!validateForm()) return

    setLoading(true)
    setError(null)

    try {
      const connectionData = {
        name: name.trim(),
        host: host.trim(),
        port: parseInt(port, 10) || 22,
        username: username.trim(),
        authType,
        password: authType === 'password' ? password : undefined,
        keyPath: authType === 'key' ? keyPath.trim() : undefined,
        enabled: true
      }

      let result
      if (viewMode === 'edit' && editingConnection) {
        result = await window.api.mcp.ssh.updateConnection(editingConnection.id, connectionData)
      } else {
        result = await window.api.mcp.ssh.addConnection(connectionData)
      }

      if (result.success) {
        setSuccess(viewMode === 'edit' ? 'Connection updated!' : 'Connection added!')
        await loadConnections()
        setTimeout(() => {
          handleBack()
          onSave()
        }, 1000)
      } else {
        setError(result.error || 'Failed to save connection')
      }
    } catch (err) {
      setError('Failed to save SSH connection')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (connection: SSHConnection) => {
    if (!confirm(`Delete SSH connection "${connection.name}"?`)) return

    try {
      const result = await window.api.mcp.ssh.deleteConnection(connection.id)
      if (result.success) {
        await loadConnections()
      } else {
        setError(result.error || 'Failed to delete connection')
      }
    } catch (err) {
      setError('Failed to delete connection')
    }
  }

  const handleToggleConnection = async (connection: SSHConnection, status: SSHConnectionStatus) => {
    try {
      if (status.isConnected) {
        await window.api.mcp.ssh.disconnectConnection(connection.id)
      } else {
        await window.api.mcp.ssh.connect(connection.id)
      }
      await loadConnections()
      onSave() // Refresh tools
    } catch (err) {
      console.error('Failed to toggle connection:', err)
    }
  }

  const getConnectionStatus = (id: string): SSHConnectionStatus | undefined => {
    return connectionStatus.find(s => s.id === id)
  }

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div 
        className={cn(
          "relative w-full max-w-lg",
          "bg-background rounded-xl border border-secondary",
          "shadow-2xl shadow-black/50",
          "animate-scale-in",
          "max-h-[90vh] overflow-y-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <div className="flex items-center gap-3">
            {viewMode !== 'list' && (
              <button
                onClick={handleBack}
                className="p-1.5 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Server size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {viewMode === 'list' && 'SSH Connections'}
                {viewMode === 'add' && 'Add SSH Connection'}
                {viewMode === 'edit' && 'Edit SSH Connection'}
              </h2>
              <p className="text-xs text-text-muted">
                {viewMode === 'list' && 'Manage remote server connections'}
                {viewMode === 'add' && 'Configure a new SSH server'}
                {viewMode === 'edit' && `Editing: ${editingConnection?.name}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Loading State */}
          {checkingStatus && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-text-muted" size={24} />
            </div>
          )}

          {!checkingStatus && (
            <>
              {/* Success Banner */}
              {success && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Check className="text-green-400" size={18} />
                  <span className="text-sm text-green-400">{success}</span>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="text-red-400" size={18} />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}

              {/* List View */}
              {viewMode === 'list' && (
                <>
                  {/* Connection List */}
                  {connections.length > 0 ? (
                    <div className="space-y-2">
                      {connections.map(conn => {
                        const status = getConnectionStatus(conn.id)
                        return (
                          <div 
                            key={conn.id}
                            className="p-3 bg-secondary/30 rounded-xl border border-secondary/50"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className={cn(
                                  "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                                  status?.isConnected 
                                    ? "bg-green-500/20" 
                                    : "bg-secondary"
                                )}>
                                  <Server size={18} className={
                                    status?.isConnected ? "text-green-400" : "text-text-muted"
                                  } />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-white truncate">
                                      {conn.name}
                                    </span>
                                    {status?.isConnected && (
                                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full flex-shrink-0">
                                        <Check size={10} />
                                        Connected
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-text-muted font-mono truncate">
                                    {conn.username}@{conn.host}:{conn.port}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                <button
                                  onClick={() => handleToggleConnection(conn, status!)}
                                  className={cn(
                                    "p-2 rounded-lg transition-colors",
                                    status?.isConnected
                                      ? "text-green-400 hover:text-red-400 hover:bg-red-400/10"
                                      : "text-text-muted hover:text-green-400 hover:bg-green-400/10"
                                  )}
                                  title={status?.isConnected ? 'Disconnect' : 'Connect'}
                                >
                                  {status?.isConnected ? <Power size={16} /> : <PowerOff size={16} />}
                                </button>
                                <button
                                  onClick={() => handleEdit(conn)}
                                  className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(conn)}
                                  className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Server className="mx-auto text-text-muted mb-3" size={32} />
                      <p className="text-text-muted text-sm">
                        No SSH connections configured
                      </p>
                      <p className="text-text-muted/60 text-xs mt-1">
                        Add a connection to enable remote server access
                      </p>
                    </div>
                  )}

                  {/* Add New Button */}
                  <button
                    onClick={handleAddNew}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 p-3 rounded-lg",
                      "border border-dashed border-secondary hover:border-primary/50",
                      "text-text-muted hover:text-white",
                      "transition-colors"
                    )}
                  >
                    <Plus size={16} />
                    Add SSH Connection
                  </button>

                  {/* Info Note */}
                  <div className="p-3 bg-tertiary/50 rounded-lg border border-tertiary text-sm">
                    <p className="text-text-muted">
                      <span className="text-cyan-400">💡 Tip:</span> Connection names (like DEV, PROD) 
                      are visible to the AI. Say "connect to PROD" to use a specific connection.
                    </p>
                  </div>
                </>
              )}

              {/* Add/Edit Form */}
              {(viewMode === 'add' || viewMode === 'edit') && (
                <div className="space-y-4">
                  {/* Connection Name */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">
                      Connection Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="DEV, PROD, Staging, etc."
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg",
                        "bg-tertiary border border-gray-700",
                        "text-white placeholder-text-muted/50 text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      )}
                    />
                    <p className="text-xs text-text-muted">
                      This name will be visible to the AI when selecting connections
                    </p>
                  </div>

                  {/* Host and Port */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 space-y-2">
                      <label className="text-sm font-medium text-text-muted">
                        Host
                      </label>
                      <input
                        type="text"
                        value={host}
                        onChange={(e) => setHost(e.target.value)}
                        placeholder="192.168.1.100 or server.example.com"
                        className={cn(
                          "w-full px-3 py-2.5 rounded-lg",
                          "bg-tertiary border border-gray-700",
                          "text-white placeholder-text-muted/50 font-mono text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-muted">
                        Port
                      </label>
                      <input
                        type="text"
                        value={port}
                        onChange={(e) => setPort(e.target.value)}
                        placeholder="22"
                        className={cn(
                          "w-full px-3 py-2.5 rounded-lg",
                          "bg-tertiary border border-gray-700",
                          "text-white placeholder-text-muted/50 font-mono text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        )}
                      />
                    </div>
                  </div>

                  {/* Username */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">
                      Username
                    </label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="root"
                        className={cn(
                          "w-full pl-10 pr-3 py-2.5 rounded-lg",
                          "bg-tertiary border border-gray-700",
                          "text-white placeholder-text-muted/50 font-mono text-sm",
                          "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                        )}
                      />
                    </div>
                  </div>

                  {/* Auth Type Toggle */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">
                      Authentication Method
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAuthType('key')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                          authType === 'key'
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-secondary/30 border-secondary text-text-muted hover:text-white"
                        )}
                      >
                        <FileKey size={18} />
                        SSH Key
                      </button>
                      <button
                        onClick={() => setAuthType('password')}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-all",
                          authType === 'password'
                            ? "bg-primary/20 border-primary text-primary"
                            : "bg-secondary/30 border-secondary text-text-muted hover:text-white"
                        )}
                      >
                        <Lock size={18} />
                        Password
                      </button>
                    </div>
                  </div>

                  {/* Password Input */}
                  {authType === 'password' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-muted">
                        Password
                      </label>
                      <div className="relative">
                        <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter password"
                          className={cn(
                            "w-full pl-10 pr-3 py-2.5 rounded-lg",
                            "bg-tertiary border border-gray-700",
                            "text-white placeholder-text-muted/50 text-sm",
                            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {/* SSH Key Path Input */}
                  {authType === 'key' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-text-muted">
                        SSH Private Key Path
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <FileKey size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                          <input
                            type="text"
                            value={keyPath}
                            onChange={(e) => setKeyPath(e.target.value)}
                            placeholder="~/.ssh/id_rsa"
                            className={cn(
                              "w-full pl-10 pr-3 py-2.5 rounded-lg",
                              "bg-tertiary border border-gray-700",
                              "text-white placeholder-text-muted/50 font-mono text-sm",
                              "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                            )}
                          />
                        </div>
                        <button
                          onClick={handleSelectKeyFile}
                          className={cn(
                            "px-3 py-2.5 rounded-lg",
                            "bg-secondary hover:bg-secondary/80",
                            "text-text-muted hover:text-white",
                            "transition-colors"
                          )}
                          title="Browse for key file"
                        >
                          <FolderOpen size={18} />
                        </button>
                      </div>
                      <p className="text-xs text-text-muted">
                        Common locations: ~/.ssh/id_rsa, ~/.ssh/id_ed25519
                      </p>
                    </div>
                  )}

                  {/* Security Note */}
                  <div className="p-3 bg-tertiary/50 rounded-lg border border-tertiary text-sm">
                    <p className="text-text-muted">
                      <span className="text-yellow-400">⚠️ Security:</span> Credentials are stored 
                      locally using your system's secure storage. SSH key authentication is recommended.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-secondary">
          <button
            onClick={viewMode === 'list' ? onClose : handleBack}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
          >
            {viewMode === 'list' ? 'Done' : 'Cancel'}
          </button>
          {(viewMode === 'add' || viewMode === 'edit') && (
            <button
              onClick={handleSave}
              disabled={!name.trim() || !host.trim() || !username.trim() || loading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
                "bg-cyan-500 hover:bg-cyan-400 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  {viewMode === 'edit' ? 'Updating...' : 'Adding...'}
                </>
              ) : (
                <>
                  <Check size={16} />
                  {viewMode === 'edit' ? 'Update Connection' : 'Add Connection'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
