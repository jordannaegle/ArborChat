# Phase 2: Notebook Preload API & Renderer Types

**Reference:** `docs/NOTEBOOK_FEATURE_DESIGN.md`  
**Depends on:** Phase 1 (Database & Service Layer) ✅  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`

---

## Objective

Expose notebook operations to the renderer process via the preload bridge and define renderer-side TypeScript types. This phase establishes the secure IPC boundary between main and renderer processes following ArborChat's established patterns.

---

## Pattern Reference

Follow the existing patterns established by:
- `src/preload/index.ts` - PersonaAPI and WorkJournalAPI structures
- `src/preload/index.d.ts` - Type declarations for window.api
- `src/renderer/src/types/persona.ts` - Renderer-side type definitions

---

## Files to Modify

### 1. `src/preload/index.ts`

**Location:** After the `workJournalApi` definition (around line 453)

**Add Notebook API Types:**
```typescript
// Notebook API types
interface Notebook {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  created_at: string
  updated_at: string
  entry_count: number
}

interface NotebookEntry {
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

interface CreateNotebookInput {
  name: string
  description?: string
  emoji?: string
  color?: string
}

interface UpdateNotebookInput {
  name?: string
  description?: string
  emoji?: string
  color?: string
}

interface CreateEntryInput {
  notebook_id: string
  content: string
  source_message_id?: string
  source_conversation_id?: string
  source_role?: 'user' | 'assistant'
  title?: string
  tags?: string[]
}

interface UpdateEntryInput {
  content?: string
  title?: string
  tags?: string[]
}

interface NotebookSearchResult {
  entry: NotebookEntry
  notebook: Notebook
  snippet: string
  rank: number
}
```

**Add Notebook API Implementation:**
```typescript
// Notebook API for managing saved chat content
const notebooksApi = {
  // Notebook operations
  list: () => 
    ipcRenderer.invoke('notebooks:list') as Promise<Notebook[]>,
  
  get: (id: string) => 
    ipcRenderer.invoke('notebooks:get', id) as Promise<Notebook | null>,
  
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
```

**Update the `api` object:**
Add `notebooks: notebooksApi` to the `api` object (after `git: gitApi`):

```typescript
const api = {
  // ... existing properties ...
  git: gitApi,
  // Notebooks API
  notebooks: notebooksApi
}
```

---

### 2. `src/preload/index.d.ts`

**Add Notebook Type Declarations** (after WorkJournalAPI interface, around line 248):

```typescript
// Notebook Types
interface Notebook {
  id: string
  name: string
  description: string | null
  emoji: string
  color: string
  created_at: string
  updated_at: string
  entry_count: number
}

interface NotebookEntry {
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

interface CreateNotebookInput {
  name: string
  description?: string
  emoji?: string
  color?: string
}

interface UpdateNotebookInput {
  name?: string
  description?: string
  emoji?: string
  color?: string
}

interface CreateEntryInput {
  notebook_id: string
  content: string
  source_message_id?: string
  source_conversation_id?: string
  source_role?: 'user' | 'assistant'
  title?: string
  tags?: string[]
}

interface UpdateEntryInput {
  content?: string
  title?: string
  tags?: string[]
}

interface NotebookSearchResult {
  entry: NotebookEntry
  notebook: Notebook
  snippet: string
  rank: number
}

interface NotebooksAPI {
  // Notebook operations
  list: () => Promise<Notebook[]>
  get: (id: string) => Promise<Notebook | null>
  create: (input: CreateNotebookInput) => Promise<Notebook>
  update: (id: string, input: UpdateNotebookInput) => Promise<Notebook | null>
  delete: (id: string) => Promise<boolean>
  
  // Entry operations
  entries: {
    list: (notebookId: string) => Promise<NotebookEntry[]>
    get: (id: string) => Promise<NotebookEntry | null>
    create: (input: CreateEntryInput) => Promise<NotebookEntry>
    update: (id: string, input: UpdateEntryInput) => Promise<NotebookEntry | null>
    delete: (id: string) => Promise<boolean>
  }
  
  // Search & Export
  search: (query: string) => Promise<NotebookSearchResult[]>
  export: (id: string) => Promise<string | null>
}
```

**Update `Window.api` interface** (add after `git: GitAPI`):

```typescript
// Notebooks API
notebooks: NotebooksAPI
```

**Update exports at end of file:**

```typescript
export type {
  // ... existing exports ...
  // Notebook types
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  UpdateNotebookInput,
  CreateEntryInput,
  UpdateEntryInput,
  NotebookSearchResult,
  NotebooksAPI
}
```

---

## Files to Create

### 3. `src/renderer/src/types/notebook.ts`

```typescript
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
export type NotebookColorId = typeof NOTEBOOK_COLORS[number]['id']

/**
 * Helper to get color class by ID
 */
export function getNotebookColorClass(colorId: string): string {
  const color = NOTEBOOK_COLORS.find(c => c.id === colorId)
  return color?.class ?? NOTEBOOK_COLORS[0].class
}
```

---

## Verification

### TypeScript Compilation
```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

### Manual Testing (in Electron DevTools Console)

```javascript
// Test notebook list
await window.api.notebooks.list()

// Test create notebook
const nb = await window.api.notebooks.create({ name: 'Test Notebook', emoji: '📓' })
console.log('Created:', nb)

// Test create entry
const entry = await window.api.notebooks.entries.create({
  notebook_id: nb.id,
  content: 'Test content from DevTools',
  title: 'Test Entry'
})
console.log('Entry:', entry)

// Test get entries
const entries = await window.api.notebooks.entries.list(nb.id)
console.log('Entries:', entries)

// Test search
const results = await window.api.notebooks.search('test')
console.log('Search results:', results)

// Test export
const markdown = await window.api.notebooks.export(nb.id)
console.log('Markdown:', markdown)

// Cleanup - delete notebook
await window.api.notebooks.delete(nb.id)
```

---

## Checklist

- [ ] Types added to `src/preload/index.ts`
- [ ] `notebooksApi` object implemented in `src/preload/index.ts`
- [ ] `notebooks` added to `api` export object
- [ ] Type declarations added to `src/preload/index.d.ts`
- [ ] `NotebooksAPI` interface declared
- [ ] `Window.api.notebooks` typed correctly
- [ ] Types exported from `index.d.ts`
- [ ] `src/renderer/src/types/notebook.ts` created
- [ ] `NOTEBOOK_COLORS` constant defined
- [ ] `NOTEBOOK_EMOJIS` constant defined
- [ ] Helper function `getNotebookColorClass` implemented
- [ ] TypeScript compiles without errors
- [ ] API accessible via `window.api.notebooks` in DevTools

---

## Git Commit

```bash
git add -A
git commit -m "feat(notebook): Phase 2 - Preload API and renderer types

- Add notebooksApi to preload bridge with full CRUD operations
- Add notebook entry operations (list, get, create, update, delete)
- Add search and export functionality
- Define NotebooksAPI interface in type declarations
- Create renderer-side notebook types
- Add NOTEBOOK_COLORS and NOTEBOOK_EMOJIS constants
- Add getNotebookColorClass helper function"
```

---

## Next Phase

**Phase 3** will create the `useNotebooks` React hook for state management and operations in the renderer process.

---

*Phase 2 Implementation Prompt*  
*Depends on: Phase 1 ✅*  
*Enables: Phase 3 (useNotebooks Hook)*
