// src/renderer/src/components/agent/AgentListItem.tsx

import { X, Bot, AlertCircle, Loader2, CheckCircle2, Pause, Clock, XCircle, RotateCcw } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { AgentSummary, AgentStatus } from '../../types/agent'

interface AgentListItemProps {
  agent: AgentSummary
  isActive: boolean
  onClick: () => void
  onClose: (e: React.MouseEvent) => void
  onRetry?: (e: React.MouseEvent) => void
}

// Status icon configuration - compact version for list display
const statusIcons: Record<AgentStatus, {
  icon: React.ReactNode
  color: string
  bgColor: string
  pulse?: boolean
}> = {
  created: {
    icon: <Clock size={12} />,
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500/20'
  },
  running: {
    icon: <Loader2 size={12} className="animate-spin" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    pulse: true
  },
  waiting: {
    icon: <AlertCircle size={12} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20'
  },
  paused: {
    icon: <Pause size={12} />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20'
  },
  completed: {
    icon: <CheckCircle2 size={12} />,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20'
  },
  failed: {
    icon: <XCircle size={12} />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20'
  }
}

export function AgentListItem({ agent, isActive, onClick, onClose, onRetry }: AgentListItemProps) {
  const statusConfig = statusIcons[agent.status]
  const showAttentionBadge = agent.pendingApprovals > 0 || agent.status === 'waiting'
  const showRetry = agent.status === 'failed' && onRetry

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 p-2 rounded-lg cursor-pointer',
        'transition-all duration-150',
        isActive
          ? 'bg-primary/20 text-text-normal ring-1 ring-primary/30'
          : 'text-text-muted hover:text-text-normal hover:bg-secondary/40'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      aria-selected={isActive}
    >
      {/* Status icon with background */}
      <div
        className={cn(
          'shrink-0 p-1.5 rounded-md transition-colors duration-150',
          statusConfig.bgColor,
          statusConfig.color
        )}
      >
        {statusConfig.icon}
      </div>

      {/* Agent name - truncated */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Bot size={12} className="shrink-0 opacity-50" />
          <span className="truncate text-sm font-medium">
            {agent.name}
          </span>
        </div>
        {/* Steps completed indicator */}
        <div className="text-[10px] text-text-muted opacity-70">
          {agent.stepsCompleted} step{agent.stepsCompleted !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Attention badge for pending approvals */}
      {showAttentionBadge && (
        <div className="shrink-0 relative">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-black">
            {agent.pendingApprovals > 0 ? agent.pendingApprovals : '!'}
          </span>
          {/* Pulse effect for attention */}
          <span className="absolute inset-0 animate-ping rounded-full bg-amber-500 opacity-40" />
        </div>
      )}

      {/* Retry button for failed agents */}
      {showRetry && (
        <button
          onClick={onRetry}
          className={cn(
            'shrink-0 p-1 rounded-md',
            'text-text-muted hover:text-amber-400 hover:bg-amber-400/10',
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-amber-400/30'
          )}
          aria-label={`Retry agent ${agent.name}`}
          title="Retry agent"
        >
          <RotateCcw size={14} />
        </button>
      )}

      {/* Close button - visible on hover */}
      <button
        onClick={onClose}
        className={cn(
          'shrink-0 p-1 rounded-md',
          'text-text-muted hover:text-red-400 hover:bg-red-400/10',
          'opacity-0 group-hover:opacity-100 focus:opacity-100',
          'transition-all duration-150',
          'focus:outline-none focus:ring-2 focus:ring-red-400/30'
        )}
        aria-label={`Close agent ${agent.name}`}
      >
        <X size={14} />
      </button>
    </div>
  )
}

export default AgentListItem
