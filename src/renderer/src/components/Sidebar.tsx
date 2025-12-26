import { Plus, MessageSquare, Trash, Settings } from 'lucide-react'
import { cn } from '../lib/utils'
import { Conversation } from '../types'

interface SidebarProps {
    conversations: Conversation[]
    activeId: string | null
    onSelect: (id: string) => void
    onNewChat: () => void
    onDelete: (id: string) => void
    onSettings: () => void
}

export function Sidebar({ conversations, activeId, onSelect, onNewChat, onDelete, onSettings }: SidebarProps) {
    return (
        <div className="flex flex-col w-72 bg-tertiary h-full border-r border-secondary shrink-0">
            <div className="p-4 border-b border-secondary drag-region">
                <h1 className="text-white font-bold mb-4 px-2">ArborChat</h1>
                <button
                    onClick={onNewChat}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white rounded-md p-2 transition-colors font-medium text-sm no-drag shadow-sm"
                >
                    <Plus size={16} />
                    New Chat
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {conversations.map((conv) => (
                    <div
                        key={conv.id}
                        onClick={() => onSelect(conv.id)}
                        className={cn(
                            "group flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-secondary/50 transition-colors text-text-muted hover:text-text-normal",
                            activeId === conv.id && "bg-secondary text-text-normal"
                        )}
                    >
                        <div className="flex items-center gap-2 truncate min-w-0">
                            <MessageSquare size={16} className="shrink-0" />
                            <span className="truncate text-sm font-medium">{conv.title || 'Untitled Chat'}</span>
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(conv.id) }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-400 text-text-muted transition-opacity p-1 rounded hover:bg-tertiary"
                        >
                            <Trash size={14} />
                        </button>
                    </div>
                ))}
            </div>

            <div className="p-2 border-t border-secondary">
                <button
                    onClick={onSettings}
                    className="w-full flex items-center gap-2 text-text-muted hover:text-text-normal hover:bg-secondary/50 rounded-md p-2 transition-colors text-sm font-medium"
                >
                    <Settings size={16} />
                    Settings
                </button>
            </div>
        </div>
    )
}
