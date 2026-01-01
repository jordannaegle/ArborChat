/**
 * SessionList Component
 * 
 * Displays a list of resumable sessions (paused or crashed).
 * Used within SessionResumeDialog to allow users to select a session to resume.
 * 
 * @module components/workJournal/SessionList
 */

import { useState, useEffect } from 'react'
import { Clock, AlertTriangle, Pause, ChevronRight, Loader2 } from 'lucide-react'

// Replicate types for isolation (matches preload)
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

interface SessionListProps {
  onSelectSession: (session: WorkSession) => void
  selectedSessionId?: string | null
}

export function SessionList({ onSelectSession, selectedSessionId }: SessionListProps) {
  const [sessions, setSessions] = useState<WorkSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const resumable = await window.api.workJournal.getResumableSessions()
      setSessions(resumable)
    } catch (err) {
      console.error('[SessionList] Failed to load sessions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paused':
        return <Pause className="w-4 h-4 text-amber-500" />
      case 'crashed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return `${diffDays}d ago`
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8 text-zinc-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        <span>Loading sessions...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-red-400 text-center">
        <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
        <p>{error}</p>
        <button
          onClick={loadSessions}
          className="mt-2 text-sm text-zinc-400 hover:text-zinc-200 underline"
        >
          Retry
        </button>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="p-6 text-zinc-500 text-center">
        <Pause className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="font-medium">No interrupted sessions</p>
        <p className="text-sm mt-1 text-zinc-600">
          Sessions appear here when paused or crashed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => (
        <button
          key={session.id}
          onClick={() => onSelectSession(session)}
          className={`
            w-full p-3 rounded-lg border text-left transition-colors
            ${
              selectedSessionId === session.id
                ? 'border-violet-500 bg-violet-500/10'
                : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50'
            }
          `}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {getStatusIcon(session.status)}
              <span className="font-medium text-zinc-200 truncate">
                {session.originalPrompt.slice(0, 60)}
                {session.originalPrompt.length > 60 ? '...' : ''}
              </span>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-500 flex-shrink-0 ml-2" />
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTime(session.updatedAt)}
            </span>
            <span>{session.entryCount} entries</span>
            <span>~{Math.round(session.tokenEstimate / 1000)}k tokens</span>
          </div>
        </button>
      ))}
    </div>
  )
}

export default SessionList
