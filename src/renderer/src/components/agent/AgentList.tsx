// src/renderer/src/components/agent/AgentList.tsx

import { Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { cn } from '../../lib/utils'
import type { AgentSummary } from '../../types/agent'
import { AgentListItem } from './AgentListItem'

interface AgentListProps {
  agents: AgentSummary[]
  activeAgentId: string | null
  onSelectAgent: (id: string) => void
  onCloseAgent: (id: string) => void
  onRetryAgent?: (id: string) => void
}

export function AgentList({ 
  agents, 
  activeAgentId, 
  onSelectAgent, 
  onCloseAgent,
  onRetryAgent
}: AgentListProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Count agents needing attention
  const attentionCount = agents.filter(
    a => a.pendingApprovals > 0 || a.status === 'waiting'
  ).length

  // Count running agents
  const runningCount = agents.filter(
    a => a.status === 'running'
  ).length

  // Don't render if no agents
  if (agents.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'flex items-center justify-between px-2 py-1.5 mb-1',
          'text-text-muted hover:text-text-normal',
          'transition-colors duration-150',
          'focus:outline-none focus:text-text-normal'
        )}
      >
        <div className="flex items-center gap-2">
          {isCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronDown size={14} />
          )}
          <Bot size={14} />
          <span className="text-xs font-semibold uppercase tracking-wider">
            Agents
          </span>
          <span className="text-[10px] text-text-muted">
            ({agents.length})
          </span>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5">
          {runningCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-400">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              {runningCount}
            </span>
          )}
          {attentionCount > 0 && (
            <span className="flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-black">
              {attentionCount}
            </span>
          )}
        </div>
      </button>

      {/* Agent list - collapsible */}
      {!isCollapsed && (
        <div className="space-y-0.5">
          {agents.map((agent) => (
            <AgentListItem
              key={agent.id}
              agent={agent}
              isActive={activeAgentId === agent.id}
              onClick={() => onSelectAgent(agent.id)}
              onClose={(e) => {
                e.stopPropagation()
                onCloseAgent(agent.id)
              }}
              onRetry={onRetryAgent ? (e) => {
                e.stopPropagation()
                onRetryAgent(agent.id)
              } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default AgentList
