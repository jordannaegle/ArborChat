import { useState, useEffect, useCallback } from 'react'
import { X, Key, Wrench, User } from 'lucide-react'
import { cn } from '../../lib/utils'
import { APIKeysSection } from './sections/APIKeysSection'
import { ToolsSection } from './sections/ToolsSection'
import { PersonasSection } from './sections/PersonasSection'

type SettingsSection = 'api-keys' | 'tools' | 'personas'

interface SettingsPanelProps {
  isOpen: boolean
  onClose: () => void
  // Pass through props needed by sections
  selectedModel: string
  onModelChange: (model: string) => void
  // Persona props
  activePersonaId?: string | null
  onActivatePersona?: (id: string | null) => void
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
  },
  {
    id: 'personas' as const,
    label: 'Personas',
    icon: User,
    description: 'Manage AI personalities'
  }
]

export function SettingsPanel({ 
  isOpen, 
  onClose,
  selectedModel,
  onModelChange,
  activePersonaId,
  onActivatePersona
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
            {activeSection === 'personas' && (
              <PersonasSection 
                activePersonaId={activePersonaId}
                onActivatePersona={onActivatePersona}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  )
}
