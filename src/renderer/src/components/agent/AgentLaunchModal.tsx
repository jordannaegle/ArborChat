// src/renderer/src/components/agent/AgentLaunchModal.tsx

import { useState, useRef, useEffect } from 'react'
import { X, Bot, Rocket, Sparkles, FolderOpen, Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { AgentToolPermission } from '../../types/agent'

interface ContextSeedingOptions {
  includeCurrentMessage: boolean
  includeParentContext: boolean
  parentContextDepth: number
  includeFullConversation: boolean
  includePersona: boolean
}

interface AgentLaunchModalProps {
  isOpen: boolean
  rootContext?: string  // The message that spawned this
  hasActivePersona?: boolean
  personaName?: string
  onLaunch: (config: {
    instructions: string
    name?: string
    toolPermission: AgentToolPermission
    contextOptions: ContextSeedingOptions
    workingDirectory: string
  }) => void
  onClose: () => void
}

export function AgentLaunchModal({
  isOpen,
  rootContext,
  hasActivePersona = false,
  personaName,
  onLaunch,
  onClose
}: AgentLaunchModalProps) {
  const [instructions, setInstructions] = useState('')
  const [agentName, setAgentName] = useState('')
  const [toolPermission, setToolPermission] = useState<AgentToolPermission>('standard')
  const [workingDirectory, setWorkingDirectory] = useState('')
  
  // Context seeding options
  const [contextOptions, setContextOptions] = useState<ContextSeedingOptions>({
    includeCurrentMessage: true,
    includeParentContext: true,
    parentContextDepth: 3,
    includeFullConversation: false,
    includePersona: hasActivePersona
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setInstructions('')
      setAgentName('')
      setToolPermission('standard')
      setContextOptions({
        includeCurrentMessage: true,
        includeParentContext: true,
        parentContextDepth: 3,
        includeFullConversation: false,
        includePersona: hasActivePersona
      })
    }
  }, [isOpen, hasActivePersona])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!instructions.trim()) return
    onLaunch({
      instructions,
      name: agentName || undefined,
      toolPermission,
      contextOptions,
      workingDirectory
    })
  }

  const handleSelectDirectory = async () => {
    try {
      const result = await window.api.selectDirectory?.()
      if (result) {
        setWorkingDirectory(result)
      }
    } catch (err) {
      console.error('Failed to select directory:', err)
    }
  }

  const updateContextOption = <K extends keyof ContextSeedingOptions>(
    key: K,
    value: ContextSeedingOptions[K]
  ) => {
    setContextOptions(prev => ({ ...prev, [key]: value }))
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className={cn(
        'relative w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto',
        'bg-gradient-to-b from-tertiary to-background',
        'border border-violet-500/30 rounded-2xl',
        'shadow-2xl shadow-violet-500/10',
        'animate-in zoom-in-95 fade-in duration-200'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-violet-500/20 sticky top-0 bg-tertiary/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30">
              <Bot size={22} className="text-violet-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Launch Agent</h2>
              <p className="text-xs text-text-muted">Configure and spawn an autonomous coding agent</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-5">
          {/* Root Context Preview */}
          {rootContext && (
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                <Sparkles size={12} />
                Context from conversation
              </label>
              <div className="p-3 bg-secondary/30 rounded-lg border border-secondary/50">
                <p className="text-xs text-text-muted line-clamp-3">
                  {rootContext.length > 200 ? rootContext.slice(0, 200) + '...' : rootContext}
                </p>
              </div>
            </div>
          )}

          {/* Agent Name */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted">
              Agent Name <span className="text-text-muted/50">(optional)</span>
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="e.g., Feature Builder, Bug Fixer..."
              className={cn(
                'w-full bg-secondary/50 text-text-normal',
                'px-3 py-2.5 text-sm rounded-lg',
                'border border-secondary/50',
                'placeholder-text-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40',
                'transition-all duration-150'
              )}
            />
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted">
              Task Instructions <span className="text-red-400">*</span>
            </label>
            <textarea
              ref={textareaRef}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="What should the agent do? Be specific about the task, files to modify, and expected outcomes..."
              rows={4}
              className={cn(
                'w-full bg-secondary/50 text-text-normal',
                'px-3 py-2.5 text-sm rounded-lg',
                'border border-secondary/50',
                'placeholder-text-muted/50',
                'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40',
                'transition-all duration-150',
                'resize-none'
              )}
            />
          </div>

          {/* Context Seeding */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-muted">Context Seeding</label>
            <div className="space-y-2 p-3 bg-secondary/20 rounded-lg border border-secondary/30">
              {/* Include current message */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={contextOptions.includeCurrentMessage}
                  onChange={(e) => updateContextOption('includeCurrentMessage', e.target.checked)}
                  className="w-4 h-4 rounded border-secondary bg-secondary/50 text-violet-500 focus:ring-violet-500/30"
                />
                <span className="text-sm text-text-muted group-hover:text-text-normal transition-colors">
                  Include current message
                </span>
              </label>

              {/* Include parent context */}
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer group flex-1">
                  <input
                    type="checkbox"
                    checked={contextOptions.includeParentContext}
                    onChange={(e) => updateContextOption('includeParentContext', e.target.checked)}
                    className="w-4 h-4 rounded border-secondary bg-secondary/50 text-violet-500 focus:ring-violet-500/30"
                  />
                  <span className="text-sm text-text-muted group-hover:text-text-normal transition-colors">
                    Include parent context
                  </span>
                </label>
                {contextOptions.includeParentContext && (
                  <select
                    value={contextOptions.parentContextDepth}
                    onChange={(e) => updateContextOption('parentContextDepth', parseInt(e.target.value))}
                    className="bg-secondary/50 text-text-muted text-xs px-2 py-1 rounded border border-secondary/50 focus:outline-none focus:ring-1 focus:ring-violet-500/30"
                  >
                    <option value={1}>1 message</option>
                    <option value={3}>3 messages</option>
                    <option value={5}>5 messages</option>
                    <option value={10}>10 messages</option>
                  </select>
                )}
              </div>

              {/* Include full conversation */}
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={contextOptions.includeFullConversation}
                  onChange={(e) => updateContextOption('includeFullConversation', e.target.checked)}
                  className="w-4 h-4 rounded border-secondary bg-secondary/50 text-violet-500 focus:ring-violet-500/30"
                />
                <span className="text-sm text-text-muted group-hover:text-text-normal transition-colors">
                  Include full conversation
                </span>
              </label>

              {/* Include persona */}
              {hasActivePersona && (
                <label className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={contextOptions.includePersona}
                    onChange={(e) => updateContextOption('includePersona', e.target.checked)}
                    className="w-4 h-4 rounded border-secondary bg-secondary/50 text-violet-500 focus:ring-violet-500/30"
                  />
                  <span className="text-sm text-text-muted group-hover:text-text-normal transition-colors">
                    Include active persona {personaName && <span className="text-violet-400">({personaName})</span>}
                  </span>
                </label>
              )}
            </div>
          </div>

          {/* Tool Permissions */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-text-muted">Tool Permissions</label>
            <div className="space-y-2">
              {/* Standard */}
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                toolPermission === 'standard'
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-secondary/50 bg-secondary/20 hover:border-secondary'
              )}>
                <input
                  type="radio"
                  name="toolPermission"
                  value="standard"
                  checked={toolPermission === 'standard'}
                  onChange={() => setToolPermission('standard')}
                  className="mt-0.5 text-violet-500 focus:ring-violet-500/30"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Shield size={14} className="text-green-400" />
                    <span className="text-sm font-medium text-text-normal">Standard</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Auto-approve safe operations, require approval for moderate and dangerous
                  </p>
                </div>
              </label>

              {/* Restricted */}
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                toolPermission === 'restricted'
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-secondary/50 bg-secondary/20 hover:border-secondary'
              )}>
                <input
                  type="radio"
                  name="toolPermission"
                  value="restricted"
                  checked={toolPermission === 'restricted'}
                  onChange={() => setToolPermission('restricted')}
                  className="mt-0.5 text-violet-500 focus:ring-violet-500/30"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-amber-400" />
                    <span className="text-sm font-medium text-text-normal">Restricted</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Require approval for all tool operations
                  </p>
                </div>
              </label>

              {/* Autonomous */}
              <label className={cn(
                'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                toolPermission === 'autonomous'
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-secondary/50 bg-secondary/20 hover:border-secondary'
              )}>
                <input
                  type="radio"
                  name="toolPermission"
                  value="autonomous"
                  checked={toolPermission === 'autonomous'}
                  onChange={() => setToolPermission('autonomous')}
                  className="mt-0.5 text-violet-500 focus:ring-violet-500/30"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-blue-400" />
                    <span className="text-sm font-medium text-text-normal">Autonomous</span>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">
                    Auto-approve safe and moderate operations, only require approval for dangerous
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Working Directory */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-text-muted">
              Working Directory <span className="text-text-muted/50">(optional)</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={workingDirectory}
                onChange={(e) => setWorkingDirectory(e.target.value)}
                placeholder="/path/to/project"
                className={cn(
                  'flex-1 bg-secondary/50 text-text-normal',
                  'px-3 py-2.5 text-sm rounded-lg',
                  'border border-secondary/50',
                  'placeholder-text-muted/50',
                  'focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/40',
                  'transition-all duration-150'
                )}
              />
              <button
                type="button"
                onClick={handleSelectDirectory}
                className={cn(
                  'px-3 py-2 rounded-lg',
                  'bg-secondary/50 border border-secondary/50',
                  'text-text-muted hover:text-text-normal hover:bg-secondary',
                  'transition-colors duration-150'
                )}
                title="Browse for directory"
              >
                <FolderOpen size={18} />
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-secondary/30">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium',
                'text-text-muted hover:text-white hover:bg-secondary',
                'transition-colors duration-150'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!instructions.trim()}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium',
                'bg-gradient-to-r from-violet-500 to-purple-600',
                'text-white shadow-lg shadow-violet-500/25',
                'hover:shadow-violet-500/40 hover:scale-[1.02]',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-violet-500/25',
                'transition-all duration-150'
              )}
            >
              <Rocket size={16} />
              Launch Agent
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AgentLaunchModal
