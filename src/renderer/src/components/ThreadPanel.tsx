import { X, MessageCircle, CornerDownRight } from 'lucide-react'
import { Message } from '../types'
import { ChatWindow } from './ChatWindow'
import { cn } from '../lib/utils'

interface ThreadPanelProps {
  rootMessage: Message
  messages: Message[]
  onSendMessage: (content: string) => void
  onClose: () => void
  pending?: boolean
  selectedModel: string
  onModelChange: (modelId: string) => void
}

export function ThreadPanel({
  rootMessage,
  messages,
  onSendMessage,
  onClose,
  pending,
  selectedModel,
  onModelChange
}: ThreadPanelProps) {
  // Truncate long root messages for preview
  const truncatedRoot =
    rootMessage.content.length > 200
      ? rootMessage.content.slice(0, 200) + '...'
      : rootMessage.content

  return (
    <div
      className={cn(
        'w-[420px] flex flex-col h-full',
        'bg-tertiary',
        'border-l border-secondary/50',
        'shadow-2xl shadow-black/20',
        // Smooth slide-in animation
        'animate-in slide-in-from-right-full duration-300 ease-out'
      )}
    >
      {/* Header */}
      <div className="h-12 border-b border-secondary/50 flex items-center justify-between px-4 bg-tertiary shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-primary/10">
            <MessageCircle size={14} className="text-primary" />
          </div>
          <span className="font-semibold text-text-normal text-sm">Thread</span>
          <span className="text-xs text-text-muted bg-secondary px-1.5 py-0.5 rounded">
            {messages.length} {messages.length === 1 ? 'reply' : 'replies'}
          </span>
        </div>
        <button
          onClick={onClose}
          className={cn(
            'p-1.5 rounded-md',
            'text-text-muted hover:text-text-normal hover:bg-secondary',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary/30'
          )}
          aria-label="Close thread"
        >
          <X size={18} />
        </button>
      </div>

      {/* Root Message Context */}
      <div className="shrink-0 border-b border-secondary/50">
        <div className="p-4 bg-gradient-to-b from-secondary/20 to-transparent">
          {/* Context label */}
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
            <CornerDownRight size={12} />
            <span className="font-medium">Replying to ArborChat</span>
          </div>

          {/* Root message preview */}
          <div
            className={cn(
              'relative pl-3 py-2',
              'border-l-2 border-primary/50',
              'bg-secondary/30 rounded-r-lg'
            )}
          >
            <p className="text-sm text-text-muted leading-relaxed">{truncatedRoot}</p>
          </div>
        </div>
      </div>

      {/* Thread Chat Area */}
      <div className="flex-1 min-h-0 flex flex-col">
        <ChatWindow
          messages={messages}
          onSendMessage={onSendMessage}
          onThreadSelect={() => {}} // No nested threads in V1
          isThreadOpen={false}
          pending={pending}
          isThread={true}
          threadTitle="Thread replies"
          selectedModel={selectedModel}
          onModelChange={onModelChange}
        />
      </div>
    </div>
  )
}
