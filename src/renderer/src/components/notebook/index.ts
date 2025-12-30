/**
 * Notebook Components
 * Barrel exports for notebook feature components
 *
 * @module components/notebook
 */

// Phase 4 Components
export { SaveToNotebookModal } from './SaveToNotebookModal'
export { NotebookIcon } from './NotebookIcon'

// Phase 5 Components
export { NotebookSidebar } from './NotebookSidebar'
export { NotebookList } from './NotebookList'
export { NotebookCard } from './NotebookCard'
export { NotebookViewer } from './NotebookViewer'
export { NotebookEntryCard } from './NotebookEntryCard'
export { CreateNotebookModal } from './CreateNotebookModal'

// Re-export types for convenience
export type {
  Notebook,
  NotebookEntry,
  CreateNotebookInput,
  CreateEntryInput
} from '../../types/notebook'
