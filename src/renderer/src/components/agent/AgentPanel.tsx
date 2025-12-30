// src/renderer/src/components/agent/AgentPanel.tsx

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  X, Bot, Send, Pause, Play, AlertCircle,
  CheckCircle2, Loader2, Sparkles, User, Minimize2, Clock, RotateCcw
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { ModelSelector } from '../ModelSelector'
import { InlineToolCall } from '../mcp'
import type { ToolCallStatus } from '../mcp'
import { AgentStepTimeline } from './AgentStepTimeline'
import type { Agent, AgentStatus, AgentMessage, AgentStep } from '../../types/agent'

// Timeline item types for unified agent rendering
type AgentTimelineItem =
  | { type: 'message'; data: AgentMessage; isStreaming: boolean }
  | { type: 'tool_step'; data: AgentStep }
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
  onRetry?: () => void
  canRetry?: boolean
  isRetrying?: boolean
  onClose: () => void
  onMinimize: () => void
  onToolApprove: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onToolAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  onToolReject: (id: string) => void
}

// Status indicator component - aligned with AgentStatus type
function StatusBadge({ status, hasPendingTool }: { status: AgentStatus; hasPendingTool?: boolean }) {
  const statusConfig: Record<AgentStatus, { label: string; color: string; icon: React.ReactNode }> = {
    created: { 
      label: 'Starting', 
      color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: <Clock size={12} />
    },
    running: { 
      label: 'Working', 
      color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      icon: <Loader2 size={12} className="animate-spin" />
    },
    waiting: { 
      label: hasPendingTool ? 'Needs Approval' : 'Awaiting Input', 
      color: hasPendingTool 
        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30 animate-pulse'
        : 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      icon: <AlertCircle size={12} />
    },
    paused: { 
      label: 'Paused', 
      color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
      icon: <Pause size={12} />
    },
    completed: { 
      label: 'Completed', 
      color: 'bg-green-500/20 text-green-400 border-green-500/30',
      icon: <CheckCircle2 size={12} />
    },
    failed: { 
      label: 'Error', 
      color: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: <AlertCircle size={12} />
    }
  }

  const config = statusConfig[status]

  return (
    <div className={cn(
      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border',
      config.color
    )}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  )
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
  onRetry,
  canRetry = false,
  isRetrying = false,
  onClose,
  onMinimize,
  onToolApprove,
  onToolAlwaysApprove,
  onToolReject
}: AgentPanelProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
        
        // Add tool steps that happened between this message and the next
        while (toolStepIndex < toolSteps.length) {
          const step = toolSteps[toolStepIndex]
          if (step.timestamp > msgTime && step.timestamp <= nextMsgTime) {
            items.push({ type: 'tool_step', data: step })
            toolStepIndex++
          } else if (step.timestamp <= msgTime) {
            // Skip steps that are before this message (already processed)
            toolStepIndex++
          } else {
            break
          }
        }
      }
    }
    
    // Add any remaining tool steps
    while (toolStepIndex < toolSteps.length) {
      items.push({ type: 'tool_step', data: toolSteps[toolStepIndex] })
      toolStepIndex++
    }
    
    // Add streaming message if there's new content not yet in messages
    if (isStreaming && streamingContent && 
        (!agent.messages.length || agent.messages[agent.messages.length - 1]?.role !== 'assistant')) {
      items.push({ type: 'streaming_message', content: streamingContent })
    }
    
    // Add pending tool call
    if (agent.pendingToolCall) {
      items.push({ type: 'pending_tool', data: agent.pendingToolCall })
    }
    
    // Add working indicator when agent is running but no content yet
    if (isWorking && !streamingContent && agent.messages.length > 0 && !agent.pendingToolCall) {
      items.push({ type: 'working_indicator' })
    }
    
    return items
  }, [agent.messages, agent.steps, agent.pendingToolCall, isStreaming, streamingContent, isWorking])

  // Get context summary for display
  const contextSummary = agent.config.context.seedMessages.length > 0
    ? agent.config.context.seedMessages.map(m => m.content).join('\n').slice(0, 150)
    : null

  return (
    <div className={cn(
      'w-[480px] flex flex-col h-full',
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
          <StatusBadge status={agent.status} hasPendingTool={hasPendingTool} />
          
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

      {/* Messages Area */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-violet-500/20 scrollbar-track-transparent"
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
  )
}

export default AgentPanel
