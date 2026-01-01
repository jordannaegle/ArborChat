// src/renderer/src/components/agent/AgentStatusBadge.tsx
// Phase 3: Enhanced Agent Status Badge with Execution Phase Support
// Author: Alex Chen (Distinguished Software Architect)

import React from 'react'
import {
  Loader2,
  AlertCircle,
  Pause,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Cpu,
  ShieldCheck,
  CheckSquare
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { AgentStatus, ExecutionPhase } from '../../types/agent'

interface AgentStatusBadgeProps {
  status: AgentStatus
  /** Optional execution phase for granular display when running */
  executionPhase?: ExecutionPhase | null
  /** Current tool name (shown when executing) */
  currentToolName?: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  /** Whether there's a pending tool awaiting approval */
  hasPendingTool?: boolean
}

/**
 * Base agent status configuration
 */
const statusConfig: Record<
  AgentStatus,
  {
    label: string
    color: string
    bgColor: string
    icon: React.ReactNode
    pulse?: boolean
  }
> = {
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

/**
 * Execution phase configuration for enhanced display
 */
const phaseConfig: Record<
  ExecutionPhase,
  {
    label: string
    color: string
    bgColor: string
    borderColor: string
    icon: React.ReactNode
    pulse?: boolean
  }
> = {
  idle: {
    label: 'Idle',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/20',
    borderColor: 'border-gray-500/30',
    icon: <Clock size={12} />
  },
  streaming_ai: {
    label: 'Generating',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/20',
    borderColor: 'border-violet-500/30',
    icon: <Zap size={12} className="animate-pulse" />,
    pulse: true
  },
  executing_tool: {
    label: 'Executing',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/30',
    icon: <Cpu size={12} className="animate-spin" />,
    pulse: true
  },
  waiting_approval: {
    label: 'Needs Approval',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20',
    borderColor: 'border-orange-500/30',
    icon: <ShieldCheck size={12} />,
    pulse: true
  },
  verifying_completion: {
    label: 'Verifying',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/30',
    icon: <CheckSquare size={12} className="animate-pulse" />
  }
}

/**
 * AgentStatusBadge - Enhanced status display with execution phase support
 * 
 * When the agent is running, this component can optionally show the current
 * execution phase (streaming_ai, executing_tool, etc.) for more granular
 * visibility into what the agent is actually doing.
 * 
 * @example
 * ```tsx
 * // Basic usage (existing behavior)
 * <AgentStatusBadge status="running" />
 * 
 * // With execution phase (Phase 3 enhancement)
 * <AgentStatusBadge 
 *   status="running" 
 *   executionPhase="executing_tool"
 *   currentToolName="read_file"
 * />
 * ```
 */
export function AgentStatusBadge({
  status,
  executionPhase,
  currentToolName,
  size = 'md',
  showLabel = true,
  hasPendingTool
}: AgentStatusBadgeProps) {
  // When running with an execution phase, use phase-specific display
  const usePhaseDisplay = status === 'running' && executionPhase && executionPhase !== 'idle'

  const sizeClasses = {
    sm: 'text-[10px] gap-1 px-1.5 py-0.5',
    md: 'text-xs gap-1.5 px-2 py-1',
    lg: 'text-sm gap-2 px-2.5 py-1.5'
  }

  const dotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2.5 w-2.5'
  }

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14
  }

  // Get appropriate configuration
  if (usePhaseDisplay && executionPhase) {
    const phase = phaseConfig[executionPhase]
    
    // Build label with optional tool name
    let label = phase.label
    if (executionPhase === 'executing_tool' && currentToolName) {
      // Truncate long tool names
      const truncatedTool = currentToolName.length > 12 
        ? currentToolName.slice(0, 10) + '...' 
        : currentToolName
      label = `${truncatedTool}`
    }
    
    return (
      <div
        className={cn(
          'flex items-center rounded-full font-medium border transition-colors',
          phase.bgColor,
          phase.borderColor,
          phase.color,
          sizeClasses[size]
        )}
      >
        {/* Phase-specific icon */}
        <span className="flex items-center">
          {React.cloneElement(phase.icon as React.ReactElement<{ size?: number }>, { 
            size: iconSizes[size] 
          })}
        </span>
        
        {showLabel && <span>{label}</span>}
        
        {/* Pulsing indicator for active phases */}
        {phase.pulse && (
          <span className="relative flex ml-1">
            <span
              className={cn(
                'animate-ping absolute inline-flex rounded-full opacity-75',
                executionPhase === 'streaming_ai' ? 'bg-violet-500' :
                executionPhase === 'executing_tool' ? 'bg-blue-500' :
                executionPhase === 'waiting_approval' ? 'bg-orange-500' :
                'bg-emerald-500',
                dotSizes[size]
              )}
            />
            <span
              className={cn(
                'relative inline-flex rounded-full',
                executionPhase === 'streaming_ai' ? 'bg-violet-500' :
                executionPhase === 'executing_tool' ? 'bg-blue-500' :
                executionPhase === 'waiting_approval' ? 'bg-orange-500' :
                'bg-emerald-500',
                dotSizes[size]
              )}
            />
          </span>
        )}
      </div>
    )
  }

  // Default status display (existing behavior)
  const config = statusConfig[status]
  
  // Adjust waiting label if there's a pending tool
  const displayLabel = status === 'waiting' && hasPendingTool 
    ? 'Needs Approval' 
    : config.label

  return (
    <div className={cn('flex items-center', sizeClasses[size], config.color)}>
      {/* Pulsing dot indicator */}
      <span className="relative flex">
        {config.pulse && (
          <span
            className={cn(
              'animate-ping absolute inline-flex rounded-full opacity-75',
              config.bgColor,
              dotSizes[size]
            )}
          />
        )}
        <span 
          className={cn(
            'relative inline-flex rounded-full', 
            config.bgColor, 
            dotSizes[size]
          )} 
        />
      </span>

      {showLabel && <span className="font-medium">{displayLabel}</span>}
    </div>
  )
}

/**
 * Compact badge version for lists (unchanged from original)
 */
export function AgentStatusIcon({ status }: { status: AgentStatus }) {
  const config = statusConfig[status]

  return (
    <div className={cn('flex items-center', config.color)}>
      {config.icon}
    </div>
  )
}

/**
 * Detailed status badge with border - for prominent display
 */
export function AgentStatusBadgeBordered({
  status,
  executionPhase,
  currentToolName,
  hasPendingTool
}: Omit<AgentStatusBadgeProps, 'size' | 'showLabel'>) {
  // When running with an execution phase, use phase-specific display
  const usePhaseDisplay = status === 'running' && executionPhase && executionPhase !== 'idle'
  
  if (usePhaseDisplay && executionPhase) {
    const phase = phaseConfig[executionPhase]
    
    // Build label with optional tool name
    let label = phase.label
    if (executionPhase === 'executing_tool' && currentToolName) {
      const truncatedTool = currentToolName.length > 15 
        ? currentToolName.slice(0, 13) + '...' 
        : currentToolName
      label = `Executing: ${truncatedTool}`
    }
    
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border',
          phase.bgColor,
          phase.borderColor,
          phase.color
        )}
      >
        {phase.icon}
        <span>{label}</span>
      </div>
    )
  }

  // Default: use existing bordered style
  const config = statusConfig[status]
  
  // Adjust waiting display
  const displayLabel = status === 'waiting' && hasPendingTool 
    ? 'Needs Approval' 
    : config.label
  
  const borderColor = status === 'waiting' && hasPendingTool
    ? 'border-orange-500/30'
    : `border-current/30`

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border',
        config.color,
        borderColor,
        status === 'waiting' && hasPendingTool && 'animate-pulse bg-orange-500/10'
      )}
    >
      {config.icon}
      <span>{displayLabel}</span>
    </div>
  )
}

export default AgentStatusBadge
