import { useState, useEffect } from 'react'
import { 
  X, 
  Github, 
  Key, 
  ExternalLink, 
  Check, 
  AlertCircle,
  Trash2,
  RefreshCw,
  User
} from 'lucide-react'
import { cn } from '../../../lib/utils'

interface GitHubAccount {
  username: string
  tokenCreatedAt?: string
}

interface GitHubConfigModalProps {
  onClose: () => void
  onSave: () => void
}

export function GitHubConfigModal({ onClose, onSave }: GitHubConfigModalProps) {
  const [currentAccount, setCurrentAccount] = useState<GitHubAccount | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)

  useEffect(() => {
    loadCurrentAccount()
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const loadCurrentAccount = async () => {
    setCheckingStatus(true)
    try {
      const status = await window.api.mcp.github.getStatus()
      if (status.isConfigured && status.username) {
        setCurrentAccount({
          username: status.username
        })
      } else {
        setShowTokenInput(true)
      }
    } catch (error) {
      console.error('Failed to load GitHub status:', error)
      setShowTokenInput(true)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleSaveToken = async () => {
    if (!token.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await window.api.mcp.github.configure(token.trim())
      
      if (result.success) {
        setSuccess(true)
        setCurrentAccount({
          username: result.username || 'Unknown'
        })
        setToken('')
        setShowTokenInput(false)
        
        setTimeout(() => {
          onSave()
        }, 1000)
      } else {
        setError(result.error || 'Failed to configure GitHub')
      }
    } catch (err) {
      setError('Failed to connect to GitHub. Please check your token.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await window.api.mcp.github.disconnect()
      setCurrentAccount(null)
      setShowTokenInput(true)
      setSuccess(false)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
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
          "animate-scale-in"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Github size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">GitHub Configuration</h2>
              <p className="text-xs text-text-muted">Connect your GitHub account</p>
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
                  <span className="text-sm text-green-400">
                    GitHub connected successfully!
                  </span>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="text-red-400" size={18} />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}

              {/* Current Account */}
              {currentAccount && (
                <div className="p-4 bg-secondary/30 rounded-xl border border-secondary/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <User size={20} className="text-text-muted" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            @{currentAccount.username}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                            <Check size={10} />
                            Connected
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          Personal Access Token configured
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                        "text-red-400 hover:text-red-300 hover:bg-red-400/10",
                        "text-sm transition-colors"
                      )}
                    >
                      <Trash2 size={14} />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}

              {/* Token Input Section */}
              {(showTokenInput || !currentAccount) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key size={16} className="text-text-muted" />
                    <h3 className="font-medium text-white">
                      {currentAccount ? 'Update' : 'Add'} Personal Access Token
                    </h3>
                  </div>

                  {/* Instructions */}
                  <div className="p-3 bg-tertiary/50 rounded-lg border border-tertiary text-sm space-y-2">
                    <p className="text-text-muted">Create a Personal Access Token with these scopes:</p>
                    <ul className="list-disc list-inside text-text-muted space-y-1 ml-2">
                      <li><code className="text-primary/80">repo</code> - Full repository access</li>
                      <li><code className="text-primary/80">read:org</code> - Read organization data</li>
                      <li><code className="text-primary/80">read:user</code> - Read user profile</li>
                    </ul>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        window.open('https://github.com/settings/tokens/new?scopes=repo,read:org,read:user&description=ArborChat', '_blank')
                      }}
                      className="flex items-center gap-1 text-primary hover:underline mt-2"
                    >
                      Create a new token on GitHub
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Token Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">
                      Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg",
                        "bg-tertiary border border-gray-700",
                        "text-white placeholder-text-muted/50 font-mono text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      )}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && token.trim()) {
                          handleSaveToken()
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Update Token Button (when connected) */}
              {currentAccount && !showTokenInput && (
                <button
                  onClick={() => setShowTokenInput(true)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 p-3 rounded-lg",
                    "border border-dashed border-secondary hover:border-primary/50",
                    "text-text-muted hover:text-white",
                    "transition-colors"
                  )}
                >
                  <RefreshCw size={16} />
                  Update Token
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-secondary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
          >
            {currentAccount && !showTokenInput ? 'Done' : 'Cancel'}
          </button>
          {(showTokenInput || !currentAccount) && !checkingStatus && (
            <button
              onClick={handleSaveToken}
              disabled={!token.trim() || loading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
                "bg-primary hover:bg-primary/90 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Connecting...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Connect GitHub
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
