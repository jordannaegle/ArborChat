// src/renderer/src/components/agent/AgentDiagnosticsPanel.tsx
// Phase 2: Agent Execution Monitoring - Diagnostics & Recovery Panel
// Author: Alex Chen (Distinguished Software Architect)

import { useState } from 'react'
import {
  Activity,
  RotateCcw,
  XCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Timer,
  Gauge,
  TrendingUp
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { ExecutionDiagnostics } from '../../types/agent'
import type { WatchdogState } from '../../hooks/useAgentWatchdog'
import { formatWatchdogDuration } from '../../hooks/useAgentWatchdog'

/**
 * Stat Display Component
 */
interface StatProps {
  label: string
  value: string | number
  icon?: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
}

function Stat({ label, value, icon, variant = 'default' }: StatProps) {
  const variantStyles = {
    default: 'text-text-normal',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    error: 'text-red-400'
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-text-muted flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className={cn('text-sm font-medium tabular-nums', variantStyles[variant])}>
        {value}
      </span>
    </div>
  )
}

/**
 * Recovery Action Button
 */
interface RecoveryButtonProps {
  label: string
  icon: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'warning' | 'danger'
  disabled?: boolean
  title?: string
}

function RecoveryButton({ 
  label, 
  icon, 
  onClick, 
  variant = 'default',
  disabled = false,
  title
}: RecoveryButtonProps) {
  const variantStyles = {
    default: 'text-text-muted hover:text-text-normal hover:bg-secondary',
    warning: 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/10',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/10'
  }

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors',
        variantStyles[variant],
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

/**
 * Agent Diagnostics Panel Props
 */
export interface AgentDiagnosticsPanelProps {
  /** Execution diagnostics from agent runner */
  diagnostics: ExecutionDiagnostics
  /** Watchdog state for stall detection */
  watchdogState?: WatchdogState
  /** Handler for force retry action */
  onForceRetry: () => void
  /** Handler for kill current tool action */
  onKillTool: () => void
  /** Whether a tool is currently executing */
  isToolExecuting: boolean
  /** Whether the agent is running */
  isRunning: boolean
  /** Default collapsed state */
  defaultCollapsed?: boolean
}

/**
 * AgentDiagnosticsPanel - Collapsible panel for execution diagnostics and recovery
 * 
 * Displays:
 * - Loop iteration count
 * - Total runtime
 * - Tool call statistics (total, successful, failed)
 * - Average tool duration
 * - Recovery actions (force retry, kill tool)
 * 
 * Recovery actions:
 * - Force Retry: Restarts the current iteration from scratch
 * - Kill Tool: Terminates the currently executing tool (if any)
 * 
 * @example
 * ```tsx
 * <AgentDiagnosticsPanel
 *   diagnostics={runnerState.diagnostics}
 *   watchdogState={watchdogState}
 *   onForceRetry={handleForceRetry}
 *   onKillTool={handleKillTool}
 *   isToolExecuting={runnerState.execution?.phase === 'executing_tool'}
 *   isRunning={runnerState.isRunning}
 * />
 * ```
 */
export function AgentDiagnosticsPanel({
  diagnostics,
  watchdogState,
  onForceRetry,
  onKillTool,
  isToolExecuting,
  isRunning,
  defaultCollapsed = true
}: AgentDiagnosticsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)

  // Calculate success rate
  const successRate = diagnostics.toolCallsTotal > 0
    ? Math.round((diagnostics.toolCallsSuccessful / diagnostics.toolCallsTotal) * 100)
    : 100

  // Determine success rate variant
  const successRateVariant = 
    successRate >= 90 ? 'success' :
    successRate >= 70 ? 'warning' : 'error'

  // Whether we're in a stalled state
  const isStalled = watchdogState?.status === 'stalled'
  const isWarning = watchdogState?.status === 'warning'

  return (
    <div className={cn(
      'border rounded-lg transition-colors',
      isStalled 
        ? 'border-red-500/30 bg-red-500/5' 
        : isWarning
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-tertiary bg-secondary/30'
    )}>
      {/* Collapsible Trigger */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2',
          'text-xs text-text-muted hover:text-text-normal',
          'transition-colors rounded-lg'
        )}
      >
        <div className="flex items-center gap-1.5">
          <Activity size={12} className={cn(
            isStalled ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-violet-400'
          )} />
          <span className="font-medium">Diagnostics</span>
          {isStalled && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-500/20 text-red-400">
              Stalled
            </span>
          )}
          {isWarning && !isStalled && (
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400">
              Slow
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="px-3 pb-3 space-y-3">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Loop Iterations"
              value={diagnostics.loopIterations}
              icon={<TrendingUp size={10} />}
            />
            <Stat
              label="Total Runtime"
              value={formatWatchdogDuration(diagnostics.totalRuntime)}
              icon={<Timer size={10} />}
            />
            <Stat
              label="Tool Calls"
              value={`${diagnostics.toolCallsSuccessful}/${diagnostics.toolCallsTotal}`}
              icon={<Cpu size={10} />}
              variant={diagnostics.toolCallsFailed > 0 ? 'warning' : 'default'}
            />
            <Stat
              label="Success Rate"
              value={`${successRate}%`}
              icon={
                successRate >= 90 ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />
              }
              variant={successRateVariant}
            />
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-tertiary/50">
            <Stat
              label="Avg Tool Duration"
              value={formatWatchdogDuration(diagnostics.averageToolDuration)}
              icon={<Clock size={10} />}
            />
            {watchdogState?.currentTool && (
              <Stat
                label="Current Tool"
                value={watchdogState.currentTool}
                icon={<Gauge size={10} />}
                variant={watchdogState.toolTimeoutImminent ? 'warning' : 'default'}
              />
            )}
          </div>

          {/* Current Tool Duration (if executing) */}
          {watchdogState?.currentTool && watchdogState.currentToolDuration > 0 && (
            <div className={cn(
              'p-2 rounded-md text-xs',
              watchdogState.toolTimeoutImminent 
                ? 'bg-amber-500/10 text-amber-400'
                : 'bg-secondary text-text-muted'
            )}>
              <span className="font-medium">{watchdogState.currentTool}</span>
              <span className="ml-2">
                running for {formatWatchdogDuration(watchdogState.currentToolDuration)}
              </span>
              {watchdogState.toolTimeoutImminent && (
                <span className="ml-2 text-amber-400">
                  (timeout approaching)
                </span>
              )}
            </div>
          )}

          {/* Recovery Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-tertiary/50">
            <RecoveryButton
              label="Force Retry"
              icon={<RotateCcw size={12} />}
              onClick={onForceRetry}
              variant={isStalled || isWarning ? 'warning' : 'default'}
              disabled={!isRunning}
              title={isRunning 
                ? 'Restart the current iteration' 
                : 'Agent must be running to retry'
              }
            />
            <RecoveryButton
              label="Kill Tool"
              icon={<XCircle size={12} />}
              onClick={onKillTool}
              variant="danger"
              disabled={!isToolExecuting}
              title={isToolExecuting 
                ? 'Terminate the currently executing tool' 
                : 'No tool currently executing'
              }
            />
          </div>

          {/* Stall Recovery Hint */}
          {isStalled && (
            <div className="p-2 rounded-md bg-red-500/10 border border-red-500/20 text-xs text-red-400">
              <strong>Recovery Suggestion:</strong> The agent appears to be stalled. 
              Try "Kill Tool" if a tool is stuck, or "Force Retry" to restart the current iteration.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AgentDiagnosticsPanel
