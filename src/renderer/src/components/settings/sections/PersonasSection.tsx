import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  User,
  Plus,
  Trash2,
  Check,
  X,
  RefreshCw,
  Search,
  FileText,
  Wand2,
  AlertCircle,
  Keyboard,
  HelpCircle
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { PersonaMetadata, Persona } from '../../../types/persona'
import { CreatePersonaModal } from '../modals/CreatePersonaModal'
import { PersonaDetailModal } from '../modals/PersonaDetailModal'

interface PersonasSectionProps {
  activePersonaId?: string | null
  onActivatePersona?: (id: string | null) => void
}

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function PersonasSection({ 
  activePersonaId, 
  onActivatePersona 
}: PersonasSectionProps) {
  const [personas, setPersonas] = useState<PersonaMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)
  
  // Debounce search query for performance (150ms delay)
  const debouncedSearchQuery = useDebounce(searchQuery, 150)

  // Auto-dismiss error after 5 seconds
  useEffect(() => {
    if (!error) return
    const timer = setTimeout(() => setError(null), 5000)
    return () => clearTimeout(timer)
  }, [error])

  const loadPersonas = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.personas.list()
      setPersonas(list)
    } catch (err: any) {
      setError(err.message || 'Failed to load personas')
      console.error('Failed to load personas:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPersonas()
  }, [loadPersonas])

  const handleViewPersona = useCallback(async (id: string) => {
    setError(null)
    try {
      const persona = await window.api.personas.get(id)
      setSelectedPersona(persona)
      setIsEditing(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load persona details')
      console.error('Failed to load persona:', err)
    }
  }, [])

  const handleDeletePersona = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) return
    
    setError(null)
    try {
      await window.api.personas.delete(id)
      await loadPersonas()
      if (selectedPersona?.id === id) {
        setSelectedPersona(null)
      }
      if (activePersonaId === id && onActivatePersona) {
        onActivatePersona(null)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete persona')
      console.error('Failed to delete persona:', err)
    }
  }, [loadPersonas, selectedPersona, activePersonaId, onActivatePersona])

  const handleActivatePersona = useCallback((id: string) => {
    if (onActivatePersona) {
      onActivatePersona(activePersonaId === id ? null : id)
    }
  }, [activePersonaId, onActivatePersona])

  // Memoized filtered personas for performance
  const filteredPersonas = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return personas
    }
    
    const query = debouncedSearchQuery.toLowerCase()
    return personas.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.tags.some(t => t.toLowerCase().includes(query))
    )
  }, [personas, debouncedSearchQuery])

  // Memoized active persona name lookup
  const activePersonaName = useMemo(() => {
    return personas.find(p => p.id === activePersonaId)?.name
  }, [personas, activePersonaId])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-text-muted" size={24} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error Notification */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <span className="text-sm text-red-400 flex-1">{error}</span>
          <button
            onClick={() => setError(null)}
            className="p-1 text-red-400 hover:text-red-300 rounded"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Personas</h2>
            <p className="text-sm text-text-muted mt-1">
              Create and manage custom AI personalities
            </p>
          </div>
          <button
            onClick={() => setShowShortcuts(!showShortcuts)}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              showShortcuts
                ? "text-primary bg-primary/20"
                : "text-text-muted hover:text-white hover:bg-secondary"
            )}
            title="Keyboard shortcuts"
          >
            <HelpCircle size={16} />
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-primary hover:bg-primary/90 text-white",
            "font-medium text-sm transition-colors"
          )}
        >
          <Plus size={16} />
          Create Persona
        </button>
      </div>

      {/* Keyboard Shortcuts Help */}
      {showShortcuts && (
        <div className="p-4 bg-secondary/50 border border-secondary rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-3">
            <Keyboard size={16} className="text-primary" />
            <h3 className="font-medium text-white text-sm">Slash Commands</h3>
          </div>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <code className="px-2 py-1 bg-tertiary rounded text-text-muted font-mono text-xs">/persona &lt;name&gt;</code>
              <span className="text-text-muted">Activate a persona by name</span>
            </div>
            <div className="flex items-center justify-between">
              <code className="px-2 py-1 bg-tertiary rounded text-text-muted font-mono text-xs">/persona list</code>
              <span className="text-text-muted">Show persona selection modal</span>
            </div>
            <div className="flex items-center justify-between">
              <code className="px-2 py-1 bg-tertiary rounded text-text-muted font-mono text-xs">/clear persona</code>
              <span className="text-text-muted">Deactivate the current persona</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-text-muted/60">
            Type these commands in the chat input to quickly manage personas.
          </p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search 
          size={16} 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" 
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search personas..."
          className={cn(
            "w-full pl-10 pr-4 py-2 rounded-lg",
            "bg-secondary border border-secondary/50",
            "text-text-normal placeholder-text-muted/50",
            "focus:outline-none focus:ring-2 focus:ring-primary/50"
          )}
        />
        {/* Search indicator when debouncing */}
        {searchQuery !== debouncedSearchQuery && (
          <RefreshCw 
            size={14} 
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted/50 animate-spin" 
          />
        )}
      </div>

      {/* Active Persona Banner */}
      {activePersonaId && activePersonaName && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-primary" />
            <span className="text-sm text-primary font-medium">
              Active Persona: {activePersonaName}
            </span>
          </div>
          <button
            onClick={() => onActivatePersona?.(null)}
            className="text-xs text-primary hover:text-primary/80"
          >
            Deactivate
          </button>
        </div>
      )}

      {/* Persona List */}
      <div className="grid gap-3">
        {filteredPersonas.length === 0 ? (
          <div className="text-center py-12">
            <User size={48} className="mx-auto text-text-muted/30 mb-4" />
            <h3 className="text-lg font-medium text-text-normal mb-2">
              {searchQuery ? 'No personas found' : 'No personas yet'}
            </h3>
            <p className="text-sm text-text-muted mb-4">
              {searchQuery 
                ? 'Try a different search term'
                : 'Create your first custom AI persona'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowCreateModal(true)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg",
                  "bg-secondary hover:bg-secondary/80 text-text-normal",
                  "text-sm transition-colors"
                )}
              >
                <Wand2 size={16} />
                Generate with AI
              </button>
            )}
          </div>
        ) : (
          filteredPersonas.map((persona) => (
            <PersonaCard
              key={persona.id}
              persona={persona}
              isActive={activePersonaId === persona.id}
              onView={() => handleViewPersona(persona.id)}
              onActivate={() => handleActivatePersona(persona.id)}
              onDelete={() => handleDeletePersona(persona.id)}
            />
          ))
        )}
      </div>

      {/* Persona Count */}
      {personas.length > 0 && (
        <div className="text-xs text-text-muted/60 text-center pt-2">
          {filteredPersonas.length === personas.length
            ? `${personas.length} persona${personas.length === 1 ? '' : 's'}`
            : `${filteredPersonas.length} of ${personas.length} personas`}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreatePersonaModal
          onClose={() => setShowCreateModal(false)}
          onCreated={async () => {
            setShowCreateModal(false)
            await loadPersonas()
          }}
        />
      )}

      {selectedPersona && (
        <PersonaDetailModal
          persona={selectedPersona}
          isEditing={isEditing}
          onClose={() => {
            setSelectedPersona(null)
            setIsEditing(false)
          }}
          onEdit={() => setIsEditing(true)}
          onSave={async (updates) => {
            setError(null)
            try {
              await window.api.personas.update(selectedPersona.id, updates)
              await loadPersonas()
              setSelectedPersona(null)
              setIsEditing(false)
            } catch (err: any) {
              setError(err.message || 'Failed to save persona')
              console.error('Failed to save persona:', err)
            }
          }}
        />
      )}
    </div>
  )
}

// PersonaCard subcomponent - memoized for performance
interface PersonaCardProps {
  persona: PersonaMetadata
  isActive: boolean
  onView: () => void
  onActivate: () => void
  onDelete: () => void
}

function PersonaCard({ persona, isActive, onView, onActivate, onDelete }: PersonaCardProps) {
  return (
    <div
      className={cn(
        "p-4 rounded-xl border transition-all",
        isActive
          ? "bg-primary/10 border-primary/30"
          : "bg-secondary/30 border-secondary/50 hover:border-secondary"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Emoji Avatar */}
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0",
          isActive ? "bg-primary/20" : "bg-secondary"
        )}>
          {persona.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium text-white">{persona.name}</h3>
            {isActive && (
              <span className="flex items-center gap-1 text-xs text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                <Check size={10} />
                Active
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted mt-0.5 line-clamp-1">
            {persona.description || 'No description'}
          </p>
          {persona.tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {persona.tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="text-xs text-text-muted/70 bg-tertiary px-2 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
              {persona.tags.length > 3 && (
                <span className="text-xs text-text-muted/50">
                  +{persona.tags.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onActivate}
            className={cn(
              "p-2 rounded-lg transition-colors",
              isActive
                ? "text-primary bg-primary/20 hover:bg-primary/30"
                : "text-text-muted hover:text-white hover:bg-secondary"
            )}
            title={isActive ? 'Deactivate' : 'Activate'}
          >
            {isActive ? <X size={16} /> : <Check size={16} />}
          </button>
          <button
            onClick={onView}
            className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
            title="View details"
          >
            <FileText size={16} />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
