import { Sidebar } from './Sidebar'
import { ChatWindow } from './ChatWindow'
import { ThreadPanel } from './ThreadPanel'
import { Conversation, Message } from '../types'
import { Loader2, Sparkles } from 'lucide-react'
import { cn } from '../lib/utils'

export interface LayoutProps {
    conversations: Conversation[]
    activeId: string | null
    messages: Message[]
    rootMessage: Message | null
    threadMessages: Message[]
    pending: boolean

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
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
                <span className="text-sm text-text-muted">Loading ArborChat...</span>
            </div>
        </div>
    )
}

function WelcomeState() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-8 drag-region">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-indigo-600/20 flex items-center justify-center mb-6 shadow-xl shadow-primary/10">
                <Sparkles size={36} className="text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-text-normal mb-2">
                Welcome to ArborChat
            </h2>
            <p className="text-text-muted max-w-md leading-relaxed">
                Select a conversation from the sidebar or create a new one to start chatting.
                You can branch into focused threads from any AI response.
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
                <div className={cn(
                    "flex-1 min-w-0 transition-opacity duration-300",
                    isThreadOpen && "opacity-60"
                )}>
                    {activeId ? (
                        <ChatWindow
                            messages={messages}
                            onSendMessage={onSendMessage}
                            onThreadSelect={onThreadSelect}
                            isThreadOpen={isThreadOpen}
                            pending={pending && !isThreadOpen}
                            threadTitle="Chat"
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
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
