import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, MessageCircle, Sparkles, User, Loader2, X, Bot } from 'lucide-react'
import { Message } from '../types'
import { cn } from '../lib/utils'
import { ModelSelector } from './ModelSelector'
import { ToolApprovalCard, ToolResultCard } from './mcp'
import { SlashCommandMenu } from './chat'
import { useSlashCommands } from '../hooks'
import type { PendingToolCall, ToolExecution } from '../hooks'

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
  // MCP Tool Props
  pendingToolCall?: PendingToolCall | null
  toolExecutions?: ToolExecution[]
  onToolApprove?: (id: string, modifiedArgs?: Record<string, unknown>) => void
  onToolAlwaysApprove?: (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => void
  onToolReject?: (id: string) => void
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
  showThreadButton = true,
  isStreaming = false
}: {
  message: Message
  onThreadSelect: (id: string) => void
  onAgentLaunch?: (messageContent: string) => void
  showThreadButton?: boolean
  isStreaming?: boolean
}) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
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
          <p className="whitespace-pre-wrap break-words">{message.content}</p>

          {/* Streaming indicator */}
          {isStreaming && isAssistant && (
            <span className="inline-block w-2 h-4 bg-primary/70 ml-1 animate-pulse rounded-sm" />
          )}
        </div>

        {/* Thread button - only on assistant messages */}
        {isAssistant && showThreadButton && !isStreaming && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
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
            
            {/* Agent Launch Button */}
            {onAgentLaunch && (
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
          </div>
        )}
      </div>
    </div>
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
    <div className={cn(
      "absolute -top-9 left-1/2 -translate-x-1/2",
      "flex items-center gap-2 px-3 py-1.5 rounded-full",
      "bg-primary/10 border border-primary/20",
      "animate-in fade-in slide-in-from-bottom-2 duration-200"
    )}>
      <Sparkles size={12} className="text-primary" />
      <span className="text-xs text-primary font-medium">
        {personaName}
      </span>
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
  pendingToolCall,
  toolExecutions,
  onToolApprove,
  onToolAlwaysApprove,
  onToolReject,
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
  const {
    state: slashState,
    handleInputChange: handleSlashInput,
    handleNavigate,
    setSelectedIndex,
    executeSelected,
    executeCommand,
    reset: resetSlash
  } = useSlashCommands({
    onActivatePersona: onActivatePersona || (() => {}),
    onShowPersonaList: onShowPersonaList || (() => {})
  })

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
  const lastMessage = messages[messages.length - 1]
  const isLastMessageStreaming = pending && lastMessage?.role === 'assistant'

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
          'h-12 border-b flex items-center px-4 shrink-0',
          'drag-region select-none',
          isThread ? 'border-secondary/50 bg-tertiary' : 'border-secondary bg-background'
        )}
      >
        <span className="font-semibold text-text-normal text-sm">{threadTitle}</span>
      </div>

      {/* Messages area */}
      <div
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent"
        ref={scrollRef}
      >
        {hasMessages ? (
          <div className="max-w-4xl lg:max-w-5xl xl:max-w-6xl mx-auto py-4 px-4 space-y-1">
            {messages.map((msg, index) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onThreadSelect={onThreadSelect}
                onAgentLaunch={onAgentLaunch}
                showThreadButton={!isThread}
                isStreaming={isLastMessageStreaming && index === messages.length - 1}
              />
            ))}

            {/* Typing indicator when waiting for response */}
            {pending && lastMessage?.role === 'user' && (
              <div className="flex gap-3 px-4 py-2 -mx-4">
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
            )}

            {/* Tool Approval Card - show when AI requests a tool */}
            {pendingToolCall && onToolApprove && onToolReject && (
              <div className="my-4">
                <ToolApprovalCard
                  id={pendingToolCall.id}
                  toolName={pendingToolCall.tool}
                  args={pendingToolCall.args}
                  explanation={pendingToolCall.explanation}
                  riskLevel={getToolRiskLevel(pendingToolCall.tool)}
                  onApprove={onToolApprove}
                  onAlwaysApprove={onToolAlwaysApprove}
                  onReject={onToolReject}
                />
              </div>
            )}

            {/* Tool Results - show completed tool executions */}
            {toolExecutions && toolExecutions.filter(e => e.status === 'completed' || e.status === 'error').map((exec) => (
              <ToolResultCard
                key={exec.id}
                toolName={exec.toolName}
                result={exec.result}
                error={exec.error}
                duration={exec.duration}
                autoApproved={exec.autoApproved}
              />
            ))}
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
              executeSelected().then(handled => {
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
              placeholder={pending ? 'Waiting for response...' : 'Send a message... (Type / for commands)'}
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
