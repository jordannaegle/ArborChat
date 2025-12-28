// src/renderer/src/components/agent/AgentIndicator.tsx

import { useState } from 'react'
import { Bot, ChevronUp, ChevronDown, Loader2, CheckCircle2, AlertCircle, Pause, Clock, XCircle } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Agent, AgentStatus } from '../../types/agent'

interface AgentIndicatorProps {
  agents: Agent[]
  onSelectAgent: (agentId: string) => void
  activeAgentId?: string
}

// Mini status icon
function MiniStatusIcon({ status }: { status: AgentStatus }) {
  switch (status) {
    case 'running':
      return <Loader2 size={10} className="animate-spin text-emerald-400" />
    case 'created':
      return <Clock size={10} className="text-zinc-400" />
    case 'completed':
      return <CheckCircle2 size={10} className="text-green-400" />
    case 'waiting':
      return <AlertCircle size={10} className="text-amber-400" />
    case 'paused':
      return <Pause size={10} className="text-gray-400" />
    case 'failed':
      return <XCircle size={10} className="text-red-400" />
    default:
      return null
  }
}

export function AgentIndicator({ agents, onSelectAgent, activeAgentId }: AgentIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (agents.length === 0) return null

  const workingCount = agents.filter(a => a.status === 'running').length
  const needsAttention = agents.filter(a => a.status === 'waiting').length
  const hasActive = workingCount > 0 || needsAttention > 0

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {/* Expanded List */}
      {isExpanded && (
        <div className={cn(
          'w-72 bg-tertiary/95 backdrop-blur-xl rounded-xl',
          'border border-violet-500/20 shadow-2xl shadow-black/30',
          'animate-in slide-in-from-bottom-2 fade-in duration-200',
          'overflow-hidden'
        )}>
          <div className="p-3 border-b border-secondary/50">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bot size={16} className="text-violet-400" />
              Active Agents ({agents.length})
            </h3>
          </div>
          
          <div className="max-h-64 overflow-y-auto">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  onSelectAgent(agent.id)
                  setIsExpanded(false)
                }}
                className={cn(
                  'w-full p-3 flex items-center gap-3 text-left',
                  'hover:bg-secondary/50 transition-colors',
                  'border-b border-secondary/30 last:border-0',
                  activeAgentId === agent.id && 'bg-violet-500/10'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Bot size={14} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-normal truncate">
                      {agent.config.name}
                    </span>
                    <MiniStatusIcon status={agent.status} />
                  </div>
                  <span className="text-[10px] text-text-muted">
                    {agent.stepsCompleted} steps • {agent.status}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Indicator Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'group flex items-center gap-2 px-4 py-2.5 rounded-full',
          'bg-tertiary/90 backdrop-blur-lg',
          'border transition-all duration-200',
          hasActive
            ? 'border-violet-500/40 shadow-lg shadow-violet-500/20 hover:border-violet-500/60'
            : 'border-secondary/50 hover:border-violet-500/30',
          'hover:bg-tertiary'
        )}
      >
        <div className={cn(
          'w-6 h-6 rounded-full flex items-center justify-center',
          hasActive
            ? 'bg-gradient-to-br from-violet-500 to-purple-600'
            : 'bg-secondary/80'
        )}>
          <Bot size={14} className={hasActive ? 'text-white' : 'text-text-muted'} />
        </div>

        <span className="text-sm font-medium text-text-normal">
          {agents.length} Agent{agents.length !== 1 ? 's' : ''}
        </span>

        {workingCount > 0 && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <Loader2 size={12} className="animate-spin" />
            {workingCount} running
          </span>
        )}

        {needsAttention > 0 && (
          <span className="flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle size={12} />
            {needsAttention} waiting
          </span>
        )}

        {isExpanded ? (
          <ChevronDown size={16} className="text-text-muted" />
        ) : (
          <ChevronUp size={16} className="text-text-muted" />
        )}
      </button>
    </div>
  )
}
