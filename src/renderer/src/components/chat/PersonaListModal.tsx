/**
 * PersonaListModal Component
 * Quick-access modal for viewing and selecting personas from chat
 * Triggered by /persona list command
 * 
 * @author Alex Chen (Design Lead)
 * @phase Phase 4: Slash Commands
 */

import { useState, useEffect, useCallback } from 'react'
import { 
  X, 
  User, 
  Check, 
  Search,
  Loader2,
  Sparkles
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { PersonaMetadata } from '../../types/persona'

interface PersonaListModalProps {
  isOpen: boolean
  activePersonaId: string | null
  onClose: () => void
  onSelect: (id: string | null) => void
}

export function PersonaListModal({ 
  isOpen, 
  activePersonaId,
  onClose, 
  onSelect 
}: PersonaListModalProps) {
  const [personas, setPersonas] = useState<PersonaMetadata[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Load personas when modal opens
  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setSearch('')
      window.api.personas.list()
        .then(list => {
          setPersonas(list)
          setLoading(false)
        })
        .catch(err => {
          console.error('[PersonaListModal] Failed to load:', err)
          setPersonas([])
          setLoading(false)
        })
    }
  }, [isOpen])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return
    
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [isOpen, onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  if (!isOpen) return null

  const filteredPersonas = personas.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  const handleSelectPersona = (id: string) => {
    // If clicking the active persona, deactivate it
    if (activePersonaId === id) {
      onSelect(null)
    } else {
      onSelect(id)
    }
    onClose()
  }

  const handleDeactivate = () => {
    onSelect(null)
    onClose()
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="persona-list-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div 
        className={cn(
          "relative w-full max-w-md",
          "bg-background rounded-2xl border border-secondary",
          "shadow-2xl shadow-black/50",
          "overflow-hidden",
          "animate-in fade-in zoom-in-95 duration-150"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <User size={20} className="text-primary" />
            </div>
            <div>
              <h2 id="persona-list-title" className="text-lg font-bold text-white">
                Select Persona
              </h2>
              <p className="text-xs text-text-muted">
                {personas.length} persona{personas.length !== 1 ? 's' : ''} available
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "text-text-muted hover:text-white hover:bg-secondary"
            )}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-secondary/50">
          <div className="relative">
            <Search 
              size={16} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" 
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personas..."
              autoFocus
              className={cn(
                "w-full pl-9 pr-4 py-2.5 rounded-lg",
                "bg-secondary border border-secondary/50",
                "text-text-normal placeholder-text-muted/50 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "transition-shadow duration-150"
              )}
            />
          </div>
        </div>

        {/* Active Persona Banner */}
        {activePersonaId && (
          <div className="mx-3 mt-3">
            <div className={cn(
              "flex items-center justify-between p-2.5 rounded-lg",
              "bg-primary/10 border border-primary/20"
            )}>
              <div className="flex items-center gap-2">
                <Check size={14} className="text-primary" />
                <span className="text-sm text-primary font-medium">
                  {personas.find(p => p.id === activePersonaId)?.name || 'Active'}
                </span>
              </div>
              <button
                onClick={handleDeactivate}
                className="text-xs text-primary hover:text-primary/80 font-medium"
              >
                Deactivate
              </button>
            </div>
          </div>
        )}

        {/* Persona List */}
        <div className="max-h-80 overflow-y-auto p-3 scrollbar-thin">
          {loading ? (
            <div className="py-12 text-center">
              <Loader2 size={24} className="mx-auto text-text-muted animate-spin mb-2" />
              <p className="text-sm text-text-muted">Loading personas...</p>
            </div>
          ) : filteredPersonas.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-3">
                <User size={28} className="text-text-muted/30" />
              </div>
              <h3 className="text-sm font-medium text-text-normal mb-1">
                {search ? 'No personas found' : 'No personas yet'}
              </h3>
              <p className="text-xs text-text-muted">
                {search 
                  ? 'Try a different search term'
                  : 'Create personas in Settings → Personas'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredPersonas.map((persona) => {
                const isActive = activePersonaId === persona.id
                
                return (
                  <button
                    key={persona.id}
                    onClick={() => handleSelectPersona(persona.id)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl",
                      "text-left transition-all duration-150",
                      isActive
                        ? "bg-primary/15 border-2 border-primary/40"
                        : "bg-secondary/30 hover:bg-secondary border-2 border-transparent"
                    )}
                  >
                    {/* Emoji Avatar */}
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-2xl shrink-0",
                      isActive ? "bg-primary/20" : "bg-tertiary"
                    )}>
                      {persona.emoji || '👤'}
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "font-medium truncate",
                          isActive ? "text-primary" : "text-white"
                        )}>
                          {persona.name}
                        </span>
                        {isActive && (
                          <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/20 px-1.5 py-0.5 rounded-full shrink-0">
                            <Sparkles size={10} />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-muted line-clamp-1 mt-0.5">
                        {persona.description || 'No description'}
                      </p>
                    </div>

                    {/* Selection indicator */}
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                      "transition-all duration-150",
                      isActive 
                        ? "border-primary bg-primary" 
                        : "border-text-muted/30"
                    )}>
                      {isActive && <Check size={12} className="text-white" />}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className={cn(
          "p-3 border-t border-secondary/50",
          "text-xs text-text-muted text-center"
        )}>
          <span>Type </span>
          <code className="bg-tertiary px-1.5 py-0.5 rounded font-mono">/persona name</code>
          <span> in chat for quick access</span>
        </div>
      </div>
    </div>
  )
}
