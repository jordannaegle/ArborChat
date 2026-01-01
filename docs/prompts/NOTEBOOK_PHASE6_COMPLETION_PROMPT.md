# Phase 6 Completion: TypeScript Type Definition Fixes

**Reference:** `docs/prompts/NOTEBOOK_PHASE6_PROMPT.md`  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`
**Status:** Fixing TypeScript compilation errors

---

## Objective

Complete Phase 6 by fixing TypeScript compilation errors. The implementation is complete but type definitions are out of sync with the runtime code.

---

## Current Errors

```
src/renderer/src/components/notebook/ExportMenu.tsx(11,1): error TS6133: 'cn' is declared but its value is never read.

src/renderer/src/components/notebook/NotebookSidebar.tsx(39,5): error TS6133: 'selectedNotebookId' is declared but its value is never read.

src/renderer/src/components/notebook/NotebookSidebar.tsx(220,15): error TS2322: Type '(id: string, input: UpdateEntryInput) => Promise<NotebookEntry | null>' is not assignable to type '(id: string, input: UpdateEntryInput) => Promise<boolean>'.

src/renderer/src/hooks/useNotebooks.ts(251,60): error TS2339: Property 'reorder' does not exist on type '{ list: ...; get: ...; create: ...; update: ...; delete: ... }'.

src/renderer/src/hooks/useNotebooks.ts(273,60): error TS2339: Property 'bulkDelete' does not exist on type '{ list: ...; get: ...; create: ...; update: ...; delete: ... }'.

src/renderer/src/hooks/useNotebooks.ts(318,48): error TS2339: Property 'markdown' does not exist on type '(id: string) => Promise<string | null>'.

src/renderer/src/hooks/useNotebooks.ts(329,48): error TS2339: Property 'json' does not exist on type '(id: string) => Promise<string | null>'.

src/renderer/src/hooks/useNotebooks.ts(340,48): error TS2339: Property 'text' does not exist on type '(id: string) => Promise<string | null>'.

src/renderer/src/hooks/useNotebookShortcuts.ts(87,13): error TS7030: Not all code paths return a value.
```

---

## Part 1: Update Type Definitions

### 1.1 Update `src/preload/index.d.ts`

Find the `NotebooksAPI` interface and update it to include Phase 6 methods:

**Current (incomplete):**
```typescript
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

**Updated (with Phase 6):**
```typescript
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
    // Phase 6: Reorder and bulk operations
    reorder: (notebookId: string, orderedIds: string[]) => Promise<boolean>
    bulkDelete: (ids: string[]) => Promise<boolean>
  }

  // Search
  search: (query: string) => Promise<NotebookSearchResult[]>
  
  // Phase 6: Enhanced export options
  export: {
    markdown: (id: string) => Promise<string | null>
    json: (id: string) => Promise<string | null>
    text: (id: string) => Promise<string | null>
  }
}
```

---

## Part 2: Fix Component Type Issues

### 2.1 Fix `ExportMenu.tsx` - Remove Unused Import

In `src/renderer/src/components/notebook/ExportMenu.tsx`, remove the unused `cn` import:

**Line 11, change from:**
```typescript
import { cn } from '../../lib/utils'
```

**To:**
```typescript
// Remove this line entirely - cn is not used in this file
```

### 2.2 Fix `NotebookSidebar.tsx` - Remove Unused Variable

In `src/renderer/src/components/notebook/NotebookSidebar.tsx`, the `selectedNotebookId` is destructured from `useNotebooks()` but never used directly. Remove it from destructuring.

**Line 39, change from:**
```typescript
const {
  notebooks,
  loading,
  error,
  selectedNotebookId,  // ← Remove this
  selectedNotebook,
  entries,
  entriesLoading,
  selectNotebook,
  // ... rest
} = useNotebooks()
```

**To:**
```typescript
const {
  notebooks,
  loading,
  error,
  selectedNotebook,
  entries,
  entriesLoading,
  selectNotebook,
  // ... rest
} = useNotebooks()
```

### 2.3 Fix `NotebookSidebar.tsx` - Type Mismatch for onUpdateEntry

The `NotebookViewer` expects `onUpdateEntry: (id: string, input: UpdateEntryInput) => Promise<boolean>`, but we're passing `updateEntry` which returns `Promise<NotebookEntry | null>`.

**Option A: Modify the prop passed (simpler fix)**

In `NotebookSidebar.tsx` around line 220, wrap the call:

**Change from:**
```typescript
onUpdateEntry={updateEntry}
```

**To:**
```typescript
onUpdateEntry={async (id, input) => {
  const result = await updateEntry(id, input)
  return result !== null
}}
```

**Option B: Update NotebookViewer's prop type (alternative)**

This would require changing `NotebookViewerProps` to accept `Promise<NotebookEntry | null>` instead. Option A is simpler.

### 2.4 Fix `useNotebookShortcuts.ts` - Missing Return Statement

In `src/renderer/src/hooks/useNotebookShortcuts.ts`, the `useEffect` cleanup function needs to explicitly return `undefined` when `enabled` is false.

**Around line 80-87, change from:**
```typescript
useEffect(() => {
  if (enabled) {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }
}, [enabled, handleKeyDown])
```

**To:**
```typescript
useEffect(() => {
  if (enabled) {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }
  return undefined
}, [enabled, handleKeyDown])
```

---

## Verification

After making all changes, run:

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck
```

Expected output: No errors.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/preload/index.d.ts` | Add Phase 6 methods to `NotebooksAPI` interface |
| `src/renderer/src/components/notebook/ExportMenu.tsx` | Remove unused `cn` import |
| `src/renderer/src/components/notebook/NotebookSidebar.tsx` | Remove unused `selectedNotebookId`, fix `onUpdateEntry` wrapper |
| `src/renderer/src/hooks/useNotebookShortcuts.ts` | Add explicit `return undefined` |

---

## Checklist

- [ ] Update `NotebooksAPI` interface in `index.d.ts`
- [ ] Remove `cn` import from `ExportMenu.tsx`
- [ ] Remove `selectedNotebookId` from destructuring in `NotebookSidebar.tsx`
- [ ] Wrap `updateEntry` call in `NotebookSidebar.tsx`
- [ ] Add `return undefined` to `useNotebookShortcuts.ts`
- [ ] Run `npm run typecheck` - passes with no errors
- [ ] Run `npm run dev` - app starts correctly
- [ ] Test drag-and-drop reordering works
- [ ] Test bulk selection and delete works
- [ ] Test export menu (Markdown, JSON, Text) works
- [ ] Test keyboard shortcuts work

---

## Git Commit

```bash
git add -A
git commit -m "fix(notebook): Phase 6 TypeScript compilation fixes

- Update NotebooksAPI type definitions with Phase 6 methods
- Add entries.reorder and entries.bulkDelete to type interface
- Update export type from function to object with markdown/json/text
- Remove unused cn import from ExportMenu
- Remove unused selectedNotebookId from NotebookSidebar
- Fix onUpdateEntry type wrapper in NotebookSidebar
- Add explicit return undefined in useNotebookShortcuts effect"
```

---

*Phase 6 Completion Prompt*  
*TypeScript type fixes for completed Phase 6 implementation*
