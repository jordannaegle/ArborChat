# Persona Feature Design Document

**Author:** Alex Chen (Design Lead)  
**Date:** December 2024  
**Status:** Ready for Implementation  
**Version:** 1.0

---

## Executive Summary

This document outlines the design for ArborChat's **Persona System**, enabling users to create, manage, and dynamically load custom AI personas. Personas are stored as Markdown files and can be invoked via slash commands (`/persona <name>`) or through the Settings panel, allowing for flexible and contextual AI interactions.

### Key Features

| Feature | Description |
|---------|-------------|
| Persona Generation | AI-assisted creation of custom personas via natural language |
| Markdown Storage | Personas saved as `.md` files in user's data directory |
| Settings Management | Full CRUD interface for personas in Settings panel |
| Slash Commands | Quick `/persona` commands for loading and listing |
| Context Integration | Seamless injection of persona into system prompt |

---

## Design Philosophy

### Principles

1. **User Empowerment** - Users define exactly how they want the AI to behave
2. **Persistence** - Personas survive app restarts and updates
3. **Discoverability** - Easy access via both UI and keyboard shortcuts
4. **Non-Destructive** - Changes to personas don't affect conversation history
5. **Extensibility** - Foundation for future persona features (sharing, templates)

### Visual Language

- **Consistent with Settings** - Same card-based UI as Tools section
- **Persona Avatars** - Emoji-based visual identifiers
- **Status Indicators** - Show which persona is currently active
- **Markdown Preview** - Rich preview of persona content

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ User Interaction Flow                                           │
│                                                                 │
│   Chat Input                    Settings Panel                  │
│   ┌─────────────┐               ┌─────────────────────┐        │
│   │ /persona... │──────┐        │  Personas Section   │        │
│   └─────────────┘      │        │  ┌───────────────┐  │        │
│         │              │        │  │ View/Edit/Del │  │        │
│         ▼              ▼        │  └───────────────┘  │        │
│   ┌─────────────────────────────┴─────────────────────┘        │
│   │                                                             │
│   │              Persona Service (Main Process)                 │
│   │   ┌─────────────────────────────────────────────┐          │
│   │   │  • Load/Save personas from disk             │          │
│   │   │  • Generate personas via AI                 │          │
│   │   │  • Validate persona format                  │          │
│   │   └─────────────────────────────────────────────┘          │
│   │                         │                                   │
│   │                         ▼                                   │
│   │              ┌─────────────────────┐                       │
│   │              │  ~/.arborchat/      │                       │
│   │              │  └── personas/      │                       │
│   │              │      ├── coder.md   │                       │
│   │              │      ├── writer.md  │                       │
│   │              │      └── tutor.md   │                       │
│   │              └─────────────────────┘                       │
│   │                                                             │
│   └─────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### New Files

```
src/
├── main/
│   └── personas/
│       ├── index.ts           # Export & setup IPC handlers
│       ├── service.ts         # Core persona CRUD operations
│       ├── generator.ts       # AI-powered persona generation
│       └── types.ts           # TypeScript interfaces
│
├── renderer/src/
│   ├── components/
│   │   ├── settings/
│   │   │   └── sections/
│   │   │       └── PersonasSection.tsx   # Settings UI
│   │   └── chat/
│   │       └── SlashCommandMenu.tsx      # Autocomplete menu
│   │
│   ├── hooks/
│   │   ├── usePersonas.ts                # Persona state management
│   │   └── useSlashCommands.ts           # Slash command detection
│   │
│   └── types/
│       └── persona.ts                    # Shared types
│
├── preload/
│   └── index.ts               # Add persona API exposure
│
└── resources/
    └── personas/              # Default/template personas
        ├── helpful-assistant.md
        └── coding-expert.md
```

### Persona File Format

```markdown
<!-- filepath: ~/.arborchat/personas/senior-developer.md -->
---
name: Senior Developer
emoji: 👨‍💻
description: Expert software engineer with 15+ years experience
created: 2024-12-27T10:30:00Z
modified: 2024-12-27T14:15:00Z
tags:
  - coding
  - technical
  - mentoring
---

# Senior Developer Persona

You are a senior software developer with over 15 years of experience across multiple tech stacks and industries.

## Core Traits

- **Pragmatic**: You favor working solutions over perfect ones
- **Patient**: You explain complex concepts step-by-step
- **Thorough**: You consider edge cases and potential issues
- **Honest**: You admit when you don't know something

## Communication Style

- Use technical terminology appropriately
- Provide code examples when relevant
- Ask clarifying questions before diving into solutions
- Reference best practices and design patterns

## Areas of Expertise

- Full-stack web development (React, Node.js, Python)
- System design and architecture
- Code review and mentoring
- DevOps and CI/CD pipelines
- Database design and optimization

## Behavior Guidelines

1. When reviewing code, be constructive and specific
2. When explaining concepts, start with the "why" before the "how"
3. Suggest relevant tools and libraries when appropriate
4. Consider maintainability and scalability in recommendations
```

---

## Component Specifications

### 1. Main Process: Persona Service

```typescript
// src/main/personas/service.ts

import { app } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import matter from 'gray-matter'
import { Persona, PersonaMetadata, CreatePersonaInput } from './types'

const PERSONAS_DIR = join(app.getPath('userData'), 'personas')

export class PersonaService {
  private initialized = false

  /**
   * Initialize the personas directory
   */
  async init(): Promise<void> {
    if (this.initialized) return
    
    try {
      await fs.mkdir(PERSONAS_DIR, { recursive: true })
      this.initialized = true
      console.log('[PersonaService] Initialized at:', PERSONAS_DIR)
    } catch (error) {
      console.error('[PersonaService] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Get all personas
   */
  async listPersonas(): Promise<PersonaMetadata[]> {
    await this.init()
    
    try {
      const files = await fs.readdir(PERSONAS_DIR)
      const mdFiles = files.filter(f => f.endsWith('.md'))
      
      const personas: PersonaMetadata[] = []
      
      for (const file of mdFiles) {
        try {
          const content = await fs.readFile(join(PERSONAS_DIR, file), 'utf-8')
          const { data } = matter(content)
          
          personas.push({
            id: file.replace('.md', ''),
            name: data.name || file.replace('.md', ''),
            emoji: data.emoji || '🤖',
            description: data.description || '',
            created: data.created || new Date().toISOString(),
            modified: data.modified || new Date().toISOString(),
            tags: data.tags || []
          })
        } catch (parseError) {
          console.warn(`[PersonaService] Failed to parse ${file}:`, parseError)
        }
      }
      
      return personas.sort((a, b) => 
        new Date(b.modified).getTime() - new Date(a.modified).getTime()
      )
    } catch (error) {
      console.error('[PersonaService] Failed to list personas:', error)
      return []
    }
  }

  /**
   * Get a single persona by ID
   */
  async getPersona(id: string): Promise<Persona | null> {
    await this.init()
    
    const filePath = join(PERSONAS_DIR, `${this.sanitizeId(id)}.md`)
    
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const { data, content: body } = matter(content)
      
      return {
        id: id,
        name: data.name || id,
        emoji: data.emoji || '🤖',
        description: data.description || '',
        created: data.created || new Date().toISOString(),
        modified: data.modified || new Date().toISOString(),
        tags: data.tags || [],
        content: body.trim()
      }
    } catch (error) {
      console.warn(`[PersonaService] Persona not found: ${id}`)
      return null
    }
  }

  /**
   * Create a new persona
   */
  async createPersona(input: CreatePersonaInput): Promise<Persona> {
    await this.init()
    
    const id = this.sanitizeId(input.name)
    const filePath = join(PERSONAS_DIR, `${id}.md`)
    
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
    return persona
  }

  /**
   * Update an existing persona
   */
  async updatePersona(id: string, updates: Partial<CreatePersonaInput>): Promise<Persona> {
    const existing = await this.getPersona(id)
    if (!existing) {
      throw new Error(`Persona "${id}" not found`)
    }
    
    const updated: Persona = {
      ...existing,
      ...updates,
      modified: new Date().toISOString()
    }
    
    // Handle rename
    if (updates.name && updates.name !== existing.name) {
      const oldPath = join(PERSONAS_DIR, `${id}.md`)
      const newId = this.sanitizeId(updates.name)
      updated.id = newId
      
      await this.savePersonaFile(updated)
      await fs.unlink(oldPath)
      
      return updated
    }
    
    await this.savePersonaFile(updated)
    return updated
  }

  /**
   * Delete a persona
   */
  async deletePersona(id: string): Promise<void> {
    const filePath = join(PERSONAS_DIR, `${this.sanitizeId(id)}.md`)
    
    try {
      await fs.unlink(filePath)
      console.log(`[PersonaService] Deleted persona: ${id}`)
    } catch (error) {
      console.error(`[PersonaService] Failed to delete ${id}:`, error)
      throw error
    }
  }

  /**
   * Get the system prompt for a persona
   */
  async getPersonaPrompt(id: string): Promise<string | null> {
    const persona = await this.getPersona(id)
    if (!persona) return null
    
    return persona.content
  }

  // Private helpers
  
  private sanitizeId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50)
  }

  private async savePersonaFile(persona: Persona): Promise<void> {
    const filePath = join(PERSONAS_DIR, `${persona.id}.md`)
    
    const frontmatter = {
      name: persona.name,
      emoji: persona.emoji,
      description: persona.description,
      created: persona.created,
      modified: persona.modified,
      tags: persona.tags
    }
    
    const fileContent = matter.stringify(persona.content, frontmatter)
    await fs.writeFile(filePath, fileContent, 'utf-8')
  }
}

export const personaService = new PersonaService()
```

---

### 2. Main Process: Persona Generator

```typescript
// src/main/personas/generator.ts

import { GoogleGenerativeAI } from '@google/generative-ai'
import { getApiKey } from '../db'
import { CreatePersonaInput } from './types'

const PERSONA_GENERATION_PROMPT = `You are a persona designer for an AI assistant application called ArborChat.

Your task is to create a detailed persona definition based on the user's description. The persona should include:

1. **Core Identity**: Who is this persona? What is their expertise, background, and perspective?

2. **Communication Style**: How should the AI communicate when using this persona? (formal/casual, verbose/concise, technical/simple)

3. **Key Traits**: 3-5 defining characteristics that shape responses

4. **Behavior Guidelines**: Specific instructions for how to handle common scenarios

5. **Example Responses**: Optional examples showing the persona's voice

Format your response as a detailed Markdown document that can be used as a system prompt.

Important guidelines:
- Be specific and actionable
- Include both what TO do and what NOT to do
- Keep the persona consistent and believable
- Focus on practical, useful behaviors

User's description of the persona they want:`

export async function generatePersona(
  description: string,
  name: string
): Promise<CreatePersonaInput> {
  const apiKey = getApiKey()
  if (!apiKey) {
    throw new Error('API key not configured')
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `${PERSONA_GENERATION_PROMPT}

"${description}"

Persona name: ${name}

Create a comprehensive persona definition in Markdown format.`

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response
    const content = response.text()

    // Extract a good emoji based on the persona
    const emoji = await generateEmoji(description, name)
    
    // Generate a short description
    const shortDescription = await generateDescription(description)

    return {
      name,
      emoji,
      description: shortDescription,
      content,
      tags: extractTags(description)
    }
  } catch (error) {
    console.error('[PersonaGenerator] Failed to generate:', error)
    throw error
  }
}

async function generateEmoji(description: string, name: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) return '🤖'

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  try {
    const result = await model.generateContent(
      `Based on this persona description, respond with ONLY a single emoji that best represents it. No other text.

Persona: "${name}"
Description: "${description}"

Reply with just the emoji:`
    )
    const emoji = result.response.text().trim()
    // Validate it's actually an emoji (basic check)
    if (emoji.length <= 4) return emoji
    return '🤖'
  } catch {
    return '🤖'
  }
}

async function generateDescription(description: string): Promise<string> {
  const apiKey = getApiKey()
  if (!apiKey) return description.substring(0, 100)

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  try {
    const result = await model.generateContent(
      `Summarize this persona description in one sentence (max 80 characters):

"${description}"

Reply with just the summary:`
    )
    return result.response.text().trim().substring(0, 100)
  } catch {
    return description.substring(0, 100)
  }
}

function extractTags(description: string): string[] {
  const commonTags = [
    'coding', 'writing', 'creative', 'technical', 'business',
    'education', 'research', 'casual', 'formal', 'expert',
    'mentor', 'helper', 'analyst', 'designer', 'scientist'
  ]
  
  const descLower = description.toLowerCase()
  return commonTags.filter(tag => descLower.includes(tag)).slice(0, 5)
}
```

---

### 3. Main Process: IPC Handlers

```typescript
// src/main/personas/index.ts

import { ipcMain } from 'electron'
import { personaService } from './service'
import { generatePersona } from './generator'

export function setupPersonaHandlers(): void {
  console.log('[Personas] Setting up IPC handlers...')

  // List all personas
  ipcMain.handle('personas:list', async () => {
    return personaService.listPersonas()
  })

  // Get single persona
  ipcMain.handle('personas:get', async (_, id: string) => {
    return personaService.getPersona(id)
  })

  // Create persona
  ipcMain.handle('personas:create', async (_, input) => {
    return personaService.createPersona(input)
  })

  // Update persona
  ipcMain.handle('personas:update', async (_, { id, updates }) => {
    return personaService.updatePersona(id, updates)
  })

  // Delete persona
  ipcMain.handle('personas:delete', async (_, id: string) => {
    return personaService.deletePersona(id)
  })

  // Get persona prompt (for chat context)
  ipcMain.handle('personas:get-prompt', async (_, id: string) => {
    return personaService.getPersonaPrompt(id)
  })

  // Generate persona via AI
  ipcMain.handle('personas:generate', async (_, { description, name }) => {
    return generatePersona(description, name)
  })

  console.log('[Personas] IPC handlers ready')
}

export { personaService } from './service'
```

---

### 4. Main Process: Types

```typescript
// src/main/personas/types.ts

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
```

---

### 5. Preload: Persona API

```typescript
// Add to src/preload/index.ts

// Persona API
const personaApi = {
  // List all personas
  list: () => ipcRenderer.invoke('personas:list') as Promise<PersonaMetadata[]>,
  
  // Get single persona
  get: (id: string) => ipcRenderer.invoke('personas:get', id) as Promise<Persona | null>,
  
  // Create new persona
  create: (input: CreatePersonaInput) => 
    ipcRenderer.invoke('personas:create', input) as Promise<Persona>,
  
  // Update persona
  update: (id: string, updates: Partial<CreatePersonaInput>) =>
    ipcRenderer.invoke('personas:update', { id, updates }) as Promise<Persona>,
  
  // Delete persona
  delete: (id: string) => ipcRenderer.invoke('personas:delete', id) as Promise<void>,
  
  // Get persona prompt for chat
  getPrompt: (id: string) => 
    ipcRenderer.invoke('personas:get-prompt', id) as Promise<string | null>,
  
  // Generate persona via AI
  generate: (description: string, name: string) =>
    ipcRenderer.invoke('personas:generate', { description, name }) as Promise<CreatePersonaInput>
}

// Add to api object
const api = {
  // ... existing API
  personas: personaApi
}
```

---

### 6. Renderer: Personas Section (Settings)

```typescript
// src/renderer/src/components/settings/sections/PersonasSection.tsx

import { useState, useEffect, useCallback } from 'react'
import {
  User,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Search,
  Tag,
  FileText,
  Wand2
} from 'lucide-react'
import { cn } from '../../../lib/utils'
import { PersonaMetadata, Persona } from '../../../types/persona'

interface PersonasSectionProps {
  activePersonaId?: string | null
  onActivatePersona?: (id: string | null) => void
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
  const [isGenerating, setIsGenerating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    loadPersonas()
  }, [])

  const loadPersonas = async () => {
    setLoading(true)
    try {
      const list = await window.api.personas.list()
      setPersonas(list)
    } catch (error) {
      console.error('Failed to load personas:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleViewPersona = async (id: string) => {
    const persona = await window.api.personas.get(id)
    setSelectedPersona(persona)
    setIsEditing(false)
  }

  const handleDeletePersona = async (id: string) => {
    if (!confirm('Are you sure you want to delete this persona?')) return
    
    try {
      await window.api.personas.delete(id)
      await loadPersonas()
      if (selectedPersona?.id === id) {
        setSelectedPersona(null)
      }
      if (activePersonaId === id && onActivatePersona) {
        onActivatePersona(null)
      }
    } catch (error) {
      console.error('Failed to delete persona:', error)
    }
  }

  const handleActivatePersona = (id: string) => {
    if (onActivatePersona) {
      onActivatePersona(activePersonaId === id ? null : id)
    }
  }

  const filteredPersonas = personas.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
  )

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Personas</h2>
          <p className="text-sm text-text-muted mt-1">
            Create and manage custom AI personalities
          </p>
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
      </div>

      {/* Active Persona Banner */}
      {activePersonaId && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-primary" />
            <span className="text-sm text-primary font-medium">
              Active Persona: {personas.find(p => p.id === activePersonaId)?.name}
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
          onClose={() => setSelectedPersona(null)}
          onEdit={() => setIsEditing(true)}
          onSave={async (updates) => {
            await window.api.personas.update(selectedPersona.id, updates)
            await loadPersonas()
            setSelectedPersona(null)
          }}
        />
      )}
    </div>
  )
}

// PersonaCard subcomponent
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
          "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
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
            {persona.description}
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
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
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
```

---

### 7. Create Persona Modal

```typescript
// src/renderer/src/components/settings/modals/CreatePersonaModal.tsx

import { useState } from 'react'
import {
  X,
  Wand2,
  User,
  FileText,
  Sparkles,
  Loader2
} from 'lucide-react'
import { cn } from '../../../lib/utils'

interface CreatePersonaModalProps {
  onClose: () => void
  onCreated: () => void
}

type CreateMode = 'generate' | 'manual'

export function CreatePersonaModal({ onClose, onCreated }: CreatePersonaModalProps) {
  const [mode, setMode] = useState<CreateMode>('generate')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [content, setContent] = useState('')
  const [emoji, setEmoji] = useState('🤖')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!name.trim() || !description.trim()) return

    setLoading(true)
    setError(null)

    try {
      const generated = await window.api.personas.generate(description, name)
      
      // Create the persona with generated content
      await window.api.personas.create({
        name: generated.name || name,
        emoji: generated.emoji || '🤖',
        description: generated.description || description,
        content: generated.content,
        tags: generated.tags
      })

      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to generate persona')
    } finally {
      setLoading(false)
    }
  }

  const handleManualCreate = async () => {
    if (!name.trim() || !content.trim()) return

    setLoading(true)
    setError(null)

    try {
      await window.api.personas.create({
        name,
        emoji,
        description,
        content
      })

      onCreated()
    } catch (err: any) {
      setError(err.message || 'Failed to create persona')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div 
        className={cn(
          "relative w-full max-w-2xl max-h-[90vh] overflow-y-auto",
          "bg-background rounded-xl border border-secondary",
          "shadow-2xl shadow-black/50"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-secondary bg-background z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <User size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Create Persona</h2>
              <p className="text-xs text-text-muted">Define a custom AI personality</p>
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
        <div className="p-4 space-y-6">
          {/* Mode Selection */}
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg">
            <button
              onClick={() => setMode('generate')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md",
                "text-sm font-medium transition-all",
                mode === 'generate'
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-white"
              )}
            >
              <Wand2 size={16} />
              AI Generate
            </button>
            <button
              onClick={() => setMode('manual')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md",
                "text-sm font-medium transition-all",
                mode === 'manual'
                  ? "bg-primary text-white"
                  : "text-text-muted hover:text-white"
              )}
            >
              <FileText size={16} />
              Write Manually
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-text-normal mb-1.5">
                Persona Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Senior Developer, Creative Writer..."
                className={cn(
                  "w-full px-3 py-2 rounded-lg",
                  "bg-secondary border border-secondary/50",
                  "text-white placeholder-text-muted/50",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
              />
            </div>

            {mode === 'generate' ? (
              /* AI Generation Description */
              <div>
                <label className="block text-sm font-medium text-text-normal mb-1.5">
                  Describe Your Persona *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the persona you want to create. Be specific about their expertise, communication style, and how they should behave..."
                  rows={6}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg resize-none",
                    "bg-secondary border border-secondary/50",
                    "text-white placeholder-text-muted/50",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                />
                <p className="mt-1.5 text-xs text-text-muted">
                  The AI will generate a complete persona definition based on your description
                </p>
              </div>
            ) : (
              /* Manual Content Entry */
              <>
                {/* Emoji & Description Row */}
                <div className="grid grid-cols-[80px_1fr] gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-normal mb-1.5">
                      Emoji
                    </label>
                    <input
                      type="text"
                      value={emoji}
                      onChange={(e) => setEmoji(e.target.value.slice(-2))}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-center text-2xl",
                        "bg-secondary border border-secondary/50",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-normal mb-1.5">
                      Short Description
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of this persona"
                      className={cn(
                        "w-full px-3 py-2 rounded-lg",
                        "bg-secondary border border-secondary/50",
                        "text-white placeholder-text-muted/50",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50"
                      )}
                    />
                  </div>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-text-normal mb-1.5">
                    Persona Instructions *
                  </label>
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write the system prompt instructions for this persona. This will be injected into the AI context when the persona is active..."
                    rows={12}
                    className={cn(
                      "w-full px-3 py-2 rounded-lg resize-none font-mono text-sm",
                      "bg-secondary border border-secondary/50",
                      "text-white placeholder-text-muted/50",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50"
                    )}
                  />
                  <p className="mt-1.5 text-xs text-text-muted">
                    Write in Markdown. Describe who the persona is, their expertise, communication style, and guidelines.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 flex justify-end gap-3 p-4 border-t border-secondary bg-background">
          <button
            onClick={onClose}
            className="px-4 py-2 text-text-muted hover:text-white rounded-lg hover:bg-secondary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'generate' ? handleGenerate : handleManualCreate}
            disabled={loading || !name.trim() || (mode === 'generate' ? !description.trim() : !content.trim())}
            className={cn(
              "flex items-center gap-2 px-5 py-2 rounded-lg",
              "bg-primary hover:bg-primary/90 text-white font-medium",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {mode === 'generate' ? 'Generating...' : 'Creating...'}
              </>
            ) : mode === 'generate' ? (
              <>
                <Sparkles size={16} />
                Generate Persona
              </>
            ) : (
              'Create Persona'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 8. Slash Command System


```typescript
// src/renderer/src/hooks/useSlashCommands.ts

import { useState, useCallback, useMemo, useEffect } from 'react'
import { PersonaMetadata } from '../types/persona'

export interface SlashCommand {
  name: string
  description: string
  syntax: string
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

export function useSlashCommands({ 
  onActivatePersona, 
  onShowPersonaList 
}: UseSlashCommandsOptions) {
  const [personas, setPersonas] = useState<PersonaMetadata[]>([])
  const [state, setState] = useState<SlashCommandState>({
    isActive: false,
    query: '',
    matches: [],
    selectedIndex: 0
  })

  // Load personas
  useEffect(() => {
    window.api.personas.list().then(setPersonas)
  }, [])

  // Define available commands
  const commands = useMemo<SlashCommand[]>(() => [
    {
      name: 'persona',
      description: 'Load a persona by name',
      syntax: '/persona <name>',
      handler: async (args: string) => {
        const personaName = args.trim().toLowerCase()
        
        if (personaName === 'list') {
          onShowPersonaList()
          return
        }
        
        // Find persona by name (fuzzy match)
        const match = personas.find(p => 
          p.id === personaName ||
          p.name.toLowerCase() === personaName ||
          p.name.toLowerCase().startsWith(personaName)
        )
        
        if (match) {
          onActivatePersona(match.id)
        }
      }
    },
    {
      name: 'persona list',
      description: 'Show all available personas',
      syntax: '/persona list',
      handler: () => {
        onShowPersonaList()
      }
    },
    {
      name: 'clear persona',
      description: 'Deactivate current persona',
      syntax: '/clear persona',
      handler: () => {
        onActivatePersona(null)
      }
    }
  ], [personas, onActivatePersona, onShowPersonaList])

  // Parse input for slash commands
  const parseInput = useCallback((input: string): SlashCommandState => {
    // Check if input starts with /
    if (!input.startsWith('/')) {
      return {
        isActive: false,
        query: '',
        matches: [],
        selectedIndex: 0
      }
    }

    const query = input.slice(1).toLowerCase()

    // Find matching commands
    const matches: SlashCommandMatch[] = commands
      .filter(cmd => 
        cmd.name.toLowerCase().startsWith(query) ||
        cmd.syntax.toLowerCase().includes(query)
      )
      .map(cmd => ({
        command: cmd,
        query,
        fullMatch: cmd.name.toLowerCase() === query.split(' ')[0]
      }))

    // Also add persona name suggestions for /persona <name>
    if (query.startsWith('persona ')) {
      const personaQuery = query.slice(8).trim()
      const personaMatches = personas
        .filter(p => 
          p.name.toLowerCase().includes(personaQuery) ||
          p.id.includes(personaQuery)
        )
        .slice(0, 5)
        .map(p => ({
          command: {
            name: `persona ${p.name}`,
            description: p.description || `Load ${p.name} persona`,
            syntax: `/persona ${p.name}`,
            handler: () => onActivatePersona(p.id)
          },
          query: personaQuery,
          fullMatch: p.name.toLowerCase() === personaQuery
        }))
      
      matches.push(...personaMatches)
    }

    return {
      isActive: true,
      query,
      matches: matches.slice(0, 8),
      selectedIndex: 0
    }
  }, [commands, personas, onActivatePersona])

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

  // Execute selected command
  const executeSelected = useCallback(async (): Promise<boolean> => {
    if (!state.isActive || state.matches.length === 0) return false
    
    const match = state.matches[state.selectedIndex]
    if (!match) return false
    
    // Extract args from the full query
    const args = state.query.slice(match.command.name.split(' ')[0].length).trim()
    
    await match.command.handler(args)
    
    setState({
      isActive: false,
      query: '',
      matches: [],
      selectedIndex: 0
    })
    
    return true
  }, [state])

  // Execute specific command
  const executeCommand = useCallback(async (input: string): Promise<boolean> => {
    if (!input.startsWith('/')) return false
    
    const parts = input.slice(1).split(' ')
    const commandName = parts[0].toLowerCase()
    const args = parts.slice(1).join(' ')
    
    const command = commands.find(c => 
      c.name.toLowerCase() === commandName ||
      c.name.toLowerCase().startsWith(commandName)
    )
    
    if (command) {
      await command.handler(args)
      return true
    }
    
    return false
  }, [commands])

  // Reset state
  const reset = useCallback(() => {
    setState({
      isActive: false,
      query: '',
      matches: [],
      selectedIndex: 0
    })
  }, [])

  return {
    state,
    handleInputChange,
    handleNavigate,
    executeSelected,
    executeCommand,
    reset
  }
}
```

---

### 9. Slash Command Menu Component

```typescript
// src/renderer/src/components/chat/SlashCommandMenu.tsx

import { useEffect, useRef } from 'react'
import { 
  User, 
  List, 
  X,
  ChevronRight 
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { SlashCommandState } from '../../hooks/useSlashCommands'

interface SlashCommandMenuProps {
  state: SlashCommandState
  onSelect: (index: number) => void
  onClose: () => void
}

export function SlashCommandMenu({ 
  state, 
  onSelect, 
  onClose 
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [state.selectedIndex])

  if (!state.isActive || state.matches.length === 0) {
    return null
  }

  const getCommandIcon = (name: string) => {
    if (name.includes('list')) return List
    if (name.includes('clear')) return X
    return User
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-2",
        "bg-secondary/95 backdrop-blur-sm",
        "border border-secondary rounded-xl",
        "shadow-xl shadow-black/30",
        "max-h-64 overflow-y-auto",
        "z-50"
      )}
    >
      <div className="p-2">
        <div className="text-xs text-text-muted px-2 py-1 mb-1">
          Commands
        </div>
        
        {state.matches.map((match, index) => {
          const Icon = getCommandIcon(match.command.name)
          const isSelected = index === state.selectedIndex
          
          return (
            <button
              key={`${match.command.name}-${index}`}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(index)}
              className={cn(
                "w-full flex items-center gap-3 p-2 rounded-lg",
                "text-left transition-colors",
                isSelected
                  ? "bg-primary/20 text-white"
                  : "text-text-muted hover:bg-tertiary hover:text-text-normal"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-md",
                isSelected ? "bg-primary/30" : "bg-tertiary"
              )}>
                <Icon size={14} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">
                    {match.command.syntax}
                  </span>
                  {isSelected && (
                    <ChevronRight size={12} className="text-primary" />
                  )}
                </div>
                <span className="text-xs text-text-muted line-clamp-1">
                  {match.command.description}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      
      <div className="border-t border-tertiary px-3 py-2 text-xs text-text-muted/60">
        <span className="inline-flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-tertiary rounded text-[10px]">↑↓</kbd>
          navigate
        </span>
        <span className="ml-3 inline-flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-tertiary rounded text-[10px]">Enter</kbd>
          select
        </span>
        <span className="ml-3 inline-flex items-center gap-1">
          <kbd className="px-1 py-0.5 bg-tertiary rounded text-[10px]">Esc</kbd>
          cancel
        </span>
      </div>
    </div>
  )
}
```

---

### 10. Persona List Modal (for /persona list)

```typescript
// src/renderer/src/components/PersonaListModal.tsx

import { useState, useEffect } from 'react'
import { 
  X, 
  User, 
  Check, 
  Search 
} from 'lucide-react'
import { cn } from '../lib/utils'
import { PersonaMetadata } from '../types/persona'

interface PersonaListModalProps {
  isOpen: boolean
  activePersonaId: string | null
  onClose: () => void
  onSelect: (id: string) => void
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

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      window.api.personas.list().then(list => {
        setPersonas(list)
        setLoading(false)
      })
    }
  }, [isOpen])

  if (!isOpen) return null

  const filteredPersonas = personas.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div 
        className={cn(
          "relative w-full max-w-md",
          "bg-background rounded-xl border border-secondary",
          "shadow-2xl shadow-black/50",
          "overflow-hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary">
          <h2 className="text-lg font-bold text-white">Select Persona</h2>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-white hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-secondary/50">
          <div className="relative">
            <Search 
              size={16} 
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" 
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search personas..."
              autoFocus
              className={cn(
                "w-full pl-9 pr-4 py-2 rounded-lg",
                "bg-secondary border border-secondary/50",
                "text-text-normal placeholder-text-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            />
          </div>
        </div>

        {/* Persona List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {loading ? (
            <div className="py-8 text-center text-text-muted">
              Loading...
            </div>
          ) : filteredPersonas.length === 0 ? (
            <div className="py-8 text-center">
              <User size={32} className="mx-auto text-text-muted/30 mb-2" />
              <p className="text-sm text-text-muted">
                {search ? 'No personas found' : 'No personas created yet'}
              </p>
            </div>
          ) : (
            filteredPersonas.map((persona) => (
              <button
                key={persona.id}
                onClick={() => {
                  onSelect(persona.id)
                  onClose()
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg",
                  "text-left transition-all",
                  activePersonaId === persona.id
                    ? "bg-primary/20 border border-primary/30"
                    : "hover:bg-secondary border border-transparent"
                )}
              >
                <span className="text-2xl">{persona.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white">
                      {persona.name}
                    </span>
                    {activePersonaId === persona.id && (
                      <Check size={14} className="text-primary" />
                    )}
                  </div>
                  <p className="text-xs text-text-muted line-clamp-1">
                    {persona.description}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="p-3 border-t border-secondary/50 text-xs text-text-muted text-center">
          Type <code className="bg-tertiary px-1 rounded">/persona name</code> in chat for quick access
        </div>
      </div>
    </div>
  )
}
```

---

## Integration Points

### 1. App.tsx Changes

```typescript
// Key additions to App.tsx

import { useState, useCallback } from 'react'
import { PersonaListModal } from './components/PersonaListModal'

function AppContent({ apiKey }: { apiKey: string }) {
  // Add persona state
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null)
  const [activePersonaContent, setActivePersonaContent] = useState<string | null>(null)
  const [showPersonaList, setShowPersonaList] = useState(false)

  // Load persona content when active persona changes
  useEffect(() => {
    if (activePersonaId) {
      window.api.personas.getPrompt(activePersonaId).then(setActivePersonaContent)
    } else {
      setActivePersonaContent(null)
    }
  }, [activePersonaId])

  // Modified buildSystemPrompt to include persona
  const enhancedSystemPrompt = useCallback((basePrompt: string) => {
    let prompt = basePrompt
    
    // Add persona content if active
    if (activePersonaContent) {
      prompt = `${activePersonaContent}\n\n---\n\n${prompt}`
    }
    
    // Add MCP tool instructions
    return buildSystemPrompt(prompt)
  }, [activePersonaContent, buildSystemPrompt])

  // ... rest of component

  return (
    <>
      <Layout
        // ... existing props
        activePersonaId={activePersonaId}
        onActivatePersona={setActivePersonaId}
        onShowPersonaList={() => setShowPersonaList(true)}
      />
      <SettingsPanel
        // ... existing props
        activePersonaId={activePersonaId}
        onActivatePersona={setActivePersonaId}
      />
      <PersonaListModal
        isOpen={showPersonaList}
        activePersonaId={activePersonaId}
        onClose={() => setShowPersonaList(false)}
        onSelect={setActivePersonaId}
      />
    </>
  )
}
```

### 2. ChatWindow.tsx Changes

```typescript
// Key additions to ChatWindow.tsx

import { useSlashCommands } from '../hooks/useSlashCommands'
import { SlashCommandMenu } from './chat/SlashCommandMenu'

export function ChatWindow({
  // ... existing props
  activePersonaId,
  onActivatePersona,
  onShowPersonaList
}: ChatWindowProps) {
  const [input, setInput] = useState('')

  // Slash command integration
  const {
    state: slashState,
    handleInputChange: handleSlashInput,
    handleNavigate,
    executeSelected,
    executeCommand,
    reset: resetSlash
  } = useSlashCommands({
    onActivatePersona,
    onShowPersonaList
  })

  // Handle input change
  const handleInputChange = (value: string) => {
    setInput(value)
    handleSlashInput(value)
  }

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command navigation
    if (slashState.isActive) {
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        handleNavigate('up')
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        handleNavigate('down')
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        executeSelected().then(handled => {
          if (handled) setInput('')
        })
        return
      }
      if (e.key === 'Escape') {
        resetSlash()
        return
      }
    }

    // Normal enter handling
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || pending) return

    // Check if it's a slash command
    if (input.startsWith('/')) {
      const handled = await executeCommand(input)
      if (handled) {
        setInput('')
        return
      }
    }

    // Normal message
    onSendMessage(input)
    setInput('')
  }

  return (
    <div className="flex-1 flex flex-col h-full relative">
      {/* ... messages area ... */}

      {/* Input area with slash command menu */}
      <div className="p-4 border-t shrink-0 relative">
        <form onSubmit={handleSubmit} className="relative">
          {/* Slash Command Menu */}
          <SlashCommandMenu
            state={slashState}
            onSelect={(index) => {
              // Update selection and execute
              executeSelected()
              setInput('')
            }}
            onClose={resetSlash}
          />

          {/* Active Persona Indicator */}
          {activePersonaId && (
            <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
              <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full">
                Persona Active
              </span>
            </div>
          )}

          {/* Text input */}
          <textarea
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            // ... rest of textarea props
          />
        </form>
      </div>
    </div>
  )
}
```

### 3. SettingsPanel.tsx Changes

```typescript
// Add Personas to menu items

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

// Add to content rendering
{activeSection === 'personas' && (
  <PersonasSection 
    activePersonaId={activePersonaId}
    onActivatePersona={onActivatePersona}
  />
)}
```

---

## Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `/src/main/personas/` directory structure
- [ ] Implement `PersonaService` with CRUD operations
- [ ] Add IPC handlers in `/src/main/personas/index.ts`
- [ ] Extend preload API with persona methods
- [ ] Add persona types to `/src/renderer/src/types/persona.ts`

### Phase 2: Settings UI
- [ ] Create `PersonasSection.tsx` component
- [ ] Create `CreatePersonaModal.tsx` component
- [ ] Create `PersonaDetailModal.tsx` component
- [ ] Add "Personas" to settings menu
- [ ] Implement persona card design

### Phase 3: Persona Generation
- [ ] Implement `generator.ts` with AI generation
- [ ] Add emoji and description generation
- [ ] Add tag extraction logic
- [ ] Test generation with various prompts

### Phase 4: Slash Commands
- [ ] Create `useSlashCommands` hook
- [ ] Create `SlashCommandMenu` component
- [ ] Integrate with ChatWindow input
- [ ] Add `/persona <name>` command
- [ ] Add `/persona list` command
- [ ] Add `/clear persona` command

### Phase 5: Integration
- [ ] Modify `App.tsx` for persona state
- [ ] Update system prompt builder
- [ ] Add persona indicator to chat
- [ ] Create `PersonaListModal` component
- [ ] Test full flow end-to-end

### Phase 6: Polish
- [ ] Add default personas
- [ ] Add keyboard shortcuts documentation
- [ ] Add error handling and validation
- [ ] Add loading states
- [ ] Performance optimization

---

## Testing Plan

### Unit Tests
- PersonaService CRUD operations
- Persona file format parsing
- Slash command parsing
- Input validation

### Integration Tests
- Persona creation via AI
- Persona loading into chat context
- Settings panel navigation
- Slash command execution

### E2E Tests
- Full persona creation flow
- Persona switching during conversation
- Persistence across app restart
- Error handling scenarios

---

## Security Considerations

1. **File System Access**
   - Personas stored in app's userData directory
   - Sanitize persona IDs to prevent path traversal
   - Validate file extensions (.md only)

2. **Content Validation**
   - Limit persona content length (100KB max)
   - Validate frontmatter structure
   - Sanitize user-provided content

3. **AI Generation**
   - Rate limit generation requests
   - Validate generated content before saving
   - Handle API errors gracefully

---

## Future Enhancements

1. **Persona Templates** - Pre-built personas for common use cases
2. **Persona Sharing** - Export/import personas as files
3. **Persona Marketplace** - Community-shared personas
4. **Conversation Memory** - Personas remember past interactions
5. **Persona Chaining** - Combine multiple personas
6. **Voice/Tone Preview** - Sample response before activation
7. **Usage Analytics** - Track which personas are used most

---

## Appendix: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Open slash command menu |
| `↑` / `↓` | Navigate command options |
| `Enter` | Select command |
| `Esc` | Close command menu |
| `Cmd/Ctrl + Shift + P` | Open persona list (future) |

---

*Document prepared by Alex Chen, Design Lead*  
*Ready for implementation review*
