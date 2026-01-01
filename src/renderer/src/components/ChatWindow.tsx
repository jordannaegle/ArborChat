import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Send, MessageCircle, Sparkles, User, Loader2, X, Bot, AlertTriangle } from 'lucide-react'
import { Message } from '../types'
import { cn } from '../lib/utils'
import { ModelSelector } from './ModelSelector'
import { InlineToolCall, MemoryIndicator, ToolStepGroup } from './mcp'
import type { MemoryStatus, ToolCallStatus } from './mcp'
import { SlashCommandMenu, MarkdownRenderer } from './chat'
import { NotebookIcon, SaveToNotebookModal } from './notebook'
import { useSlashCommands, useStreamingStepExtractor } from '../hooks'
import type { PendingToolCall, ToolExecution } from '../hooks'
import { useSettings } from '../contexts/SettingsContext'
import { useNotificationContext } from '../contexts/NotificationContext'
import {
  toolExecutionToStep,
  pendingToolToStep,
  inferServerFromTool,
  type ToolStepGroupData as StepGroupData
} from '../lib/stepExtractor'

// Timeline item types for unified rendering
type TimelineItem =
  | { type: 'message'; data: Message; isStreaming: boolean }
  | { type: 'tool_execution'; data: ToolExecution }
  | { type: 'tool_step_group'; data: StepGroupData }
  | { type: 'pending_tool'; data: PendingToolCall }
  | { type: 'typing_indicator' }

// Tool risk levels (mirrored from main process for renderer use)
const TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Safe - read-only operations
  read_file: 'safe',
  read_multiple_files: 'safe',
  list_directory: 'safe',
  get_file_info: 'safe',
  list_sessions: 'safe',
  list_processes: 'safe',
  list_searches: 'safe',
  get_config: 'safe',
  read_process_output: 'safe',
  get_usage_stats: 'safe',
  get_recent_tool_calls: 'safe',
  get_more_search_results: 'safe',
  get_prompts: 'safe',
  give_feedback_to_desktop_commander: 'safe',
  // Moderate - write operations
  write_file: 'moderate',
  write_pdf: 'moderate',
  create_directory: 'moderate',
  start_search: 'moderate',
  start_process: 'moderate',
  interact_with_process: 'moderate',
  edit_block: 'moderate',
  stop_search: 'moderate',
  // Dangerous - system-wide effects
  move_file: 'dangerous',
  force_terminate: 'dangerous',
  kill_process: 'dangerous',
  set_config_value: 'dangerous'
}

function getToolRiskLevel(toolName: string): 'safe' | 'moderate' | 'dangerous' {
  return TOOL_RISK_LEVELS[toolName] || 'moderate'
}

interface ChatWindowProps {
  messages: Message[]
  onSendMessage: (content: string) => void
  onThreadSelect: (messageId: string) => void
  isThreadOpen: boolean
  pending?: boolean
  isThread?: boolean
  threadTitle?: string
  selectedModel: string
  onModelChange: (modelId: string) => void
  // Notebook Props
  conversationId?: string
  // MCP Tool Props
  mcpConnected?: boolean
  pendingToolCall?: PendingToolCall | null
  toolExecutions?: ToolExecution[]
  onToolApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onToolAlwaysApprove?: (
    id: string,
    toolName: string,
    modifiedArgs?: Record<string, unknown>
  ) => void
  onToolReject?: (id: string) => void
  // Memory Props
  memoryStatus?: MemoryStatus
  memoryItemCount?: number
  // Persona Props (Phase 4)
  activePersonaId?: string | null
  activePersonaName?: string | null
  onActivatePersona?: (id: string | null) => void
  onShowPersonaList?: () => void
  // Agent Props
  onAgentLaunch?: (messageContent: string) => void
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1">
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
      <span className="w-2 h-2 bg-primary/60 rounded-full animate-bounce" />
    </div>
  )
}

function MessageBubble({
  message,
  onThreadSelect,
  onAgentLaunch,
  conversationId,
  showThreadButton = true,
  isStreaming = false
}: {
  message: Message
  onThreadSelect: (id: string) => void
  onAgentLaunch?: (messageContent: string) => void
  conversationId?: string
  showThreadButton?: boolean
  isStreaming?: boolean
}) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  
  // Notebook modal state
  const [showNotebookModal, setShowNotebookModal] = useState(false)

  return (
    <>
      <div
        className={cn(
          'group flex gap-3 px-4 py-2 -mx-4 rounded-lg transition-colors duration-150',
          'hover:bg-secondary/30',
          isUser && 'flex-row-reverse'
        )}
      >
        {/* Avatar */}
        <div
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
            'ring-2 ring-offset-2 ring-offset-background transition-shadow duration-150',
            isAssistant
              ? 'bg-gradient-to-br from-primary to-indigo-600 ring-primary/30'
              : 'bg-gradient-to-br from-emerald-500 to-teal-600 ring-emerald-500/30'
          )}
        >
          {isAssistant ? (
            <Sparkles size={16} className="text-white" />
          ) : (
            <User size={16} className="text-white" />
          )}
        </div>

        {/* Content - responsive width that expands with viewport */}
        <div
          className={cn(
            'flex flex-col gap-1 min-w-0',
            'max-w-[85%] lg:max-w-[88%] xl:max-w-[90%]',
            isUser && 'items-end'
          )}
        >
          {/* Role label */}
          <span
            className={cn('text-xs font-medium', isAssistant ? 'text-primary' : 'text-emerald-400')}
          >
            {isAssistant ? 'ArborChat' : 'You'}
          </span>

          {/* Message bubble */}
          <div
            className={cn(
              'relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
              'shadow-sm transition-shadow duration-150',
              isUser
                ? 'bg-primary text-white rounded-tr-sm'
                : 'bg-secondary text-text-normal rounded-tl-sm border border-tertiary'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}

            {/* Streaming indicator */}
            {isStreaming && isAssistant && (
              <span className="inline-block w-2 h-4 bg-primary/70 ml-1 animate-pulse rounded-sm" />
            )}
          </div>

          {/* Hover action buttons - show on all messages when not streaming */}
          {showThreadButton && !isStreaming && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {/* Thread button - only on assistant messages */}
              {isAssistant && (
                <button
                  onClick={() => onThreadSelect(message.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                    'text-text-muted hover:text-primary hover:bg-primary/10',
                    'transition-all duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30'
                  )}
                  aria-label="Start thread on this message"
                >
                  <MessageCircle size={14} />
                  <span>Thread</span>
                </button>
              )}

              {/* Agent Launch Button - only on assistant messages */}
              {isAssistant && onAgentLaunch && (
                <button
                  onClick={() => onAgentLaunch(message.content)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                    'text-text-muted hover:text-violet-400 hover:bg-violet-500/10',
                    'transition-all duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-violet-500/30'
                  )}
                  aria-label="Launch agent based on this message"
                >
                  <Bot size={14} />
                  <span>Agent</span>
                </button>
              )}

              {/* Notebook Save Button - available on all messages */}
              <NotebookIcon onClick={() => setShowNotebookModal(true)} />
            </div>
          )}
        </div>
      </div>

      {/* Notebook Modal */}
      <SaveToNotebookModal
        isOpen={showNotebookModal}
        onClose={() => setShowNotebookModal(false)}
        content={message.content}
        sourceMessageId={message.id}
        sourceConversationId={conversationId}
        sourceRole={message.role as 'user' | 'assistant'}
      />
    </>
  )
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Sparkles size={28} className="text-primary" />
      </div>
      <h3 className="text-lg font-semibold text-text-normal mb-2">Start a conversation</h3>
      <p className="text-sm text-text-muted max-w-sm">
        Ask me anything. When I respond, hover over my message to start a focused thread for
        follow-up questions.
      </p>
    </div>
  )
}

/**
 * Active Persona Indicator
 * Shows when a persona is active above the input
 */
function ActivePersonaIndicator({
  personaName,
  onDeactivate
}: {
  personaName: string
  onDeactivate: () => void
}) {
  return (
    <div
      className={cn(
        'absolute -top-9 left-1/2 -translate-x-1/2',
        'flex items-center gap-2 px-3 py-1.5 rounded-full',
        'bg-primary/10 border border-primary/20',
        'animate-in fade-in slide-in-from-bottom-2 duration-200'
      )}
    >
      <Sparkles size={12} className="text-primary" />
      <span className="text-xs text-primary font-medium">{personaName}</span>
      <button
        onClick={onDeactivate}
        className="p-0.5 rounded-full hover:bg-primary/20 transition-colors"
        aria-label="Deactivate persona"
      >
        <X size={12} className="text-primary" />
      </button>
    </div>
  )
}

export function ChatWindow({
  messages,
  onSendMessage,
  onThreadSelect,
  isThreadOpen: _isThreadOpen,
  pending,
  isThread = false,
  threadTitle = 'Chat',
  selectedModel,
  onModelChange,
  // Notebook props
  conversationId,
  // MCP Tool props
  mcpConnected = true,
  pendingToolCall,
  toolExecutions,
  onToolApprove,
  onToolAlwaysApprove,
  onToolReject,
  // Memory props
  memoryStatus = 'idle',
  memoryItemCount = 0,
  // Persona props
  activePersonaId,
  activePersonaName,
  onActivatePersona,
  onShowPersonaList,
  // Agent props
  onAgentLaunch
}: ChatWindowProps) {
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Slash command integration
  const { success: showSuccess, error: showError } = useNotificationContext()
  
  const handleCommitResult = useCallback((result: { success: boolean; message?: string; error?: string }) => {
    if (result.success) {
      showSuccess('Git Commit', result.message || 'Changes committed successfully')
    } else {
      showError('Git Commit Failed', result.error || 'Unknown error')
    }
  }, [showSuccess, showError])

  const {
    state: slashState,
    handleInputChange: handleSlashInput,
    handleNavigate,
    setSelectedIndex,
    executeSelected,
    executeCommand,
    reset: resetSlash
  } = useSlashCommands({
    onActivatePersona: onActivatePersona || (() => { }),
    onShowPersonaList: onShowPersonaList || (() => { }),
    onCommitResult: handleCommitResult
  })

  // Settings context for enhanced tool display preference
  const { settings } = useSettings()
  const useEnhancedToolDisplay = settings.enhancedToolDisplay

  // Get streaming content for real-time step extraction
  const lastMessage = messages[messages.length - 1]
  const isLastMessageStreaming = pending && lastMessage?.role === 'assistant'
  
  // Phase 6.4: Real-time thinking extraction from streaming content
  // Extracts AI thinking patterns as they stream in for potential display
  const { thinkingSteps, verificationSteps } = useStreamingStepExtractor({
    streamingContent: isLastMessageStreaming ? (lastMessage?.content || '') : '',
    isStreaming: !!isLastMessageStreaming
  })
  
  // Clear extracted steps when a new conversation starts or streaming ends
  useEffect(() => {
    if (!isLastMessageStreaming && (thinkingSteps.length > 0 || verificationSteps.length > 0)) {
      // Steps will be cleared automatically when streaming restarts
      // Could integrate these into step groups in a future enhancement
    }
  }, [isLastMessageStreaming, thinkingSteps.length, verificationSteps.length])

  // Auto-resize textarea based on content
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get accurate scrollHeight
    textarea.style.height = 'auto'
    // Set to scrollHeight, capped at max-height (handled by CSS)
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
  }, [])

  // Auto-scroll on new messages or pending tool call
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages, pendingToolCall])

  // Focus input on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Adjust height when input changes
  useEffect(() => {
    adjustTextareaHeight()
  }, [input, adjustTextareaHeight])

  // Handle input change with slash command detection
  const handleInputChange = (value: string) => {
    setInput(value)
    handleSlashInput(value)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || pending) return

    // Check if it's a slash command first
    if (input.startsWith('/')) {
      const handled = await executeCommand(input)
      if (handled) {
        setInput('')
        resetSlash()
        return
      }
    }

    // Normal message
    onSendMessage(input)
    setInput('')
    resetSlash()
    // Reset textarea height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // Slash command navigation
    if (slashState.isActive) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        handleNavigate('up')
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        handleNavigate('down')
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        // Tab to autocomplete the selected command
        const match = slashState.matches[slashState.selectedIndex]
        if (match && match.command.syntax !== '/persona <n>') {
          setInput(match.command.syntax)
          handleSlashInput(match.command.syntax)
        }
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        const handled = await executeSelected()
        if (handled) {
          setInput('')
          resetSlash()
        } else {
          // If not handled (e.g., generic /persona hint), try to submit as command
          handleSubmit(e)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        resetSlash()
        return
      }
    }

    // Normal enter handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const hasMessages = messages.length > 0

  // Build unified timeline that interleaves messages and tool calls
  // Tool calls appear after the assistant message that triggered them
  const timeline = useMemo((): TimelineItem[] => {
    // DEBUG: Log inputs to diagnose tool display issue
    console.log('[ChatWindow] Timeline building:', {
      useEnhancedToolDisplay,
      toolExecutionsCount: toolExecutions?.length || 0,
      toolExecutions: toolExecutions?.map(e => ({ id: e.id, toolName: e.toolName, status: e.status })),
      pendingToolCall: pendingToolCall ? { id: pendingToolCall.id, tool: pendingToolCall.tool } : null,
      messagesCount: messages.length
    })
    
    const items: TimelineItem[] = []
    
    // Track which tool executions we've added
    const usedToolExecIds = new Set<string>()
    
    // Helper to create step group from executions
    const createStepGroup = (executions: ToolExecution[], pendingTool?: PendingToolCall): StepGroupData => {
      const steps = executions.map(exec => {
        const serverName = inferServerFromTool(exec.toolName)
        return toolExecutionToStep({
          ...exec,
          serverName,
          riskLevel: getToolRiskLevel(exec.toolName)
        }, serverName)
      })
      
      // Add pending tool if present
      if (pendingTool) {
        const serverName = inferServerFromTool(pendingTool.tool)
        steps.push(pendingToolToStep({
          id: pendingTool.id,
          tool: pendingTool.tool,
          args: pendingTool.args,
          explanation: pendingTool.explanation,
          serverName,
          riskLevel: getToolRiskLevel(pendingTool.tool)
        }, serverName))
      }
      
      // Determine collapsed state - expand if any pending
      const hasPending = steps.some(s => s.toolCall?.status === 'pending')
      
      return {
        groupId: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        steps,
        collapsed: !hasPending
      }
    }
    
    // Add messages with tool executions interleaved
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]
      const msgIsStreaming = !!(isLastMessageStreaming && i === messages.length - 1)
      
      items.push({ type: 'message', data: msg, isStreaming: msgIsStreaming })
      
      // After an assistant message, add any completed tool executions
      // Tool calls happen after the AI requests them (in an assistant message)
      // FIX: Add tool executions after EVERY assistant message, not just "last before user"
      // The usedToolExecIds set prevents duplicates, so tools appear after the FIRST
      // assistant message they encounter (which is the one that requested them)
      if (msg.role === 'assistant' && toolExecutions) {
        // Collect all unused tool executions
        const unusedExecs = toolExecutions.filter(exec => !usedToolExecIds.has(exec.id))
        
        if (unusedExecs.length > 0) {
          console.log('[ChatWindow] Adding tool executions to timeline:', {
            useEnhancedToolDisplay,
            count: unusedExecs.length,
            execIds: unusedExecs.map(e => e.id),
            afterMessageIndex: i
          })
          
          if (useEnhancedToolDisplay) {
            // Create a step group for consecutive executions
            const stepGroup = createStepGroup(unusedExecs)
            console.log('[ChatWindow] Created step group:', {
              groupId: stepGroup.groupId,
              stepsCount: stepGroup.steps.length,
              steps: stepGroup.steps.map(s => ({ id: s.id, type: s.type, toolName: s.toolCall?.name }))
            })
            items.push({ type: 'tool_step_group', data: stepGroup })
          } else {
            // Legacy: add individual tool executions
            for (const exec of unusedExecs) {
              items.push({ type: 'tool_execution', data: exec })
            }
          }
          
          // Mark all as used
          for (const exec of unusedExecs) {
            usedToolExecIds.add(exec.id)
          }
        }
      }
    }
    
    // If we have remaining tool executions (shouldn't happen normally), add them
    if (toolExecutions) {
      const remainingExecs = toolExecutions.filter(exec => !usedToolExecIds.has(exec.id))
      
      if (remainingExecs.length > 0) {
        if (useEnhancedToolDisplay) {
          const stepGroup = createStepGroup(remainingExecs)
          items.push({ type: 'tool_step_group', data: stepGroup })
        } else {
          for (const exec of remainingExecs) {
            items.push({ type: 'tool_execution', data: exec })
          }
        }
      }
    }
    
    // Add typing indicator when waiting for first response
    if (pending && lastMessage?.role === 'user') {
      items.push({ type: 'typing_indicator' })
    }
    
    // Add pending tool call
    if (pendingToolCall) {
      if (useEnhancedToolDisplay) {
        // Create a step group with just the pending tool
        const stepGroup = createStepGroup([], pendingToolCall)
        items.push({ type: 'tool_step_group', data: stepGroup })
      } else {
        items.push({ type: 'pending_tool', data: pendingToolCall })
      }
    }
    
    // DEBUG: Log final timeline
    console.log('[ChatWindow] Final timeline:', {
      itemCount: items.length,
      types: items.map(i => i.type),
      toolStepGroups: items.filter(i => i.type === 'tool_step_group').length,
      toolExecutions: items.filter(i => i.type === 'tool_execution').length
    })
    
    return items
  }, [messages, toolExecutions, pendingToolCall, pending, lastMessage, isLastMessageStreaming, useEnhancedToolDisplay])

  return (
    <div
      className={cn(
        'flex-1 flex flex-col h-full relative min-w-0',
        isThread ? 'bg-tertiary' : 'bg-background'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'h-12 border-b flex items-center justify-between px-4 shrink-0',
          'drag-region select-none',
          isThread ? 'border-secondary/50 bg-tertiary' : 'border-secondary bg-background'
        )}
      >
        <span className="font-semibold text-text-normal text-sm">{threadTitle}</span>
        {/* Memory Indicator in header */}
        <MemoryIndicator 
          status={memoryStatus} 
          itemCount={memoryItemCount}
          compact
        />
      </div>

      {/* MCP Disconnected Warning */}
      {!mcpConnected && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-500 shrink-0" />
          <span className="text-xs text-amber-500">
            Desktop Commander not connected. File system tools are unavailable.
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent"
        ref={scrollRef}
      >
        {hasMessages || timeline.length > 0 ? (
          <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto py-4 px-4 space-y-1">
            {timeline.map((item) => {
              switch (item.type) {
                case 'message':
                  return (
                    <MessageBubble
                      key={item.data.id}
                      message={item.data}
                      onThreadSelect={onThreadSelect}
                      onAgentLaunch={onAgentLaunch}
                      conversationId={conversationId}
                      showThreadButton={!isThread}
                      isStreaming={item.isStreaming}
                    />
                  )
                
                case 'tool_execution':
                  return (
                    <InlineToolCall
                      key={item.data.id}
                      id={item.data.id}
                      toolName={item.data.toolName}
                      args={item.data.args}
                      status={item.data.status as ToolCallStatus}
                      result={item.data.result}
                      error={item.data.error}
                      duration={item.data.duration}
                      autoApproved={item.data.autoApproved}
                      explanation={item.data.explanation}
                      riskLevel={getToolRiskLevel(item.data.toolName)}
                    />
                  )
                
                case 'tool_step_group':
                  return (
                    <ToolStepGroup
                      key={item.data.groupId}
                      groupId={item.data.groupId}
                      steps={item.data.steps}
                      initialVisible={!item.data.collapsed}
                      onApprove={onToolApprove}
                      onAlwaysApprove={onToolAlwaysApprove}
                      onReject={onToolReject}
                    />
                  )
                
                case 'pending_tool':
                  return onToolApprove && onToolReject ? (
                    <InlineToolCall
                      key={`pending-${item.data.id}`}
                      id={item.data.id}
                      toolName={item.data.tool}
                      args={item.data.args}
                      status="pending"
                      explanation={item.data.explanation}
                      riskLevel={getToolRiskLevel(item.data.tool)}
                      onApprove={onToolApprove}
                      onAlwaysApprove={onToolAlwaysApprove}
                      onReject={onToolReject}
                    />
                  ) : null
                
                case 'typing_indicator':
                  return (
                    <div key="typing" className="flex gap-3 px-4 py-2 -mx-4">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center ring-2 ring-offset-2 ring-offset-background ring-primary/30">
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium text-primary">ArborChat</span>
                        <div className="bg-secondary rounded-2xl rounded-tl-sm px-4 py-3 border border-tertiary">
                          <TypingIndicator />
                        </div>
                      </div>
                    </div>
                  )
                
                default:
                  return null
              }
            })}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Input area */}
      <div
        className={cn(
          'p-4 border-t shrink-0',
          isThread ? 'border-secondary/50 bg-tertiary' : 'border-secondary bg-background'
        )}
      >
        <form
          onSubmit={handleSubmit}
          className="relative max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto"
        >
          {/* Slash Command Menu */}
          <SlashCommandMenu
            state={slashState}
            onSelect={(index) => {
              setSelectedIndex(index)
              executeSelected().then((handled) => {
                if (handled) {
                  setInput('')
                  resetSlash()
                }
              })
            }}
            onClose={resetSlash}
          />

          {/* Active Persona Indicator */}
          {activePersonaId && activePersonaName && onActivatePersona && (
            <ActivePersonaIndicator
              personaName={activePersonaName}
              onDeactivate={() => onActivatePersona(null)}
            />
          )}

          <div
            className={cn(
              'relative rounded-xl overflow-hidden',
              'ring-1 ring-secondary focus-within:ring-2 focus-within:ring-primary/50',
              'transition-shadow duration-150'
            )}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                pending ? 'Waiting for response...' : 'Send a message... (Type / for commands)'
              }
              disabled={pending}
              rows={1}
              className={cn(
                'w-full bg-secondary text-text-normal',
                'pl-4 pr-12 py-3.5 text-sm',
                'placeholder-text-muted',
                'focus:outline-none',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'resize-none overflow-y-auto',
                'min-h-[52px] max-h-[200px]',
                'scrollbar-thin'
              )}
              aria-label="Message input"
            />
            <button
              type="submit"
              disabled={!input.trim() || pending}
              className={cn(
                'absolute right-2 bottom-2',
                'p-2 rounded-lg',
                'text-text-muted hover:text-white hover:bg-primary',
                'disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-muted',
                'transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
              aria-label="Send message"
            >
              {pending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-text-muted/50">
              {slashState.isActive ? 'Tab to complete • Enter to select' : 'Type / for commands'}
            </span>
            <span className="text-[10px] text-text-muted/50">
              {slashState.isActive ? 'Esc to cancel' : 'Shift+Enter for new line'}
            </span>
          </div>

          {/* Model Selector */}
          <div className="mt-3">
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              disabled={pending}
            />
          </div>
        </form>
      </div>
    </div>
  )
}
