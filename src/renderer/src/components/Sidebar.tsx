import { Plus, MessageSquare, Trash2, Settings, MessagesSquare, History, BookOpen, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '../lib/utils'
import { Conversation } from '../types'
import { useAgentContext } from '../contexts/AgentContext'
import { AgentList } from './agent'
import { ArborLogo } from './icons'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onRename: (id: string, title: string) => void
  onSettings: () => void
  // Phase 5: Session resumption
  onResumeSession?: () => void
  // Phase 5: Notebooks panel
  onOpenNotebooks?: () => void
}

// Tooltip component for collapsed state
function Tooltip({ children, label, show }: { children: React.ReactNode; label: string; show: boolean }) {
  if (!show) return <>{children}</>
  
  return (
    <div className="relative group">
      {children}
      <div className={cn(
        "absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50",
        "px-2 py-1 rounded-md bg-secondary text-text-normal text-xs font-medium whitespace-nowrap",
        "opacity-0 group-hover:opacity-100 pointer-events-none",
        "transition-opacity duration-150 shadow-lg border border-white/10"
      )}>
        {label}
      </div>
    </div>
  )
}

function Logo({ collapsed }: { collapsed: boolean }) {
  // iOS/macOS HIG: Icon size 30px with ~22% corner radius (≈7px)
  // Provides proper visual breathing room below window controls
  return (
    <div className={cn(
      "flex items-center gap-2.5",
      collapsed ? "justify-center px-0" : "px-1"
    )}>
      <div className="shrink-0 shadow-lg shadow-black/20 rounded-[7px] overflow-hidden">
        <ArborLogo size={30} />
      </div>
      {!collapsed && (
        <div className="flex flex-col">
          <span className="text-white font-semibold text-[15px] tracking-tight leading-tight">
            ArborChat
          </span>
          <span className="text-text-muted text-[9px] uppercase tracking-wider font-medium leading-tight">
            Threaded AI
          </span>
        </div>
      )}
    </div>
  )
}

function EmptyConversations({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center">
          <MessagesSquare size={14} className="text-text-muted" />
        </div>
      </div>
    )
  }
  
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
  onRename,
  collapsed
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => void
  onRename: (title: string) => void
  collapsed: boolean
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
    if (collapsed) return // Disable editing in collapsed mode
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

  if (collapsed) {
    return (
      <Tooltip label={conversation.title || 'New conversation'} show={true}>
        <div
          onClick={onSelect}
          className={cn(
            'group flex items-center justify-center p-2 rounded-lg cursor-pointer',
            'transition-all duration-150',
            isActive
              ? 'bg-secondary text-text-normal shadow-sm'
              : 'text-text-muted hover:text-text-normal hover:bg-secondary/40'
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect()}
          aria-selected={isActive}
          aria-label={conversation.title || 'New conversation'}
        >
          <div
            className={cn(
              'p-1.5 rounded-md transition-colors duration-150',
              isActive ? 'bg-primary/20 text-primary' : 'text-text-muted group-hover:text-text-normal'
            )}
          >
            <MessageSquare size={14} />
          </div>
        </div>
      </Tooltip>
    )
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


// Storage key for collapsed state persistence
const SIDEBAR_COLLAPSED_KEY = 'arborchat-sidebar-collapsed'

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  onSettings,
  onResumeSession,
  onOpenNotebooks
}: SidebarProps) {
  // Collapsed state with localStorage persistence
  const [collapsed, setCollapsed] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
    return stored === 'true'
  })

  // Persist collapsed state
  const toggleCollapsed = () => {
    const newState = !collapsed
    setCollapsed(newState)
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState))
  }

  // Get agent context for sidebar agent list
  const { 
    getAgentSummaries, 
    state: agentState, 
    setActiveAgent, 
    removeAgent, 
    togglePanel 
  } = useAgentContext()

  const agentSummaries = getAgentSummaries()

  // Handle agent selection - opens panel and sets active
  const handleSelectAgent = (agentId: string) => {
    setActiveAgent(agentId)
    togglePanel(true)
  }

  // Handle agent close
  const handleCloseAgent = (agentId: string) => {
    removeAgent(agentId)
  }

  // Handle agent retry - select and open panel to show retry button
  const handleRetryAgent = (agentId: string) => {
    setActiveAgent(agentId)
    togglePanel(true)
  }

  return (
    <div className={cn(
      "flex flex-col bg-tertiary h-full border-r border-secondary/50 shrink-0",
      "transition-all duration-200 ease-in-out",
      collapsed ? "w-16" : "w-72"
    )}>
      {/* Header with Logo */}
      <div className={cn(
        "border-b border-secondary/50",
        // macOS HIG: ~28px top padding clears traffic light controls
        collapsed ? "p-2 pt-7" : "p-4 pt-7"
      )}>
        <div className={cn(
          "drag-region",
          collapsed ? "mb-2" : "mb-4"
        )}>
          <Logo collapsed={collapsed} />
        </div>

        <Tooltip label="New Chat" show={collapsed}>
          <button
            onClick={onNewChat}
            className={cn(
              'flex items-center justify-center gap-2',
              'bg-primary hover:bg-primary/90 active:bg-primary/80',
              'text-white font-medium text-sm',
              'rounded-lg',
              'shadow-lg shadow-primary/20 hover:shadow-primary/30',
              'transition-all duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-tertiary',
              'no-drag',
              collapsed ? 'w-10 h-10 p-0' : 'w-full p-2.5'
            )}
            aria-label="New Chat"
          >
            <Plus size={16} strokeWidth={2.5} />
            {!collapsed && <span>New Chat</span>}
          </button>
        </Tooltip>
      </div>

      {/* Conversations List */}
      <div className={cn(
        "flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent",
        collapsed ? "p-1" : "p-2"
      )}>
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
                collapsed={collapsed}
              />
            ))}
          </div>
        ) : (
          <EmptyConversations collapsed={collapsed} />
        )}

        {/* Agent List Section */}
        {agentSummaries.length > 0 && !collapsed && (
          <div className="border-t border-secondary/50 pt-2 mt-3">
            <AgentList
              agents={agentSummaries}
              activeAgentId={agentState.activeAgentId}
              onSelectAgent={handleSelectAgent}
              onCloseAgent={handleCloseAgent}
              onRetryAgent={handleRetryAgent}
            />
          </div>
        )}
      </div>

      {/* Footer with Settings and Collapse Toggle */}
      <div className={cn(
        "border-t border-secondary/50 space-y-0.5",
        collapsed ? "p-1" : "p-2"
      )}>
        {/* Notebooks Button */}
        {onOpenNotebooks && (
          <Tooltip label="Notebooks" show={collapsed}>
            <button
              onClick={onOpenNotebooks}
              className={cn(
                'flex items-center gap-2 rounded-lg',
                'text-text-muted hover:text-amber-400 hover:bg-amber-500/10',
                'transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-amber-500/30',
                collapsed ? 'w-10 h-10 justify-center p-0' : 'w-full p-2.5'
              )}
              aria-label="Notebooks"
            >
              <BookOpen size={16} />
              {!collapsed && <span className="text-sm font-medium">Notebooks</span>}
            </button>
          </Tooltip>
        )}
        
        {/* Resume Session Button */}
        {onResumeSession && (
          <Tooltip label="Resume Session" show={collapsed}>
            <button
              onClick={onResumeSession}
              className={cn(
                'flex items-center gap-2 rounded-lg',
                'text-text-muted hover:text-text-normal hover:bg-secondary/40',
                'transition-colors duration-150',
                'focus:outline-none focus:ring-2 focus:ring-primary/30',
                collapsed ? 'w-10 h-10 justify-center p-0' : 'w-full p-2.5'
              )}
              aria-label="Resume Session"
            >
              <History size={16} />
              {!collapsed && <span className="text-sm font-medium">Resume Session</span>}
            </button>
          </Tooltip>
        )}
        
        {/* Settings Button */}
        <Tooltip label="Settings" show={collapsed}>
          <button
            onClick={onSettings}
            className={cn(
              'flex items-center gap-2 rounded-lg',
              'text-text-muted hover:text-text-normal hover:bg-secondary/40',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary/30',
              collapsed ? 'w-10 h-10 justify-center p-0' : 'w-full p-2.5'
            )}
            aria-label="Settings"
          >
            <Settings size={16} />
            {!collapsed && <span className="text-sm font-medium">Settings</span>}
          </button>
        </Tooltip>

        {/* Collapse Toggle Button */}
        <Tooltip label={collapsed ? "Expand sidebar" : "Collapse sidebar"} show={collapsed}>
          <button
            onClick={toggleCollapsed}
            className={cn(
              'flex items-center gap-2 rounded-lg',
              'text-text-muted hover:text-text-normal hover:bg-secondary/40',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary/30',
              collapsed ? 'w-10 h-10 justify-center p-0' : 'w-full p-2.5'
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <span className="text-sm font-medium">Collapse</span>}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
