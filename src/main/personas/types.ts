/**
 * Persona Types
 * Core type definitions for the persona system
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

export interface PersonaGenerationRequest {
  name: string
  description: string
}

export interface PersonaGenerationResult {
  name: string
  emoji: string
  description: string
  content: string
  tags: string[]
}
