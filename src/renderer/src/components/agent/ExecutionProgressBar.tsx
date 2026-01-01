// src/renderer/src/components/agent/ExecutionProgressBar.tsx
// Phase 2: Agent Execution Monitoring - Progress Visualization
// Author: Alex Chen (Distinguished Software Architect)

import { useEffect, useState } from 'react'
import {
  Cpu,
  Loader2,
  AlertTriangle,
  Clock,
  Zap,
  ShieldCheck,
  HelpCircle
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExecutionPhase, TokenWarningLevel } from '../../types/agent'
import type { WatchdogStatus } from '../../hooks/useAgentWatchdog'
import { formatWatchdogDuration } from '../../hooks/useAgentWatchdog'

/**
 * Execution Phase Display Configuration
 */
interface PhaseConfig {
  label: string
  icon: React.ReactNode
  color: string
  bgColor: string
}

const PHASE_CONFIG: Record<ExecutionPhase, PhaseConfig> = {
  idle: {
    label: 'Idle',
    icon: <Clock size={12} />,
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10'
  },
  streaming_ai: {
    label: 'Generating',
    icon: <Zap size={12} className="animate-pulse" />,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10'
  },
  executing_tool: {
    label: 'Executing Tool',
    icon: <Cpu size={12} className="animate-spin" />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10'
  },
  waiting_approval: {
    label: 'Awaiting Approval',
    icon: <ShieldCheck size={12} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10'
  },
  verifying_completion: {
    label: 'Verifying',
    icon: <Loader2 size={12} className="animate-spin" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10'
  }
}

/**
 * Phase Icon Component
 */
function PhaseIcon({ phase }: { phase: ExecutionPhase }) {
  const config = PHASE_CONFIG[phase]
  return (
    <span className={cn('flex items-center', config.color)}>
      {config.icon}
    </span>
  )
}

/**
 * Token Usage Bar Props
 */
interface TokenUsageBarProps {
  used: number
  max: number
  warningLevel: TokenWarningLevel
}

/**
 * Token Usage Bar - Visual indicator of context window usage
 * Phase 4: Enhanced with more prominent warnings
 */
function TokenUsageBar({ used, max, warningLevel }: TokenUsageBarProps) {
  const percentage = Math.min((used / max) * 100, 100)
  
  const barColor = {
    normal: 'bg-violet-500',
    warning: 'bg-amber-500',
    critical: 'bg-red-500'
  }[warningLevel]
  
  const textColor = {
    normal: 'text-text-muted',
    warning: 'text-amber-400',
    critical: 'text-red-400'
  }[warningLevel]
  
  const bgColor = {
    normal: 'bg-secondary',
    warning: 'bg-amber-500/10',
    critical: 'bg-red-500/10'
  }[warningLevel]

  return (
    <div className={cn('space-y-0.5 p-1.5 rounded', bgColor)}>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all duration-300',
            barColor,
            warningLevel === 'critical' && 'animate-pulse'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className={cn('flex items-center justify-between text-[10px]', textColor)}>
        <span className="font-medium">Context Window</span>
        <span className="tabular-nums">
          {Math.round(used / 1000)}k / {Math.round(max / 1000)}k tokens
          <span className="ml-1">
            ({Math.round(percentage)}%)
          </span>
        </span>
      </div>
      {warningLevel === 'warning' && (
        <div className="text-[10px] text-amber-400 mt-0.5">
          ⚠️ Context window filling up. Older messages may be truncated.
        </div>
      )}
      {warningLevel === 'critical' && (
        <div className="text-[10px] text-red-400 mt-0.5 animate-pulse">
          🚨 Critical: Context nearly full! Auto-truncation active.
        </div>
      )}
    </div>
  )
}

/**
 * Execution Progress Bar Props
 */
export interface ExecutionProgressBarProps {
  /** Current execution phase */
  phase: ExecutionPhase
  /** Human-readable activity description */
  activity: string
  /** Duration of current activity (ms) */
  duration: number
  /** Current tool name (if executing tool) */
  toolName?: string
  /** Token usage metrics */
  tokenUsage?: {
    used: number
    max: number
    warningLevel: TokenWarningLevel
  }
  /** Watchdog status for stall indication */
  watchdogStatus?: WatchdogStatus
  /** Time since last progress (from watchdog) */
  timeSinceProgress?: number
  /** Whether the progress bar is visible */
  visible?: boolean
}

/**
 * ExecutionProgressBar - Real-time agent execution status display
 * 
 * Shows:
 * - Current execution phase with icon
 * - Activity description
 * - Duration of current activity
 * - Token usage bar (optional)
 * - Stall warning indicators
 * 
 * @example
 * ```tsx
 * <ExecutionProgressBar
 *   phase="executing_tool"
 *   activity="Executing read_file..."
 *   duration={15000}
 *   toolName="read_file"
 *   tokenUsage={{ used: 50000, max: 200000, warningLevel: 'normal' }}
 *   watchdogStatus="normal"
 * />
 * ```
 */
export function ExecutionProgressBar({
  phase,
  activity,
  duration,
  toolName,
  tokenUsage,
  watchdogStatus = 'normal',
  timeSinceProgress,
  visible = true
}: ExecutionProgressBarProps) {
  // Live duration counter
  const [liveDuration, setLiveDuration] = useState(duration)
  
  useEffect(() => {
    if (phase === 'idle') {
      setLiveDuration(0)
      return
    }
    
    // Update duration every second
    const intervalId = setInterval(() => {
      setLiveDuration(prev => prev + 1000)
    }, 1000)
    
    // Reset when duration prop changes significantly (new activity)
    if (Math.abs(duration - liveDuration) > 2000) {
      setLiveDuration(duration)
    }
    
    return () => clearInterval(intervalId)
  }, [phase, duration, liveDuration])
  
  if (!visible || phase === 'idle') {
    return null
  }

  const phaseConfig = PHASE_CONFIG[phase]
  const isWarning = watchdogStatus === 'warning'
  const isStalled = watchdogStatus === 'stalled'

  return (
    <div 
      className={cn(
        'px-3 py-2 border-t transition-colors duration-300',
        isStalled 
          ? 'bg-red-500/10 border-red-500/30' 
          : isWarning 
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-violet-500/5 border-violet-500/10'
      )}
    >
      {/* Phase and Activity */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Phase icon with background */}
          <div className={cn(
            'flex items-center justify-center w-5 h-5 rounded',
            phaseConfig.bgColor
          )}>
            <PhaseIcon phase={phase} />
          </div>
          
          {/* Activity text */}
          <div className="flex flex-col min-w-0">
            <span className={cn(
              'text-xs font-medium truncate',
              isStalled ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-text-normal'
            )}>
              {activity}
            </span>
            {toolName && (
              <span className="text-[10px] text-text-muted truncate">
                Tool: {toolName}
              </span>
            )}
          </div>
        </div>
        
        {/* Duration and status */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Duration */}
          <span className={cn(
            'text-xs tabular-nums',
            isStalled ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-text-muted/70'
          )}>
            {formatWatchdogDuration(liveDuration)}
          </span>
          
          {/* Stall warning indicator */}
          {isWarning && !isStalled && (
            <div className="flex items-center gap-1 text-amber-400 animate-pulse">
              <AlertTriangle size={12} />
              <span className="text-[10px]">Taking longer than expected</span>
            </div>
          )}
          
          {isStalled && (
            <div className="flex items-center gap-1 text-red-400 animate-pulse">
              <AlertTriangle size={12} />
              <span className="text-[10px]">May be stalled</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Token usage bar */}
      {tokenUsage && (
        <div className="mt-2">
          <TokenUsageBar
            used={tokenUsage.used}
            max={tokenUsage.max}
            warningLevel={tokenUsage.warningLevel}
          />
        </div>
      )}
      
      {/* Extended stall info */}
      {isStalled && timeSinceProgress && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-red-400/80">
          <HelpCircle size={10} />
          <span>
            No progress for {formatWatchdogDuration(timeSinceProgress)}. 
            Consider using recovery actions in diagnostics.
          </span>
        </div>
      )}
    </div>
  )
}

export default ExecutionProgressBar
