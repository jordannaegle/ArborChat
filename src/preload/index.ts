import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  getConversations: () => ipcRenderer.invoke('db:get-conversations'),
  createConversation: (title: string) => ipcRenderer.invoke('db:create-conversation', title),
  deleteConversation: (id: string) => ipcRenderer.invoke('db:delete-conversation', id),
  updateConversationTitle: (id: string, title: string) =>
    ipcRenderer.invoke('db:update-conversation-title', { id, title }),
  getMessages: (conversationId: string) => ipcRenderer.invoke('db:get-messages', conversationId),
  addMessage: (conversationId: string, role: string, content: string, parentId: string | null) =>
    ipcRenderer.invoke('db:add-message', { conversationId, role, content, parentId }),
  saveApiKey: (key: string) => ipcRenderer.invoke('settings:save-key', key),
  getApiKey: () => ipcRenderer.invoke('settings:get-key'),
  getSelectedModel: () => ipcRenderer.invoke('settings:get-model'),
  setSelectedModel: (model: string) => ipcRenderer.invoke('settings:set-model', model),
  getOllamaServerUrl: () => ipcRenderer.invoke('settings:get-ollama-url'),
  setOllamaServerUrl: (url: string) => ipcRenderer.invoke('settings:set-ollama-url', url),
  // Model Discovery
  getAvailableModels: (apiKey?: string) => ipcRenderer.invoke('models:get-available', { apiKey }),
  checkOllamaConnection: () => ipcRenderer.invoke('ollama:check-connection'),
  // AI Communication
  askAI: (apiKey: string, messages: any[], model: string) =>
    ipcRenderer.send('ai:ask', { apiKey, messages, model }),
  onToken: (callback: (token: string) => void) =>
    ipcRenderer.on('ai:token', (_, token) => callback(token)),
  onDone: (callback: () => void) => ipcRenderer.on('ai:done', () => callback()),
  onError: (callback: (err: string) => void) =>
    ipcRenderer.on('ai:error', (_, err) => callback(err)),
  offAI: () => {
    ipcRenderer.removeAllListeners('ai:token')
    ipcRenderer.removeAllListeners('ai:done')
    ipcRenderer.removeAllListeners('ai:error')
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
