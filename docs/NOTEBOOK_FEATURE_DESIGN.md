# Notebook Feature Design Document

**Author:** Alex Chen (Design Lead)  
**Date:** December 2024  
**Status:** Ready for Implementation  
**Version:** 1.0

---

## Executive Summary

This document outlines the design for ArborChat's **Notebook System**, enabling users to save, organize, and review valuable content from chat conversations. Users can hover over any chat message to reveal a notebook icon, click to save that content to existing or new notebooks, and access all notebooks via a dedicated sidebar panel.

### Key Features

| Feature | Description |
|---------|-------------|
| Message Save Action | Hover-reveal notebook icon on chat bubbles |
| Save Modal | Create new or select existing notebook for saving |
| Notebook Sidebar | Dedicated panel for browsing all notebooks |
| Notebook Viewer | Read and manage notebook contents |
| SQLite Storage | Persistent storage with full-text search capability |

---

## Design Philosophy

### Principles

1. **Frictionless Capture** - One-click saving from any chat message
2. **Organization** - Notebooks provide logical grouping of saved content
3. **Discoverability** - Easy access via sidebar icon
4. **Non-Intrusive** - Hover-reveal keeps UI clean until needed
5. **Searchable** - Full-text search across all notebook entries

### Visual Language

- **Consistent with ArborChat** - Matches existing sidebar and modal patterns
- **Hover Reveal** - Icons appear on message hover (like Thread/Agent buttons)
- **Notebook Icons** - BookOpen from Lucide for recognition
- **Status Indicators** - Show entry count and last modified

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ User Interaction Flow                                               │
│                                                                     │
│   Chat Message                          Sidebar                     │
│   ┌─────────────────┐                   ┌──────────────────┐       │
│   │ [Hover] 📓 icon │────┐              │ 📓 Notebooks     │       │
│   └─────────────────┘    │              │ └─> Open Panel   │       │
│           │              │              └──────────────────┘       │
│           ▼              │                       │                  │
│   ┌─────────────────┐    │              ┌────────▼─────────┐       │
│   │  Save to        │    │              │  Notebook Panel  │       │
│   │  Notebook Modal │◄───┘              │  ┌─────────────┐ │       │
│   │  ┌───────────┐  │                   │  │ List View   │ │       │
│   │  │ Create/   │  │                   │  ├─────────────┤ │       │
│   │  │ Select    │  │                   │  │ Search      │ │       │
│   │  └───────────┘  │                   │  ├─────────────┤ │       │
│   └─────────────────┘                   │  │ Notebook    │ │       │
│           │                             │  │ Viewer      │ │       │
│           ▼                             │  └─────────────┘ │       │
│   ┌─────────────────────────────────────┴──────────────────┘       │
│   │                                                                 │
│   │              Notebook Service (Main Process)                    │
│   │   ┌───────────────────────────────────────────────────┐        │
│   │   │  • CRUD operations for notebooks                  │        │
│   │   │  • CRUD operations for notebook entries           │        │
│   │   │  • Full-text search across entries                │        │
│   │   │  • Export notebooks (Markdown, JSON)              │        │
│   │   └───────────────────────────────────────────────────┘        │
│   │                         │                                       │
│   │                         ▼                                       │
│   │              ┌─────────────────────┐                           │
│   │              │  SQLite Database    │                           │
│   │              │  ├── notebooks      │                           │
│   │              │  └── notebook_entries│                          │
│   │              └─────────────────────┘                           │
│   │                                                                 │
│   └─────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### New Files

```
src/
├── main/
│   └── notebooks/
│       ├── index.ts           # Export & setup IPC handlers
│       ├── service.ts         # Core notebook CRUD operations
│       └── types.ts           # TypeScript interfaces
│
├── renderer/src/
│   ├── components/
│   │   └── notebook/
│   │       ├── index.ts              # Barrel exports
│   │       ├── NotebookIcon.tsx      # Hover icon for messages (exists)
│   │       ├── SaveToNotebookModal.tsx # Modal for saving content
│   │       ├── NotebookSidebar.tsx   # Main sidebar panel
│   │       ├── NotebookList.tsx      # List of all notebooks
│   │       ├── NotebookViewer.tsx    # View notebook contents
│   │       ├── NotebookCard.tsx      # Individual notebook card
│   │       ├── NotebookEntryCard.tsx # Individual entry card
│   │       └── CreateNotebookModal.tsx # Create new notebook
│   │
│   ├── hooks/
│   │   └── useNotebooks.ts           # Notebook state management
│   │
│   └── types/
│       └── notebook.ts               # Shared types
│
└── preload/
    └── index.ts               # Add notebook API exposure
```

---

## Database Schema

### Tables

```sql
-- Notebooks table
CREATE TABLE IF NOT EXISTS notebooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '📓',
  color TEXT DEFAULT 'default',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  entry_count INTEGER DEFAULT 0
);

-- Notebook entries table
CREATE TABLE IF NOT EXISTS notebook_entries (
  id TEXT PRIMARY KEY,
  notebook_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_message_id TEXT,
  source_conversation_id TEXT,
  source_role TEXT CHECK(source_role IN ('user', 'assistant')),
  title TEXT,
  tags TEXT, -- JSON array stored as text
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_notebook ON notebook_entries(notebook_id);
CREATE INDEX IF NOT EXISTS idx_entries_source ON notebook_entries(source_message_id);

-- Full-text search virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS notebook_entries_fts USING fts5(
  content,
  title,
  tags,
  content='notebook_entries',
  content_rowid='rowid'
);
```

---

## Component Specifications

### 1. Main Process: Types

```typescript
// src/main/notebooks/types.ts

export interface Notebook {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  created_at: string
  updated_at: string
  entry_count: number
}

export interface NotebookEntry {
  id: string
  notebook_id: string
  content: string
  source_message_id: string | null
  source_conversation_id: string | null
  source_role: 'user' | 'assistant' | null
  title: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CreateNotebookInput {
  name: string
  description?: string
  emoji?: string
  color?: string
}

export interface UpdateNotebookInput {
  name?: string
  description?: string
  emoji?: string
  color?: string
}

export interface CreateEntryInput {
  notebook_id: string
  content: string
  source_message_id?: string
  source_conversation_id?: string
  source_role?: 'user' | 'assistant'
  title?: string
  tags?: string[]
}

export interface UpdateEntryInput {
  content?: string
  title?: string
  tags?: string[]
}

export interface NotebookSearchResult {
  entry: NotebookEntry
  notebook: Notebook
  snippet: string
  rank: number
}
```

---

### 2. Main Process: Notebook Service

```typescript
// src/main/notebooks/service.ts

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import {
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput,
  NotebookSearchResult
} from './types'

const dbPath = join(app.getPath('userData'), 'arborchat.db')
let db: Database.Database

export function initNotebookTables(): void {
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  db.exec(`
    -- Notebooks table
    CREATE TABLE IF NOT EXISTS notebooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      emoji TEXT DEFAULT '📓',
      color TEXT DEFAULT 'default',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      entry_count INTEGER DEFAULT 0
    );

    -- Notebook entries table
    CREATE TABLE IF NOT EXISTS notebook_entries (
      id TEXT PRIMARY KEY,
      notebook_id TEXT NOT NULL,
      content TEXT NOT NULL,
      source_message_id TEXT,
      source_conversation_id TEXT,
      source_role TEXT CHECK(source_role IN ('user', 'assistant', NULL)),
      title TEXT,
      tags TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(notebook_id) REFERENCES notebooks(id) ON DELETE CASCADE
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_entries_notebook ON notebook_entries(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_entries_source ON notebook_entries(source_message_id);
    CREATE INDEX IF NOT EXISTS idx_notebooks_updated ON notebooks(updated_at DESC);
  `)

  console.log('[NotebookService] Database tables initialized')
}

// ============ NOTEBOOK OPERATIONS ============

export function createNotebook(input: CreateNotebookInput): Notebook {
  const id = randomUUID()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO notebooks (id, name, description, emoji, color, created_at, updated_at, entry_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `)

  stmt.run(
    id,
    input.name,
    input.description || null,
    input.emoji || '📓',
    input.color || 'default',
    now,
    now
  )

  return {
    id,
    name: input.name,
    description: input.description || null,
    emoji: input.emoji || '📓',
    color: input.color || 'default',
    created_at: now,
    updated_at: now,
    entry_count: 0
  }
}

export function getNotebooks(): Notebook[] {
  return db
    .prepare('SELECT * FROM notebooks ORDER BY updated_at DESC')
    .all() as Notebook[]
}

export function getNotebook(id: string): Notebook | null {
  return db
    .prepare('SELECT * FROM notebooks WHERE id = ?')
    .get(id) as Notebook | null
}

export function updateNotebook(id: string, input: UpdateNotebookInput): Notebook | null {
  const existing = getNotebook(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const updates: string[] = ['updated_at = ?']
  const values: (string | null)[] = [now]

  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }
  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }
  if (input.emoji !== undefined) {
    updates.push('emoji = ?')
    values.push(input.emoji)
  }
  if (input.color !== undefined) {
    updates.push('color = ?')
    values.push(input.color)
  }

  values.push(id)

  db.prepare(`UPDATE notebooks SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  return getNotebook(id)
}

export function deleteNotebook(id: string): boolean {
  const result = db.prepare('DELETE FROM notebooks WHERE id = ?').run(id)
  return result.changes > 0
}

// ============ ENTRY OPERATIONS ============

export function createEntry(input: CreateEntryInput): NotebookEntry {
  const id = randomUUID()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO notebook_entries 
    (id, notebook_id, content, source_message_id, source_conversation_id, source_role, title, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.notebook_id,
    input.content,
    input.source_message_id || null,
    input.source_conversation_id || null,
    input.source_role || null,
    input.title || null,
    input.tags ? JSON.stringify(input.tags) : null,
    now,
    now
  )

  // Update notebook entry count and timestamp
  db.prepare(`
    UPDATE notebooks 
    SET entry_count = entry_count + 1, updated_at = ? 
    WHERE id = ?
  `).run(now, input.notebook_id)

  return {
    id,
    notebook_id: input.notebook_id,
    content: input.content,
    source_message_id: input.source_message_id || null,
    source_conversation_id: input.source_conversation_id || null,
    source_role: input.source_role || null,
    title: input.title || null,
    tags: input.tags || [],
    created_at: now,
    updated_at: now
  }
}

export function getEntries(notebookId: string): NotebookEntry[] {
  const rows = db
    .prepare('SELECT * FROM notebook_entries WHERE notebook_id = ? ORDER BY created_at DESC')
    .all(notebookId) as any[]

  return rows.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  }))
}

export function getEntry(id: string): NotebookEntry | null {
  const row = db
    .prepare('SELECT * FROM notebook_entries WHERE id = ?')
    .get(id) as any

  if (!row) return null

  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags) : []
  }
}

export function updateEntry(id: string, input: UpdateEntryInput): NotebookEntry | null {
  const existing = getEntry(id)
  if (!existing) return null

  const now = new Date().toISOString()
  const updates: string[] = ['updated_at = ?']
  const values: (string | null)[] = [now]

  if (input.content !== undefined) {
    updates.push('content = ?')
    values.push(input.content)
  }
  if (input.title !== undefined) {
    updates.push('title = ?')
    values.push(input.title)
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?')
    values.push(JSON.stringify(input.tags))
  }

  values.push(id)

  db.prepare(`UPDATE notebook_entries SET ${updates.join(', ')} WHERE id = ?`).run(...values)

  // Update notebook timestamp
  db.prepare('UPDATE notebooks SET updated_at = ? WHERE id = ?')
    .run(now, existing.notebook_id)

  return getEntry(id)
}

export function deleteEntry(id: string): boolean {
  const entry = getEntry(id)
  if (!entry) return false

  const result = db.prepare('DELETE FROM notebook_entries WHERE id = ?').run(id)
  
  if (result.changes > 0) {
    // Update notebook entry count
    db.prepare(`
      UPDATE notebooks 
      SET entry_count = entry_count - 1, updated_at = ? 
      WHERE id = ?
    `).run(new Date().toISOString(), entry.notebook_id)
  }

  return result.changes > 0
}

// ============ SEARCH OPERATIONS ============

export function searchEntries(query: string): NotebookSearchResult[] {
  // Simple LIKE search (can be upgraded to FTS5 later)
  const searchPattern = `%${query}%`
  
  const rows = db.prepare(`
    SELECT 
      e.*,
      n.name as notebook_name,
      n.emoji as notebook_emoji
    FROM notebook_entries e
    JOIN notebooks n ON e.notebook_id = n.id
    WHERE e.content LIKE ? OR e.title LIKE ? OR e.tags LIKE ?
    ORDER BY e.updated_at DESC
    LIMIT 50
  `).all(searchPattern, searchPattern, searchPattern) as any[]

  return rows.map(row => ({
    entry: {
      id: row.id,
      notebook_id: row.notebook_id,
      content: row.content,
      source_message_id: row.source_message_id,
      source_conversation_id: row.source_conversation_id,
      source_role: row.source_role,
      title: row.title,
      tags: row.tags ? JSON.parse(row.tags) : [],
      created_at: row.created_at,
      updated_at: row.updated_at
    },
    notebook: {
      id: row.notebook_id,
      name: row.notebook_name,
      emoji: row.notebook_emoji,
      description: null,
      color: 'default',
      created_at: '',
      updated_at: '',
      entry_count: 0
    },
    snippet: row.content.substring(0, 150) + (row.content.length > 150 ? '...' : ''),
    rank: 1
  }))
}

// ============ EXPORT OPERATIONS ============

export function exportNotebookAsMarkdown(id: string): string | null {
  const notebook = getNotebook(id)
  if (!notebook) return null

  const entries = getEntries(id)
  
  let markdown = `# ${notebook.emoji} ${notebook.name}\n\n`
  
  if (notebook.description) {
    markdown += `> ${notebook.description}\n\n`
  }
  
  markdown += `---\n\n`
  
  for (const entry of entries) {
    if (entry.title) {
      markdown += `## ${entry.title}\n\n`
    }
    markdown += `${entry.content}\n\n`
    if (entry.tags.length > 0) {
      markdown += `*Tags: ${entry.tags.join(', ')}*\n\n`
    }
    markdown += `---\n\n`
  }
  
  return markdown
}
```

---

### 3. Main Process: IPC Handlers

```typescript
// src/main/notebooks/index.ts

import { ipcMain } from 'electron'
import {
  initNotebookTables,
  createNotebook,
  getNotebooks,
  getNotebook,
  updateNotebook,
  deleteNotebook,
  createEntry,
  getEntries,
  getEntry,
  updateEntry,
  deleteEntry,
  searchEntries,
  exportNotebookAsMarkdown
} from './service'
import type {
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput
} from './types'

export function setupNotebookHandlers(): void {
  console.log('[Notebooks] Setting up IPC handlers...')

  // Initialize database tables
  initNotebookTables()

  // ===== NOTEBOOK HANDLERS =====

  ipcMain.handle('notebooks:list', async () => {
    return getNotebooks()
  })

  ipcMain.handle('notebooks:get', async (_, id: string) => {
    return getNotebook(id)
  })

  ipcMain.handle('notebooks:create', async (_, input: CreateNotebookInput) => {
    return createNotebook(input)
  })

  ipcMain.handle('notebooks:update', async (_, { id, input }: { id: string; input: UpdateNotebookInput }) => {
    return updateNotebook(id, input)
  })

  ipcMain.handle('notebooks:delete', async (_, id: string) => {
    return deleteNotebook(id)
  })

  // ===== ENTRY HANDLERS =====

  ipcMain.handle('notebooks:entries:list', async (_, notebookId: string) => {
    return getEntries(notebookId)
  })

  ipcMain.handle('notebooks:entries:get', async (_, id: string) => {
    return getEntry(id)
  })

  ipcMain.handle('notebooks:entries:create', async (_, input: CreateEntryInput) => {
    return createEntry(input)
  })

  ipcMain.handle('notebooks:entries:update', async (_, { id, input }: { id: string; input: UpdateEntryInput }) => {
    return updateEntry(id, input)
  })

  ipcMain.handle('notebooks:entries:delete', async (_, id: string) => {
    return deleteEntry(id)
  })

  // ===== SEARCH & EXPORT =====

  ipcMain.handle('notebooks:search', async (_, query: string) => {
    return searchEntries(query)
  })

  ipcMain.handle('notebooks:export', async (_, id: string) => {
    return exportNotebookAsMarkdown(id)
  })

  console.log('[Notebooks] IPC handlers ready')
}

export * from './types'
```

---

### 4. Preload: Notebook API

```typescript
// Add to src/preload/index.ts

import type {
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput,
  NotebookSearchResult
} from '../main/notebooks/types'

const notebooksApi = {
  // Notebook operations
  list: () => ipcRenderer.invoke('notebooks:list') as Promise<Notebook[]>,
  get: (id: string) => ipcRenderer.invoke('notebooks:get', id) as Promise<Notebook | null>,
  create: (input: CreateNotebookInput) => 
    ipcRenderer.invoke('notebooks:create', input) as Promise<Notebook>,
  update: (id: string, input: UpdateNotebookInput) =>
    ipcRenderer.invoke('notebooks:update', { id, input }) as Promise<Notebook | null>,
  delete: (id: string) => 
    ipcRenderer.invoke('notebooks:delete', id) as Promise<boolean>,

  // Entry operations
  entries: {
    list: (notebookId: string) => 
      ipcRenderer.invoke('notebooks:entries:list', notebookId) as Promise<NotebookEntry[]>,
    get: (id: string) => 
      ipcRenderer.invoke('notebooks:entries:get', id) as Promise<NotebookEntry | null>,
    create: (input: CreateEntryInput) =>
      ipcRenderer.invoke('notebooks:entries:create', input) as Promise<NotebookEntry>,
    update: (id: string, input: UpdateEntryInput) =>
      ipcRenderer.invoke('notebooks:entries:update', { id, input }) as Promise<NotebookEntry | null>,
    delete: (id: string) =>
      ipcRenderer.invoke('notebooks:entries:delete', id) as Promise<boolean>
  },

  // Search & Export
  search: (query: string) =>
    ipcRenderer.invoke('notebooks:search', query) as Promise<NotebookSearchResult[]>,
  export: (id: string) =>
    ipcRenderer.invoke('notebooks:export', id) as Promise<string | null>
}

// Add to api object
const api = {
  // ... existing API
  notebooks: notebooksApi
}
```

---

## Renderer Components

### 5. Renderer: Types

```typescript
// src/renderer/src/types/notebook.ts

export interface Notebook {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  created_at: string
  updated_at: string
  entry_count: number
}

export interface NotebookEntry {
  id: string
  notebook_id: string
  content: string
  source_message_id: string | null
  source_conversation_id: string | null
  source_role: 'user' | 'assistant' | null
  title: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface CreateNotebookInput {
  name: string
  description?: string
  emoji?: string
  color?: string
}

export interface CreateEntryInput {
  notebook_id: string
  content: string
  source_message_id?: string
  source_conversation_id?: string
  source_role?: 'user' | 'assistant'
  title?: string
  tags?: string[]
}

export interface NotebookSearchResult {
  entry: NotebookEntry
  notebook: Notebook
  snippet: string
  rank: number
}

// Color options for notebooks
export const NOTEBOOK_COLORS = [
  { id: 'default', name: 'Default', class: 'bg-secondary' },
  { id: 'blue', name: 'Blue', class: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'green', name: 'Green', class: 'bg-emerald-500/20 border-emerald-500/30' },
  { id: 'purple', name: 'Purple', class: 'bg-purple-500/20 border-purple-500/30' },
  { id: 'amber', name: 'Amber', class: 'bg-amber-500/20 border-amber-500/30' },
  { id: 'rose', name: 'Rose', class: 'bg-rose-500/20 border-rose-500/30' },
  { id: 'cyan', name: 'Cyan', class: 'bg-cyan-500/20 border-cyan-500/30' }
] as const

// Common emoji options for notebooks
export const NOTEBOOK_EMOJIS = [
  '📓', '📔', '📕', '📗', '📘', '📙',
  '📚', '📖', '📝', '✏️', '🗒️', '📋',
  '💡', '🎯', '⭐', '🔖', '🏷️', '📌',
  '💻', '🔬', '🎨', '🎵', '📊', '🗂️'
]
```

---

### 6. Renderer: useNotebooks Hook

```typescript
// src/renderer/src/hooks/useNotebooks.ts

import { useState, useEffect, useCallback } from 'react'
import type { Notebook, NotebookEntry, NotebookSearchResult } from '../types/notebook'

interface UseNotebooksReturn {
  // State
  notebooks: Notebook[]
  loading: boolean
  error: string | null
  
  // Notebook operations
  loadNotebooks: () => Promise<void>
  createNotebook: (input: { name: string; description?: string; emoji?: string; color?: string }) => Promise<Notebook>
  updateNotebook: (id: string, input: { name?: string; description?: string; emoji?: string; color?: string }) => Promise<void>
  deleteNotebook: (id: string) => Promise<void>
  
  // Entry operations
  loadEntries: (notebookId: string) => Promise<NotebookEntry[]>
  createEntry: (input: {
    notebook_id: string
    content: string
    source_message_id?: string
    source_conversation_id?: string
    source_role?: 'user' | 'assistant'
    title?: string
    tags?: string[]
  }) => Promise<NotebookEntry>
  updateEntry: (id: string, input: { content?: string; title?: string; tags?: string[] }) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  
  // Search
  search: (query: string) => Promise<NotebookSearchResult[]>
  
  // Export
  exportNotebook: (id: string) => Promise<string | null>
}

export function useNotebooks(): UseNotebooksReturn {
  const [notebooks, setNotebooks] = useState<Notebook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadNotebooks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await window.api.notebooks.list()
      setNotebooks(list)
    } catch (err) {
      console.error('[useNotebooks] Failed to load:', err)
      setError('Failed to load notebooks')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount
  useEffect(() => {
    loadNotebooks()
  }, [loadNotebooks])

  const createNotebook = useCallback(async (input: {
    name: string
    description?: string
    emoji?: string
    color?: string
  }) => {
    const notebook = await window.api.notebooks.create(input)
    setNotebooks(prev => [notebook, ...prev])
    return notebook
  }, [])

  const updateNotebook = useCallback(async (
    id: string,
    input: { name?: string; description?: string; emoji?: string; color?: string }
  ) => {
    const updated = await window.api.notebooks.update(id, input)
    if (updated) {
      setNotebooks(prev => prev.map(n => n.id === id ? updated : n))
    }
  }, [])

  const deleteNotebook = useCallback(async (id: string) => {
    await window.api.notebooks.delete(id)
    setNotebooks(prev => prev.filter(n => n.id !== id))
  }, [])

  const loadEntries = useCallback(async (notebookId: string) => {
    return window.api.notebooks.entries.list(notebookId)
  }, [])

  const createEntry = useCallback(async (input: {
    notebook_id: string
    content: string
    source_message_id?: string
    source_conversation_id?: string
    source_role?: 'user' | 'assistant'
    title?: string
    tags?: string[]
  }) => {
    const entry = await window.api.notebooks.entries.create(input)
    // Update notebook entry count locally
    setNotebooks(prev => prev.map(n => 
      n.id === input.notebook_id 
        ? { ...n, entry_count: n.entry_count + 1, updated_at: new Date().toISOString() }
        : n
    ))
    return entry
  }, [])

  const updateEntry = useCallback(async (
    id: string,
    input: { content?: string; title?: string; tags?: string[] }
  ) => {
    await window.api.notebooks.entries.update(id, input)
  }, [])

  const deleteEntry = useCallback(async (id: string) => {
    const entry = await window.api.notebooks.entries.get(id)
    if (entry) {
      await window.api.notebooks.entries.delete(id)
      // Update notebook entry count locally
      setNotebooks(prev => prev.map(n =>
        n.id === entry.notebook_id
          ? { ...n, entry_count: Math.max(0, n.entry_count - 1) }
          : n
      ))
    }
  }, [])

  const search = useCallback(async (query: string) => {
    return window.api.notebooks.search(query)
  }, [])

  const exportNotebook = useCallback(async (id: string) => {
    return window.api.notebooks.export(id)
  }, [])

  return {
    notebooks,
    loading,
    error,
    loadNotebooks,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    loadEntries,
    createEntry,
    updateEntry,
    deleteEntry,
    search,
    exportNotebook
  }
}
```

---

### 7. Renderer: NotebookIcon (Updated)

```typescript
// src/renderer/src/components/notebook/NotebookIcon.tsx

import { BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'

interface NotebookIconProps {
  onClick: () => void
  className?: string
  size?: number
}

/**
 * Small notebook icon that appears on message hover
 * Triggers the save-to-notebook modal
 */
export function NotebookIcon({ onClick, className, size = 14 }: NotebookIconProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
        'text-text-muted hover:text-amber-400 hover:bg-amber-500/10',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30',
        className
      )}
      aria-label="Save to notebook"
      title="Save to notebook"
    >
      <BookOpen size={size} />
      <span>Save</span>
    </button>
  )
}
```

---

### 8. Renderer: SaveToNotebookModal

```typescript
// src/renderer/src/components/notebook/SaveToNotebookModal.tsx

import { useState, useEffect } from 'react'
import { X, Plus, BookOpen, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useNotebooks } from '../../hooks/useNotebooks'
import type { Notebook } from '../../types/notebook'

interface SaveToNotebookModalProps {
  isOpen: boolean
  onClose: () => void
  content: string
  sourceMessageId?: string
  sourceConversationId?: string
  sourceRole?: 'user' | 'assistant'
}

export function SaveToNotebookModal({
  isOpen,
  onClose,
  content,
  sourceMessageId,
  sourceConversationId,
  sourceRole
}: SaveToNotebookModalProps) {
  const { notebooks, loading, createNotebook, createEntry } = useNotebooks()
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [newNotebookName, setNewNotebookName] = useState('')
  const [entryTitle, setEntryTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedNotebook(null)
      setIsCreatingNew(false)
      setNewNotebookName('')
      setEntryTitle('')
      setSaving(false)
      setSuccess(false)
    }
  }, [isOpen])

  const handleSave = async () => {
    if (saving) return

    setSaving(true)
    try {
      let targetNotebookId = selectedNotebook

      // Create new notebook if needed
      if (isCreatingNew && newNotebookName.trim()) {
        const newNotebook = await createNotebook({ name: newNotebookName.trim() })
        targetNotebookId = newNotebook.id
      }

      if (!targetNotebookId) {
        throw new Error('No notebook selected')
      }

      // Create the entry
      await createEntry({
        notebook_id: targetNotebookId,
        content,
        source_message_id: sourceMessageId,
        source_conversation_id: sourceConversationId,
        source_role: sourceRole,
        title: entryTitle.trim() || undefined
      })

      setSuccess(true)
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      console.error('Failed to save to notebook:', error)
    } finally {
      setSaving(false)
    }
  }

  const canSave = (selectedNotebook || (isCreatingNew && newNotebookName.trim())) && !saving

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        className={cn(
          "bg-tertiary rounded-xl w-full max-w-md shadow-2xl",
          "border border-secondary/50",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary/50">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Save to Notebook</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Content Preview */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Content Preview
            </label>
            <div className="bg-secondary/50 rounded-lg p-3 max-h-24 overflow-y-auto">
              <p className="text-sm text-text-normal line-clamp-3">
                {content}
              </p>
            </div>
          </div>

          {/* Optional Title */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Title (Optional)
            </label>
            <input
              type="text"
              value={entryTitle}
              onChange={(e) => setEntryTitle(e.target.value)}
              placeholder="Add a title for this entry..."
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-secondary border border-secondary/50",
                "text-text-normal placeholder-text-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              )}
            />
          </div>

          {/* Notebook Selection */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Select Notebook
            </label>
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="animate-spin text-text-muted" size={24} />
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {/* Create New Option */}
                <button
                  onClick={() => {
                    setIsCreatingNew(true)
                    setSelectedNotebook(null)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                    "border border-dashed",
                    isCreatingNew
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-secondary hover:border-amber-500/50 hover:bg-secondary/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isCreatingNew ? "bg-amber-500/20" : "bg-secondary"
                  )}>
                    <Plus size={20} className={isCreatingNew ? "text-amber-400" : "text-text-muted"} />
                  </div>
                  <div className="text-left">
                    <p className={cn(
                      "font-medium",
                      isCreatingNew ? "text-amber-400" : "text-text-normal"
                    )}>
                      Create New Notebook
                    </p>
                    <p className="text-xs text-text-muted">Start a fresh collection</p>
                  </div>
                </button>

                {/* New notebook name input */}
                {isCreatingNew && (
                  <div className="pl-4">
                    <input
                      type="text"
                      value={newNotebookName}
                      onChange={(e) => setNewNotebookName(e.target.value)}
                      placeholder="Enter notebook name..."
                      autoFocus
                      className={cn(
                        "w-full px-3 py-2 rounded-lg",
                        "bg-secondary border border-amber-500/30",
                        "text-text-normal placeholder-text-muted/50",
                        "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                      )}
                    />
                  </div>
                )}

                {/* Existing Notebooks */}
                {notebooks.map((notebook) => (
                  <button
                    key={notebook.id}
                    onClick={() => {
                      setSelectedNotebook(notebook.id)
                      setIsCreatingNew(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg transition-colors",
                      "border",
                      selectedNotebook === notebook.id
                        ? "border-amber-500 bg-amber-500/10"
                        : "border-secondary/50 hover:border-secondary hover:bg-secondary/30"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center text-xl",
                      selectedNotebook === notebook.id ? "bg-amber-500/20" : "bg-secondary"
                    )}>
                      {notebook.emoji}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className={cn(
                        "font-medium truncate",
                        selectedNotebook === notebook.id ? "text-amber-400" : "text-text-normal"
                      )}>
                        {notebook.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {notebook.entry_count} {notebook.entry_count === 1 ? 'entry' : 'entries'}
                      </p>
                    </div>
                    {selectedNotebook === notebook.id && (
                      <Check size={18} className="text-amber-400 shrink-0" />
                    )}
                  </button>
                ))}

                {notebooks.length === 0 && !isCreatingNew && (
                  <p className="text-center text-text-muted py-4 text-sm">
                    No notebooks yet. Create your first one!
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-secondary/50">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg",
              "text-text-muted hover:text-text-normal hover:bg-secondary",
              "transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg",
              "bg-amber-500 hover:bg-amber-600 text-white font-medium",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check size={16} />
                Saved!
              </>
            ) : (
              <>
                <BookOpen size={16} />
                Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 9. Renderer: NotebookSidebar

```typescript
// src/renderer/src/components/notebook/NotebookSidebar.tsx

import { useState, useEffect } from 'react'
import { X, Plus, Search, BookOpen, ChevronLeft, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useNotebooks } from '../../hooks/useNotebooks'
import { NotebookList } from './NotebookList'
import { NotebookViewer } from './NotebookViewer'
import { CreateNotebookModal } from './CreateNotebookModal'
import type { Notebook } from '../../types/notebook'

interface NotebookSidebarProps {
  isOpen: boolean
  onClose: () => void
}

type View = 'list' | 'viewer'

export function NotebookSidebar({ isOpen, onClose }: NotebookSidebarProps) {
  const {
    notebooks,
    loading,
    loadNotebooks,
    createNotebook,
    updateNotebook,
    deleteNotebook,
    loadEntries,
    deleteEntry,
    exportNotebook
  } = useNotebooks()

  const [view, setView] = useState<View>('list')
  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Reset view when sidebar closes
  useEffect(() => {
    if (!isOpen) {
      setView('list')
      setSelectedNotebook(null)
      setSearchQuery('')
    }
  }, [isOpen])

  const handleSelectNotebook = (notebook: Notebook) => {
    setSelectedNotebook(notebook)
    setView('viewer')
  }

  const handleBack = () => {
    setView('list')
    setSelectedNotebook(null)
  }

  const handleDeleteNotebook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this notebook and all its entries?')) {
      return
    }
    await deleteNotebook(id)
    if (selectedNotebook?.id === id) {
      handleBack()
    }
  }

  const handleExport = async (id: string) => {
    const markdown = await exportNotebook(id)
    if (markdown) {
      // Create and download file
      const blob = new Blob([markdown], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `notebook-${id}.md`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const filteredNotebooks = notebooks.filter(n =>
    n.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 w-96 z-50",
          "bg-tertiary border-l border-secondary/50",
          "flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary/50">
          <div className="flex items-center gap-2">
            {view === 'viewer' && (
              <button
                onClick={handleBack}
                className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            <BookOpen size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              {view === 'list' ? 'Notebooks' : selectedNotebook?.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {view === 'list' ? (
            <>
              {/* Search & Create */}
              <div className="p-4 space-y-3 border-b border-secondary/50">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                  />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search notebooks..."
                    className={cn(
                      "w-full pl-10 pr-4 py-2 rounded-lg",
                      "bg-secondary border border-secondary/50",
                      "text-text-normal placeholder-text-muted/50",
                      "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    )}
                  />
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className={cn(
                    "w-full flex items-center justify-center gap-2",
                    "px-4 py-2.5 rounded-lg",
                    "bg-amber-500 hover:bg-amber-600 text-white font-medium",
                    "transition-colors"
                  )}
                >
                  <Plus size={18} />
                  New Notebook
                </button>
              </div>

              {/* Notebook List */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-text-muted" size={24} />
                  </div>
                ) : (
                  <NotebookList
                    notebooks={filteredNotebooks}
                    onSelect={handleSelectNotebook}
                    onDelete={handleDeleteNotebook}
                    onExport={handleExport}
                  />
                )}
              </div>
            </>
          ) : selectedNotebook ? (
            <NotebookViewer
              notebook={selectedNotebook}
              loadEntries={loadEntries}
              onDeleteEntry={deleteEntry}
              onUpdateNotebook={updateNotebook}
              onExport={() => handleExport(selectedNotebook.id)}
            />
          ) : null}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateNotebookModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (input) => {
            await createNotebook(input)
            setShowCreateModal(false)
          }}
        />
      )}
    </>
  )
}
```

---

### 10. Renderer: NotebookList

```typescript
// src/renderer/src/components/notebook/NotebookList.tsx

import { MoreHorizontal, Trash2, Download, BookOpen } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { cn } from '../../lib/utils'
import type { Notebook } from '../../types/notebook'

interface NotebookListProps {
  notebooks: Notebook[]
  onSelect: (notebook: Notebook) => void
  onDelete: (id: string) => void
  onExport: (id: string) => void
}

export function NotebookList({ notebooks, onSelect, onDelete, onExport }: NotebookListProps) {
  if (notebooks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
          <BookOpen size={28} className="text-text-muted" />
        </div>
        <h3 className="text-lg font-medium text-text-normal mb-2">No notebooks yet</h3>
        <p className="text-sm text-text-muted">
          Create your first notebook to start saving content from chats
        </p>
      </div>
    )
  }

  return (
    <div className="p-2 space-y-1">
      {notebooks.map((notebook) => (
        <NotebookCard
          key={notebook.id}
          notebook={notebook}
          onSelect={() => onSelect(notebook)}
          onDelete={() => onDelete(notebook.id)}
          onExport={() => onExport(notebook.id)}
        />
      ))}
    </div>
  )
}

interface NotebookCardProps {
  notebook: Notebook
  onSelect: () => void
  onDelete: () => void
  onExport: () => void
}

function NotebookCard({ notebook, onSelect, onDelete, onExport }: NotebookCardProps) {
  const [showMenu, setShowMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  return (
    <div
      className={cn(
        "group relative p-3 rounded-lg",
        "bg-secondary/30 hover:bg-secondary/50",
        "border border-transparent hover:border-secondary",
        "cursor-pointer transition-all duration-150"
      )}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        {/* Emoji */}
        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-xl shrink-0">
          {notebook.emoji}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-text-normal truncate">
            {notebook.name}
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            {notebook.entry_count} {notebook.entry_count === 1 ? 'entry' : 'entries'} • {formatDate(notebook.updated_at)}
          </p>
          {notebook.description && (
            <p className="text-xs text-text-muted/70 mt-1 line-clamp-1">
              {notebook.description}
            </p>
          )}
        </div>

        {/* Menu */}
        <div className="relative shrink-0" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowMenu(!showMenu)
            }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              "text-text-muted hover:text-white hover:bg-tertiary",
              "opacity-0 group-hover:opacity-100 focus:opacity-100"
            )}
          >
            <MoreHorizontal size={16} />
          </button>

          {showMenu && (
            <div className={cn(
              "absolute right-0 top-full mt-1 z-10",
              "bg-tertiary border border-secondary rounded-lg shadow-xl",
              "py-1 min-w-[140px]",
              "animate-in fade-in zoom-in-95 duration-150"
            )}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onExport()
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-normal hover:bg-secondary transition-colors"
              >
                <Download size={14} />
                Export
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                  setShowMenu(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

---

### 11. Renderer: NotebookViewer

```typescript
// src/renderer/src/components/notebook/NotebookViewer.tsx

import { useState, useEffect } from 'react'
import { Edit2, Download, Trash2, Loader2, FileText } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { Notebook, NotebookEntry } from '../../types/notebook'

interface NotebookViewerProps {
  notebook: Notebook
  loadEntries: (notebookId: string) => Promise<NotebookEntry[]>
  onDeleteEntry: (id: string) => Promise<void>
  onUpdateNotebook: (id: string, input: { name?: string; description?: string; emoji?: string }) => Promise<void>
  onExport: () => void
}

export function NotebookViewer({
  notebook,
  loadEntries,
  onDeleteEntry,
  onUpdateNotebook,
  onExport
}: NotebookViewerProps) {
  const [entries, setEntries] = useState<NotebookEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [editName, setEditName] = useState(notebook.name)
  const [editDescription, setEditDescription] = useState(notebook.description || '')

  useEffect(() => {
    loadNotebookEntries()
  }, [notebook.id])

  const loadNotebookEntries = async () => {
    setLoading(true)
    try {
      const data = await loadEntries(notebook.id)
      setEntries(data)
    } catch (error) {
      console.error('Failed to load entries:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveHeader = async () => {
    await onUpdateNotebook(notebook.id, {
      name: editName,
      description: editDescription || undefined
    })
    setIsEditingHeader(false)
  }

  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Delete this entry?')) return
    await onDeleteEntry(entryId)
    setEntries(prev => prev.filter(e => e.id !== entryId))
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Notebook Header */}
      <div className="p-4 border-b border-secondary/50">
        {isEditingHeader ? (
          <div className="space-y-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-secondary border border-secondary/50",
                "text-text-normal font-medium",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              )}
              autoFocus
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Add a description..."
              rows={2}
              className={cn(
                "w-full px-3 py-2 rounded-lg resize-none",
                "bg-secondary border border-secondary/50",
                "text-text-muted text-sm",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              )}
            />
            <div className="flex gap-2">
              <button
                onClick={handleSaveHeader}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditingHeader(false)
                  setEditName(notebook.name)
                  setEditDescription(notebook.description || '')
                }}
                className="px-3 py-1.5 rounded-lg text-text-muted hover:text-text-normal hover:bg-secondary text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl">
              {notebook.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-white">{notebook.name}</h2>
              {notebook.description && (
                <p className="text-sm text-text-muted mt-1">{notebook.description}</p>
              )}
              <p className="text-xs text-text-muted/70 mt-2">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </p>
            </div>
            <div className="flex gap-1 shrink-0">
              <button
                onClick={() => setIsEditingHeader(true)}
                className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={onExport}
                className="p-2 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
                title="Export as Markdown"
              >
                <Download size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Entries List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-text-muted" size={24} />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-secondary/50 flex items-center justify-center mb-3">
              <FileText size={24} className="text-text-muted" />
            </div>
            <p className="text-sm text-text-muted">No entries yet</p>
            <p className="text-xs text-text-muted/70 mt-1">
              Save content from chat to add entries
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {entries.map((entry) => (
              <NotebookEntryCard
                key={entry.id}
                entry={entry}
                onDelete={() => handleDeleteEntry(entry.id)}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

interface NotebookEntryCardProps {
  entry: NotebookEntry
  onDelete: () => void
  formatDate: (dateStr: string) => string
}

function NotebookEntryCard({ entry, onDelete, formatDate }: NotebookEntryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const isLong = entry.content.length > 300

  return (
    <div className={cn(
      "p-4 rounded-xl",
      "bg-secondary/30 border border-secondary/50",
      "hover:border-secondary transition-colors"
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          {entry.title && (
            <h4 className="font-medium text-text-normal mb-1">{entry.title}</h4>
          )}
          <p className="text-xs text-text-muted">
            {formatDate(entry.created_at)}
            {entry.source_role && (
              <span className={cn(
                "ml-2 px-1.5 py-0.5 rounded",
                entry.source_role === 'assistant' 
                  ? "bg-primary/20 text-primary" 
                  : "bg-emerald-500/20 text-emerald-400"
              )}>
                {entry.source_role === 'assistant' ? 'AI' : 'You'}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
          title="Delete entry"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="text-sm text-text-normal whitespace-pre-wrap">
        {isLong && !expanded ? (
          <>
            {entry.content.substring(0, 300)}...
            <button
              onClick={() => setExpanded(true)}
              className="text-amber-400 hover:text-amber-300 ml-1"
            >
              Read more
            </button>
          </>
        ) : (
          <>
            {entry.content}
            {isLong && (
              <button
                onClick={() => setExpanded(false)}
                className="text-amber-400 hover:text-amber-300 ml-1 block mt-2"
              >
                Show less
              </button>
            )}
          </>
        )}
      </div>

      {/* Tags */}
      {entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="text-xs text-text-muted bg-tertiary px-2 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
```

---

### 12. Renderer: CreateNotebookModal

```typescript
// src/renderer/src/components/notebook/CreateNotebookModal.tsx

import { useState } from 'react'
import { X, BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'
import { NOTEBOOK_EMOJIS, NOTEBOOK_COLORS } from '../../types/notebook'

interface CreateNotebookModalProps {
  onClose: () => void
  onCreate: (input: { name: string; description?: string; emoji?: string; color?: string }) => Promise<void>
}

export function CreateNotebookModal({ onClose, onCreate }: CreateNotebookModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [emoji, setEmoji] = useState('📓')
  const [color, setColor] = useState('default')
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    if (!name.trim() || creating) return

    setCreating(true)
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        emoji,
        color
      })
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
      <div
        className={cn(
          "bg-tertiary rounded-xl w-full max-w-md shadow-2xl",
          "border border-secondary/50",
          "animate-in fade-in zoom-in-95 duration-200"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-secondary/50">
          <div className="flex items-center gap-2">
            <BookOpen size={20} className="text-amber-400" />
            <h2 className="text-lg font-semibold text-white">Create Notebook</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-white hover:bg-secondary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Notebook"
              autoFocus
              className={cn(
                "w-full px-3 py-2 rounded-lg",
                "bg-secondary border border-secondary/50",
                "text-text-normal placeholder-text-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              )}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this notebook for?"
              rows={2}
              className={cn(
                "w-full px-3 py-2 rounded-lg resize-none",
                "bg-secondary border border-secondary/50",
                "text-text-normal placeholder-text-muted/50",
                "focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              )}
            />
          </div>

          {/* Emoji */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Icon
            </label>
            <div className="flex flex-wrap gap-2">
              {NOTEBOOK_EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => setEmoji(e)}
                  className={cn(
                    "w-10 h-10 rounded-lg text-xl",
                    "transition-all duration-150",
                    emoji === e
                      ? "bg-amber-500/20 border-2 border-amber-500 scale-110"
                      : "bg-secondary hover:bg-secondary/80 border border-transparent"
                  )}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-text-muted uppercase tracking-wide mb-2 block">
              Color
            </label>
            <div className="flex gap-2">
              {NOTEBOOK_COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id)}
                  className={cn(
                    "w-8 h-8 rounded-full transition-all duration-150",
                    c.class,
                    color === c.id
                      ? "ring-2 ring-amber-500 ring-offset-2 ring-offset-tertiary scale-110"
                      : "hover:scale-105"
                  )}
                  title={c.name}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-secondary/50">
          <button
            onClick={onClose}
            className={cn(
              "px-4 py-2 rounded-lg",
              "text-text-muted hover:text-text-normal hover:bg-secondary",
              "transition-colors"
            )}
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim() || creating}
            className={cn(
              "px-4 py-2 rounded-lg",
              "bg-amber-500 hover:bg-amber-600 text-white font-medium",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors"
            )}
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

---

### 13. Renderer: Index Exports

```typescript
// src/renderer/src/components/notebook/index.ts

export { NotebookIcon } from './NotebookIcon'
export { SaveToNotebookModal } from './SaveToNotebookModal'
export { NotebookSidebar } from './NotebookSidebar'
export { NotebookList } from './NotebookList'
export { NotebookViewer } from './NotebookViewer'
export { CreateNotebookModal } from './CreateNotebookModal'
```

---

## Integration Points

### 14. ChatWindow Integration: MessageBubble Update

Update the `MessageBubble` component in `ChatWindow.tsx` to include the notebook save icon:

```typescript
// In ChatWindow.tsx - Update MessageBubble component

import { NotebookIcon } from './notebook'
import { SaveToNotebookModal } from './notebook'

// Add state for notebook modal in ChatWindow
const [notebookModal, setNotebookModal] = useState<{
  isOpen: boolean
  content: string
  messageId: string
  conversationId: string
  role: 'user' | 'assistant'
} | null>(null)

// Update MessageBubble to include notebook icon
function MessageBubble({
  message,
  conversationId,
  onThreadSelect,
  onAgentLaunch,
  onSaveToNotebook,  // NEW PROP
  showThreadButton = true,
  isStreaming = false
}: {
  message: Message
  conversationId: string
  onThreadSelect: (id: string) => void
  onAgentLaunch?: (messageContent: string) => void
  onSaveToNotebook?: (content: string, messageId: string, role: 'user' | 'assistant') => void  // NEW
  showThreadButton?: boolean
  isStreaming?: boolean
}) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-2 -mx-4 rounded-lg transition-colors duration-150',
        'hover:bg-secondary/30',
        isUser && 'flex-row-reverse'
      )}
    >
      {/* ... existing avatar and content ... */}

      {/* Action buttons - shown on hover */}
      {!isStreaming && (
        <div className={cn(
          "flex items-center gap-1",
          "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
          "transition-opacity"
        )}>
          {/* Notebook Save Button - NEW */}
          {onSaveToNotebook && (
            <NotebookIcon
              onClick={() => onSaveToNotebook(
                message.content,
                message.id,
                message.role as 'user' | 'assistant'
              )}
            />
          )}
          
          {/* Existing Thread button */}
          {isAssistant && showThreadButton && (
            <button
              onClick={() => onThreadSelect(message.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                'text-text-muted hover:text-primary hover:bg-primary/10',
                'transition-all duration-150'
              )}
            >
              <MessageCircle size={14} />
              <span>Thread</span>
            </button>
          )}
          
          {/* Existing Agent button */}
          {isAssistant && onAgentLaunch && (
            <button
              onClick={() => onAgentLaunch(message.content)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
                'text-text-muted hover:text-violet-400 hover:bg-violet-500/10',
                'transition-all duration-150'
              )}
            >
              <Bot size={14} />
              <span>Agent</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// In ChatWindow component, add the modal:
return (
  <div className="...">
    {/* ... existing content ... */}
    
    {/* Notebook Save Modal */}
    {notebookModal && (
      <SaveToNotebookModal
        isOpen={notebookModal.isOpen}
        onClose={() => setNotebookModal(null)}
        content={notebookModal.content}
        sourceMessageId={notebookModal.messageId}
        sourceConversationId={notebookModal.conversationId}
        sourceRole={notebookModal.role}
      />
    )}
  </div>
)
```

---

### 15. Sidebar Integration: Add Notebook Icon

Update `Sidebar.tsx` to include the notebook icon button:

```typescript
// In Sidebar.tsx

import { BookOpen } from 'lucide-react'

interface SidebarProps {
  // ... existing props
  onOpenNotebooks: () => void  // NEW PROP
}

export function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNewChat,
  onDelete,
  onRename,
  onSettings,
  onOpenNotebooks  // NEW
}: SidebarProps) {
  return (
    <div className="flex flex-col w-72 bg-tertiary h-full border-r border-secondary/50 shrink-0">
      {/* ... existing header and content ... */}

      {/* Footer with Settings and Notebooks */}
      <div className="p-2 border-t border-secondary/50 space-y-1">
        {/* Notebooks Button - NEW */}
        <button
          onClick={onOpenNotebooks}
          className={cn(
            'w-full flex items-center gap-2 p-2.5 rounded-lg',
            'text-text-muted hover:text-amber-400 hover:bg-amber-500/10',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-amber-500/30'
          )}
        >
          <BookOpen size={16} />
          <span className="text-sm font-medium">Notebooks</span>
        </button>

        {/* Existing Settings Button */}
        <button
          onClick={onSettings}
          className={cn(
            'w-full flex items-center gap-2 p-2.5 rounded-lg',
            'text-text-muted hover:text-text-normal hover:bg-secondary/40',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-2 focus:ring-primary/30'
          )}
        >
          <Settings size={16} />
          <span className="text-sm font-medium">Settings</span>
        </button>
      </div>
    </div>
  )
}
```

---

### 16. Layout Integration: Wire Notebook Sidebar

Update `Layout.tsx` to include the notebook sidebar:

```typescript
// In Layout.tsx

import { NotebookSidebar } from './notebook'

export interface LayoutProps {
  // ... existing props
}

export function Layout({ /* ... existing props ... */ }: LayoutProps) {
  const [notebookSidebarOpen, setNotebookSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen w-screen bg-background overflow-hidden text-text-normal">
      {/* Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={onSelectConversation}
        onNewChat={onNewChat}
        onDelete={onDeleteConversation}
        onRename={onRenameConversation}
        onSettings={onSettings}
        onOpenNotebooks={() => setNotebookSidebarOpen(true)}  // NEW
      />

      {/* ... existing main content ... */}

      {/* Notebook Sidebar - NEW */}
      <NotebookSidebar
        isOpen={notebookSidebarOpen}
        onClose={() => setNotebookSidebarOpen(false)}
      />
    </div>
  )
}
```

---

### 17. Main Process: Initialize Notebooks

Update `src/main/index.ts` to initialize notebook handlers:

```typescript
// In src/main/index.ts

import { setupNotebookHandlers } from './notebooks'

// In your initialization code:
app.whenReady().then(() => {
  // ... existing initialization
  
  // Initialize notebook handlers
  setupNotebookHandlers()
  
  // ... rest of initialization
})
```

---

## Implementation Order

### Phase 1: Database & Service Layer
1. Create `src/main/notebooks/types.ts`
2. Create `src/main/notebooks/service.ts`
3. Create `src/main/notebooks/index.ts`
4. Update `src/main/index.ts` to initialize handlers

### Phase 2: Preload & Types
1. Update `src/preload/index.ts` with notebook API
2. Update `src/preload/index.d.ts` with types
3. Create `src/renderer/src/types/notebook.ts`

### Phase 3: Hook & Core Components
1. Create `src/renderer/src/hooks/useNotebooks.ts`
2. Update `src/renderer/src/components/notebook/NotebookIcon.tsx`
3. Create `src/renderer/src/components/notebook/SaveToNotebookModal.tsx`

### Phase 4: Sidebar Components
1. Create `src/renderer/src/components/notebook/NotebookList.tsx`
2. Create `src/renderer/src/components/notebook/NotebookViewer.tsx`
3. Create `src/renderer/src/components/notebook/CreateNotebookModal.tsx`
4. Create `src/renderer/src/components/notebook/NotebookSidebar.tsx`
5. Create `src/renderer/src/components/notebook/index.ts`

### Phase 5: Integration
1. Update `ChatWindow.tsx` - Add notebook icon to MessageBubble
2. Update `Sidebar.tsx` - Add notebooks button
3. Update `Layout.tsx` - Wire notebook sidebar

---

## Verification Checklist

### Database
- [ ] Notebooks table created successfully
- [ ] Notebook entries table created successfully
- [ ] Foreign key cascading works (delete notebook → delete entries)
- [ ] Indexes created for performance

### Core Operations
- [ ] Create notebook works
- [ ] List notebooks returns sorted by updated_at
- [ ] Update notebook works
- [ ] Delete notebook cascades to entries
- [ ] Create entry works
- [ ] List entries for notebook works
- [ ] Delete entry updates notebook count
- [ ] Search returns matching results
- [ ] Export generates valid Markdown

### UI Components
- [ ] NotebookIcon appears on message hover
- [ ] SaveToNotebookModal opens on icon click
- [ ] Modal shows existing notebooks
- [ ] Can create new notebook from modal
- [ ] Can save to existing notebook
- [ ] Success state shows before closing
- [ ] Notebooks button visible in sidebar
- [ ] NotebookSidebar opens/closes properly
- [ ] NotebookList displays all notebooks
- [ ] NotebookViewer shows entries
- [ ] Can edit notebook name/description
- [ ] Can delete entries
- [ ] Export downloads Markdown file

### Edge Cases
- [ ] Empty notebooks display correctly
- [ ] Long content truncates with expand
- [ ] Search with no results shows message
- [ ] Delete confirmation prevents accidents
- [ ] Proper loading states shown

---

## Future Enhancements

### Phase 2 Possibilities
1. **Tags & Filtering** - Add tags to notebooks and entries with filter UI
2. **Full-Text Search (FTS5)** - Upgrade to SQLite FTS5 for better search
3. **Notebook Templates** - Pre-defined notebook types (Research, Code Snippets, etc.)
4. **Sharing** - Export notebooks in various formats (PDF, HTML, JSON)
5. **AI Summarization** - Generate summaries of notebook contents
6. **Quick Notes** - Add notes without associating to chat messages
7. **Keyboard Shortcuts** - Quick save with Cmd/Ctrl+S on hover
8. **Drag & Drop** - Reorder entries and move between notebooks

---

## Design Mockups

### Message Hover State
```
┌────────────────────────────────────────────────────────┐
│  [AI Avatar]  ArborChat                               │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Here's the solution you asked for...            │ │
│  │ ...                                              │ │
│  └──────────────────────────────────────────────────┘ │
│  [📓 Save] [💬 Thread] [🤖 Agent]  ← Hover actions    │
└────────────────────────────────────────────────────────┘
```

### Save Modal
```
┌─────────────────────────────────────┐
│  📓 Save to Notebook            [X] │
├─────────────────────────────────────┤
│  Content Preview                    │
│  ┌─────────────────────────────────┐│
│  │ Here's the solution you...     ││
│  └─────────────────────────────────┘│
│                                     │
│  Title (Optional)                   │
│  ┌─────────────────────────────────┐│
│  │ Solution for bug fix           ││
│  └─────────────────────────────────┘│
│                                     │
│  Select Notebook                    │
│  ┌─────────────────────────────────┐│
│  │ [+] Create New Notebook        ││
│  │ [📓] Work Notes          (12)  ││
│  │ [💡] Ideas               (5)   ││
│  │ [💻] Code Snippets       (23)  ││
│  └─────────────────────────────────┘│
│                                     │
│            [Cancel]  [📓 Save]      │
└─────────────────────────────────────┘
```

### Sidebar Notebook List
```
┌──────────────────────────────┐
│  📓 Notebooks            [X] │
├──────────────────────────────┤
│  [🔍 Search notebooks...]    │
│  [+ New Notebook]            │
├──────────────────────────────┤
│  ┌──────────────────────────┐│
│  │ 📓 Work Notes           ││
│  │    12 entries • Today   ││
│  │ └ Project documentation ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 💡 Ideas                ││
│  │    5 entries • 2d ago   ││
│  │ └ Future features       ││
│  └──────────────────────────┘│
│  ┌──────────────────────────┐│
│  │ 💻 Code Snippets        ││
│  │    23 entries • 1w ago  ││
│  └──────────────────────────┘│
└──────────────────────────────┘
```

---

*Document Version: 1.0*
*Last Updated: December 2024*
