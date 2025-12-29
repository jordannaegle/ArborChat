/**
 * Notebook Types (Renderer)
 * Type definitions for notebook system used in the renderer process
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

/**
 * Color options for notebooks
 * Used in notebook creation and editing UI
 */
export const NOTEBOOK_COLORS = [
  { id: 'default', name: 'Default', class: 'bg-secondary' },
  { id: 'blue', name: 'Blue', class: 'bg-blue-500/20 border-blue-500/30' },
  { id: 'green', name: 'Green', class: 'bg-emerald-500/20 border-emerald-500/30' },
  { id: 'purple', name: 'Purple', class: 'bg-purple-500/20 border-purple-500/30' },
  { id: 'amber', name: 'Amber', class: 'bg-amber-500/20 border-amber-500/30' },
  { id: 'rose', name: 'Rose', class: 'bg-rose-500/20 border-rose-500/30' },
  { id: 'cyan', name: 'Cyan', class: 'bg-cyan-500/20 border-cyan-500/30' }
] as const

/**
 * Common emoji options for notebooks
 * Displayed in emoji picker during notebook creation
 */
export const NOTEBOOK_EMOJIS = [
  '📓', '📔', '📕', '📗', '📘', '📙',
  '📚', '📖', '📝', '✏️', '🗒️', '📋',
  '💡', '🎯', '⭐', '🔖', '🏷️', '📌',
  '💻', '🔬', '🎨', '🎵', '📊', '🗂️'
] as const

/**
 * Type for notebook color IDs
 */
export type NotebookColorId = (typeof NOTEBOOK_COLORS)[number]['id']

/**
 * Helper to get color class by ID
 */
export function getNotebookColorClass(colorId: string): string {
  const color = NOTEBOOK_COLORS.find((c) => c.id === colorId)
  return color?.class ?? NOTEBOOK_COLORS[0].class
}
