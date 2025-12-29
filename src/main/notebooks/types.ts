/**
 * Notebook Types
 * Core type definitions for the notebook system
 *
 * @module main/notebooks/types
 */

/**
 * Notebook entity - represents a collection of saved content
 */
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

/**
 * Notebook entry - individual saved content item
 */
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

/**
 * Input for creating a new notebook
 */
export interface CreateNotebookInput {
  name: string
  description?: string
  emoji?: string
  color?: string
}

/**
 * Input for updating an existing notebook
 */
export interface UpdateNotebookInput {
  name?: string
  description?: string
  emoji?: string
  color?: string
}

/**
 * Input for creating a new notebook entry
 */
export interface CreateEntryInput {
  notebook_id: string
  content: string
  source_message_id?: string
  source_conversation_id?: string
  source_role?: 'user' | 'assistant'
  title?: string
  tags?: string[]
}

/**
 * Input for updating an existing entry
 */
export interface UpdateEntryInput {
  content?: string
  title?: string
  tags?: string[]
}

/**
 * Search result combining entry with notebook context
 */
export interface NotebookSearchResult {
  entry: NotebookEntry
  notebook: Notebook
  snippet: string
  rank: number
}
