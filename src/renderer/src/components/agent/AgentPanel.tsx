// src/renderer/src/components/agent/AgentPanel.tsx

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  X, Bot, Send, Pause, Play,
  Sparkles, User, Minimize2, RotateCcw, Square
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { ModelSelector } from '../ModelSelector'
import { InlineToolCall, ToolStepGroup } from '../mcp'
import type { ToolCallStatus } from '../mcp'
import { AgentStepTimeline } from './AgentStepTimeline'
import { ExecutionProgressBar } from './ExecutionProgressBar'
import { AgentDiagnosticsPanel } from './AgentDiagnosticsPanel'
import { AgentStatusBadgeBordered } from './AgentStatusBadge'
import type { 
  Agent, 
  AgentMessage, 
  AgentStep,
  ExecutionPhase,
  TokenWarningLevel,
  ExecutionDiagnostics
} from '../../types/agent'
import type { WatchdogState } from '../../hooks'
import { useSettings } from '../../contexts/SettingsContext'
import { ResizablePanel } from '../shared'
import {
  agentStepToToolStep,
  agentPendingToolToStep,
  type AgentToolStepGroupData
} from '../../lib/agentStepAdapter'

// Timeline item types for unified agent rendering
type AgentTimelineItem =
  | { type: 'message'; data: AgentMessage; isStreaming: boolean }
  | { type: 'tool_step'; data: AgentStep }
  | { type: 'tool_step_group'; data: AgentToolStepGroupData }  // Enhanced grouped display
  | { type: 'pending_tool'; data: NonNullable<Agent['pendingToolCall']> }
  | { type: 'streaming_message'; content: string }
  | { type: 'working_indicator' }

interface AgentPanelProps {
  agent: Agent
  isStreaming: boolean
  streamingContent: string
  selectedModel: string
  onModelChange: (modelId: string) => void
  onSendMessage: (content: string) => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
  onRetry?: () => void
  canRetry?: boolean
  isRetrying?: boolean
  onClose: () => void
  onMinimize: () => void
  onToolApprove: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onToolAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  onToolReject: (id: string) => void
  // Phase 2: Execution monitoring props
  execution?: {
    phase: ExecutionPhase
    currentActivity: string
    activityStartedAt: number
    lastProgressAt: number
    currentToolName?: string
    currentToolDuration?: number
  } | null
  tokens?: {
    contextUsed: number
    contextMax: number
    usagePercent: number
    warningLevel: TokenWarningLevel
  } | null
  diagnostics?: ExecutionDiagnostics
  watchdogState?: WatchdogState
  onForceRetry?: () => void
  onKillTool?: () => void
}

// Message bubble for agent messages
function AgentMessageBubble({ 
  role, 
  content, 
  isStreaming 
}: { 
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean 
}) {
  const isAssistant = role === 'assistant'

  return (
    <div className={cn(
      'group flex gap-2 px-3 py-1.5 rounded-lg transition-colors',
      'hover:bg-secondary/20',
      !isAssistant && 'flex-row-reverse'
    )}>
      {/* Avatar */}
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center shrink-0',
        'ring-1 ring-offset-1 ring-offset-background',
        isAssistant
          ? 'bg-gradient-to-br from-violet-500 to-purple-600 ring-violet-500/30'
          : 'bg-gradient-to-br from-emerald-500 to-teal-600 ring-emerald-500/30'
      )}>
        {isAssistant ? (
          <Bot size={14} className="text-white" />
        ) : (
          <User size={14} className="text-white" />
        )}
      </div>

      {/* Content */}
      <div className={cn(
        'flex flex-col gap-0.5 min-w-0 max-w-[85%]',
        !isAssistant && 'items-end'
      )}>
        <span className={cn(
          'text-[10px] font-medium',
          isAssistant ? 'text-violet-400' : 'text-emerald-400'
        )}>
          {isAssistant ? 'Agent' : 'You'}
        </span>
        <div className={cn(
          'relative rounded-xl px-3 py-2 text-xs leading-relaxed',
          !isAssistant
            ? 'bg-primary text-white rounded-tr-sm'
            : 'bg-secondary/50 text-text-normal rounded-tl-sm border border-tertiary/50'
        )}>
          <p className="whitespace-pre-wrap break-words">{content}</p>
          {isStreaming && isAssistant && (
            <span className="inline-block w-1.5 h-3 bg-violet-500/70 ml-1 animate-pulse rounded-sm" />
          )}
        </div>
      </div>
    </div>
  )
}


export function AgentPanel({
  agent,
  isStreaming,
  streamingContent,
  selectedModel,
  onModelChange,
  onSendMessage,
  onPause,
  onResume,
  onStop,
  onRetry,
  canRetry = false,
  isRetrying = false,
  onClose,
  onMinimize,
  onToolApprove,
  onToolAlwaysApprove,
  onToolReject,
  // Phase 2: Execution monitoring props
  execution,
  tokens,
  diagnostics,
  watchdogState,
  onForceRetry,
  onKillTool
}: AgentPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Settings context for enhanced tool display preference
  const { settings } = useSettings()
  const useEnhancedToolDisplay = settings.enhancedToolDisplay

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [agent.messages, streamingContent])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return
    onSendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Derive state from status
  const hasPendingTool = agent.pendingToolCall != null
  const canSendMessage = agent.status === 'waiting' && !hasPendingTool || 
                         agent.status === 'completed' || 
                         agent.status === 'failed'
  const isPaused = agent.status === 'paused'
  const isWorking = agent.status === 'running' || isStreaming

  // Build unified timeline that interleaves messages and tool calls
  const timeline = useMemo((): AgentTimelineItem[] => {
    const items: AgentTimelineItem[] = []
    const toolSteps = agent.steps.filter((s) => s.type === 'tool_call' && s.toolCall)
    let toolStepIndex = 0
    
    // Group ID counter for enhanced display
    let groupIdCounter = 0
    const generateGroupId = () => `agent-timeline-group-${Date.now()}-${++groupIdCounter}`
    
    // Interleave messages with tool steps based on timestamps
    for (let i = 0; i < agent.messages.length; i++) {
      const msg = agent.messages[i]
      const msgTime = new Date(msg.timestamp).getTime()
      const isLastMsg = i === agent.messages.length - 1
      const isMsgStreaming = isStreaming && isLastMsg && msg.role === 'assistant'
      
      items.push({ type: 'message', data: msg, isStreaming: isMsgStreaming })
      
      // After each assistant message, add any tool steps that occurred before the next message
      if (msg.role === 'assistant') {
        const nextMsg = agent.messages[i + 1]
        const nextMsgTime = nextMsg ? new Date(nextMsg.timestamp).getTime() : Infinity
        
        // Collect tool steps that happened between this message and the next
        const stepsInRange: AgentStep[] = []
        while (toolStepIndex < toolSteps.length) {
          const step = toolSteps[toolStepIndex]
          if (step.timestamp > msgTime && step.timestamp <= nextMsgTime) {
            stepsInRange.push(step)
            toolStepIndex++
          } else if (step.timestamp <= msgTime) {
            // Skip steps that are before this message (already processed)
            toolStepIndex++
          } else {
            break
          }
        }
        
        // Add steps based on feature flag
        if (stepsInRange.length > 0) {
          if (useEnhancedToolDisplay) {
            // Group consecutive steps for enhanced display
            const toolStepsForGroup = stepsInRange.map(agentStepToToolStep)
            const hasPending = toolStepsForGroup.some(
              s => s.type === 'tool_call' && s.toolCall?.status === 'pending'
            )
            items.push({
              type: 'tool_step_group',
              data: {
                groupId: generateGroupId(),
                steps: toolStepsForGroup,
                collapsed: !hasPending
              }
            })
          } else {
            // Legacy: add individual tool steps
            for (const step of stepsInRange) {
              items.push({ type: 'tool_step', data: step })
            }
          }
        }
      }
    }
    
    // Add any remaining tool steps
    if (toolStepIndex < toolSteps.length) {
      const remainingSteps: AgentStep[] = []
      while (toolStepIndex < toolSteps.length) {
        remainingSteps.push(toolSteps[toolStepIndex])
        toolStepIndex++
      }
      
      if (remainingSteps.length > 0) {
        if (useEnhancedToolDisplay) {
          const toolStepsForGroup = remainingSteps.map(agentStepToToolStep)
          const hasPending = toolStepsForGroup.some(
            s => s.type === 'tool_call' && s.toolCall?.status === 'pending'
          )
          items.push({
            type: 'tool_step_group',
            data: {
              groupId: generateGroupId(),
              steps: toolStepsForGroup,
              collapsed: !hasPending
            }
          })
        } else {
          for (const step of remainingSteps) {
            items.push({ type: 'tool_step', data: step })
          }
        }
      }
    }
    
    // Add streaming message if there's new content not yet in messages
    if (isStreaming && streamingContent && 
        (!agent.messages.length || agent.messages[agent.messages.length - 1]?.role !== 'assistant')) {
      items.push({ type: 'streaming_message', content: streamingContent })
    }
    
    // Add pending tool call
    if (agent.pendingToolCall) {
      if (useEnhancedToolDisplay) {
        // Wrap pending tool in a group for consistent display
        items.push({
          type: 'tool_step_group',
          data: {
            groupId: generateGroupId(),
            steps: [agentPendingToolToStep(agent.pendingToolCall)],
            collapsed: false  // Always show pending approvals expanded
          }
        })
      } else {
        items.push({ type: 'pending_tool', data: agent.pendingToolCall })
      }
    }
    
    // Add working indicator when agent is running but no content yet
    if (isWorking && !streamingContent && agent.messages.length > 0 && !agent.pendingToolCall) {
      items.push({ type: 'working_indicator' })
    }
    
    return items
  }, [agent.messages, agent.steps, agent.pendingToolCall, isStreaming, streamingContent, isWorking, useEnhancedToolDisplay])

  // Get context summary for display
  const contextSummary = agent.config.context.seedMessages.length > 0
    ? agent.config.context.seedMessages.map(m => m.content).join('\n').slice(0, 150)
    : null

  return (
    <ResizablePanel
      storageKey={`agent-panel-${agent.id}`}
      defaultWidth={480}
      minWidth={380}
      maxWidth={800}
      className="h-full"
    >
      <div className={cn(
        'w-full flex flex-col h-full',
        'bg-gradient-to-b from-tertiary to-background',
        'border-l border-violet-500/20',
        'shadow-2xl shadow-violet-500/5',
        'animate-in slide-in-from-right-full duration-300 ease-out'
      )}>
      {/* Header */}
      <div className="h-14 border-b border-violet-500/20 flex items-center justify-between px-4 bg-tertiary/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30">
            <Bot size={18} className="text-violet-400" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-text-normal text-sm">{agent.config.name}</span>
            <span className="text-[10px] text-text-muted">{agent.stepsCompleted} steps completed</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <AgentStatusBadgeBordered 
            status={agent.status} 
            executionPhase={execution?.phase}
            currentToolName={execution?.currentToolName}
            hasPendingTool={hasPendingTool} 
          />
          
          {/* Retry button for failed agents */}
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'text-amber-400 hover:bg-amber-500/20',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              title={isRetrying ? 'Retrying...' : 'Retry'}
            >
              <RotateCcw size={16} className={isRetrying ? 'animate-spin' : ''} />
            </button>
          )}
          
          {/* Pause/Resume button */}
          {(isWorking || isPaused) && (
            <button
              onClick={isPaused ? onResume : onPause}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                isPaused
                  ? 'text-emerald-400 hover:bg-emerald-500/20'
                  : 'text-amber-400 hover:bg-amber-500/20'
              )}
              title={isPaused ? 'Resume' : 'Pause'}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          
          {/* Stop button - always visible when agent is active */}
          {(agent.status === 'running' || agent.status === 'waiting' || agent.status === 'paused' || agent.status === 'created') && (
            <button
              onClick={onStop}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                'text-red-400 hover:bg-red-500/20 hover:text-red-300'
              )}
              title="Stop agent"
            >
              <Square size={16} />
            </button>
          )}
          
          {/* Minimize button */}
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-md text-text-muted hover:text-text-normal hover:bg-secondary transition-colors"
            title="Minimize"
          >
            <Minimize2 size={16} />
          </button>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Close agent"
          >
            <X size={16} />
          </button>
        </div>
      </div>


      {/* Initial Instructions Context */}
      {contextSummary && (
        <div className="shrink-0 border-b border-violet-500/10">
          <div className="p-3 bg-gradient-to-b from-violet-500/5 to-transparent">
            <div className="flex items-center gap-1.5 text-[10px] text-text-muted mb-1.5">
              <Sparkles size={10} />
              <span className="font-medium">Context</span>
            </div>
            <div className="relative pl-2 py-1.5 border-l-2 border-violet-500/30 bg-secondary/20 rounded-r-lg">
              <p className="text-[11px] text-text-muted leading-relaxed line-clamp-2">
                {contextSummary.length > 150 
                  ? contextSummary.slice(0, 150) + '...'
                  : contextSummary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step Timeline */}
      {agent.steps.length > 0 && (
        <div className="shrink-0 border-b border-violet-500/10 p-3">
          <AgentStepTimeline
            steps={agent.steps}
            currentStepId={agent.steps[agent.currentStepIndex]?.id}
          />
        </div>
      )}

      {/* Phase 2: Execution Progress Bar - Real-time status display */}
      {execution && execution.phase !== 'idle' && (
        <ExecutionProgressBar
          phase={execution.phase}
          activity={execution.currentActivity}
          duration={Date.now() - execution.activityStartedAt}
          toolName={execution.currentToolName}
          tokenUsage={tokens ? {
            used: tokens.contextUsed,
            max: tokens.contextMax,
            warningLevel: tokens.warningLevel
          } : undefined}
          watchdogStatus={watchdogState?.status}
          timeSinceProgress={watchdogState?.timeSinceProgress}
          visible={true}
        />
      )}

      {/* Phase 2: Diagnostics Panel - Collapsible execution metrics and recovery */}
      {diagnostics && (isWorking || diagnostics.loopIterations > 0) && (
        <div className="shrink-0 border-b border-violet-500/10 px-3 py-2">
          <AgentDiagnosticsPanel
            diagnostics={diagnostics}
            watchdogState={watchdogState}
            onForceRetry={onForceRetry || (() => {})}
            onKillTool={onKillTool || (() => {})}
            isToolExecuting={execution?.phase === 'executing_tool'}
            isRunning={isWorking}
            defaultCollapsed={true}
          />
        </div>
      )}

      {/* Messages Area */}
      <div
        className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent"
        ref={scrollRef}
      >
        <div className="py-3 space-y-1">
          {timeline.map((item) => {
            switch (item.type) {
              case 'message':
                return (
                  <AgentMessageBubble
                    key={item.data.id}
                    role={item.data.role as 'user' | 'assistant'}
                    content={item.data.content}
                    isStreaming={item.isStreaming}
                  />
                )
              
              case 'tool_step':
                return (
                  <div key={item.data.id} className="px-3 py-1">
                    <InlineToolCall
                      id={item.data.id}
                      toolName={item.data.toolCall!.name}
                      args={item.data.toolCall!.args}
                      status={
                        item.data.toolCall!.status === 'completed' ? 'completed' :
                        item.data.toolCall!.status === 'failed' ? 'error' :
                        item.data.toolCall!.status === 'pending' ? 'pending' :
                        item.data.toolCall!.status === 'approved' ? 'executing' :
                        'rejected' as ToolCallStatus
                      }
                      result={item.data.toolCall!.result}
                      error={item.data.toolCall!.error}
                      explanation={item.data.toolCall!.explanation}
                      riskLevel="moderate"
                    />
                  </div>
                )
              
              case 'tool_step_group':
                return (
                  <div key={item.data.groupId} className="px-3 py-1">
                    <ToolStepGroup
                      groupId={item.data.groupId}
                      steps={item.data.steps}
                      initialVisible={!item.data.collapsed}
                      onApprove={onToolApprove}
                      onAlwaysApprove={onToolAlwaysApprove}
                      onReject={onToolReject}
                    />
                  </div>
                )
              
              case 'pending_tool':
                return (
                  <div key={`pending-${item.data.id}`} className="px-3 py-1">
                    <InlineToolCall
                      id={item.data.id}
                      toolName={item.data.tool}
                      args={item.data.args}
                      status="pending"
                      explanation={item.data.explanation}
                      riskLevel="moderate"
                      onApprove={onToolApprove}
                      onAlwaysApprove={onToolAlwaysApprove}
                      onReject={onToolReject}
                    />
                  </div>
                )
              
              case 'streaming_message':
                return (
                  <AgentMessageBubble
                    key="streaming"
                    role="assistant"
                    content={item.content}
                    isStreaming={true}
                  />
                )
              
              case 'working_indicator':
                return (
                  <div key="working" className="flex gap-2 px-3 py-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Bot size={14} className="text-white" />
                    </div>
                    <div className="flex items-center gap-1.5 bg-secondary/50 rounded-xl px-3 py-2 border border-tertiary/50">
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce" />
                    </div>
                  </div>
                )
              
              default:
                return null
            }
          })}
        </div>
      </div>


      {/* Input Area */}
      <div className="p-3 border-t border-violet-500/10 bg-tertiary/50 shrink-0">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className={cn(
            'relative rounded-lg overflow-hidden',
            'ring-1 ring-violet-500/20 focus-within:ring-2 focus-within:ring-violet-500/40',
            'transition-shadow duration-150'
          )}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasPendingTool 
                  ? 'Approve or reject the tool request above...'
                  : isWorking 
                    ? 'Agent is working...' 
                    : 'Send instructions to agent...'
              }
              disabled={!canSendMessage}
              rows={2}
              className={cn(
                'w-full bg-secondary/50 text-text-normal',
                'pl-3 pr-10 py-2.5 text-xs',
                'placeholder-text-muted',
                'focus:outline-none',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'resize-none',
                'min-h-[60px] max-h-[120px]'
              )}
            />
            <button
              type="submit"
              disabled={!input.trim() || !canSendMessage}
              className={cn(
                'absolute right-2 bottom-2',
                'p-1.5 rounded-md',
                'text-text-muted hover:text-white hover:bg-violet-500',
                'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted',
                'transition-all duration-150'
              )}
            >
              <Send size={14} />
            </button>
          </div>
          
          {/* Model Selector */}
          <ModelSelector
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            disabled={isWorking}
          />
        </form>
      </div>
    </div>
    </ResizablePanel>
  )
}

export default AgentPanel
