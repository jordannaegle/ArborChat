import { Plus, MessageSquare, Trash2, Settings, MessagesSquare } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { Conversation } from '../types'
import logo from '../assets/logo.png'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onSettings: () => void
}

function Logo() {
  return (
    <div className="flex items-center gap-3 px-2">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden shadow-lg shadow-black/20 border border-white/10">
        <img src={logo} alt="ArborChat" className="w-full h-full object-cover" />
      </div>
      <div className="flex flex-col">
        <span className="text-white font-bold text-base tracking-tight leading-tight">
          ArborChat
        </span>
        <span className="text-text-muted text-[10px] uppercase tracking-wider font-medium leading-tight">
          Threaded AI
        </span>
      </div>
    </div>
  )
}

function EmptyConversations() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
        <MessagesSquare size={20} className="text-text-muted" />
      </div>
      <p className="text-sm text-text-muted">No conversations yet</p>
      <p className="text-xs text-text-muted/60 mt-1">Start a new chat to begin</p>
    </div>
  )
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditValue(conversation.title)
    setIsEditing(true)
  }

  const handleSave = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== conversation.title) {
      onRename(trimmed)
    }
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditValue(conversation.title)
      setIsEditing(false)
    }
  }

  return (
    <div
      onClick={!isEditing ? onSelect : undefined}
      className={cn(
        'group flex items-center gap-2 p-2.5 rounded-lg cursor-pointer',
        'transition-all duration-150',
        isActive
          ? 'bg-secondary text-text-normal shadow-sm'
          : 'text-text-muted hover:text-text-normal hover:bg-secondary/40'
      )}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => !isEditing && e.key === 'Enter' && onSelect()}
      aria-selected={isActive}
    >
      {/* Icon */}
      <div
        className={cn(
          'shrink-0 p-1.5 rounded-md transition-colors duration-150',
          isActive ? 'bg-primary/20 text-primary' : 'text-text-muted group-hover:text-text-normal'
        )}
      >
        <MessageSquare size={14} />
      </div>

      {/* Title - editable */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-tertiary border border-primary rounded px-2 py-0.5 text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-primary"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 truncate text-sm font-medium"
          onDoubleClick={handleDoubleClick}
          title="Double-click to rename"
        >
          {conversation.title || 'New conversation'}
        </span>
      )}

      {/* Delete button */}
      {!isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className={cn(
            'shrink-0 p-1.5 rounded-md',
            'text-text-muted hover:text-red-400 hover:bg-red-400/10',
            'opacity-0 group-hover:opacity-100 focus:opacity-100',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-red-400/30'
          )}
          aria-label={`Delete ${conversation.title || 'conversation'}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  )
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  onSettings
}: SidebarProps) {
  return (
    <div className="flex flex-col w-72 bg-tertiary h-full border-r border-secondary/50 shrink-0">
      {/* Header with Logo */}
      <div className="p-4 border-b border-secondary/50">
        <div className="drag-region mb-4">
          <Logo />
        </div>

        <button
          onClick={onNewChat}
          className={cn(
            'w-full flex items-center justify-center gap-2',
            'bg-primary hover:bg-primary/90 active:bg-primary/80',
            'text-white font-medium text-sm',
            'rounded-lg p-2.5',
            'shadow-lg shadow-primary/20 hover:shadow-primary/30',
            'transition-all duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-tertiary',
            'no-drag'
          )}
        >
          <Plus size={16} strokeWidth={2.5} />
          New Chat
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
        {conversations.length > 0 ? (
          <div className="space-y-0.5">
            {conversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={activeId === conv.id}
                onSelect={() => onSelect(conv.id)}
                onDelete={() => onDelete(conv.id)}
                onRename={(title) => onRename(conv.id, title)}
              />
            ))}
          </div>
        ) : (
          <EmptyConversations />
        )}
      </div>

      {/* Footer with Settings */}
      <div className="p-2 border-t border-secondary/50">
        <button
          onClick={onSettings}
          className={cn(
            'w-full flex items-center gap-2 p-2.5 rounded-lg',
            'text-text-muted hover:text-text-normal hover:bg-secondary/40',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary/30'
          )}
        >
          <Settings size={16} />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  )
}
