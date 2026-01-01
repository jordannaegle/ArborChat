// src/renderer/src/components/agent/AgentStepTimeline.tsx
// Agent execution timeline with optional enhanced tool display
// Phase 5.4: Integrates ToolStepGroup for consistent UX with ChatWindow

import { useState, useMemo } from 'react'
import {
  Brain,
  Wrench,
  CheckCircle,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
  Loader2,
  Timer
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { AgentStep, Agent } from '../../types/agent'
import { useSettings } from '../../contexts/SettingsContext'
import { ToolStepGroup } from '../mcp'
import { groupAgentStepsForDisplay } from '../../lib/agentStepAdapter'

interface AgentStepTimelineProps {
  steps: AgentStep[]
  currentStepId?: string
  isExpanded?: boolean
  onToggleExpand?: () => void
  className?: string
  /** Optional pending tool call from agent */
  pendingToolCall?: Agent['pendingToolCall']
  /** Tool approval callbacks */
  onToolApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onToolAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  onToolReject?: (id: string) => void
}

// Step type configuration with icons, colors, and labels
const STEP_CONFIG = {
  thinking: {
    icon: Brain,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Thinking'
  },
  tool_call: {
    icon: Wrench,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    label: 'Tool Call'
  },
  tool_result: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    label: 'Result'
  },
  message: {
    icon: MessageSquare,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    label: 'Message'
  },
  error: {
    icon: AlertCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: 'Error'
  }
} as const

// Tool status indicator configuration
const TOOL_STATUS_CONFIG = {
  pending: {
    icon: Loader2,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    label: 'Pending',
    animate: true
  },
  approved: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    label: 'Approved',
    animate: false
  },
  denied: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Denied',
    animate: false
  },
  completed: {
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    label: 'Completed',
    animate: false
  },
  failed: {
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    label: 'Failed',
    animate: false
  }
} as const

// Format duration between timestamps
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

// Format timestamp for display
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  })
}

// Tool status badge component
function ToolStatusBadge({ status }: { status: keyof typeof TOOL_STATUS_CONFIG }) {
  const config = TOOL_STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div className={cn(
      'flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium',
      config.bgColor,
      config.color
    )}>
      <Icon size={10} className={config.animate ? 'animate-spin' : ''} />
      <span>{config.label}</span>
    </div>
  )
}

// Tool call details component
function ToolCallDetails({ toolCall }: { toolCall: NonNullable<AgentStep['toolCall']> }) {
  return (
    <div className="mt-2 space-y-2">
      {toolCall.args && Object.keys(toolCall.args).length > 0 && (
        <div className={cn(
          'rounded-md p-2 text-[10px] font-mono',
          'bg-secondary/50 border border-tertiary/50'
        )}>
          <div className="text-text-muted mb-1 font-sans font-medium">Arguments:</div>
          <pre className="text-text-normal whitespace-pre-wrap break-all overflow-x-auto">
            {JSON.stringify(toolCall.args, null, 2)}
          </pre>
        </div>
      )}

      {toolCall.result !== undefined && (
        <div className={cn(
          'rounded-md p-2 text-[10px] font-mono',
          'bg-emerald-500/10 border border-emerald-500/20'
        )}>
          <div className="text-emerald-400 mb-1 font-sans font-medium">Result:</div>
          <pre className="text-text-normal whitespace-pre-wrap break-all overflow-x-auto max-h-32 overflow-y-auto">
            {typeof toolCall.result === 'string' 
              ? toolCall.result 
              : JSON.stringify(toolCall.result, null, 2)}
          </pre>
        </div>
      )}

      {toolCall.error && (
        <div className={cn(
          'rounded-md p-2 text-[10px] font-mono',
          'bg-red-500/10 border border-red-500/20'
        )}>
          <div className="text-red-400 mb-1 font-sans font-medium">Error:</div>
          <pre className="text-red-300 whitespace-pre-wrap break-all">
            {toolCall.error}
          </pre>
        </div>
      )}
    </div>
  )
}

// Individual step item component (legacy display)
function StepItem({ 
  step, 
  isLast,
  isCurrent,
  durationToNext 
}: { 
  step: AgentStep
  isLast: boolean
  isCurrent: boolean
  durationToNext?: number
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const config = STEP_CONFIG[step.type]
  const Icon = config.icon
  
  const hasDetails = step.content.length > 80 || 
                    (step.toolCall && (step.toolCall.args || step.toolCall.result))

  const previewContent = step.content.length > 80 
    ? step.content.slice(0, 80) + '...' 
    : step.content

  return (
    <div className="relative">
      {!isLast && (
        <div 
          className={cn(
            'absolute left-3.5 top-7 w-0.5 -bottom-1',
            isCurrent ? 'bg-violet-500/40' : 'bg-tertiary'
          )}
        />
      )}
      
      <div className={cn(
        'relative flex items-start gap-3 p-2 rounded-lg transition-all duration-150',
        isCurrent && 'bg-violet-500/10 ring-1 ring-violet-500/30',
        !isCurrent && 'hover:bg-secondary/30'
      )}>
        <div className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
          'ring-1 ring-offset-1 ring-offset-background',
          config.bgColor,
          config.borderColor.replace('border-', 'ring-'),
          isCurrent && 'animate-pulse'
        )}>
          <Icon size={14} className={config.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-xs font-medium', config.color)}>
              {config.label}
            </span>
            
            {step.toolCall && (
              <ToolStatusBadge status={step.toolCall.status} />
            )}
            
            <span className="text-[10px] text-text-muted ml-auto flex items-center gap-1">
              <Clock size={10} />
              {formatTimestamp(step.timestamp)}
            </span>
          </div>

          {step.toolCall && (
            <div className="mt-1 text-[11px] text-text-muted font-mono">
              {step.toolCall.name}
            </div>
          )}

          {step.content && (
            <p className="mt-1 text-xs text-text-muted leading-relaxed">
              {isExpanded ? step.content : previewContent}
            </p>
          )}

          {hasDetails && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'mt-1.5 flex items-center gap-1 text-[10px] font-medium',
                'text-text-muted hover:text-text-normal transition-colors'
              )}
            >
              {isExpanded ? (
                <>
                  <ChevronDown size={12} />
                  <span>Hide details</span>
                </>
              ) : (
                <>
                  <ChevronRight size={12} />
                  <span>Show details</span>
                </>
              )}
            </button>
          )}

          {isExpanded && step.toolCall && (
            <ToolCallDetails toolCall={step.toolCall} />
          )}
        </div>
      </div>

      {durationToNext !== undefined && !isLast && (
        <div className="flex items-center gap-1 ml-10 py-0.5 text-[9px] text-text-muted">
          <Timer size={9} />
          <span>{formatDuration(durationToNext)}</span>
        </div>
      )}
    </div>
  )
}

// Message step display (for non-tool message steps in enhanced mode)
function MessageStepDisplay({ step }: { step: AgentStep }) {
  const config = STEP_CONFIG[step.type]
  const Icon = config.icon

  return (
    <div className={cn(
      'flex items-start gap-3 p-2 rounded-lg',
      config.bgColor,
      'border',
      config.borderColor
    )}>
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
        config.bgColor
      )}>
        <Icon size={12} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <span className={cn('text-xs font-medium', config.color)}>
          {config.label}
        </span>
        <p className="mt-1 text-xs text-text-normal leading-relaxed">
          {step.content}
        </p>
      </div>
    </div>
  )
}

// Main timeline component
export function AgentStepTimeline({
  steps,
  currentStepId,
  isExpanded: externalIsExpanded,
  onToggleExpand,
  className,
  pendingToolCall,
  onToolApprove,
  onToolAlwaysApprove,
  onToolReject
}: AgentStepTimelineProps) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(true)
  const { settings } = useSettings()
  
  const isExpanded = externalIsExpanded ?? internalIsExpanded
  const handleToggle = onToggleExpand ?? (() => setInternalIsExpanded(!internalIsExpanded))

  // Group steps for enhanced display
  const groupedDisplay = useMemo(() => {
    if (!settings.enhancedToolDisplay) return null
    return groupAgentStepsForDisplay(steps, pendingToolCall)
  }, [steps, pendingToolCall, settings.enhancedToolDisplay])

  // Calculate durations for legacy display
  const stepsWithDurations = useMemo(() => {
    return steps.map((step, index) => {
      const nextStep = steps[index + 1]
      const durationToNext = nextStep 
        ? nextStep.timestamp - step.timestamp 
        : undefined
      return { step, durationToNext }
    })
  }, [steps])

  // Summary stats
  const stats = useMemo(() => {
    const toolCalls = steps.filter(s => s.type === 'tool_call').length
    const errors = steps.filter(s => s.type === 'error').length
    const totalDuration = steps.length > 1 
      ? steps[steps.length - 1].timestamp - steps[0].timestamp 
      : 0
    return { toolCalls, errors, totalDuration }
  }, [steps])

  if (steps.length === 0 && !pendingToolCall) {
    return null
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header with toggle */}
      <button
        onClick={handleToggle}
        className={cn(
          'flex items-center justify-between p-2 rounded-lg',
          'bg-secondary/30 hover:bg-secondary/50 transition-colors',
          'text-xs text-text-muted'
        )}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <span className="font-medium">Execution Timeline</span>
          <span className="text-[10px]">
            ({steps.length}{pendingToolCall ? '+1 pending' : ''} steps)
          </span>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-3 text-[10px]">
          {stats.toolCalls > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Wrench size={10} />
              {stats.toolCalls}
            </span>
          )}
          {stats.errors > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle size={10} />
              {stats.errors}
            </span>
          )}
          {stats.totalDuration > 0 && (
            <span className="flex items-center gap-1 text-text-muted">
              <Timer size={10} />
              {formatDuration(stats.totalDuration)}
            </span>
          )}
        </div>
      </button>

      {/* Expanded timeline */}
      {isExpanded && (
        <div className={cn(
          'mt-2 space-y-2',
          'animate-in slide-in-from-top-2 duration-200'
        )}>
          {/* Enhanced display with ToolStepGroup */}
          {settings.enhancedToolDisplay && groupedDisplay ? (
            groupedDisplay.map((item, index) => {
              if (item.type === 'step_group' && item.steps && item.groupId) {
                return (
                  <ToolStepGroup
                    key={item.groupId}
                    groupId={item.groupId}
                    steps={item.steps}
                    initialVisible={true}
                    onApprove={onToolApprove}
                    onAlwaysApprove={onToolAlwaysApprove}
                    onReject={onToolReject}
                  />
                )
              } else if (item.type === 'message' && item.agentStep) {
                return (
                  <MessageStepDisplay 
                    key={item.agentStep.id} 
                    step={item.agentStep} 
                  />
                )
              } else if (item.type === 'other' && item.agentStep) {
                return (
                  <StepItem
                    key={item.agentStep.id}
                    step={item.agentStep}
                    isLast={index === groupedDisplay.length - 1}
                    isCurrent={item.agentStep.id === currentStepId}
                  />
                )
              }
              return null
            })
          ) : (
            /* Legacy display */
            <div className="pl-1 space-y-0.5">
              {stepsWithDurations.map(({ step, durationToNext }, index) => (
                <StepItem
                  key={step.id}
                  step={step}
                  isLast={index === steps.length - 1 && !pendingToolCall}
                  isCurrent={step.id === currentStepId}
                  durationToNext={durationToNext}
                />
              ))}
              {/* Legacy pending tool call indicator */}
              {pendingToolCall && (
                <div className="relative">
                  <div className="absolute left-3.5 top-0 h-3 w-0.5 bg-amber-500/40" />
                  <div className={cn(
                    'flex items-start gap-3 p-2 rounded-lg',
                    'bg-amber-500/10 ring-1 ring-amber-500/30'
                  )}>
                    <div className={cn(
                      'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
                      'bg-amber-500/10 ring-1 ring-amber-500/30 animate-pulse'
                    )}>
                      <Loader2 size={14} className="text-amber-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-amber-400">
                          Pending Approval
                        </span>
                        <ToolStatusBadge status="pending" />
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted font-mono">
                        {pendingToolCall.tool}
                      </div>
                      {pendingToolCall.explanation && (
                        <p className="mt-1 text-xs text-text-muted">
                          {pendingToolCall.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AgentStepTimeline
