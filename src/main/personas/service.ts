/**
 * Persona Service
 * Core CRUD operations for persona management
 * 
 * Personas are stored as Markdown files with YAML frontmatter
 * in the user's data directory: ~/.arborchat/personas/
 */

import { app } from 'electron'
import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import {
  Persona,
  PersonaMetadata,
  CreatePersonaInput,
  UpdatePersonaInput
} from './types'

// Validation constants
const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 500
const MAX_CONTENT_LENGTH = 100000 // 100KB
const RESERVED_NAMES = ['default', 'system', 'none', 'null', 'undefined']

// Simple YAML frontmatter parser (avoiding external dependency)
function parseFrontmatter(content: string): { data: Record<string, any>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/
  const match = content.match(frontmatterRegex)

  if (!match) {
    return { data: {}, content: content.trim() }
  }

  const yamlContent = match[1]
  const bodyContent = match[2]

  // Simple YAML parser for our specific format
  const data: Record<string, any> = {}
  const lines = yamlContent.split('\n')
  let currentKey = ''
  let inArray = false
  let arrayItems: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // Array item
    if (trimmed.startsWith('- ') && inArray) {
      arrayItems.push(trimmed.slice(2).trim())
      continue
    }

    // If we were in an array, save it
    if (inArray && !trimmed.startsWith('-')) {
      data[currentKey] = arrayItems
      inArray = false
      arrayItems = []
    }

    // Key-value pair
    const colonIndex = trimmed.indexOf(':')
    if (colonIndex > 0) {
      const key = trimmed.slice(0, colonIndex).trim()
      const value = trimmed.slice(colonIndex + 1).trim()

      if (value === '') {
        // Start of array or empty value
        currentKey = key
        inArray = true
        arrayItems = []
      } else {
        data[key] = value
      }
    }
  }

  // Handle trailing array
  if (inArray && arrayItems.length > 0) {
    data[currentKey] = arrayItems
  }

  return { data, content: bodyContent.trim() }
}

// Simple YAML stringifier
function stringifyFrontmatter(data: Record<string, any>, content: string): string {
  const lines: string[] = ['---']

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      lines.push(`${key}:`)
      for (const item of value) {
        lines.push(`  - ${item}`)
      }
    } else {
      lines.push(`${key}: ${value}`)
    }
  }

  lines.push('---')
  lines.push('')
  lines.push(content)

  return lines.join('\n')
}

class PersonaService {
  private personasDir: string
  private defaultPersonasDir: string
  private initialized = false

  constructor() {
    this.personasDir = join(app.getPath('userData'), 'personas')
    // Default personas are bundled with the app in resources
    this.defaultPersonasDir = app.isPackaged
      ? join(process.resourcesPath, 'personas')
      : join(dirname(dirname(dirname(__dirname))), 'resources', 'personas')
  }

  /**
   * Initialize the personas directory and copy defaults if empty
   */
  async init(): Promise<void> {
    if (this.initialized) return

    try {
      await fs.mkdir(this.personasDir, { recursive: true })
      
      // Check if directory is empty and copy defaults
      await this.copyDefaultPersonasIfEmpty()
      
      this.initialized = true
      console.log('[PersonaService] Initialized at:', this.personasDir)
    } catch (error) {
      console.error('[PersonaService] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Copy default personas if user has none
   */
  private async copyDefaultPersonasIfEmpty(): Promise<void> {
    try {
      const existingFiles = await fs.readdir(this.personasDir)
      const existingMdFiles = existingFiles.filter(f => f.endsWith('.md'))
      
      // Only copy if user has no personas
      if (existingMdFiles.length > 0) {
        console.log('[PersonaService] User already has personas, skipping defaults')
        return
      }

      // Check if default personas directory exists
      try {
        await fs.access(this.defaultPersonasDir)
      } catch {
        console.log('[PersonaService] No default personas directory found')
        return
      }

      const defaultFiles = await fs.readdir(this.defaultPersonasDir)
      const defaultMdFiles = defaultFiles.filter(f => f.endsWith('.md'))

      for (const file of defaultMdFiles) {
        const src = join(this.defaultPersonasDir, file)
        const dest = join(this.personasDir, file)
        
        try {
          const content = await fs.readFile(src, 'utf-8')
          // Update timestamps to current time
          const updatedContent = content
            .replace(/created: .+/g, `created: ${new Date().toISOString()}`)
            .replace(/modified: .+/g, `modified: ${new Date().toISOString()}`)
          await fs.writeFile(dest, updatedContent, 'utf-8')
          console.log(`[PersonaService] Copied default persona: ${file}`)
        } catch (err) {
          console.warn(`[PersonaService] Failed to copy default ${file}:`, err)
        }
      }
    } catch (error) {
      console.warn('[PersonaService] Failed to copy default personas:', error)
      // Non-fatal - continue without defaults
    }
  }

  /**
   * Validate persona input before creation/update
   */
  private validatePersonaInput(input: CreatePersonaInput | UpdatePersonaInput): void {
    if ('name' in input && input.name) {
      if (input.name.length > MAX_NAME_LENGTH) {
        throw new Error(`Persona name must be ${MAX_NAME_LENGTH} characters or less`)
      }
      if (RESERVED_NAMES.includes(input.name.toLowerCase())) {
        throw new Error(`"${input.name}" is a reserved name and cannot be used`)
      }
      if (!/^[a-zA-Z0-9]/.test(input.name)) {
        throw new Error('Persona name must start with a letter or number')
      }
    }

    if ('description' in input && input.description) {
      if (input.description.length > MAX_DESCRIPTION_LENGTH) {
        throw new Error(`Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`)
      }
    }

    if ('content' in input && input.content) {
      if (input.content.length > MAX_CONTENT_LENGTH) {
        throw new Error(`Persona content is too large (max ${Math.round(MAX_CONTENT_LENGTH / 1000)}KB)`)
      }
    }
  }

  /**
   * List all personas (metadata only)
   */
  async listPersonas(): Promise<PersonaMetadata[]> {
    await this.init()

    try {
      const files = await fs.readdir(this.personasDir)
      const mdFiles = files.filter((f) => f.endsWith('.md'))

      const personas: PersonaMetadata[] = []

      for (const file of mdFiles) {
        try {
          const filePath = join(this.personasDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const { data } = parseFrontmatter(content)

          personas.push({
            id: file.replace('.md', ''),
            name: data.name || file.replace('.md', ''),
            emoji: data.emoji || '🤖',
            description: data.description || '',
            created: data.created || new Date().toISOString(),
            modified: data.modified || new Date().toISOString(),
            tags: Array.isArray(data.tags) ? data.tags : []
          })
        } catch (parseError) {
          console.warn(`[PersonaService] Failed to parse ${file}:`, parseError)
        }
      }

      // Sort by modified date, newest first
      return personas.sort(
        (a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime()
      )
    } catch (error) {
      console.error('[PersonaService] Failed to list personas:', error)
      return []
    }
  }

  /**
   * Get a single persona by ID (includes content)
   */
  async getPersona(id: string): Promise<Persona | null> {
    await this.init()

    const filePath = join(this.personasDir, `${this.sanitizeId(id)}.md`)

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const { data, content } = parseFrontmatter(fileContent)

      return {
        id: id,
        name: data.name || id,
        emoji: data.emoji || '🤖',
        description: data.description || '',
        created: data.created || new Date().toISOString(),
        modified: data.modified || new Date().toISOString(),
        tags: Array.isArray(data.tags) ? data.tags : [],
        content: content
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.warn(`[PersonaService] Persona not found: ${id}`)
        return null
      }
      throw error
    }
  }

  /**
   * Create a new persona
   */
  async createPersona(input: CreatePersonaInput): Promise<Persona> {
    await this.init()

    // Validate input
    this.validatePersonaInput(input)

    const id = this.sanitizeId(input.name)
    const filePath = join(this.personasDir, `${id}.md`)

    // Check if already exists
    try {
      await fs.access(filePath)
      throw new Error(`Persona "${input.name}" already exists`)
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error
    }

    const now = new Date().toISOString()
    const persona: Persona = {
      id,
      name: input.name,
      emoji: input.emoji || '🤖',
      description: input.description || '',
      created: now,
      modified: now,
      tags: input.tags || [],
      content: input.content
    }

    await this.savePersonaFile(persona)
    console.log(`[PersonaService] Created persona: ${id}`)

    return persona
  }

  /**
   * Update an existing persona
   */
  async updatePersona(id: string, updates: UpdatePersonaInput): Promise<Persona> {
    const existing = await this.getPersona(id)
    if (!existing) {
      throw new Error(`Persona "${id}" not found`)
    }

    // Validate updates
    this.validatePersonaInput(updates)

    const updated: Persona = {
      ...existing,
      name: updates.name ?? existing.name,
      emoji: updates.emoji ?? existing.emoji,
      description: updates.description ?? existing.description,
      tags: updates.tags ?? existing.tags,
      content: updates.content ?? existing.content,
      modified: new Date().toISOString()
    }

    // Handle rename - need to delete old file and create new one
    if (updates.name && updates.name !== existing.name) {
      const oldPath = join(this.personasDir, `${id}.md`)
      const newId = this.sanitizeId(updates.name)
      updated.id = newId

      await this.savePersonaFile(updated)
      await fs.unlink(oldPath)

      console.log(`[PersonaService] Renamed persona: ${id} -> ${newId}`)
      return updated
    }

    await this.savePersonaFile(updated)
    console.log(`[PersonaService] Updated persona: ${id}`)

    return updated
  }

  /**
   * Delete a persona
   */
  async deletePersona(id: string): Promise<void> {
    const filePath = join(this.personasDir, `${this.sanitizeId(id)}.md`)

    try {
      await fs.unlink(filePath)
      console.log(`[PersonaService] Deleted persona: ${id}`)
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        throw new Error(`Persona "${id}" not found`)
      }
      throw error
    }
  }

  /**
   * Get the system prompt content for a persona
   * Used to inject into chat context
   */
  async getPersonaPrompt(id: string): Promise<string | null> {
    const persona = await this.getPersona(id)
    if (!persona) return null

    return persona.content
  }

  /**
   * Get the personas directory path
   */
  getPersonasDirectory(): string {
    return this.personasDir
  }

  // ============ Private Helpers ============

  /**
   * Sanitize a name into a valid file ID
   */
  private sanitizeId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)
  }

  /**
   * Save a persona to disk
   */
  private async savePersonaFile(persona: Persona): Promise<void> {
    const filePath = join(this.personasDir, `${persona.id}.md`)

    const frontmatter = {
      name: persona.name,
      emoji: persona.emoji,
      description: persona.description,
      created: persona.created,
      modified: persona.modified,
      tags: persona.tags
    }

    const fileContent = stringifyFrontmatter(frontmatter, persona.content)
    await fs.writeFile(filePath, fileContent, 'utf-8')
  }
}

// Singleton instance
export const personaService = new PersonaService()
