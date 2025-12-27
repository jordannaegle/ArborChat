import { useState, useEffect, useMemo, useRef } from 'react'
import { Layout } from './components/Layout'
import { ModelSelector } from './components/ModelSelector'
import { Conversation, Message } from './types'
import { Loader2 } from 'lucide-react'

function ApiKeyPrompt({ onSave }: { onSave: (k: string) => void }) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await window.api.saveApiKey(key)
    onSave(key)
    setLoading(false)
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-text-normal p-4">
      <div className="bg-secondary p-8 rounded-lg shadow-xl w-full max-w-md space-y-6 border border-tertiary">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Welcome to ArborChat</h2>
          <p className="text-text-muted">To get started, you need a Google Gemini API Key.</p>
        </div>

        <div className="bg-tertiary/50 p-4 rounded-md text-sm space-y-3 border border-tertiary">
          <h3 className="font-semibold text-white">How to get a key:</h3>
          <ol className="list-decimal list-inside space-y-2 text-text-muted">
            <li>
              Go to{' '}
              <a
                href="#"
                onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                className="text-primary hover:underline"
              >
                aistudio.google.com/app/apikey
              </a>
            </li>
            <li>Log in with Google.</li>
            <li>
              Click <strong>"Create API key"</strong>.
            </li>
            <li>Copy the key.</li>
            <li>Paste it below.</li>
          </ol>
          <div className="text-xs text-text-muted/80 pt-2 border-t border-secondary mt-2">
            Your key is stored <strong>locally</strong> in a secure database on your machine. We do
            not track or sync your keys.
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full bg-tertiary border border-gray-700 rounded p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary placeholder-text-muted/50"
            placeholder="AIzaSy..."
          />
          <button
            type="submit"
            disabled={!key || loading}
            className="w-full bg-primary hover:bg-primary/90 text-white p-3 rounded font-bold transition-transform active:scale-[0.98] disabled:opacity-50 disabled:scale-100"
          >
            {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Save Key & Start Chatting'}
          </button>
        </form>
      </div>
    </div>
  )
}

function SettingsModal({
  onClose,
  onSave,
  selectedModel,
  onModelChange
}: {
  onClose: () => void
  onSave: (k: string) => void
  selectedModel: string
  onModelChange: (model: string) => void
}) {
  const [key, setKey] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await window.api.saveApiKey(key)
    onSave(key)
    setLoading(false)
    onClose()
  }

  const handleModelChange = async (modelId: string) => {
    await window.api.setSelectedModel(modelId)
    onModelChange(modelId)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-secondary p-6 rounded-lg shadow-xl w-full max-w-md space-y-6 border border-tertiary"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-text-muted hover:text-white">
            ✕
          </button>
        </div>

        {/* Model Selection */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">AI Model</h3>
          <p className="text-xs text-text-muted">Choose which Gemini model to use for chat.</p>
          <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white">Update API Key</h3>
          <p className="text-xs text-text-muted">Enter a new key to overwrite the current one.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full bg-tertiary border border-gray-700 rounded p-3 text-white focus:outline-none focus:ring-2 focus:ring-primary placeholder-text-muted/50"
            placeholder="AIzaSy... (New Key)"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded text-text-normal hover:bg-tertiary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!key || loading}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              Save New Key
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function App() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')

  // Data
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [allMessages, setAllMessages] = useState<Message[]>([])

  // Threading
  const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null)

  // Streaming state
  const [pending, setPending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const streamBufferRef = useRef('')

  // Init
  useEffect(() => {
    Promise.all([window.api.getApiKey(), window.api.getSelectedModel()]).then(([key, model]) => {
      if (key) setApiKey(key)
      if (model) setSelectedModel(model)
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (apiKey) refreshConversations()
  }, [apiKey])

  useEffect(() => {
    if (activeId) {
      window.api.getMessages(activeId).then(setAllMessages)
      setActiveThreadRootId(null)
    } else {
      setAllMessages([])
    }
  }, [activeId])

  const refreshConversations = () => {
    window.api.getConversations().then(setConversations)
  }

  // Views
  const mainMessages = useMemo(() => {
    const base = allMessages.filter((m) => !m.parent_message_id)
    if (pending && streamingContent && !activeThreadRootId) {
      return [
        ...base,
        {
          id: 'temp-streaming',
          conversation_id: activeId!,
          role: 'assistant' as const,
          content: streamingContent,
          parent_message_id: null,
          created_at: new Date().toISOString()
        }
      ]
    }
    return base
  }, [allMessages, pending, streamingContent, activeThreadRootId, activeId])

  const threadMessages = useMemo(() => {
    if (!activeThreadRootId) return []
    const base = allMessages.filter((m) => m.parent_message_id === activeThreadRootId)
    if (pending && streamingContent && activeThreadRootId) {
      return [
        ...base,
        {
          id: 'temp-streaming',
          conversation_id: activeId!,
          role: 'assistant' as const,
          content: streamingContent,
          parent_message_id: activeThreadRootId,
          created_at: new Date().toISOString()
        }
      ]
    }
    return base
  }, [allMessages, activeThreadRootId, pending, streamingContent, activeId])

  const rootMessage = useMemo(() => {
    return allMessages.find((m) => m.id === activeThreadRootId) || null
  }, [allMessages, activeThreadRootId])

  // Logic
  const handleSendMessage = async (content: string) => {
    if (!activeId || !apiKey || pending) return

    const parentId = activeThreadRootId

    // Save User Message
    const userMsg = await window.api.addMessage(activeId, 'user', content, parentId)
    setAllMessages((prev) => [...prev, userMsg])

    // Auto-name conversation from first user message (if still "New Chat")
    const currentConv = conversations.find((c) => c.id === activeId)
    if (currentConv && currentConv.title === 'New Chat' && !parentId) {
      const autoTitle = content.length > 40 ? content.slice(0, 40) + '...' : content
      await window.api.updateConversationTitle(activeId, autoTitle)
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, title: autoTitle } : c))
      )
    }

    // Build Context (Isolated Threading Logic)
    const system: { role: 'system'; content: string } = {
      role: 'system',
      content: 'You are ArborChat, an intelligent assistant.'
    }

    let context: any[] = []

    if (parentId) {
      // Thread Context: Only Root + Thread History
      const root = allMessages.find((m) => m.id === parentId)
      if (!root) return

      context = [
        system,
        { role: 'user', content: `[Context: Thread on previous message: "${root.content}"]` }, // Provide context about what we are threading on
        ...threadMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: content }
      ]
    } else {
      // Main Context
      context = [
        system,
        ...mainMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: content }
      ]
    }

    // Stream
    setPending(true)
    setStreamingContent('')
    streamBufferRef.current = ''

    const cleanup = () => {
      window.api.offAI()
    }

    window.api.onToken((token) => {
      streamBufferRef.current += token
      setStreamingContent(streamBufferRef.current)
    })

    window.api.onDone(async () => {
      const finalContent = streamBufferRef.current
      cleanup()
      setPending(false)
      if (!finalContent) return

      const aiMsg = await window.api.addMessage(activeId, 'assistant', finalContent, parentId)
      setAllMessages((prev) => [...prev, aiMsg])
      setStreamingContent('')
    })

    window.api.onError((err) => {
      console.error(err)
      cleanup()
      setPending(false)

      // Inject error message into chat
      const errorMsg = {
        id: 'error-' + Date.now(),
        conversation_id: activeId!,
        role: 'assistant' as const,
        content: `⚠️ **Error**: ${err}. Please check your API Key quota.`,
        parent_message_id: parentId,
        created_at: new Date().toISOString()
      }
      setAllMessages((prev) => [...prev, errorMsg])
      // Optionally save to DB if we want errors to persist, but maybe not for transient API errors.
      // For now, just show it.
    })

    window.api.askAI(apiKey, context, selectedModel)
  }

  if (loading)
    return (
      <div className="h-screen bg-background flex items-center justify-center text-white">
        <Loader2 className="animate-spin" />
      </div>
    )
  if (!apiKey) return <ApiKeyPrompt onSave={setApiKey} />

  return (
    <>
      <Layout
        conversations={conversations}
        activeId={activeId}
        messages={mainMessages}
        rootMessage={rootMessage}
        threadMessages={threadMessages}
        pending={pending}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        onSelectConversation={setActiveId}
        onNewChat={async () => {
          const c = await window.api.createConversation('New Chat')
          setConversations([c, ...conversations])
          setActiveId(c.id)
        }}
        onDeleteConversation={async (id) => {
          await window.api.deleteConversation(id)
          refreshConversations()
          if (activeId === id) setActiveId(null)
        }}
        onRenameConversation={async (id, title) => {
          await window.api.updateConversationTitle(id, title)
          setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
        }}
        onSendMessage={handleSendMessage}
        onThreadSelect={setActiveThreadRootId}
        onCloseThread={() => setActiveThreadRootId(null)}
        onSettings={() => setIsSettingsOpen(true)}
      />
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          onSave={setApiKey}
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      )}
    </>
  )
}

export default App
