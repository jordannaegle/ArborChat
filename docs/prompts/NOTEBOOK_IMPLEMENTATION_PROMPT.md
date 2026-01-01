# Notebook Feature Implementation Prompt

**Reference:** `docs/NOTEBOOK_FEATURE_DESIGN.md`  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`

---

## Overview

Implement the Notebook feature for ArborChat as specified in the design document. This feature allows users to save chat message content to organized notebooks for later reference.

**Key User Flows:**
1. Hover over any chat message → Click notebook icon → Save to new/existing notebook
2. Click Notebooks button in sidebar → Browse notebooks → View/manage entries

---

## Phase 1: Database & Service Layer

### Objective
Create the backend infrastructure for storing and managing notebooks and entries.

### Files to Create

**1. `src/main/notebooks/types.ts`**
- Define TypeScript interfaces: `Notebook`, `NotebookEntry`, `CreateNotebookInput`, `UpdateNotebookInput`, `CreateEntryInput`, `UpdateEntryInput`, `NotebookSearchResult`
- Reference the design document for exact interface definitions

**2. `src/main/notebooks/service.ts`**
- Initialize database tables (`notebooks`, `notebook_entries`)
- Implement notebook CRUD: `createNotebook`, `getNotebooks`, `getNotebook`, `updateNotebook`, `deleteNotebook`
- Implement entry CRUD: `createEntry`, `getEntries`, `getEntry`, `updateEntry`, `deleteEntry`
- Implement `searchEntries` (LIKE-based search)
- Implement `exportNotebookAsMarkdown`
- Ensure proper index creation for performance
- Handle entry_count updates on entry create/delete

**3. `src/main/notebooks/index.ts`**
- Export `setupNotebookHandlers()` function
- Register all IPC handlers for notebook operations
- Call `initNotebookTables()` on setup

### Files to Modify

**4. `src/main/index.ts`**
- Import `setupNotebookHandlers` from `./notebooks`
- Call `setupNotebookHandlers()` in the app initialization sequence

### Verification
```bash
npm run typecheck
```
- [ ] No TypeScript errors
- [ ] Tables created in SQLite on app start
- [ ] Test via Electron DevTools console: `window.api.notebooks.list()`

---

## Phase 2: Preload API & Renderer Types

### Objective
Expose notebook operations to the renderer process and define shared types.

### Files to Modify

**1. `src/preload/index.ts`**
- Add `notebooksApi` object with all notebook and entry operations
- Add to the main `api` export object
- Reference design document for exact API shape

**2. `src/preload/index.d.ts`**
- Add type declarations for the notebooks API
- Import/reference types from main process or duplicate for renderer

### Files to Create

**3. `src/renderer/src/types/notebook.ts`**
- Define renderer-side types matching main process
- Add `NOTEBOOK_COLORS` constant array
- Add `NOTEBOOK_EMOJIS` constant array

### Verification
```bash
npm run typecheck
```
- [ ] No TypeScript errors
- [ ] `window.api.notebooks` accessible in renderer
- [ ] Types properly exported and importable

---

## Phase 3: useNotebooks Hook

### Objective
Create a React hook for managing notebook state and operations.

### Files to Create

**1. `src/renderer/src/hooks/useNotebooks.ts`**
- State: `notebooks`, `loading`, `error`
- Operations: `loadNotebooks`, `createNotebook`, `updateNotebook`, `deleteNotebook`
- Entry operations: `loadEntries`, `createEntry`, `updateEntry`, `deleteEntry`
- Search: `search`
- Export: `exportNotebook`
- Auto-load notebooks on mount
- Update local state optimistically after mutations

**2. Update `src/renderer/src/hooks/index.ts`** (if exists)
- Export `useNotebooks` hook

### Verification
- [ ] Hook can be imported without errors
- [ ] `useNotebooks()` returns expected shape
- [ ] Notebooks load on component mount

---

## Phase 4: Save-to-Notebook Components

### Objective
Create the hover icon and save modal for chat messages.

### Files to Modify

**1. `src/renderer/src/components/notebook/NotebookIcon.tsx`**
- Update to match design (with "Save" text label)
- Accept `onClick`, `className`, `size` props
- Use amber color scheme for hover state

### Files to Create

**2. `src/renderer/src/components/notebook/SaveToNotebookModal.tsx`**
- Props: `isOpen`, `onClose`, `content`, `sourceMessageId`, `sourceConversationId`, `sourceRole`
- Show content preview (truncated)
- Optional title input
- List existing notebooks with selection
- "Create New Notebook" option with inline name input
- Save button with loading/success states
- Auto-close on success after brief delay

### Verification
- [ ] Modal opens with content preview
- [ ] Can select existing notebook
- [ ] Can create new notebook inline
- [ ] Save creates entry and closes modal
- [ ] Success feedback shown

---

## Phase 5: Notebook Sidebar Components

### Objective
Create the sidebar panel for browsing and viewing notebooks.

### Files to Create

**1. `src/renderer/src/components/notebook/NotebookList.tsx`**
- Display notebooks as cards
- Show emoji, name, entry count, last updated
- Menu with Export and Delete options
- Empty state when no notebooks

**2. `src/renderer/src/components/notebook/NotebookViewer.tsx`**
- Header with notebook info (editable)
- List of entries with expand/collapse for long content
- Delete entry button
- Export button
- Empty state when no entries

**3. `src/renderer/src/components/notebook/CreateNotebookModal.tsx`**
- Name input (required)
- Description textarea (optional)
- Emoji picker grid
- Color picker
- Create button with loading state

**4. `src/renderer/src/components/notebook/NotebookSidebar.tsx`**
- Slide-out panel from right
- Backdrop click to close
- Search input
- "New Notebook" button
- Switch between list view and viewer view
- Back navigation from viewer to list

**5. `src/renderer/src/components/notebook/index.ts`**
- Barrel exports for all notebook components

### Verification
- [ ] Sidebar slides in from right
- [ ] Backdrop closes sidebar
- [ ] Search filters notebook list
- [ ] Can create new notebook
- [ ] Can view notebook entries
- [ ] Can delete entries
- [ ] Export downloads .md file

---

## Phase 6: Integration

### Objective
Wire up all components into the main application.

### Files to Modify

**1. `src/renderer/src/components/ChatWindow.tsx`**

Add state for notebook modal:
```typescript
const [notebookModal, setNotebookModal] = useState<{
  isOpen: boolean
  content: string
  messageId: string
  conversationId: string
  role: 'user' | 'assistant'
} | null>(null)
```

Update `MessageBubble` component:
- Add `onSaveToNotebook` prop
- Add `NotebookIcon` to hover actions (before Thread button)
- Import `NotebookIcon` and `SaveToNotebookModal` from `./notebook`

Add modal to render:
```typescript
{notebookModal && (
  <SaveToNotebookModal
    isOpen={true}
    onClose={() => setNotebookModal(null)}
    content={notebookModal.content}
    sourceMessageId={notebookModal.messageId}
    sourceConversationId={activeConversationId}
    sourceRole={notebookModal.role}
  />
)}
```

**2. `src/renderer/src/components/Sidebar.tsx`**

- Add `onOpenNotebooks` prop to `SidebarProps`
- Add Notebooks button above Settings button
- Use `BookOpen` icon from lucide-react
- Use amber color scheme for hover

**3. `src/renderer/src/components/Layout.tsx`**

- Add state: `const [notebookSidebarOpen, setNotebookSidebarOpen] = useState(false)`
- Pass `onOpenNotebooks={() => setNotebookSidebarOpen(true)}` to Sidebar
- Import and render `NotebookSidebar` component
- Pass `isOpen` and `onClose` props

### Verification
- [ ] Notebook icon appears on message hover
- [ ] Clicking icon opens save modal
- [ ] Notebooks button visible in sidebar
- [ ] Clicking opens notebook sidebar
- [ ] Full flow works: save message → view in notebook

---

## Phase 7: Polish & Edge Cases

### Objective
Handle edge cases and improve user experience.

### Tasks

1. **Error Handling**
   - Add try/catch with user-friendly error messages
   - Toast notifications for save success/failure

2. **Loading States**
   - Skeleton loaders for notebook list
   - Disabled states during async operations

3. **Keyboard Navigation**
   - Escape to close modals/sidebar
   - Enter to submit forms

4. **Accessibility**
   - Proper ARIA labels
   - Focus management in modals

5. **Performance**
   - Debounce search input
   - Virtualize long entry lists (if needed)

### Verification
- [ ] No console errors during normal use
- [ ] Graceful handling of API failures
- [ ] Keyboard shortcuts work
- [ ] Screen reader compatible

---

## Testing Checklist

### Manual Testing Script

1. **Create First Notebook**
   - Click Notebooks in sidebar
   - Click "New Notebook"
   - Enter name, select emoji/color
   - Verify notebook appears in list

2. **Save Message to Notebook**
   - Send a message in chat
   - Hover over AI response
   - Click notebook icon
   - Select notebook, add title
   - Click Save
   - Verify success feedback

3. **View Notebook Contents**
   - Open Notebooks sidebar
   - Click on notebook
   - Verify entry appears with correct content
   - Test expand/collapse for long entries

4. **Edit Notebook**
   - In viewer, click edit icon
   - Change name/description
   - Save and verify changes persist

5. **Delete Entry**
   - Click delete on an entry
   - Confirm deletion
   - Verify entry removed and count updated

6. **Delete Notebook**
   - From list, click menu → Delete
   - Confirm deletion
   - Verify notebook and entries removed

7. **Export Notebook**
   - Click export button
   - Verify .md file downloads
   - Check file contains all entries

8. **Search**
   - Create multiple notebooks
   - Type in search box
   - Verify filtering works

---

## Commands Reference

```bash
# Development
cd /Users/cory.naegle/ArborChat
npm run dev

# Type checking
npm run typecheck

# Build
npm run build

# Git commit after each phase
git add -A
git commit -m "feat(notebook): Phase N - [description]"
```

---

## Notes

- Use amber color scheme (`amber-400`, `amber-500`, `amber-500/10`) for notebook UI
- Follow existing patterns in `PersonasSection.tsx` and `AgentPanel.tsx`
- Maintain consistency with existing modal and sidebar styles
- Test with both light and dark themes (if applicable)

---

*Implementation Prompt Version: 1.0*
*Based on: NOTEBOOK_FEATURE_DESIGN.md*
