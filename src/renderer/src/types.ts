export interface Message {
    id: string
    conversation_id: string
    role: 'user' | 'assistant' | 'system'
    content: string
    parent_message_id: string | null
    created_at: string
}

export interface Conversation {
    id: string
    title: string
    created_at: string
    updated_at: string
}
