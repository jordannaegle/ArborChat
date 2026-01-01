/**
 * Notebook Service
 * Core CRUD operations for notebooks and entries
 *
 * @module main/notebooks/service
 */

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'
import type {
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

/**
 * Initialize database tables for notebooks
 * Creates tables and indexes if they don't exist
 */
export function initNotebookTables(): void {
  console.log('[NotebookService] Initializing database connection to:', dbPath)
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

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_entries_notebook ON notebook_entries(notebook_id);
    CREATE INDEX IF NOT EXISTS idx_entries_source ON notebook_entries(source_message_id);
    CREATE INDEX IF NOT EXISTS idx_notebooks_updated ON notebooks(updated_at DESC);
  `)

  // Phase 6: Add sort_order column for drag-and-drop reordering
  try {
    db.exec(`ALTER TABLE notebook_entries ADD COLUMN sort_order INTEGER DEFAULT 0`)
    console.log('[NotebookService] Added sort_order column')
  } catch {
    // Column already exists - this is expected on subsequent runs
  }

  console.log('[NotebookService] Database tables initialized')
}

// ============ NOTEBOOK OPERATIONS ============

/**
 * Create a new notebook
 */
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

/**
 * Get all notebooks ordered by last updated
 */
export function getNotebooks(): Notebook[] {
  console.log('[NotebookService] getNotebooks called')
  const result = db
    .prepare('SELECT * FROM notebooks ORDER BY updated_at DESC')
    .all() as Notebook[]
  console.log('[NotebookService] Found notebooks:', result.length, result.map(n => n.name))
  return result
}

/**
 * Get a single notebook by ID
 */
export function getNotebook(id: string): Notebook | null {
  return db
    .prepare('SELECT * FROM notebooks WHERE id = ?')
    .get(id) as Notebook | null
}

/**
 * Update an existing notebook
 */
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

/**
 * Delete a notebook and all its entries (cascade)
 */
export function deleteNotebook(id: string): boolean {
  const result = db.prepare('DELETE FROM notebooks WHERE id = ?').run(id)
  return result.changes > 0
}

// ============ ENTRY OPERATIONS ============

/**
 * Create a new notebook entry
 */
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

/**
 * Get all entries for a notebook
 * Sorted by sort_order (ascending) then created_at (descending) for new entries
 */
export function getEntries(notebookId: string): NotebookEntry[] {
  const rows = db
    .prepare('SELECT * FROM notebook_entries WHERE notebook_id = ? ORDER BY sort_order ASC, created_at DESC')
    .all(notebookId) as Record<string, unknown>[]

  return rows.map(row => ({
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : []
  })) as NotebookEntry[]
}

/**
 * Get a single entry by ID
 */
export function getEntry(id: string): NotebookEntry | null {
  const row = db
    .prepare('SELECT * FROM notebook_entries WHERE id = ?')
    .get(id) as Record<string, unknown> | undefined

  if (!row) return null

  return {
    ...row,
    tags: row.tags ? JSON.parse(row.tags as string) : []
  } as NotebookEntry
}

/**
 * Update an existing entry
 */
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

/**
 * Delete an entry
 */
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

/**
 * Search entries using LIKE-based search
 * Returns matching entries with notebook context
 */
export function searchEntries(query: string): NotebookSearchResult[] {
  const searchPattern = `%${query}%`

  const rows = db.prepare(`
    SELECT 
      e.*,
      n.name as notebook_name,
      n.emoji as notebook_emoji,
      n.color as notebook_color,
      n.description as notebook_description,
      n.created_at as notebook_created_at,
      n.updated_at as notebook_updated_at,
      n.entry_count as notebook_entry_count
    FROM notebook_entries e
    JOIN notebooks n ON e.notebook_id = n.id
    WHERE e.content LIKE ? OR e.title LIKE ? OR e.tags LIKE ?
    ORDER BY e.updated_at DESC
    LIMIT 50
  `).all(searchPattern, searchPattern, searchPattern) as Record<string, unknown>[]

  return rows.map(row => ({
    entry: {
      id: row.id as string,
      notebook_id: row.notebook_id as string,
      content: row.content as string,
      source_message_id: row.source_message_id as string | null,
      source_conversation_id: row.source_conversation_id as string | null,
      source_role: row.source_role as 'user' | 'assistant' | null,
      title: row.title as string | null,
      tags: row.tags ? JSON.parse(row.tags as string) : [],
      created_at: row.created_at as string,
      updated_at: row.updated_at as string
    },
    notebook: {
      id: row.notebook_id as string,
      name: row.notebook_name as string,
      emoji: row.notebook_emoji as string,
      color: row.notebook_color as string,
      description: row.notebook_description as string | null,
      created_at: row.notebook_created_at as string,
      updated_at: row.notebook_updated_at as string,
      entry_count: row.notebook_entry_count as number
    },
    snippet: (row.content as string).substring(0, 150) + 
      ((row.content as string).length > 150 ? '...' : ''),
    rank: 1
  }))
}

// ============ EXPORT OPERATIONS ============

/**
 * Export a notebook as markdown
 */
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


/**
 * Export a notebook as JSON
 */
export function exportNotebookAsJSON(id: string): string | null {
  const notebook = getNotebook(id)
  if (!notebook) return null

  const entries = getEntries(id)

  return JSON.stringify({
    notebook: {
      id: notebook.id,
      name: notebook.name,
      description: notebook.description,
      emoji: notebook.emoji,
      color: notebook.color,
      created_at: notebook.created_at,
      updated_at: notebook.updated_at
    },
    entries: entries.map(e => ({
      id: e.id,
      content: e.content,
      title: e.title,
      tags: e.tags,
      source_role: e.source_role,
      created_at: e.created_at,
      updated_at: e.updated_at
    })),
    exported_at: new Date().toISOString(),
    version: '1.0'
  }, null, 2)
}

/**
 * Export a notebook as plain text
 */
export function exportNotebookAsText(id: string): string | null {
  const notebook = getNotebook(id)
  if (!notebook) return null

  const entries = getEntries(id)

  let text = `${notebook.emoji} ${notebook.name}\n`
  if (notebook.description) {
    text += `${notebook.description}\n`
  }
  text += '\n---\n\n'

  for (const entry of entries) {
    if (entry.title) {
      text += `${entry.title}\n\n`
    }
    text += `${entry.content}\n\n`
    text += '---\n\n'
  }

  return text
}


// ============ REORDER OPERATIONS ============

/**
 * Reorder entries within a notebook
 * Updates sort_order based on the provided ordered array of entry IDs
 */
export function reorderEntries(notebookId: string, orderedIds: string[]): boolean {
  const transaction = db.transaction(() => {
    const stmt = db.prepare('UPDATE notebook_entries SET sort_order = ? WHERE id = ? AND notebook_id = ?')
    orderedIds.forEach((id, index) => {
      stmt.run(index, id, notebookId)
    })
  })

  try {
    transaction()
    return true
  } catch (err) {
    console.error('[NotebookService] Failed to reorder entries:', err)
    return false
  }
}

// ============ BULK OPERATIONS ============

/**
 * Delete multiple entries at once
 * Updates notebook entry counts accordingly
 */
export function bulkDeleteEntries(ids: string[]): boolean {
  if (ids.length === 0) return true

  const transaction = db.transaction(() => {
    // Get notebook IDs for count updates
    const placeholders = ids.map(() => '?').join(',')
    const entries = db.prepare(
      `SELECT notebook_id, COUNT(*) as count FROM notebook_entries WHERE id IN (${placeholders}) GROUP BY notebook_id`
    ).all(...ids) as { notebook_id: string; count: number }[]

    // Delete entries
    const deleteStmt = db.prepare(
      `DELETE FROM notebook_entries WHERE id IN (${placeholders})`
    )
    deleteStmt.run(...ids)

    // Update notebook counts
    const updateStmt = db.prepare(
      'UPDATE notebooks SET entry_count = entry_count - ?, updated_at = ? WHERE id = ?'
    )
    const now = new Date().toISOString()
    for (const { notebook_id, count } of entries) {
      updateStmt.run(count, now, notebook_id)
    }
  })

  try {
    transaction()
    return true
  } catch (err) {
    console.error('[NotebookService] Bulk delete failed:', err)
    return false
  }
}
