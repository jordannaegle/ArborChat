import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Layout } from './components/Layout'
import { MCPProvider } from './components/mcp'
import { SettingsPanel } from './components/settings'
import { PersonaListModal } from './components/chat'
import { AgentProvider, useAgentContext } from './contexts'
import { AgentLaunchModal, AgentIndicator, AgentPanelContainer } from './components/agent'
import { Conversation, Message } from './types'
import { PersonaMetadata } from './types/persona'
import type { AgentToolPermission, AgentMessage } from './types/agent'
import { Loader2 } from 'lucide-react'
import { useToolChat } from './hooks'

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


// Main content component that uses MCP hooks (must be inside MCPProvider)
function AppContent({ apiKey }: { apiKey: string }) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash')

  // Data
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [allMessages, setAllMessages] = useState<Message[]>([])

  // Threading
  const [activeThreadRootId, setActiveThreadRootId] = useState<string | null>(null)

  // Persona State (Phase 5)
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null)
  const [activePersonaContent, setActivePersonaContent] = useState<string | null>(null)
  const [personas, setPersonas] = useState<PersonaMetadata[]>([])
  const [showPersonaList, setShowPersonaList] = useState(false)

  // Streaming state
  const [pending, setPending] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const streamBufferRef = useRef('')
  
  // Tool chat integration
  const {
    mcpConnected,
    pendingToolCall,
    toolExecutions,
    isProcessingTool,
    buildSystemPrompt,
    parseToolCall,
    showToolApprovalCard,
    executeToolDirectly,
    handleToolApprove,
    handleToolReject,
    clearPendingTool
  } = useToolChat()
  
  // Agent state (Phase 1)
  const [showAgentLaunchModal, setShowAgentLaunchModal] = useState(false)
  const [agentLaunchContext, setAgentLaunchContext] = useState<string | undefined>(undefined)
  const agentContext = useAgentContext()
  
  // Refs for continuation context
  const pendingContextRef = useRef<any[]>([])
  const pendingParentIdRef = useRef<string | null>(null)

  // Init
  useEffect(() => {
    window.api.getSelectedModel().then((model) => {
      if (model) setSelectedModel(model)
    })
  }, [])

  useEffect(() => {
    refreshConversations()
  }, [])

  useEffect(() => {
    if (activeId) {
      // CRITICAL: Clear all message and streaming state synchronously FIRST
      // This prevents old chat content from flashing during the async fetch
      setAllMessages([])
      setStreamingContent('')
      streamBufferRef.current = ''
      setPending(false)
      setActiveThreadRootId(null)
      clearPendingTool()
      
      // Then fetch messages for the new conversation
      window.api.getMessages(activeId).then(setAllMessages)
    } else {
      setAllMessages([])
      setStreamingContent('')
      streamBufferRef.current = ''
      setPending(false)
    }
  }, [activeId, clearPendingTool])

  // Load personas list on mount (Phase 5)
  useEffect(() => {
    window.api.personas.list()
      .then(setPersonas)
      .catch(err => console.warn('[App] Failed to load personas:', err))
  }, [])

  // Load persona content when active persona changes (Phase 5)
  useEffect(() => {
    if (activePersonaId) {
      window.api.personas.getPrompt(activePersonaId)
        .then(setActivePersonaContent)
        .catch(err => {
          console.warn('[App] Failed to load persona content:', err)
          setActivePersonaContent(null)
        })
    } else {
      setActivePersonaContent(null)
    }
  }, [activePersonaId])

  // Derive active persona name from personas list (Phase 5)
  const activePersonaName = useMemo(() => {
    if (!activePersonaId) return null
    const persona = personas.find(p => p.id === activePersonaId)
    return persona?.name || null
  }, [activePersonaId, personas])

  // Refresh personas when returning from settings (Phase 5)
  const refreshPersonas = useCallback(() => {
    window.api.personas.list()
      .then(setPersonas)
      .catch(err => console.warn('[App] Failed to refresh personas:', err))
  }, [])

  const refreshConversations = () => {
    window.api.getConversations().then(setConversations)
  }

  // Agent launch handler (Phase 1)
  const handleAgentLaunch = useCallback((messageContent: string) => {
    setAgentLaunchContext(messageContent)
    setShowAgentLaunchModal(true)
  }, [])

  // Handle agent creation from modal
  const handleAgentCreate = useCallback((config: {
    instructions: string
    name?: string
    toolPermission: AgentToolPermission
    contextOptions: {
      includeCurrentMessage: boolean
      includeParentContext: boolean
      parentContextDepth: number
      includeFullConversation: boolean
      includePersona: boolean
    }
    workingDirectory: string
  }) => {
    if (!activeId) return

    // Convert messages to agent format
    const conversationMessages: AgentMessage[] = allMessages.map(m => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.created_at
    }))

    // Create the agent
    agentContext.createAgent({
      name: config.name,
      instructions: config.instructions,
      conversationId: activeId,
      sourceMessageContent: agentLaunchContext,
      model: selectedModel,
      toolPermission: config.toolPermission,
      workingDirectory: config.workingDirectory,
      personaId: config.contextOptions.includePersona ? activePersonaId || undefined : undefined,
      personaContent: config.contextOptions.includePersona ? activePersonaContent || undefined : undefined,
      includeCurrentMessage: config.contextOptions.includeCurrentMessage,
      includeParentContext: config.contextOptions.includeParentContext,
      parentContextDepth: config.contextOptions.parentContextDepth,
      includeFullConversation: config.contextOptions.includeFullConversation,
      includePersona: config.contextOptions.includePersona,
      conversationMessages
    })

    setShowAgentLaunchModal(false)
    setAgentLaunchContext(undefined)
  }, [activeId, allMessages, agentLaunchContext, selectedModel, activePersonaId, activePersonaContent, agentContext])


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


  // Stream AI response with tool detection
  const streamAI = useCallback((context: any[], parentId: string | null) => {
    setPending(true)
    setStreamingContent('')
    streamBufferRef.current = ''
    pendingContextRef.current = context
    pendingParentIdRef.current = parentId

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
      
      if (!finalContent) {
        setPending(false)
        return
      }

      // Debug: Log AI response for tool detection
      console.log('[App] AI Response:', finalContent.substring(0, 500))

      // Parse tool calls WITHOUT setting state first
      const { hasToolCall, cleanContent, toolName, toolArgs, toolExplanation } = parseToolCall(finalContent)
      
      if (hasToolCall && toolName && toolArgs) {
        // Tool detected - check if it's in the always-approve list BEFORE showing card
        setStreamingContent(cleanContent)
        
        try {
          const config = await window.api.mcp.getConfig()
          const alwaysApproveTools = config.alwaysApproveTools || []
          
          if (alwaysApproveTools.includes(toolName)) {
            // Auto-approve: execute directly without showing card
            console.log(`[App] Auto-approving always-approved tool: ${toolName}`)
            
            // Save the AI message with the tool request
            const aiMsg = await window.api.addMessage(
              activeId!, 
              'assistant', 
              finalContent,
              parentId
            )
            setAllMessages((prev) => [...prev, aiMsg])
            
            // Execute tool directly
            const toolResultContext = await executeToolDirectly(toolName, toolArgs, toolExplanation)
            
            // Build continuation context with tool result
            const continueContext = [
              ...pendingContextRef.current,
              { role: 'assistant', content: finalContent },
              { role: 'user', content: `Tool execution result:\n\n${toolResultContext}\n\nPlease continue based on this result.` }
            ]

            setStreamingContent('')
            
            // Continue the conversation
            streamAI(continueContext, parentId)
          } else {
            // Not auto-approved: show the approval card
            console.log('[App] Tool call detected, waiting for approval')
            showToolApprovalCard(finalContent, toolName, toolArgs, toolExplanation)
            setPending(false)
          }
        } catch (error) {
          console.error('[App] Error checking auto-approval:', error)
          // On error, show the approval card as fallback
          showToolApprovalCard(finalContent, toolName, toolArgs, toolExplanation)
          setPending(false)
        }
      } else {
        // Normal message, save it
        console.log('[App] No tool call detected')
        const aiMsg = await window.api.addMessage(activeId!, 'assistant', finalContent, parentId)
        setAllMessages((prev) => [...prev, aiMsg])
        setStreamingContent('')
        setPending(false)
      }
    })

    window.api.onError((err) => {
      console.error(err)
      cleanup()
      setPending(false)

      const errorMsg = {
        id: 'error-' + Date.now(),
        conversation_id: activeId!,
        role: 'assistant' as const,
        content: `⚠️ **Error**: ${err}. Please check your API Key quota.`,
        parent_message_id: parentId,
        created_at: new Date().toISOString()
      }
      setAllMessages((prev) => [...prev, errorMsg])
    })

    window.api.askAI(apiKey, context, selectedModel)
  }, [activeId, apiKey, selectedModel, parseToolCall, showToolApprovalCard, executeToolDirectly])


  // Handle sending a message
  const handleSendMessage = async (content: string) => {
    if (!activeId || pending) return

    const parentId = activeThreadRootId

    // Save User Message
    const userMsg = await window.api.addMessage(activeId, 'user', content, parentId)
    setAllMessages((prev) => [...prev, userMsg])

    // Auto-name conversation from first user message
    const currentConv = conversations.find((c) => c.id === activeId)
    if (currentConv && currentConv.title === 'New Chat' && !parentId) {
      const autoTitle = content.length > 40 ? content.slice(0, 40) + '...' : content
      await window.api.updateConversationTitle(activeId, autoTitle)
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, title: autoTitle } : c))
      )
    }

    // Build Context with MCP tool instructions and persona (Phase 5)
    let basePrompt = 'You are ArborChat, an intelligent assistant.'
    
    // Prepend persona content if active (Phase 5)
    if (activePersonaContent) {
      basePrompt = `${activePersonaContent}\n\n---\n\n${basePrompt}`
    }
    
    const system: { role: 'system'; content: string } = {
      role: 'system',
      content: buildSystemPrompt(basePrompt)
    }

    let context: any[] = []

    if (parentId) {
      const root = allMessages.find((m) => m.id === parentId)
      if (!root) return

      context = [
        system,
        { role: 'user', content: `[Context: Thread on previous message: "${root.content}"]` },
        ...threadMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: content }
      ]
    } else {
      context = [
        system,
        ...mainMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: content }
      ]
    }

    streamAI(context, parentId)
  }


  // Handle tool approval - execute and continue conversation
  const onToolApprove = async (id: string, modifiedArgs?: Record<string, unknown>) => {
    if (!activeId || !pendingToolCall) return

    const parentId = pendingParentIdRef.current
    
    try {
      // Save the AI message with the tool request (cleaned content)
      const aiMsg = await window.api.addMessage(
        activeId, 
        'assistant', 
        pendingToolCall.originalContent,
        parentId
      )
      setAllMessages((prev) => [...prev, aiMsg])
      
      // Execute tool and get result
      const toolResultContext = await handleToolApprove(id, modifiedArgs)
      
      // Build continuation context with tool result (system prompt is in pendingContextRef)
      const continueContext = [
        ...pendingContextRef.current,
        { role: 'assistant', content: pendingToolCall.originalContent },
        { role: 'user', content: `Tool execution result:\n\n${toolResultContext}\n\nPlease continue based on this result.` }
      ]

      setStreamingContent('')
      
      // Continue the conversation
      streamAI(continueContext, parentId)
      
    } catch (error) {
      console.error('[App] Tool execution failed:', error)
      setStreamingContent('')
    }
  }

  // Handle tool rejection
  const onToolReject = (id: string) => {
    if (!pendingToolCall) return
    
    handleToolReject(id)
    setStreamingContent('')
    
    // Optionally show a message that the tool was rejected
    const rejectMsg = {
      id: 'reject-' + Date.now(),
      conversation_id: activeId!,
      role: 'assistant' as const,
      content: `${pendingToolCall.cleanContent}\n\n*Tool request \`${pendingToolCall.tool}\` was rejected by user.*`,
      parent_message_id: pendingParentIdRef.current,
      created_at: new Date().toISOString()
    }
    setAllMessages((prev) => [...prev, rejectMsg])
  }

  // Handle tool always approve - add to always-approve list and execute
  const onToolAlwaysApprove = async (id: string, toolName: string, modifiedArgs?: Record<string, unknown>) => {
    if (!activeId || !pendingToolCall) return

    try {
      // Get current config and add tool to always-approve list
      const currentConfig = await window.api.mcp.getConfig()
      const alwaysApproveTools = currentConfig.alwaysApproveTools || []
      
      if (!alwaysApproveTools.includes(toolName)) {
        await window.api.mcp.updateConfig({
          alwaysApproveTools: [...alwaysApproveTools, toolName]
        })
        console.log(`[App] Added ${toolName} to always-approve list`)
      }
      
      // Then proceed with regular approval
      await onToolApprove(id, modifiedArgs)
    } catch (error) {
      console.error('[App] Always approve failed:', error)
      // Fall back to regular approval
      await onToolApprove(id, modifiedArgs)
    }
  }


  return (
    <>
      <Layout
        conversations={conversations}
        activeId={activeId}
        messages={mainMessages}
        rootMessage={rootMessage}
        threadMessages={threadMessages}
        pending={pending || isProcessingTool}
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
        // MCP Tool Props
        mcpConnected={mcpConnected}
        pendingToolCall={pendingToolCall}
        toolExecutions={toolExecutions}
        onToolApprove={onToolApprove}
        onToolAlwaysApprove={onToolAlwaysApprove}
        onToolReject={onToolReject}
        // Persona Props (Phase 5)
        activePersonaId={activePersonaId}
        activePersonaName={activePersonaName}
        onActivatePersona={setActivePersonaId}
        onShowPersonaList={() => setShowPersonaList(true)}
        // Agent Props (Phase 1)
        onAgentLaunch={handleAgentLaunch}
      />
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false)
          refreshPersonas() // Refresh personas when settings close
        }}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
        activePersonaId={activePersonaId}
        onActivatePersona={setActivePersonaId}
      />
      {/* Persona List Modal (Phase 5) */}
      <PersonaListModal
        isOpen={showPersonaList}
        activePersonaId={activePersonaId}
        onClose={() => setShowPersonaList(false)}
        onSelect={(id) => {
          setActivePersonaId(id)
          setShowPersonaList(false)
        }}
      />
      {/* Agent Launch Modal (Phase 1) */}
      <AgentLaunchModal
        isOpen={showAgentLaunchModal}
        rootContext={agentLaunchContext}
        hasActivePersona={!!activePersonaId}
        personaName={activePersonaName || undefined}
        onLaunch={handleAgentCreate}
        onClose={() => {
          setShowAgentLaunchModal(false)
          setAgentLaunchContext(undefined)
        }}
      />
      {/* Agent Indicator - shows when agents are active (Phase 1) */}
      {Object.keys(agentContext.state.agents).length > 0 && (
        <AgentIndicator
          agents={Object.values(agentContext.state.agents)}
          activeAgentId={agentContext.state.activeAgentId || undefined}
          onSelectAgent={(id) => {
            agentContext.setActiveAgent(id)
            agentContext.togglePanel(true)
          }}
        />
      )}
      {/* Agent Panel - shows when panel is open with active agent (Phase 2) */}
      {agentContext.state.isPanelOpen && agentContext.state.activeAgentId && (
        <div className="fixed right-0 top-0 h-screen z-50">
          <AgentPanelContainer
            agentId={agentContext.state.activeAgentId}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            onClose={() => {
              agentContext.togglePanel(false)
            }}
            onMinimize={() => {
              agentContext.toggleMinimize(true)
              agentContext.togglePanel(false)
            }}
          />
        </div>
      )}
    </>
  )
}


function App() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.getApiKey().then((key) => {
      if (key) setApiKey(key)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center text-white">
        <Loader2 className="animate-spin" />
      </div>
    )
  }

  if (!apiKey) {
    return <ApiKeyPrompt onSave={setApiKey} />
  }

  return (
    <MCPProvider autoInit={true}>
      <AgentProvider>
        <AppContent apiKey={apiKey} />
      </AgentProvider>
    </MCPProvider>
  )
}

export default App
