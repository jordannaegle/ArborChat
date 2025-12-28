/**
 * useSlashCommands Hook
 * Handles slash command detection, parsing, and execution for the chat input
 * 
 * @author Alex Chen (Design Lead)
 * @phase Phase 4: Slash Commands
 */

import { useState, useCallback, useMemo, useEffect } from 'react'
import { PersonaMetadata } from '../types/persona'

export interface SlashCommand {
  name: string
  description: string
  syntax: string
  icon?: string
  handler: (args: string) => void | Promise<void>
}

export interface SlashCommandMatch {
  command: SlashCommand
  query: string
  fullMatch: boolean
}

export interface SlashCommandState {
  isActive: boolean
  query: string
  matches: SlashCommandMatch[]
  selectedIndex: number
}

interface UseSlashCommandsOptions {
  onActivatePersona: (id: string | null) => void
  onShowPersonaList: () => void
}

const INITIAL_STATE: SlashCommandState = {
  isActive: false,
  query: '',
  matches: [],
  selectedIndex: 0
}

export function useSlashCommands({ 
  onActivatePersona, 
  onShowPersonaList 
}: UseSlashCommandsOptions) {
  const [personas, setPersonas] = useState<PersonaMetadata[]>([])
  const [state, setState] = useState<SlashCommandState>(INITIAL_STATE)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Load personas on mount and when refresh is triggered
  useEffect(() => {
    const loadPersonas = async () => {
      try {
        const list = await window.api.personas.list()
        setPersonas(list)
      } catch (error) {
        console.warn('[useSlashCommands] Failed to load personas:', error)
        setPersonas([])
      }
    }
    loadPersonas()
  }, [refreshTrigger])

  // Refresh personas (useful after creating/deleting)
  const refreshPersonas = useCallback(() => {
    setRefreshTrigger(prev => prev + 1)
  }, [])

  // Define base commands
  const baseCommands = useMemo<SlashCommand[]>(() => [
    {
      name: 'persona list',
      description: 'Show all available personas',
      syntax: '/persona list',
      icon: '📋',
      handler: () => {
        onShowPersonaList()
      }
    },
    {
      name: 'clear persona',
      description: 'Deactivate current persona',
      syntax: '/clear persona',
      icon: '🚫',
      handler: () => {
        onActivatePersona(null)
      }
    }
  ], [onActivatePersona, onShowPersonaList])

  // Parse input for slash commands
  const parseInput = useCallback((input: string): SlashCommandState => {
    // Check if input starts with /
    if (!input.startsWith('/')) {
      return INITIAL_STATE
    }

    const query = input.slice(1).toLowerCase()
    const matches: SlashCommandMatch[] = []

    // Match base commands
    for (const cmd of baseCommands) {
      const cmdLower = cmd.name.toLowerCase()
      const syntaxLower = cmd.syntax.toLowerCase().slice(1) // remove leading /
      
      if (cmdLower.startsWith(query) || syntaxLower.startsWith(query)) {
        matches.push({
          command: cmd,
          query,
          fullMatch: cmdLower === query || syntaxLower === query
        })
      }
    }

    // Handle /persona <name> suggestions
    if (query.startsWith('persona') || 'persona'.startsWith(query)) {
      const personaQuery = query.startsWith('persona ') 
        ? query.slice(8).trim() 
        : ''

      // If just "/persona" or "/perso", show the generic persona command hint
      if (!personaQuery && !query.includes(' ')) {
        matches.unshift({
          command: {
            name: 'persona',
            description: 'Load a persona by name (type name after)',
            syntax: '/persona <name>',
            icon: '👤',
            handler: () => {} // No-op, user needs to specify name
          },
          query,
          fullMatch: false
        })
      }

      // Add persona name suggestions if there's a query
      if (personaQuery || query.startsWith('persona ')) {
        const personaMatches = personas
          .filter(p => 
            !personaQuery || // Show all if no query yet
            p.name.toLowerCase().includes(personaQuery) ||
            p.id.includes(personaQuery)
          )
          .slice(0, 5)
          .map(p => ({
            command: {
              name: `persona ${p.name}`,
              description: p.description || `Load ${p.name} persona`,
              syntax: `/persona ${p.name}`,
              icon: p.emoji || '👤',
              handler: () => onActivatePersona(p.id)
            },
            query: personaQuery,
            fullMatch: p.name.toLowerCase() === personaQuery || p.id === personaQuery
          }))
        
        matches.push(...personaMatches)
      }
    }

    return {
      isActive: true,
      query,
      matches: matches.slice(0, 8), // Limit to 8 suggestions
      selectedIndex: 0
    }
  }, [baseCommands, personas, onActivatePersona])

  // Handle input change
  const handleInputChange = useCallback((input: string) => {
    const newState = parseInput(input)
    setState(newState)
  }, [parseInput])

  // Handle selection navigation
  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    setState(prev => {
      if (!prev.isActive || prev.matches.length === 0) return prev
      
      const maxIndex = prev.matches.length - 1
      let newIndex = prev.selectedIndex
      
      if (direction === 'up') {
        newIndex = prev.selectedIndex <= 0 ? maxIndex : prev.selectedIndex - 1
      } else {
        newIndex = prev.selectedIndex >= maxIndex ? 0 : prev.selectedIndex + 1
      }
      
      return { ...prev, selectedIndex: newIndex }
    })
  }, [])

  // Set selected index directly
  const setSelectedIndex = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      selectedIndex: Math.max(0, Math.min(index, prev.matches.length - 1))
    }))
  }, [])

  // Execute selected command
  const executeSelected = useCallback(async (): Promise<boolean> => {
    if (!state.isActive || state.matches.length === 0) return false
    
    const match = state.matches[state.selectedIndex]
    if (!match) return false
    
    // Don't execute the generic "persona" hint command
    if (match.command.name === 'persona' && !match.command.syntax.includes('<name>') === false) {
      // This is the hint, not a real command
      if (match.command.syntax === '/persona <name>') {
        return false
      }
    }
    
    try {
      await match.command.handler('')
      setState(INITIAL_STATE)
      return true
    } catch (error) {
      console.error('[useSlashCommands] Command execution failed:', error)
      setState(INITIAL_STATE)
      return false
    }
  }, [state])

  // Execute a specific command from input string
  const executeCommand = useCallback(async (input: string): Promise<boolean> => {
    if (!input.startsWith('/')) return false
    
    const fullCommand = input.slice(1).toLowerCase().trim()
    
    // Check for /clear persona
    if (fullCommand === 'clear persona') {
      onActivatePersona(null)
      return true
    }
    
    // Check for /persona list
    if (fullCommand === 'persona list') {
      onShowPersonaList()
      return true
    }
    
    // Check for /persona <name>
    if (fullCommand.startsWith('persona ')) {
      const personaName = fullCommand.slice(8).trim()
      
      if (personaName === 'list') {
        onShowPersonaList()
        return true
      }
      
      // Find persona by name (fuzzy match)
      const match = personas.find(p => 
        p.id === personaName ||
        p.name.toLowerCase() === personaName ||
        p.name.toLowerCase().startsWith(personaName)
      )
      
      if (match) {
        onActivatePersona(match.id)
        return true
      }
    }
    
    return false
  }, [personas, onActivatePersona, onShowPersonaList])

  // Reset state
  const reset = useCallback(() => {
    setState(INITIAL_STATE)
  }, [])

  return {
    state,
    personas,
    handleInputChange,
    handleNavigate,
    setSelectedIndex,
    executeSelected,
    executeCommand,
    refreshPersonas,
    reset
  }
}
