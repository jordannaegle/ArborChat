import { X } from 'lucide-react'
import { Message } from '../types'
import { ChatWindow } from './ChatWindow'

interface ThreadPanelProps {
    rootMessage: Message
    messages: Message[]
    onSendMessage: (content: string) => void
    onClose: () => void
    pending?: boolean
}

export function ThreadPanel({ rootMessage, messages, onSendMessage, onClose, pending }: ThreadPanelProps) {
    // We can reuse ChatWindow logic but simpler
    // Or just reuse ChatWindow component but pass it thread messages

    // To keep it standalone and specific:
    return (
        <div className="w-[400px] border-l border-secondary bg-tertiary flex flex-col h-full shadow-xl z-10 animate-in slide-in-from-right duration-200">
            <div className="h-12 border-b border-secondary flex items-center justify-between px-4 bg-tertiary shrink-0">
                <span className="font-semibold text-text-normal flex items-center gap-2">
                    Context Thread
                </span>
                <button onClick={onClose} className="text-text-muted hover:text-text-normal transition-colors">
                    <X size={20} />
                </button>
            </div>

            {/* Root Message Context */}
            <div className="p-4 bg-secondary/30 border-b border-secondary shrink-0">
                <div className="text-xs font-bold text-text-muted mb-1 flex items-center gap-2">
                    Replying to
                </div>
                <div className="text-sm text-text-muted line-clamp-3 italic opacity-80 border-l-2 border-primary pl-2">
                    {rootMessage.content}
                </div>
            </div>

            <div className="flex-1 min-h-0 bg-tertiary">
                <ChatWindow
                    messages={messages}
                    onSendMessage={onSendMessage}
                    onThreadSelect={() => { }} // No threads in threads for V1
                    isThreadOpen={false}
                    pending={pending}
                />
            </div>
        </div>
    )
}
