import { Sidebar } from './Sidebar'
import { ChatWindow } from './ChatWindow'
import { ThreadPanel } from './ThreadPanel'
import { Conversation, Message } from '../types'
import { Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'
import logo from '../assets/logo.png'

export interface LayoutProps {
  conversations: Conversation[]
  activeId: string | null
  messages: Message[]
  rootMessage: Message | null
  threadMessages: Message[]
  pending: boolean
  selectedModel: string
  onModelChange: (modelId: string) => void

  onSelectConversation: (id: string) => void
  onNewChat: () => void
  onDeleteConversation: (id: string) => void
  onRenameConversation: (id: string, title: string) => void
  onSendMessage: (content: string) => void
  onThreadSelect: (messageId: string) => void
  onCloseThread: () => void
  onSettings: () => void
}

function LoadingState() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-2xl shadow-primary/20 border border-white/5">
            <img src={logo} alt="ArborChat" className="w-full h-full object-cover" />
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg bg-secondary flex items-center justify-center border border-white/10 shadow-lg">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-bold text-white tracking-tight">ArborChat</span>
          <span className="text-xs text-text-muted animate-pulse capitalize">
            Setting up your workspace...
          </span>
        </div>
      </div>
    </div>
  )
}

function WelcomeState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 drag-region">
      <div className="w-24 h-24 rounded-3xl overflow-hidden mb-8 shadow-2xl shadow-primary/10 border border-white/5 transform hover:scale-105 transition-transform duration-500">
        <img src={logo} alt="ArborChat" className="w-full h-full object-cover" />
      </div>
      <h2 className="text-3xl font-bold text-white mb-3 tracking-tight">Welcome to ArborChat</h2>
      <p className="text-text-muted max-w-sm leading-relaxed text-base">
        Your intelligent companion for focus and deep work. Start a thread, branch your thoughts,
        and grow your ideas.
      </p>
    </div>
  )
}

export function Layout({
  conversations,
  activeId,
  messages,
  rootMessage,
  threadMessages,
  pending,
  selectedModel,
  onModelChange,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onRenameConversation,
  onSendMessage,
  onThreadSelect,
  onCloseThread,
  onSettings
}: LayoutProps) {
  const isThreadOpen = !!rootMessage

  if (conversations === null) {
    return <LoadingState />
  }

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden text-text-normal">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
        onDelete={onDeleteConversation}
        onRename={onRenameConversation}
        onSettings={onSettings}
      />

      {/* Main content area */}
      <div className="flex flex-1 min-w-0 relative">
        {/* Main chat - dims slightly when thread is open */}
        <div
          className={cn(
            'flex-1 min-w-0 transition-opacity duration-300',
            isThreadOpen && 'opacity-60'
          )}
        >
          {activeId ? (
            <ChatWindow
              messages={messages}
              onSendMessage={onSendMessage}
              onThreadSelect={onThreadSelect}
              isThreadOpen={isThreadOpen}
              pending={pending && !isThreadOpen}
              threadTitle="Chat"
              selectedModel={selectedModel}
              onModelChange={onModelChange}
            />
          ) : (
            <WelcomeState />
          )}
        </div>

        {/* Thread panel overlay */}
        {isThreadOpen && (
          <>
            {/* Clickable backdrop to close thread */}
            <div
              className="absolute inset-0 z-10 cursor-pointer"
              onClick={onCloseThread}
              aria-hidden="true"
            />

            {/* Thread panel */}
            <div className="relative z-20">
              <ThreadPanel
                rootMessage={rootMessage}
                messages={threadMessages}
                onSendMessage={onSendMessage}
                onClose={onCloseThread}
                pending={pending}
                selectedModel={selectedModel}
                onModelChange={onModelChange}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
