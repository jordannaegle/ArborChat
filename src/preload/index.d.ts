import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getConversations: () => Promise<import('../renderer/src/types').Conversation[]>
      createConversation: (title: string) => Promise<import('../renderer/src/types').Conversation>
      deleteConversation: (id: string) => Promise<void>
      updateConversationTitle: (id: string, title: string) => Promise<void>
      getMessages: (conversationId: string) => Promise<import('../renderer/src/types').Message[]>
      addMessage: (
        conversationId: string,
        role: 'user' | 'assistant' | 'system',
        content: string,
        parentId: string | null
      ) => Promise<import('../renderer/src/types').Message>
      saveApiKey: (key: string) => Promise<void>
      getApiKey: () => Promise<string | undefined>
      getSelectedModel: () => Promise<string>
      setSelectedModel: (model: string) => Promise<void>
      getOllamaServerUrl: () => Promise<string>
      setOllamaServerUrl: (url: string) => Promise<void>
      getAvailableModels: (apiKey?: string) => Promise<import('../renderer/src/types').Model[]>
      checkOllamaConnection: () => Promise<boolean>
      askAI: (apiKey: string, messages: any[], model: string) => void
      onToken: (callback: (token: string) => void) => void
      onDone: (callback: () => void) => void
      onError: (callback: (err: string) => void) => void
      offAI: () => void
    }
  }
}
