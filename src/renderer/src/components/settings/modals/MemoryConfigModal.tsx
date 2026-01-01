import { useState, useEffect } from 'react'
import { X, Brain, Trash2, Check, AlertCircle, RefreshCw, Database, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ToggleSwitch } from '../shared/ToggleSwitch'

interface MemoryConfigModalProps {
  onClose: () => void
  onSave: () => void
}

export function MemoryConfigModal({ onClose, onSave }: MemoryConfigModalProps) {
  const [stats, setStats] = useState<{ count: number; size: number } | null>(null)
  const [_detailedStats, setDetailedStats] = useState<{
    totalMemories: number
    byScope: Record<string, number>
    byType: Record<string, number>
    avgConfidence: number
  } | null>(null)
  void _detailedStats // Suppress unused variable warning - planned for future use
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [autoLoadEnabled, setAutoLoadEnabled] = useState(true)

  useEffect(() => {
    loadMemoryStats()
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      const config = await window.api.mcp.getConfig()
      setAutoLoadEnabled(config.memory?.autoLoadOnSessionStart ?? true)
    } catch (error) {
      console.error('Failed to load memory config:', error)
    }
  }

  const loadMemoryStats = async () => {
    try {
      // Use ArborMemory API which queries the actual SQLite database
      const arborStats = await window.api.arborMemory.getStats()
      setDetailedStats(arborStats)
      // Map to legacy format for UI compatibility
      setStats({
        count: arborStats.totalMemories,
        // Estimate size: ~100 bytes per memory on average
        size: arborStats.totalMemories * 100
      })
    } catch (error) {
      console.error('Failed to load memory stats:', error)
      setError('Failed to load memory statistics')
    }
  }

  const handleAutoLoadToggle = async (enabled: boolean) => {
    setAutoLoadEnabled(enabled)
    try {
      await window.api.mcp.updateConfig({
        memory: { autoLoadOnSessionStart: enabled }
      })
      onSave()
    } catch (error) {
      console.error('Failed to update memory config:', error)
      setAutoLoadEnabled(!enabled) // Revert on failure
    }
  }

  const handleClearMemory = async () => {
    setLoading(true)
    setError(null)

    try {
      // Use ArborMemory API to clear all memories
      const result = await window.api.arborMemory.clearAll()
      if (result.success) {
        setSuccess(true)
        setShowClearConfirm(false)
        await loadMemoryStats()
        setTimeout(() => setSuccess(false), 3000)
      } else {
        setError(result.error || 'Failed to clear memory')
      }
    } catch (err) {
      setError('Failed to clear memory')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-background rounded-xl border border-secondary shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Brain size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Memory Configuration</h2>
              <p className="text-xs text-text-muted">Manage persistent AI memory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {success && (
            <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <Check className="text-green-400" size={18} />
              <span className="text-sm text-green-400">Memory cleared successfully!</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <AlertCircle className="text-red-400" size={18} />
              <span className="text-sm text-red-400">{error}</span>
            </div>
          )}

          <div className="p-3 bg-tertiary/50 rounded-lg border border-tertiary text-sm">
            <p className="text-text-muted mb-2">
              The Memory server allows the AI to remember information across conversations.
            </p>
            <p className="text-text-muted">
              <strong className="text-white">Note:</strong> Memory is stored locally on your device.
            </p>
          </div>

          {/* Auto-load Setting */}
          <div className="p-4 bg-secondary/30 rounded-xl border border-secondary/50">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-violet-500/20 text-violet-400">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">Auto-load Memory</h3>
                  <p className="text-xs text-text-muted mt-0.5">
                    Automatically recall stored memories at the start of new conversations
                  </p>
                </div>
              </div>
              <ToggleSwitch
                checked={autoLoadEnabled}
                onChange={handleAutoLoadToggle}
              />
            </div>
          </div>

          <div className="p-4 bg-secondary/30 rounded-xl border border-secondary/50">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/20 text-primary">
                <Database size={20} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-white mb-2">Memory Statistics</h3>
                {stats ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Stored Items:</span>
                      <span className="text-white font-medium">{stats.count}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Storage Size:</span>
                      <span className="text-white font-medium">
                        {stats.size > 0 ? `${(stats.size / 1024).toFixed(2)} KB` : '0 KB'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-text-muted">No statistics available</p>
                )}
              </div>
            </div>
          </div>

          {showClearConfirm ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className="font-medium text-white mb-1">Confirm Memory Deletion</h4>
                  <p className="text-sm text-text-muted">
                    This will permanently delete all stored memories. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 rounded-lg text-text-muted hover:text-white hover:bg-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearMemory}
                  disabled={loading}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium',
                    'bg-red-500 hover:bg-red-600 text-white disabled:opacity-50'
                  )}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      Clearing...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Clear All Memory
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowClearConfirm(true)}
              disabled={!stats || stats.count === 0}
              className={cn(
                'w-full flex items-center justify-center gap-2 p-3 rounded-lg',
                'border border-dashed border-red-500/30 hover:border-red-500/50',
                'text-red-400 hover:text-red-300 hover:bg-red-500/5',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <Trash2 size={16} />
              Clear All Memory
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-secondary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
