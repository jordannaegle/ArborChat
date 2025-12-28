// src/renderer/src/components/agent/AgentStatusBadge.tsx

import React from 'react'
import { Loader2, AlertCircle, Pause, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { AgentStatus } from '../../types/agent'

interface AgentStatusBadgeProps {
  status: AgentStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const statusConfig: Record<AgentStatus, {
  label: string
  color: string
  bgColor: string
  icon: React.ReactNode
  pulse?: boolean
}> = {
  created: {
    label: 'Ready',
    color: 'text-zinc-400',
    bgColor: 'bg-zinc-500',
    icon: <Clock size={12} />
  },
  running: {
    label: 'Running',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500',
    icon: <Loader2 size={12} className="animate-spin" />,
    pulse: true
  },
  waiting: {
    label: 'Waiting',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500',
    icon: <AlertCircle size={12} />
  },
  paused: {
    label: 'Paused',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500',
    icon: <Pause size={12} />
  },
  completed: {
    label: 'Completed',
    color: 'text-green-400',
    bgColor: 'bg-green-500',
    icon: <CheckCircle2 size={12} />
  },
  failed: {
    label: 'Failed',
    color: 'text-red-400',
    bgColor: 'bg-red-500',
    icon: <XCircle size={12} />
  }
}

export function AgentStatusBadge({ 
  status, 
  size = 'md',
  showLabel = true 
}: AgentStatusBadgeProps) {
  const config = statusConfig[status]

  const sizeClasses = {
    sm: 'text-[10px] gap-1',
    md: 'text-xs gap-1.5',
    lg: 'text-sm gap-2'
  }

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5'
  }

  return (
    <div className={cn(
      'flex items-center',
      sizeClasses[size],
      config.color
    )}>
      {/* Pulsing dot indicator */}
      <span className="relative flex">
        {config.pulse && (
          <span className={cn(
            'animate-ping absolute inline-flex rounded-full opacity-75',
            config.bgColor,
            dotSizes[size]
          )} />
        )}
        <span className={cn(
          'relative inline-flex rounded-full',
          config.bgColor,
          dotSizes[size]
        )} />
      </span>
      
      {showLabel && (
        <span className="font-medium">{config.label}</span>
      )}
    </div>
  )
}

// Compact badge version for lists
export function AgentStatusIcon({ status }: { status: AgentStatus }) {
  const config = statusConfig[status]
  
  return (
    <div className={cn('flex items-center', config.color)}>
      {config.icon}
    </div>
  )
}

export default AgentStatusBadge
