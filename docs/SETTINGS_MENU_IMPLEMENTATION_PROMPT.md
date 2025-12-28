# Settings Menu Implementation Prompt

**Use this prompt in a new Claude window to implement the Settings Menu redesign.**

---

## Project Context

You are implementing a Settings Menu redesign for **ArborChat**, an Electron-based AI chat application.

### Project Location
```
/Users/cory.naegle/ArborChat
```

### Tech Stack
- **Framework:** Electron with electron-vite
- **Frontend:** React 18 + TypeScript
- **Styling:** Tailwind CSS (custom dark theme)
- **State:** React hooks (useState, useEffect)
- **IPC:** Electron preload bridge pattern

### Design Document
Full design specs are at: `/Users/cory.naegle/ArborChat/docs/SETTINGS_MENU_DESIGN.md`

---

## Task Overview

Replace the current simple `SettingsModal` popup with a full-featured **Settings Panel** that includes:

1. **Slide-out panel** instead of centered modal
2. **Left navigation menu** with sections
3. **API Keys section** - Manage provider credentials and model selection
4. **Tools section** - Enable/disable MCP servers with configuration modals
5. **GitHub configuration modal** - PAT entry and account management

---

## Current Architecture

### Files to Understand First

Read these files to understand the existing patterns:

```
src/renderer/src/App.tsx                    # Current SettingsModal lives here
src/renderer/src/components/Sidebar.tsx     # Settings button that triggers modal
src/renderer/src/components/ModelSelector.tsx # Existing model selector component
src/renderer/src/components/mcp/MCPProvider.tsx # MCP context provider
src/preload/index.d.ts                      # API type definitions
src/main/mcp/types.ts                       # MCP type definitions
src/main/mcp/ipc.ts                         # MCP IPC handlers
src/renderer/src/lib/utils.ts               # cn() utility function
```

### Existing IPC APIs Available

```typescript
// API Keys & Models
window.api.saveApiKey(key: string): Promise<void>
window.api.getApiKey(): Promise<string | undefined>
window.api.getSelectedModel(): Promise<string>
window.api.setSelectedModel(model: string): Promise<void>
window.api.getAvailableModels(apiKey?: string): Promise<Model[]>

// MCP
window.api.mcp.getStatus(): Promise<MCPStatusResult>
window.api.mcp.getConfig(): Promise<MCPConfig>
window.api.mcp.updateConfig(updates: Partial<MCPConfig>): Promise<MCPConfig>
window.api.mcp.reconnect(): Promise<MCPInitResult>

// GitHub MCP
window.api.mcp.github.isConfigured(): Promise<boolean>
window.api.mcp.github.configure(token: string): Promise<GitHubConfigureResult>
window.api.mcp.github.disconnect(): Promise<{ success: boolean }>
window.api.mcp.github.getStatus(): Promise<GitHubStatus>
```

### Existing Types

```typescript
interface MCPConfig {
  enabled: boolean
  autoApprove: { safe: boolean; moderate: boolean }
  allowedDirectories: string[]
  blockedTools: string[]
  timeout: number
  servers: Array<{
    name: string
    command: string
    args: string[]
    enabled: boolean
  }>
}

interface GitHubStatus {
  isConfigured: boolean
  isConnected: boolean
  toolCount: number
  username?: string
}

interface GitHubConfigureResult {
  success: boolean
  tools?: MCPToolDefinition[]
  username?: string
  error?: string
}
```

---

## Implementation Requirements

### Step 1: Create Directory Structure

Create the following directory structure:

```
src/renderer/src/components/settings/
├── SettingsPanel.tsx
├── index.ts
├── sections/
│   ├── APIKeysSection.tsx
│   ├── ToolsSection.tsx
│   └── index.ts
├── modals/
│   ├── GitHubConfigModal.tsx
│   └── index.ts
└── shared/
    ├── ToggleSwitch.tsx
    └── index.ts
```

### Step 2: Add CSS Animations

Add to `src/renderer/src/assets/main.css`:

```css
/* Settings Panel Animations */
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slide-out-right {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

@keyframes scale-in {
  from {
    transform: scale(0.95);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out forwards;
}

.animate-slide-out-right {
  animation: slide-out-right 0.2s ease-in forwards;
}

.animate-scale-in {
  animation: scale-in 0.15s ease-out forwards;
}

.animate-fade-in {
  animation: fade-in 0.15s ease-out forwards;
}
```

### Step 3: Create ToggleSwitch Component

Create `src/renderer/src/components/settings/shared/ToggleSwitch.tsx`:

```tsx
import { cn } from '../../../lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function ToggleSwitch({ 
  checked, 
  onChange, 
  disabled = false,
  size = 'md' 
}: ToggleSwitchProps) {
  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-3 w-3', translate: 'translate-x-5' },
    md: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-6' }
  }

  const s = sizes[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center rounded-full",
        "transition-colors duration-200 ease-in-out",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
        s.track,
        checked ? "bg-primary" : "bg-secondary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-lg",
          "transform transition-transform duration-200 ease-in-out",
          s.thumb,
          checked ? s.translate : "translate-x-1"
        )}
      />
    </button>
  )
}
```

### Step 4: Create SettingsPanel Component

Create `src/renderer/src/components/settings/SettingsPanel.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { X, Key, Wrench, Settings2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { APIKeysSection } from './sections/APIKeysSection'
import { ToolsSection } from './sections/ToolsSection'

type SettingsSection = 'api-keys' | 'tools'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  // Pass through props needed by sections
  selectedModel: string
  onModelChange: (model: string) => void
}

const MENU_ITEMS = [
  {
    id: 'api-keys' as const,
    label: 'API Keys',
    icon: Key,
    description: 'Manage provider credentials'
  },
  {
    id: 'tools' as const,
    label: 'Tools',
    icon: Wrench,
    description: 'Configure MCP servers'
  }
]

export function SettingsPanel({ 
  isOpen, 
  onClose,
  selectedModel,
  onModelChange
}: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('api-keys')
  const [isClosing, setIsClosing] = useState(false)

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose()
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }, [onClose])

  if (!isOpen && !isClosing) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Backdrop */}
      <div 
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm",
          isClosing ? "animate-fade-out" : "animate-fade-in"
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div className={cn(
        "relative ml-auto h-full w-full max-w-3xl",
        "bg-background border-l border-secondary",
        "shadow-2xl shadow-black/50",
        isClosing ? "animate-slide-out-right" : "animate-slide-in-right"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <button
            onClick={handleClose}
            className={cn(
              "p-2 rounded-lg",
              "text-text-muted hover:text-white hover:bg-secondary",
              "transition-colors"
            )}
            aria-label="Close settings"
          >
            <X size={20} />
          </button>
        </div>

        {/* Two-column layout */}
        <div className="flex h-[calc(100%-65px)]">
          {/* Menu */}
          <nav className="w-56 p-3 border-r border-secondary/50 bg-tertiary/30">
            <ul className="space-y-1">
              {MENU_ITEMS.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg",
                      "text-left transition-all duration-150",
                      activeSection === item.id
                        ? "bg-secondary text-white"
                        : "text-text-muted hover:text-text-normal hover:bg-secondary/40"
                    )}
                  >
                    <item.icon size={18} />
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-text-muted">{item.description}</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {activeSection === 'api-keys' && (
              <APIKeysSection 
                selectedModel={selectedModel}
                onModelChange={onModelChange}
              />
            )}
            {activeSection === 'tools' && <ToolsSection />}
          </main>
        </div>
      </div>
    </div>
  )
}
```

### Step 5: Create APIKeysSection Component

Create `src/renderer/src/components/settings/sections/APIKeysSection.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { Plus, Check, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ModelSelector } from '../../ModelSelector'

interface Provider {
  id: string
  name: string
  icon: string
  hasKey: boolean
  isLocal: boolean
  description: string
  helpUrl?: string
  placeholder?: string
}

interface APIKeysSectionProps {
  selectedModel: string
  onModelChange: (model: string) => void
}

const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔮',
    hasKey: false,
    isLocal: false,
    description: 'Access Gemini 2.0 Flash, Pro, and more',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIzaSy...'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '🦙',
    hasKey: false,
    isLocal: true,
    description: 'Run models locally on your machine'
  }
]

export function APIKeysSection({ selectedModel, onModelChange }: APIKeysSectionProps) {
  const [providers, setProviders] = useState<Provider[]>(PROVIDERS)
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)
  const [keyInput, setKeyInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check which providers have keys configured
    window.api.getApiKey().then((key) => {
      if (key) {
        setProviders(prev => prev.map(p => 
          p.id === 'gemini' ? { ...p, hasKey: true } : p
        ))
      }
    })
  }, [])

  const handleSaveKey = async (providerId: string) => {
    if (!keyInput.trim()) return
    
    setLoading(true)
    setError(null)

    try {
      if (providerId === 'gemini') {
        await window.api.saveApiKey(keyInput.trim())
      }
      
      setProviders(prev => prev.map(p => 
        p.id === providerId ? { ...p, hasKey: true } : p
      ))
      setKeyInput('')
      setExpandedProvider(null)
    } catch (err) {
      setError('Failed to save API key')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveKey = async (providerId: string) => {
    // For now, just update UI state
    // TODO: Implement actual key removal in backend
    setProviders(prev => prev.map(p => 
      p.id === providerId ? { ...p, hasKey: false } : p
    ))
  }

  const handleModelChange = async (modelId: string) => {
    await window.api.setSelectedModel(modelId)
    onModelChange(modelId)
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">API Keys</h2>
        <p className="text-sm text-text-muted mt-1">
          Configure credentials for AI providers. Keys are stored securely on your device.
        </p>
      </div>

      {/* Model Selection */}
      <div className="p-4 bg-secondary/30 rounded-xl border border-secondary/50">
        <div className="mb-3">
          <h3 className="font-medium text-white">Active Model</h3>
          <p className="text-xs text-text-muted">Choose which model to use for chat</p>
        </div>
        <ModelSelector 
          selectedModel={selectedModel} 
          onModelChange={handleModelChange} 
        />
      </div>

      {/* Provider List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Providers
        </h3>
        
        {providers.map((provider) => (
          <div
            key={provider.id}
            className={cn(
              "rounded-xl border transition-all",
              provider.hasKey
                ? "bg-green-500/5 border-green-500/20"
                : "bg-secondary/30 border-secondary/50"
            )}
          >
            {/* Provider Header */}
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{provider.icon}</span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-medium text-white">{provider.name}</h4>
                      {provider.hasKey && (
                        <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                          <Check size={12} />
                          Configured
                        </span>
                      )}
                      {provider.isLocal && (
                        <span className="text-xs text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                          Local
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-muted mt-0.5">{provider.description}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  {provider.hasKey ? (
                    <>
                      <button
                        onClick={() => setExpandedProvider(
                          expandedProvider === provider.id ? null : provider.id
                        )}
                        className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
                        title="Update key"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleRemoveKey(provider.id)}
                        className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Remove key"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : !provider.isLocal && (
                    <button
                      onClick={() => setExpandedProvider(
                        expandedProvider === provider.id ? null : provider.id
                      )}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                        "bg-primary hover:bg-primary/90 text-white text-sm font-medium",
                        "transition-colors"
                      )}
                    >
                      <Plus size={14} />
                      Add Key
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Expanded Key Input */}
            {expandedProvider === provider.id && !provider.isLocal && (
              <div className="px-4 pb-4 pt-0 border-t border-secondary/50 mt-0">
                <div className="pt-4 space-y-3">
                  {error && (
                    <p className="text-sm text-red-400">{error}</p>
                  )}
                  
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={keyInput}
                      onChange={(e) => setKeyInput(e.target.value)}
                      placeholder={provider.placeholder || 'Enter API key'}
                      className={cn(
                        "flex-1 px-3 py-2 rounded-lg",
                        "bg-tertiary border border-gray-700",
                        "text-white placeholder-text-muted/50",
                        "focus:outline-none focus:ring-2 focus:ring-primary"
                      )}
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveKey(provider.id)}
                      disabled={!keyInput.trim() || loading}
                      className={cn(
                        "px-4 py-2 rounded-lg font-medium",
                        "bg-primary hover:bg-primary/90 text-white",
                        "disabled:opacity-50 disabled:cursor-not-allowed",
                        "transition-colors"
                      )}
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => {
                        setExpandedProvider(null)
                        setKeyInput('')
                        setError(null)
                      }}
                      className="px-3 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  {provider.helpUrl && (
                    <p className="text-xs text-text-muted">
                      Get your API key from{' '}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault()
                          window.open(provider.helpUrl, '_blank')
                        }}
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {new URL(provider.helpUrl).hostname}
                        <ExternalLink size={10} />
                      </a>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 6: Create ToolsSection Component

Create `src/renderer/src/components/settings/sections/ToolsSection.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { 
  Github, 
  Terminal, 
  Settings, 
  Check, 
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ToggleSwitch } from '../shared/ToggleSwitch'
import { GitHubConfigModal } from '../modals/GitHubConfigModal'

interface MCPServer {
  id: string
  name: string
  displayName: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  enabled: boolean
  connected: boolean
  requiresConfig: boolean
  configured: boolean
  toolCount: number
}

export function ToolsSection() {
  const [servers, setServers] = useState<MCPServer[]>([])
  const [loading, setLoading] = useState(true)
  const [configModal, setConfigModal] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState<string | null>(null)
  const [mcpEnabled, setMcpEnabled] = useState(true)

  useEffect(() => {
    loadServerStatus()
  }, [])

  const loadServerStatus = async () => {
    setLoading(true)
    try {
      const [status, githubStatus] = await Promise.all([
        window.api.mcp.getStatus(),
        window.api.mcp.github.getStatus()
      ])

      setMcpEnabled(status.config.enabled)

      const serverList: MCPServer[] = [
        {
          id: 'desktop-commander',
          name: 'desktop-commander',
          displayName: 'Desktop Commander',
          description: 'File system access, terminal commands, process management',
          icon: Terminal,
          enabled: status.config.servers.find(s => s.name === 'desktop-commander')?.enabled ?? false,
          connected: status.connectionStatus['desktop-commander'] ?? false,
          requiresConfig: false,
          configured: true,
          toolCount: 15
        },
        {
          id: 'github',
          name: 'github',
          displayName: 'GitHub',
          description: 'Repository management, issues, pull requests, code search',
          icon: Github,
          enabled: status.config.servers.find(s => s.name === 'github')?.enabled ?? false,
          connected: githubStatus.isConnected,
          requiresConfig: true,
          configured: githubStatus.isConfigured,
          toolCount: githubStatus.toolCount
        }
      ]

      setServers(serverList)
    } catch (error) {
      console.error('Failed to load server status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    const server = servers.find(s => s.id === serverId)
    
    // If enabling a server that requires config but isn't configured
    if (enabled && server?.requiresConfig && !server.configured) {
      setConfigModal(serverId)
      return
    }

    try {
      const config = await window.api.mcp.getConfig()
      const updatedServers = config.servers.map(s => 
        s.name === serverId ? { ...s, enabled } : s
      )
      await window.api.mcp.updateConfig({ servers: updatedServers })
      
      if (enabled) {
        setReconnecting(serverId)
        await window.api.mcp.reconnect()
        setReconnecting(null)
      }

      await loadServerStatus()
    } catch (error) {
      console.error('Failed to toggle server:', error)
      setReconnecting(null)
    }
  }

  const handleToggleMCP = async (enabled: boolean) => {
    try {
      await window.api.mcp.updateConfig({ enabled })
      setMcpEnabled(enabled)
      if (enabled) {
        await window.api.mcp.reconnect()
      }
      await loadServerStatus()
    } catch (error) {
      console.error('Failed to toggle MCP:', error)
    }
  }

  const handleConfigSave = async () => {
    setConfigModal(null)
    await loadServerStatus()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Tools</h2>
        <p className="text-sm text-text-muted mt-1">
          Enable AI tools via MCP servers. Each tool extends the AI's capabilities.
        </p>
      </div>

      {/* Global Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-secondary/50">
        <div>
          <h3 className="font-medium text-white">MCP Tools Enabled</h3>
          <p className="text-xs text-text-muted">Master switch for all tool integrations</p>
        </div>
        <ToggleSwitch
          checked={mcpEnabled}
          onChange={handleToggleMCP}
        />
      </div>

      {/* Server List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Available Servers
        </h3>

        {servers.map((server) => (
          <div
            key={server.id}
            className={cn(
              "p-4 rounded-xl border transition-all",
              !mcpEnabled
                ? "bg-secondary/20 border-secondary/30 opacity-60"
                : server.enabled && server.connected
                ? "bg-green-500/5 border-green-500/20"
                : server.enabled && !server.connected
                ? "bg-yellow-500/5 border-yellow-500/20"
                : "bg-secondary/30 border-secondary/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className={cn(
                  "p-2 rounded-lg",
                  server.enabled && mcpEnabled
                    ? "bg-primary/20 text-primary" 
                    : "bg-secondary text-text-muted"
                )}>
                  <server.icon size={20} />
                </div>

                {/* Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-medium text-white">{server.displayName}</h4>
                    
                    {/* Status Badges */}
                    {mcpEnabled && server.enabled && server.connected && (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                    {mcpEnabled && server.enabled && !server.connected && (
                      <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
                        <AlertCircle size={12} />
                        Disconnected
                      </span>
                    )}
                    {server.requiresConfig && !server.configured && (
                      <span className="flex items-center gap-1 text-xs text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                        <Settings size={12} />
                        Setup Required
                      </span>
                    )}
                    {mcpEnabled && server.enabled && server.toolCount > 0 && (
                      <span className="text-xs text-text-muted bg-secondary px-2 py-0.5 rounded-full">
                        {server.toolCount} tools
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-muted mt-0.5">{server.description}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {server.requiresConfig && (
                  <button
                    onClick={() => setConfigModal(server.id)}
                    disabled={!mcpEnabled}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      !mcpEnabled
                        ? "text-text-muted/50 cursor-not-allowed"
                        : server.configured
                        ? "text-text-muted hover:text-white hover:bg-secondary"
                        : "text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                    )}
                    title={server.configured ? 'Edit configuration' : 'Setup required'}
                  >
                    <Settings size={18} />
                  </button>
                )}

                <ToggleSwitch
                  checked={server.enabled}
                  onChange={(checked) => handleToggleServer(server.id, checked)}
                  disabled={!mcpEnabled || reconnecting === server.id}
                />
              </div>
            </div>

            {/* Reconnecting Indicator */}
            {reconnecting === server.id && (
              <div className="mt-3 flex items-center gap-2 text-sm text-text-muted">
                <RefreshCw className="animate-spin" size={14} />
                Connecting...
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {configModal === 'github' && (
        <GitHubConfigModal
          onClose={() => setConfigModal(null)}
          onSave={handleConfigSave}
        />
      )}
    </div>
  )
}
```

### Step 7: Create GitHubConfigModal Component

Create `src/renderer/src/components/settings/modals/GitHubConfigModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { 
  X, 
  Github, 
  Key, 
  ExternalLink, 
  Check, 
  AlertCircle,
  Trash2,
  RefreshCw,
  User
} from 'lucide-react'
import { cn } from '../../../lib/utils'

interface GitHubAccount {
  username: string
  tokenCreatedAt?: string
}

interface GitHubConfigModalProps {
  onClose: () => void
  onSave: () => void
}

export function GitHubConfigModal({ onClose, onSave }: GitHubConfigModalProps) {
  const [currentAccount, setCurrentAccount] = useState<GitHubAccount | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingStatus, setCheckingStatus] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showTokenInput, setShowTokenInput] = useState(false)

  useEffect(() => {
    loadCurrentAccount()
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const loadCurrentAccount = async () => {
    setCheckingStatus(true)
    try {
      const status = await window.api.mcp.github.getStatus()
      if (status.isConfigured && status.username) {
        setCurrentAccount({
          username: status.username
        })
      } else {
        setShowTokenInput(true)
      }
    } catch (error) {
      console.error('Failed to load GitHub status:', error)
      setShowTokenInput(true)
    } finally {
      setCheckingStatus(false)
    }
  }

  const handleSaveToken = async () => {
    if (!token.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await window.api.mcp.github.configure(token.trim())
      
      if (result.success) {
        setSuccess(true)
        setCurrentAccount({
          username: result.username || 'Unknown'
        })
        setToken('')
        setShowTokenInput(false)
        
        setTimeout(() => {
          onSave()
        }, 1000)
      } else {
        setError(result.error || 'Failed to configure GitHub')
      }
    } catch (err) {
      setError('Failed to connect to GitHub. Please check your token.')
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async () => {
    try {
      await window.api.mcp.github.disconnect()
      setCurrentAccount(null)
      setShowTokenInput(true)
      setSuccess(false)
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" />

      {/* Modal */}
      <div 
        className={cn(
          "relative w-full max-w-lg",
          "bg-background rounded-xl border border-secondary",
          "shadow-2xl shadow-black/50",
          "animate-scale-in"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Github size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">GitHub Configuration</h2>
              <p className="text-xs text-text-muted">Connect your GitHub account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Loading State */}
          {checkingStatus && (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="animate-spin text-text-muted" size={24} />
            </div>
          )}

          {!checkingStatus && (
            <>
              {/* Success Banner */}
              {success && (
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <Check className="text-green-400" size={18} />
                  <span className="text-sm text-green-400">
                    GitHub connected successfully!
                  </span>
                </div>
              )}

              {/* Error Banner */}
              {error && (
                <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <AlertCircle className="text-red-400" size={18} />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}

              {/* Current Account */}
              {currentAccount && (
                <div className="p-4 bg-secondary/30 rounded-xl border border-secondary/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <User size={20} className="text-text-muted" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">
                            @{currentAccount.username}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                            <Check size={10} />
                            Connected
                          </span>
                        </div>
                        <p className="text-xs text-text-muted">
                          Personal Access Token configured
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDisconnect}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg",
                        "text-red-400 hover:text-red-300 hover:bg-red-400/10",
                        "text-sm transition-colors"
                      )}
                    >
                      <Trash2 size={14} />
                      Disconnect
                    </button>
                  </div>
                </div>
              )}

              {/* Token Input Section */}
              {(showTokenInput || !currentAccount) && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Key size={16} className="text-text-muted" />
                    <h3 className="font-medium text-white">
                      {currentAccount ? 'Update' : 'Add'} Personal Access Token
                    </h3>
                  </div>

                  {/* Instructions */}
                  <div className="p-3 bg-tertiary/50 rounded-lg border border-tertiary text-sm space-y-2">
                    <p className="text-text-muted">Create a Personal Access Token with these scopes:</p>
                    <ul className="list-disc list-inside text-text-muted space-y-1 ml-2">
                      <li><code className="text-primary/80">repo</code> - Full repository access</li>
                      <li><code className="text-primary/80">read:org</code> - Read organization data</li>
                      <li><code className="text-primary/80">read:user</code> - Read user profile</li>
                    </ul>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault()
                        window.open('https://github.com/settings/tokens/new?scopes=repo,read:org,read:user&description=ArborChat', '_blank')
                      }}
                      className="flex items-center gap-1 text-primary hover:underline mt-2"
                    >
                      Create a new token on GitHub
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  {/* Token Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-muted">
                      Personal Access Token
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className={cn(
                        "w-full px-3 py-2.5 rounded-lg",
                        "bg-tertiary border border-gray-700",
                        "text-white placeholder-text-muted/50 font-mono text-sm",
                        "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      )}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && token.trim()) {
                          handleSaveToken()
                        }
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Update Token Button (when connected) */}
              {currentAccount && !showTokenInput && (
                <button
                  onClick={() => setShowTokenInput(true)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2 p-3 rounded-lg",
                    "border border-dashed border-secondary hover:border-primary/50",
                    "text-text-muted hover:text-white",
                    "transition-colors"
                  )}
                >
                  <RefreshCw size={16} />
                  Update Token
                </button>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-secondary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
          >
            {currentAccount && !showTokenInput ? 'Done' : 'Cancel'}
          </button>
          {(showTokenInput || !currentAccount) && !checkingStatus && (
            <button
              onClick={handleSaveToken}
              disabled={!token.trim() || loading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium",
                "bg-primary hover:bg-primary/90 text-white",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors"
              )}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={16} />
                  Connecting...
                </>
              ) : (
                <>
                  <Check size={16} />
                  Connect GitHub
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
```

### Step 8: Create Index Files

Create `src/renderer/src/components/settings/index.ts`:

```typescript
export { SettingsPanel } from './SettingsPanel'
```

Create `src/renderer/src/components/settings/sections/index.ts`:

```typescript
export { APIKeysSection } from './APIKeysSection'
export { ToolsSection } from './ToolsSection'
```

Create `src/renderer/src/components/settings/modals/index.ts`:

```typescript
export { GitHubConfigModal } from './GitHubConfigModal'
```

Create `src/renderer/src/components/settings/shared/index.ts`:

```typescript
export { ToggleSwitch } from './ToggleSwitch'
```

### Step 9: Update App.tsx

Replace the `SettingsModal` in `src/renderer/src/App.tsx`:

1. **Remove** the `SettingsModal` component definition (lines ~69-142)

2. **Add import** at the top:
```tsx
import { SettingsPanel } from './components/settings'
```

3. **Replace** the modal render at the bottom of the `App` component:

```tsx
// BEFORE (remove this):
{isSettingsOpen && (
  <SettingsModal
    onClose={() => setIsSettingsOpen(false)}
    onSave={setApiKey}
    selectedModel={selectedModel}
    onModelChange={setSelectedModel}
  />
)}

// AFTER (add this):
<SettingsPanel
  isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  selectedModel={selectedModel}
  onModelChange={setSelectedModel}
/>
```

---

## Testing Checklist

After implementation, verify:

### Settings Panel
- [ ] Panel slides in from right when clicking Settings in sidebar
- [ ] Panel closes on backdrop click
- [ ] Panel closes on Escape key
- [ ] Menu navigation switches sections
- [ ] Active menu item is highlighted

### API Keys Section
- [ ] Current model is displayed
- [ ] Model selector works
- [ ] Gemini shows "Configured" if key exists
- [ ] Can add new API key
- [ ] Can update existing key
- [ ] Can remove key
- [ ] Help link opens in browser

### Tools Section
- [ ] Master MCP toggle works
- [ ] Desktop Commander shows correct status
- [ ] GitHub shows "Setup Required" if not configured
- [ ] Server toggles enable/disable servers
- [ ] Config button opens GitHub modal
- [ ] Reconnecting state shows spinner

### GitHub Modal
- [ ] Shows current account if configured
- [ ] Shows token input if not configured
- [ ] "Create token" link opens GitHub
- [ ] Token validation works
- [ ] Success state shows briefly
- [ ] Disconnect removes account
- [ ] Update token flow works
- [ ] Modal closes on backdrop/escape

---

## Common Issues & Solutions

### Issue: MCP API not available
**Solution:** Ensure you're testing with MCP initialized. Check that `MCPProvider` wraps the app.

### Issue: GitHub status always shows disconnected
**Solution:** Verify the GitHub MCP IPC handlers are properly implemented in `src/main/mcp/ipc.ts`.

### Issue: Animations not working
**Solution:** Ensure CSS animations are added to `main.css` and Tailwind is processing the file.

### Issue: Toggle doesn't persist
**Solution:** Check that `updateConfig` is being called and the config file is being written.

---

## Files Created/Modified Summary

### New Files (8)
```
src/renderer/src/components/settings/
├── SettingsPanel.tsx
├── index.ts
├── sections/
│   ├── APIKeysSection.tsx
│   ├── ToolsSection.tsx
│   └── index.ts
├── modals/
│   ├── GitHubConfigModal.tsx
│   └── index.ts
└── shared/
    ├── ToggleSwitch.tsx
    └── index.ts
```

### Modified Files (2)
```
src/renderer/src/App.tsx           # Replace SettingsModal with SettingsPanel
src/renderer/src/assets/main.css   # Add animation keyframes
```

---

*Prompt Version: 1.0*
*Created: December 2024*
*Design Document: /Users/cory.naegle/ArborChat/docs/SETTINGS_MENU_DESIGN.md*
