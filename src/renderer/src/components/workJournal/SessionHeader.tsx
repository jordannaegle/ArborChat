/**
 * SessionHeader Component
 * 
 * Displays session summary information including status, original prompt,
 * entry count, and token estimate. Used in WorkJournalPanel.
 * 
 * @module components/workJournal/SessionHeader
 */

import { Activity, Pause, CheckCircle, AlertTriangle, Hash, Coins } from 'lucide-react'

// Replicate types for isolation
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

interface SessionHeaderProps {
  session: WorkSession
}

export function SessionHeader({ session }: SessionHeaderProps) {
  const getStatusBadge = () => {
    const badges = {
      active: {
        icon: Activity,
        color: 'text-green-400 bg-green-400/10 border-green-400/30',
        label: 'Active'
      },
      paused: {
        icon: Pause,
        color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
        label: 'Paused'
      },
      completed: {
        icon: CheckCircle,
        color: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
        label: 'Completed'
      },
      crashed: {
        icon: AlertTriangle,
        color: 'text-red-400 bg-red-400/10 border-red-400/30',
        label: 'Crashed'
      }
    }
    const badge = badges[session.status] || badges.active
    const Icon = badge.icon

    return (
      <span
        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${badge.color}`}
      >
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    )
  }

  const formatDuration = () => {
    const start = session.createdAt
    const end = session.completedAt || Date.now()
    const durationMs = end - start
    const minutes = Math.floor(durationMs / 60000)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="p-3 border-b border-zinc-800 bg-zinc-800/30">
      {/* Prompt and Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm text-zinc-300 line-clamp-2 flex-1">{session.originalPrompt}</p>
        {getStatusBadge()}
      </div>

      {/* Stats Row */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          {session.entryCount} entries
        </span>
        <span className="flex items-center gap-1">
          <Coins className="w-3 h-3" />
          ~{Math.round(session.tokenEstimate / 1000)}k tokens
        </span>
        <span className="ml-auto">{formatDuration()}</span>
      </div>
    </div>
  )
}

export default SessionHeader
