import { Sidebar } from './Sidebar'
import { ChatWindow } from './ChatWindow'
import { ThreadPanel } from './ThreadPanel'
import { Conversation, Message } from '../types'
import { Loader2 } from 'lucide-react'

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
    onSendMessage: (content: string) => void
    onThreadSelect: (messageId: string) => void
    onCloseThread: () => void
    onSettings: () => void
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
    onSendMessage,
    onThreadSelect,
    onCloseThread,
    onSettings
}: LayoutProps) {

    if (conversations === null) {
        // Loading initial state
        return <div className="flex h-screen w-screen items-center justify-center bg-background text-white"><Loader2 className="animate-spin" /></div>
    }

    return (
        <div className="flex h-screen w-screen bg-background overflow-hidden text-text-normal">
            <Sidebar
                conversations={conversations}
                activeId={activeId}
                onSelect={onSelectConversation}
                onNewChat={onNewChat}
                onDelete={onDeleteConversation}
                onSettings={onSettings}
            />

            <div className="flex flex-1 min-w-0 relative">
                {activeId ? (
                    <ChatWindow
                        messages={messages}
                        onSendMessage={onSendMessage}
                        onThreadSelect={onThreadSelect}
                        isThreadOpen={!!rootMessage}
                        pending={pending}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-text-muted select-none drag-region">
                        Select or create a conversation
                    </div>
                )}

                {rootMessage && (
                    <ThreadPanel
                        rootMessage={rootMessage}
                        messages={threadMessages}
                        onSendMessage={onSendMessage}
                        onClose={onCloseThread}
                        pending={pending} // Both share pending state for now (1 generic pending)
                    />
                )}
            </div>
        </div>
    )
}
