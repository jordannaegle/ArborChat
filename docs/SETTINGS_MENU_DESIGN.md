# Settings Menu Design Document

**Author:** Alex Chen (Design Lead)  
**Date:** December 2024  
**Status:** Ready for Implementation  
**Version:** 1.0

---

## Executive Summary

This document outlines the redesign of ArborChat's settings from a simple modal popup to a full-featured **Settings Panel**. The new design introduces a structured menu system with dedicated sections for **API Keys** and **Tools (MCP Servers)**, providing users with clear, organized access to all configuration options.

### Key Changes

| Current State | New Design |
|---------------|------------|
| Single modal popup | Slide-out settings panel |
| Combined model + API key | Separate API Keys section |
| No tool management | Full Tools section with enable/disable toggles |
| No GitHub PAT entry | Dedicated GitHub configuration modal |

---

## Design Philosophy

### Principles

1. **Progressive Disclosure** - Show high-level options first, drill down for details
2. **Contextual Configuration** - Group related settings together
3. **Non-Destructive Navigation** - Settings panel slides over content without closing chat
4. **Visual Hierarchy** - Clear section headers, consistent spacing, logical flow

### Visual Language

- **Dark Theme Consistency** - Matches existing `bg-tertiary`, `bg-secondary` palette
- **Subtle Animations** - 200ms slide transitions, fade effects
- **Icon-Driven Navigation** - Lucide icons for visual recognition
- **Status Indicators** - Color-coded enabled/disabled states

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Layout.tsx                                                      │
│ ┌─────────────┬────────────────────────────────────────────────┤
│ │             │                                                 │
│ │  Sidebar    │         Main Content Area                      │
│ │             │                                                 │
│ │  [Settings] │    ┌─────────────────────────────────────┐     │
│ │      ↓      │    │                                     │     │
│ └─────────────┤    │    Chat Window / Settings Panel     │     │
│               │    │                                     │     │
│               │    │    (Conditionally rendered)         │     │
│               │    │                                     │     │
│               │    └─────────────────────────────────────┘     │
└───────────────┴────────────────────────────────────────────────┘
```

---

## Component Hierarchy

```
SettingsPanel/
├── SettingsPanel.tsx          # Main container with menu navigation
├── SettingsMenu.tsx           # Left sidebar menu
├── sections/
│   ├── APIKeysSection.tsx     # Provider API key management
│   ├── ToolsSection.tsx       # MCP server management
│   └── GeneralSection.tsx     # (Future) General preferences
├── modals/
│   ├── APIKeyModal.tsx        # Add/edit API key modal
│   └── ToolConfigModal.tsx    # Tool-specific configuration modal
└── shared/
    ├── SettingsHeader.tsx     # Section headers
    ├── ToggleSwitch.tsx       # On/off toggle component
    └── StatusBadge.tsx        # Connected/disconnected status
```

---

## Detailed Component Specifications

### 1. SettingsPanel.tsx

The main container that replaces the current `SettingsModal`. Uses a two-column layout with navigation menu and content area.

```tsx
// src/renderer/src/components/settings/SettingsPanel.tsx

import { useState } from 'react'
import { X, Key, Wrench, Settings2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { APIKeysSection } from './sections/APIKeysSection'
import { ToolsSection } from './sections/ToolsSection'

type SettingsSection = 'api-keys' | 'tools' | 'general'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
}

const MENU_ITEMS: Array<{
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ size?: number }>
  description: string
}> = [
  {
    id: 'api-keys',
    label: 'API Keys',
    icon: Key,
    description: 'Manage provider credentials'
  },
  {
    id: 'tools',
    label: 'Tools',
    icon: Wrench,
    description: 'Configure MCP servers'
  },
  {
    id: 'general',
    label: 'General',
    icon: Settings2,
    description: 'App preferences'
  }
]

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>('api-keys')

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={cn(
        "relative ml-auto h-full w-full max-w-3xl",
        "bg-background border-l border-secondary",
        "shadow-2xl shadow-black/50",
        "animate-slide-in-right"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <h1 className="text-xl font-bold text-white">Settings</h1>
          <button
            onClick={onClose}
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
            {activeSection === 'api-keys' && <APIKeysSection />}
            {activeSection === 'tools' && <ToolsSection />}
            {activeSection === 'general' && <GeneralSection />}
          </main>
        </div>
      </div>
    </div>
  )
}
```

---

### 2. APIKeysSection.tsx

Manages API keys for different providers (Gemini, Ollama, future providers).

```tsx
// src/renderer/src/components/settings/sections/APIKeysSection.tsx

import { useState, useEffect } from 'react'
import { Plus, Key, Check, AlertCircle, Trash2, Edit2 } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ModelSelector } from '../../ModelSelector'

interface Provider {
  id: string
  name: string
  icon: string
  hasKey: boolean
  isLocal: boolean
  description: string
}

const PROVIDERS: Provider[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔮',
    hasKey: false,
    isLocal: false,
    description: 'Access Gemini 2.0 Flash, Pro, and more'
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

export function APIKeysSection() {
  const [providers, setProviders] = useState<Provider[]>(PROVIDERS)
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [selectedModel, setSelectedModel] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Load current model and check which providers have keys
    Promise.all([
      window.api.getSelectedModel(),
      window.api.getApiKey()
    ]).then(([model, key]) => {
      setSelectedModel(model)
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
    
    try {
      if (providerId === 'gemini') {
        await window.api.saveApiKey(keyInput)
      }
      // Add other providers here
      
      setProviders(prev => prev.map(p => 
        p.id === providerId ? { ...p, hasKey: true } : p
      ))
      setKeyInput('')
      setShowKeyInput(null)
    } catch (error) {
      console.error('Failed to save key:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleModelChange = async (modelId: string) => {
    await window.api.setSelectedModel(modelId)
    setSelectedModel(modelId)
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-medium text-white">Active Model</h3>
            <p className="text-xs text-text-muted">Choose which model to use for chat</p>
          </div>
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
              "p-4 rounded-xl border transition-all",
              provider.hasKey
                ? "bg-green-500/5 border-green-500/20"
                : "bg-secondary/30 border-secondary/50"
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{provider.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
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

              <div className="flex gap-2">
                {provider.hasKey ? (
                  <>
                    <button
                      onClick={() => setShowKeyInput(provider.id)}
                      className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
                      title="Update key"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        // TODO: Implement key deletion
                        setProviders(prev => prev.map(p => 
                          p.id === provider.id ? { ...p, hasKey: false } : p
                        ))
                      }}
                      className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                      title="Remove key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowKeyInput(provider.id)}
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

            {/* Key Input (expanded) */}
            {showKeyInput === provider.id && (
              <div className="mt-4 pt-4 border-t border-secondary/50">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    placeholder={provider.id === 'gemini' ? 'AIzaSy...' : 'Enter API key'}
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
                      setShowKeyInput(null)
                      setKeyInput('')
                    }}
                    className="px-3 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                
                {provider.id === 'gemini' && (
                  <p className="mt-2 text-xs text-text-muted">
                    Get your API key from{' '}
                    <a
                      href="#"
                      onClick={() => window.open('https://aistudio.google.com/app/apikey', '_blank')}
                      className="text-primary hover:underline"
                    >
                      aistudio.google.com
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

### 3. ToolsSection.tsx

Manages MCP servers with enable/disable toggles and configuration access.


```tsx
// src/renderer/src/components/settings/sections/ToolsSection.tsx

import { useState, useEffect } from 'react'
import { 
  Wrench, 
  Github, 
  Terminal, 
  Settings, 
  Check, 
  X, 
  RefreshCw,
  ExternalLink,
  AlertCircle
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ToolConfigModal } from '../modals/ToolConfigModal'
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
  const [configModalServer, setConfigModalServer] = useState<string | null>(null)
  const [reconnecting, setReconnecting] = useState<string | null>(null)

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
    
    // If enabling a server that requires config but isn't configured, open config modal
    if (enabled && server?.requiresConfig && !server.configured) {
      setConfigModalServer(serverId)
      return
    }

    try {
      const config = await window.api.mcp.getConfig()
      const updatedServers = config.servers.map(s => 
        s.name === serverId ? { ...s, enabled } : s
      )
      await window.api.mcp.updateConfig({ servers: updatedServers })
      
      // Reconnect if enabling
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

  const handleConfigSave = async () => {
    setConfigModalServer(null)
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
          Enable AI tools via MCP servers. Each tool extends Claude's capabilities.
        </p>
      </div>

      {/* Global Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border border-secondary/50">
        <div>
          <h3 className="font-medium text-white">MCP Tools Enabled</h3>
          <p className="text-xs text-text-muted">Master switch for all tool integrations</p>
        </div>
        <ToggleSwitch
          checked={true} // TODO: Wire to config.enabled
          onChange={() => {}}
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
              server.enabled && server.connected
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
                  server.enabled 
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
                    {server.enabled && server.connected && (
                      <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full">
                        <Check size={12} />
                        Connected
                      </span>
                    )}
                    {server.enabled && !server.connected && (
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
                    {server.enabled && server.toolCount > 0 && (
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
                {/* Configure Button */}
                {server.requiresConfig && (
                  <button
                    onClick={() => setConfigModalServer(server.id)}
                    className={cn(
                      "p-2 rounded-lg transition-colors",
                      server.configured
                        ? "text-text-muted hover:text-white hover:bg-secondary"
                        : "text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"
                    )}
                    title={server.configured ? 'Edit configuration' : 'Setup required'}
                  >
                    <Settings size={18} />
                  </button>
                )}

                {/* Toggle */}
                <ToggleSwitch
                  checked={server.enabled}
                  onChange={(checked) => handleToggleServer(server.id, checked)}
                  disabled={reconnecting === server.id}
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
      {configModalServer === 'github' && (
        <GitHubConfigModal
          onClose={() => setConfigModalServer(null)}
          onSave={handleConfigSave}
        />
      )}
    </div>
  )
}

// ToggleSwitch component
interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full",
        "transition-colors duration-200 ease-in-out",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
        checked ? "bg-primary" : "bg-secondary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full bg-white shadow-lg",
          "transform transition-transform duration-200 ease-in-out",
          checked ? "translate-x-6" : "translate-x-1"
        )}
      />
    </button>
  )
}
```

---

### 4. GitHubConfigModal.tsx

The configuration modal for GitHub MCP server with PAT entry and account management.

```tsx
// src/renderer/src/components/settings/modals/GitHubConfigModal.tsx

import { useState, useEffect } from 'react'
import { 
  X, 
  Github, 
  Key, 
  ExternalLink, 
  Check, 
  AlertCircle,
  Trash2,
  Copy,
  RefreshCw,
  User
} from 'lucide-react'
import { cn } from '../../../lib/utils'

interface GitHubAccount {
  username: string
  email?: string
  avatarUrl?: string
  tokenCreatedAt: string
  scopes?: string[]
}

interface GitHubConfigModalProps {
  onClose: () => void
  onSave: () => void
}

export function GitHubConfigModal({ onClose, onSave }: GitHubConfigModalProps) {
  const [currentAccount, setCurrentAccount] = useState<GitHubAccount | null>(null)
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showAddToken, setShowAddToken] = useState(false)

  useEffect(() => {
    loadCurrentAccount()
  }, [])

  const loadCurrentAccount = async () => {
    try {
      const status = await window.api.mcp.github.getStatus()
      if (status.isConfigured && status.username) {
        setCurrentAccount({
          username: status.username,
          tokenCreatedAt: new Date().toISOString() // TODO: Get actual date
        })
      }
    } catch (error) {
      console.error('Failed to load GitHub status:', error)
    }
  }

  const handleSaveToken = async () => {
    if (!token.trim()) return

    setLoading(true)
    setError(null)

    try {
      const result = await window.api.mcp.github.configure(token)
      
      if (result.success) {
        setSuccess(true)
        setCurrentAccount({
          username: result.username || 'Unknown',
          tokenCreatedAt: new Date().toISOString()
        })
        setToken('')
        setShowAddToken(false)
        
        // Brief delay to show success state
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
      setShowAddToken(false)
      await loadCurrentAccount()
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

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
                    {currentAccount.avatarUrl ? (
                      <img 
                        src={currentAccount.avatarUrl} 
                        alt={currentAccount.username}
                        className="w-full h-full rounded-full"
                      />
                    ) : (
                      <User size={20} className="text-text-muted" />
                    )}
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
                      Token added {new Date(currentAccount.tokenCreatedAt).toLocaleDateString()}
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

          {/* Add/Update Token Section */}
          {(showAddToken || !currentAccount) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-text-muted" />
                <h3 className="font-medium text-white">
                  {currentAccount ? 'Update' : 'Add'} Personal Access Token
                </h3>
              </div>

              {/* Instructions */}
              <div className="p-3 bg-tertiary/50 rounded-lg border border-tertiary text-sm space-y-2">
                <p className="text-text-muted">To connect GitHub, create a Personal Access Token (PAT) with these scopes:</p>
                <ul className="list-disc list-inside text-text-muted space-y-1 ml-2">
                  <li><code className="text-primary/80">repo</code> - Full repository access</li>
                  <li><code className="text-primary/80">read:org</code> - Read organization data</li>
                  <li><code className="text-primary/80">read:user</code> - Read user profile</li>
                </ul>
                <a
                  href="#"
                  onClick={() => window.open('https://github.com/settings/tokens/new?scopes=repo,read:org,read:user', '_blank')}
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
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className={cn(
                      "flex-1 px-3 py-2.5 rounded-lg",
                      "bg-tertiary border border-gray-700",
                      "text-white placeholder-text-muted/50 font-mono text-sm",
                      "focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    )}
                    autoFocus
                  />
                </div>
              </div>
            </div>
          )}

          {/* Update Token Button (when already connected) */}
          {currentAccount && !showAddToken && (
            <button
              onClick={() => setShowAddToken(true)}
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-secondary">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          {(showAddToken || !currentAccount) && (
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

---

## Wireframes

### Settings Panel Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ Settings                                                        [X]  │
├───────────────────┬──────────────────────────────────────────────────┤
│                   │                                                  │
│  ┌─────────────┐  │  API Keys                                        │
│  │ 🔑 API Keys │←─│  Configure credentials for AI providers          │
│  │ Manage cred │  │                                                  │
│  └─────────────┘  │  ┌────────────────────────────────────────────┐  │
│                   │  │ Active Model                                │  │
│  ┌─────────────┐  │  │ [Gemini 2.5 Flash ▼]                       │  │
│  │ 🔧 Tools    │  │  └────────────────────────────────────────────┘  │
│  │ Configure M │  │                                                  │
│  └─────────────┘  │  PROVIDERS                                       │
│                   │  ┌────────────────────────────────────────────┐  │
│  ┌─────────────┐  │  │ 🔮 Google Gemini           [✓ Configured]  │  │
│  │ ⚙️ General  │  │  │    Access Gemini 2.0 Flash, Pro...        │  │
│  │ App prefer  │  │  │                        [Edit] [Remove]     │  │
│  └─────────────┘  │  └────────────────────────────────────────────┘  │
│                   │                                                  │
│                   │  ┌────────────────────────────────────────────┐  │
│                   │  │ 🦙 Ollama (Local)              [Local]     │  │
│                   │  │    Run models locally...                   │  │
│                   │  │                             [+ Add Key]    │  │
│                   │  └────────────────────────────────────────────┘  │
│                   │                                                  │
└───────────────────┴──────────────────────────────────────────────────┘
```

### Tools Section

```
┌──────────────────────────────────────────────────────────────────────┐
│ Settings                                                        [X]  │
├───────────────────┬──────────────────────────────────────────────────┤
│                   │                                                  │
│  ┌─────────────┐  │  Tools                                           │
│  │ 🔑 API Keys │  │  Enable AI tools via MCP servers                 │
│  │ Manage cred │  │                                                  │
│  └─────────────┘  │  ┌────────────────────────────────────────────┐  │
│                   │  │ MCP Tools Enabled                    [ON]  │  │
│  ┌─────────────┐←─│  │ Master switch for all tool integrations   │  │
│  │ 🔧 Tools    │  │  └────────────────────────────────────────────┘  │
│  │ Configure M │  │                                                  │
│  └─────────────┘  │  AVAILABLE SERVERS                               │
│                   │  ┌────────────────────────────────────────────┐  │
│  ┌─────────────┐  │  │ 💻 Desktop Commander  [✓ Connected] 15 ▼  │  │
│  │ ⚙️ General  │  │  │    File system, terminal, processes...    │  │
│  │ App prefer  │  │  │                                     [ON]  │  │
│  └─────────────┘  │  └────────────────────────────────────────────┘  │
│                   │                                                  │
│                   │  ┌────────────────────────────────────────────┐  │
│                   │  │ 🐙 GitHub         [⚠ Setup Required] [⚙]  │  │
│                   │  │    Repository, issues, PRs, search...     │  │
│                   │  │                                    [OFF]  │  │
│                   │  └────────────────────────────────────────────┘  │
│                   │                                                  │
└───────────────────┴──────────────────────────────────────────────────┘
```

### GitHub Configuration Modal

```
┌─────────────────────────────────────────────────────────────────┐
│ 🐙 GitHub Configuration                                     [X] │
│     Connect your GitHub account                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 👤 @octocat                            [✓ Connected]       │  │
│  │    Token added Dec 27, 2024                                │  │
│  │                                           [🗑 Disconnect]  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│  │              🔄 Update Token                              │  │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                            [Cancel]  [Done]      │
└──────────────────────────────────────────────────────────────────┘
```

### GitHub Modal - Add Token State

```
┌─────────────────────────────────────────────────────────────────┐
│ 🐙 GitHub Configuration                                     [X] │
│     Connect your GitHub account                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔑 Add Personal Access Token                                    │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ To connect GitHub, create a PAT with these scopes:         │  │
│  │   • repo - Full repository access                          │  │
│  │   • read:org - Read organization data                      │  │
│  │   • read:user - Read user profile                          │  │
│  │                                                            │  │
│  │ 🔗 Create a new token on GitHub →                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Personal Access Token                                           │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ ghp_xxxxxxxxxxxxxxxxxxxx                                   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                [Cancel]  [✓ Connect GitHub]      │
└──────────────────────────────────────────────────────────────────┘
```

---

## Animation Specifications

### CSS Keyframes

```css
/* Add to assets/main.css */

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

.animate-slide-in-right {
  animation: slide-in-right 0.2s ease-out;
}

.animate-scale-in {
  animation: scale-in 0.15s ease-out;
}
```


---

## Implementation Roadmap

### Phase 1: Foundation (Day 1-2)

| Task | Priority | Effort |
|------|----------|--------|
| Create `SettingsPanel.tsx` container | High | 2h |
| Create menu navigation component | High | 1h |
| Add slide-in animations | Medium | 0.5h |
| Update `App.tsx` to use panel instead of modal | High | 1h |
| Add CSS animations | Low | 0.5h |

### Phase 2: API Keys Section (Day 2-3)

| Task | Priority | Effort |
|------|----------|--------|
| Create `APIKeysSection.tsx` | High | 3h |
| Integrate existing `ModelSelector` | High | 1h |
| Add provider cards with status | Medium | 2h |
| Implement key add/update/remove flow | High | 2h |
| Wire up to existing IPC handlers | High | 1h |

### Phase 3: Tools Section (Day 3-4)

| Task | Priority | Effort |
|------|----------|--------|
| Create `ToolsSection.tsx` | High | 3h |
| Create reusable `ToggleSwitch` component | Medium | 1h |
| Add server cards with status badges | High | 2h |
| Implement enable/disable with reconnect | High | 2h |
| Create `GitHubConfigModal.tsx` | High | 3h |

### Phase 4: Polish & Testing (Day 5)

| Task | Priority | Effort |
|------|----------|--------|
| Keyboard navigation (Escape to close) | Medium | 1h |
| Focus management | Medium | 1h |
| Loading states & error handling | High | 2h |
| Responsive design adjustments | Low | 1h |
| Manual testing | High | 2h |

---

## File Changes Summary

### New Files

```
src/renderer/src/components/settings/
├── SettingsPanel.tsx              # Main container
├── sections/
│   ├── APIKeysSection.tsx         # API key management
│   ├── ToolsSection.tsx           # MCP server management
│   └── GeneralSection.tsx         # Future: app preferences
├── modals/
│   ├── GitHubConfigModal.tsx      # GitHub PAT configuration
│   └── APIKeyModal.tsx            # (Optional) Standalone key modal
└── shared/
    ├── ToggleSwitch.tsx           # Reusable toggle component
    └── StatusBadge.tsx            # Connection status badge
```

### Modified Files

```
src/renderer/src/App.tsx
  - Remove SettingsModal component
  - Import and render SettingsPanel
  - Update isSettingsOpen state handling

src/renderer/src/assets/main.css
  - Add animation keyframes
  - Add utility classes

src/renderer/src/components/Sidebar.tsx
  - No changes needed (onSettings prop already exists)
```

---

## Type Definitions

```typescript
// src/renderer/src/types/settings.ts

export type SettingsSection = 'api-keys' | 'tools' | 'general'

export interface Provider {
  id: string
  name: string
  icon: string
  hasKey: boolean
  isLocal: boolean
  description: string
}

export interface MCPServerUI {
  id: string
  name: string
  displayName: string
  description: string
  icon: React.ComponentType<{ size?: number }>
  enabled: boolean
  connected: boolean
  requiresConfig: boolean
  configured: boolean
  toolCount: number
}

export interface SettingsMenuItemDef {
  id: SettingsSection
  label: string
  icon: React.ComponentType<{ size?: number }>
  description: string
}
```

---

## Accessibility Considerations

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `Escape` | Close panel/modal |
| `Tab` | Navigate through focusable elements |
| `Enter/Space` | Activate buttons/toggles |
| `Arrow Up/Down` | Navigate menu items |

### ARIA Attributes

```tsx
// Panel
<div role="dialog" aria-modal="true" aria-label="Settings">

// Menu
<nav role="navigation" aria-label="Settings sections">

// Toggle
<button role="switch" aria-checked={checked}>

// Sections
<section aria-labelledby="api-keys-heading">
```

### Focus Management

1. When panel opens, focus moves to first focusable element
2. Focus is trapped within panel while open
3. When panel closes, focus returns to trigger button
4. Modals follow the same pattern within the panel

---

## Future Enhancements

### Phase 2 Additions

1. **General Settings Section**
   - Theme selection (dark/light)
   - Font size preferences
   - Auto-save interval

2. **Advanced MCP Settings**
   - Timeout configuration
   - Auto-approve rules
   - Allowed directories picker

3. **Provider Extensions**
   - OpenAI API key support
   - Anthropic API key support
   - Custom endpoint configuration

### Phase 3 Additions

1. **Tool Usage Statistics**
   - Per-tool usage counts
   - Success/failure rates
   - Most used tools

2. **Bulk Operations**
   - Enable/disable all servers
   - Export/import configuration

---

## Appendix: Color Reference

| Element | Light | Dark (Current) |
|---------|-------|----------------|
| Background | - | `bg-background` (#1a1a2e) |
| Secondary | - | `bg-secondary` (#2d2d44) |
| Tertiary | - | `bg-tertiary` (#16213e) |
| Primary | - | `bg-primary` (#e94560) |
| Text Normal | - | `text-text-normal` (#f0f0f0) |
| Text Muted | - | `text-text-muted` (#8888aa) |
| Success | - | `text-green-400` |
| Warning | - | `text-yellow-400` |
| Error | - | `text-red-400` |

---

## Sign-off

**Design Ready for Implementation:** ✅

This design document provides complete specifications for replacing the current settings modal with a full-featured settings panel. The implementation maintains consistency with the existing ArborChat design language while introducing a more scalable, organized settings architecture.

Key benefits:
- Clear separation of concerns (API Keys vs Tools)
- Scalable menu structure for future sections
- Improved discoverability of configuration options
- Dedicated GitHub configuration flow
- Non-destructive panel overlay (chat remains visible)

---

*Document Version: 1.0*  
*Last Updated: December 27, 2024*  
*Author: Alex Chen (Design Lead)*
