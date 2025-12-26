import { useState, useRef, useEffect } from 'react'
import { Send, MessageCircle } from 'lucide-react'
import { Message } from '../types'
import { cn } from '../lib/utils'

interface ChatWindowProps {
    messages: Message[]
    onSendMessage: (content: string) => void
    onThreadSelect: (messageId: string) => void
    isThreadOpen: boolean
    pending?: boolean
}

export function ChatWindow({ messages, onSendMessage, onThreadSelect, isThreadOpen: _isThreadOpen, pending }: ChatWindowProps) {
    const [input, setInput] = useState('')
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        }
    }, [messages])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || pending) return
        onSendMessage(input)
        setInput('')
    }

    return (
        <div className="flex-1 flex flex-col h-full bg-background relative min-w-0">
            <div className="h-12 border-b border-secondary flex items-center px-4 drag-region shrink-0">
                <span className="font-semibold text-text-muted">Chat</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
                <div className="space-y-6 max-w-3xl mx-auto">
                    {messages.map((msg) => (
                        <div key={msg.id} className={cn("group flex gap-4 pr-12", msg.role === 'user' ? "flex-row-reverse pl-12 pr-0" : "")}>
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold",
                                msg.role === 'assistant' ? "bg-primary" : "bg-emerald-600"
                            )}>
                                {msg.role === 'assistant' ? "AI" : "U"}
                            </div>

                            <div className="relative max-w-full">
                                <div className={cn(
                                    "rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap",
                                    msg.role === 'user' ? "bg-primary text-white" : "bg-secondary text-text-normal"
                                )}>
                                    {msg.content}
                                </div>
                                {msg.role === 'assistant' && (
                                    <button
                                        onClick={() => onThreadSelect(msg.id)}
                                        className={cn(
                                            "absolute -right-10 top-0 p-2 text-text-muted hover:text-text-normal transition-all hover:bg-secondary rounded-full",
                                            "opacity-0 group-hover:opacity-100"
                                        )}
                                        title="Start Thread"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 border-t border-secondary bg-background shrink-0">
                <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={pending ? "AI is thinking..." : "Message ArborChat..."}
                        disabled={pending}
                        className="w-full bg-secondary text-text-normal rounded-lg pl-4 pr-12 py-3 focus:outline-none focus:ring-1 focus:ring-primary placeholder-text-muted text-sm shadow-sm"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || pending}
                        className="absolute right-3 top-2.5 text-text-muted hover:text-primary disabled:opacity-50 transition-colors p-1"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    )
}
