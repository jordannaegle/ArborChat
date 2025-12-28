/**
 * Persona Types (Renderer)
 * Type definitions for persona system used in the renderer process
 */

export interface PersonaMetadata {
  id: string
  name: string
  emoji: string
  description: string
  created: string
  modified: string
  tags: string[]
}

export interface Persona extends PersonaMetadata {
  content: string
}

export interface CreatePersonaInput {
  name: string
  emoji?: string
  description?: string
  content: string
  tags?: string[]
}

export interface UpdatePersonaInput {
  name?: string
  emoji?: string
  description?: string
  content?: string
  tags?: string[]
}

export interface PersonaGenerationResult {
  name: string
  emoji: string
  description: string
  content: string
  tags: string[]
}
