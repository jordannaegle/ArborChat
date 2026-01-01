# Phase 7: Notebook Polish & Accessibility

**Reference:** `docs/prompts/NOTEBOOK_IMPLEMENTATION_PROMPT.md`  
**Project:** ArborChat  
**Location:** `/Users/cory.naegle/ArborChat`
**Status:** Final polish phase

---

## Objective

Complete the Notebook feature with polish items including:
- Toast notification system for user feedback
- ARIA labels and screen reader accessibility
- Focus management in modals
- Debounced search for performance
- Skeleton loaders for improved perceived performance

---

## Part 1: Toast Notification System

### 1.1 Create Toast Context and Provider

**Create `src/renderer/src/contexts/ToastContext.tsx`:**

```typescript
/**
 * ToastContext
 *
 * Global toast notification system for user feedback.
 * Supports success, error, warning, and info variants.
 *
 * @module contexts/ToastContext
 */

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  message: string
  variant: ToastVariant
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, variant?: ToastVariant, duration?: number) => void
  removeToast: (id: string) => void
  success: (message: string, duration?: number) => void
  error: (message: string, duration?: number) => void
  warning: (message: string, duration?: number) => void
  info: (message: string, duration?: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((
    message: string,
    variant: ToastVariant = 'info',
    duration: number = 3000
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const toast: Toast = { id, message, variant, duration }

    setToasts((prev) => [...prev, toast])

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const success = useCallback((msg: string, dur?: number) => addToast(msg, 'success', dur), [addToast])
  const error = useCallback((msg: string, dur?: number) => addToast(msg, 'error', dur), [addToast])
  const warning = useCallback((msg: string, dur?: number) => addToast(msg, 'warning', dur), [addToast])
  const info = useCallback((msg: string, dur?: number) => addToast(msg, 'info', dur), [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
```

### 1.2 Create Toast Container Component

**Create `src/renderer/src/components/ui/ToastContainer.tsx`:**

```typescript
/**
 * ToastContainer
 *
 * Renders toast notifications with animations.
 *
 * @module components/ui/ToastContainer
 */

import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { cn } from '../../lib/utils'
import { useToast, type ToastVariant } from '../../contexts/ToastContext'

const variantConfig: Record<ToastVariant, { icon: typeof CheckCircle; className: string }> = {
  success: { icon: CheckCircle, className: 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' },
  error: { icon: AlertCircle, className: 'bg-red-500/10 border-red-500/50 text-red-400' },
  warning: { icon: AlertTriangle, className: 'bg-amber-500/10 border-amber-500/50 text-amber-400' },
  info: { icon: Info, className: 'bg-blue-500/10 border-blue-500/50 text-blue-400' }
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => {
        const config = variantConfig[toast.variant]
        const Icon = config.icon

        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border shadow-lg',
              'animate-in slide-in-from-right-5 fade-in duration-200',
              config.className
            )}
            role="alert"
          >
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm flex-1 text-text-normal">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
              aria-label="Dismiss notification"
            >
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

export default ToastContainer
```

### 1.3 Update Contexts Index

**Update `src/renderer/src/contexts/index.ts`:**

Add export:
```typescript
export { ToastProvider, useToast, type Toast, type ToastVariant } from './ToastContext'
```

### 1.4 Integrate Toast Provider in App

**Update `src/renderer/src/App.tsx`:**

1. Import `ToastProvider` and `ToastContainer`
2. Wrap existing providers with `ToastProvider`
3. Add `<ToastContainer />` at root level (before closing fragment)

```typescript
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/ToastContainer'

// In render:
<ToastProvider>
  {/* existing providers */}
  <ToastContainer />
</ToastProvider>
```

---

## Part 2: Add Toast Notifications to Notebook Operations

### 2.1 Update SaveToNotebookModal

**In `src/renderer/src/components/notebook/SaveToNotebookModal.tsx`:**

1. Import `useToast`:
```typescript
import { useToast } from '../../contexts/ToastContext'
```

2. Add hook:
```typescript
const toast = useToast()
```

3. Update `handleSave` success path:
```typescript
// After successful save, before closing:
toast.success(`Saved to ${isCreatingNew ? newNotebookName : notebooks.find(n => n.id === targetNotebookId)?.name}`)
```

4. Update error handling:
```typescript
} catch (err) {
  console.error('[SaveToNotebookModal] Failed to save:', err)
  toast.error('Failed to save to notebook')
  setError('Failed to save. Please try again.')
}
```

### 2.2 Update NotebookViewer

**In `src/renderer/src/components/notebook/NotebookViewer.tsx`:**

Add toast notifications for:
- Entry deletion success: `toast.success('Entry deleted')`
- Bulk delete success: `toast.success(\`Deleted ${count} entries\`)`
- Notebook deletion: `toast.success('Notebook deleted')`
- Export success: `toast.success('Exported to clipboard')` or `toast.success('Download started')`
- Any errors: `toast.error('Operation failed')`

### 2.3 Update NotebookSidebar

**In `src/renderer/src/components/notebook/NotebookSidebar.tsx`:**

Add toast for notebook creation:
```typescript
const handleCreateNotebook = useCallback(async (input: {...}) => {
  await createNotebook(input)
  setShowCreateModal(false)
  toast.success(`Created notebook "${input.name}"`)
}, [createNotebook, toast])
```

---

## Part 3: ARIA Labels and Accessibility

### 3.1 Update Modal Components

**For all modals (SaveToNotebookModal, CreateNotebookModal):**

Add to backdrop div:
```typescript
<div
  className="fixed inset-0 ..."
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
>
```

Add `id="modal-title"` to the h2 heading:
```typescript
<h2 id="modal-title" className="...">Save to Notebook</h2>
```

Add `aria-describedby` for form sections if applicable.

### 3.2 Update Form Inputs

**For all inputs and textareas, connect labels properly:**

```typescript
<label 
  htmlFor="notebook-name-input"
  className="text-xs text-text-muted uppercase tracking-wide mb-2 block"
>
  Name *
</label>
<input
  id="notebook-name-input"
  type="text"
  aria-required="true"
  aria-invalid={!!error}
  aria-describedby={error ? "name-error" : undefined}
  ...
/>
{error && <p id="name-error" role="alert" className="...">{error}</p>}
```

### 3.3 Update NotebookSidebar

Add ARIA to sidebar panel:
```typescript
<div
  className="fixed right-0 top-0 h-full w-96 z-40 ..."
  role="complementary"
  aria-label="Notebooks panel"
>
```

Add ARIA to search:
```typescript
<input
  ref={searchInputRef}
  type="search"
  role="searchbox"
  aria-label="Search notebooks"
  ...
/>
```

### 3.4 Update NotebookList

Add ARIA to notebook list:
```typescript
<div 
  className="p-3 space-y-2"
  role="list"
  aria-label="Notebooks"
>
  {notebooks.map((notebook) => (
    <div role="listitem" key={notebook.id}>
      <NotebookCard ... />
    </div>
  ))}
</div>
```

### 3.5 Update Interactive Elements

For all icon-only buttons, ensure `aria-label`:
```typescript
<button
  onClick={onClose}
  aria-label="Close panel"
  className="..."
>
  <X size={18} />
</button>
```

---

## Part 4: Focus Management

### 4.1 Create useFocusTrap Hook

**Create `src/renderer/src/hooks/useFocusTrap.ts`:**

```typescript
/**
 * useFocusTrap
 *
 * Traps focus within a container element for modal accessibility.
 *
 * @module hooks/useFocusTrap
 */

import { useEffect, useRef, RefObject } from 'react'

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

export function useFocusTrap<T extends HTMLElement>(
  isActive: boolean
): RefObject<T> {
  const containerRef = useRef<T>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive) return

    // Store currently focused element
    previousFocusRef.current = document.activeElement as HTMLElement

    const container = containerRef.current
    if (!container) return

    // Focus first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    if (focusables.length > 0) {
      focusables[0].focus()
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        // Shift + Tab: if on first element, go to last
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        // Tab: if on last element, go to first
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      // Restore focus on cleanup
      if (previousFocusRef.current && previousFocusRef.current.focus) {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive])

  return containerRef
}

export default useFocusTrap
```

### 4.2 Update Hooks Index

**Update `src/renderer/src/hooks/index.ts`:**

```typescript
export { useFocusTrap } from './useFocusTrap'
```

### 4.3 Apply Focus Trap to Modals

**In SaveToNotebookModal.tsx and CreateNotebookModal.tsx:**

```typescript
import { useFocusTrap } from '../../hooks'

// Inside component:
const modalRef = useFocusTrap<HTMLDivElement>(isOpen)

// On modal content div:
<div
  ref={modalRef}
  className="bg-tertiary rounded-xl ..."
  onClick={(e) => e.stopPropagation()}
>
```

---

## Part 5: Debounced Search

### 5.1 Create useDebounce Hook

**Create `src/renderer/src/hooks/useDebounce.ts`:**

```typescript
/**
 * useDebounce
 *
 * Debounces a value by the specified delay.
 *
 * @module hooks/useDebounce
 */

import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}

export default useDebounce
```

### 5.2 Update Hooks Index

```typescript
export { useDebounce } from './useDebounce'
```

### 5.3 Apply Debounce in NotebookSidebar

**In `src/renderer/src/components/notebook/NotebookSidebar.tsx`:**

```typescript
import { useDebounce } from '../../hooks'

// Change state handling:
const [searchQuery, setSearchQuery] = useState('')
const debouncedQuery = useDebounce(searchQuery, 300)

// Update the effect to use debounced value:
useEffect(() => {
  if (!debouncedQuery.trim()) {
    setSearchResults([])
    return
  }
  
  let cancelled = false
  setIsSearching(true)
  
  search(debouncedQuery)
    .then((results) => {
      if (!cancelled) setSearchResults(results)
    })
    .catch((err) => {
      if (!cancelled) console.error('[NotebookSidebar] Search failed:', err)
    })
    .finally(() => {
      if (!cancelled) setIsSearching(false)
    })

  return () => {
    cancelled = true
  }
}, [debouncedQuery, search])

// Update input handler to just set state (remove async call):
<input
  ref={searchInputRef}
  type="text"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  ...
/>
```

---

## Part 6: Skeleton Loaders

### 6.1 Create NotebookSkeleton Component

**Create `src/renderer/src/components/notebook/NotebookSkeleton.tsx`:**

```typescript
/**
 * NotebookSkeleton
 *
 * Skeleton loading placeholders for notebook components.
 *
 * @module components/notebook/NotebookSkeleton
 */

import { cn } from '../../lib/utils'

export function NotebookCardSkeleton() {
  return (
    <div className="p-3 rounded-lg bg-secondary/50 border border-secondary/30 animate-pulse">
      <div className="flex items-start gap-3">
        {/* Emoji placeholder */}
        <div className="w-10 h-10 rounded-lg bg-secondary" />
        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="h-4 bg-secondary rounded w-3/4" />
          {/* Meta */}
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function NotebookListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 space-y-2" role="status" aria-label="Loading notebooks">
      {Array.from({ length: count }).map((_, i) => (
        <NotebookCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading notebooks...</span>
    </div>
  )
}

export function NotebookEntrySkeleton() {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-secondary/20 animate-pulse">
      {/* Title */}
      <div className="h-4 bg-secondary rounded w-2/3 mb-3" />
      {/* Content lines */}
      <div className="space-y-2">
        <div className="h-3 bg-secondary rounded w-full" />
        <div className="h-3 bg-secondary rounded w-5/6" />
        <div className="h-3 bg-secondary rounded w-4/6" />
      </div>
      {/* Footer */}
      <div className="mt-3 flex justify-between">
        <div className="h-3 bg-secondary rounded w-24" />
        <div className="h-3 bg-secondary rounded w-16" />
      </div>
    </div>
  )
}

export function NotebookEntriesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 space-y-3" role="status" aria-label="Loading entries">
      {Array.from({ length: count }).map((_, i) => (
        <NotebookEntrySkeleton key={i} />
      ))}
      <span className="sr-only">Loading entries...</span>
    </div>
  )
}

export default { NotebookCardSkeleton, NotebookListSkeleton, NotebookEntrySkeleton, NotebookEntriesListSkeleton }
```

### 6.2 Update Notebook Index Exports

**Update `src/renderer/src/components/notebook/index.ts`:**

```typescript
export * from './NotebookSkeleton'
```

### 6.3 Apply Skeletons in NotebookSidebar

**In `src/renderer/src/components/notebook/NotebookSidebar.tsx`:**

Replace the loading spinner with skeleton:

```typescript
import { NotebookListSkeleton, NotebookEntriesListSkeleton } from './NotebookSkeleton'

// In content area:
{loading ? (
  <NotebookListSkeleton count={4} />
) : /* rest of conditions */}

// For entries loading in NotebookViewer:
{entriesLoading ? (
  <NotebookEntriesListSkeleton count={3} />
) : /* rest */}
```

---

## Verification Checklist

### TypeScript
```bash
npm run typecheck
```
- [ ] No TypeScript errors

### Functionality Testing
- [ ] Toast appears on successful save to notebook
- [ ] Toast appears on error conditions
- [ ] Toast auto-dismisses after 3 seconds
- [ ] Toast can be manually dismissed

### Accessibility Testing
- [ ] All modals have proper `role="dialog"` and `aria-modal="true"`
- [ ] All form inputs have associated labels via `htmlFor`/`id`
- [ ] All icon-only buttons have `aria-label`
- [ ] Focus is trapped within open modals
- [ ] Focus returns to trigger element when modal closes
- [ ] Screen reader announces toast notifications

### Performance Testing
- [ ] Search is debounced (no API call on every keystroke)
- [ ] Skeleton loaders appear during initial load
- [ ] No layout shift when content loads

### Keyboard Navigation
- [ ] Tab cycles through focusable elements in modal
- [ ] Shift+Tab cycles in reverse
- [ ] Escape closes modals
- [ ] Enter submits forms

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `src/renderer/src/contexts/ToastContext.tsx` | Toast notification state management |
| `src/renderer/src/components/ui/ToastContainer.tsx` | Toast notification renderer |
| `src/renderer/src/hooks/useFocusTrap.ts` | Modal focus trapping |
| `src/renderer/src/hooks/useDebounce.ts` | Value debouncing utility |
| `src/renderer/src/components/notebook/NotebookSkeleton.tsx` | Skeleton loading components |

### Modified Files
| File | Changes |
|------|---------|
| `src/renderer/src/contexts/index.ts` | Export ToastProvider |
| `src/renderer/src/hooks/index.ts` | Export new hooks |
| `src/renderer/src/components/notebook/index.ts` | Export skeletons |
| `src/renderer/src/App.tsx` | Add ToastProvider and ToastContainer |
| `src/renderer/src/components/notebook/SaveToNotebookModal.tsx` | Add toast, ARIA, focus trap |
| `src/renderer/src/components/notebook/CreateNotebookModal.tsx` | Add toast, ARIA, focus trap |
| `src/renderer/src/components/notebook/NotebookSidebar.tsx` | Add debounced search, skeletons, ARIA |
| `src/renderer/src/components/notebook/NotebookViewer.tsx` | Add toast notifications, ARIA |

---

## Git Commit

```bash
git add -A
git commit -m "feat(notebook): Phase 7 - Polish and accessibility

- Add global toast notification system with success/error/warning/info variants
- Add ARIA labels and roles for screen reader accessibility
- Implement focus trapping in modals with useFocusTrap hook
- Add debounced search for performance optimization
- Create skeleton loading components for better perceived performance
- Connect all form labels to inputs via htmlFor/id
- Add keyboard navigation support for focus cycling
- Ensure focus restoration when modals close"
```

---

*Phase 7 Implementation Prompt*  
*Notebook Feature Polish & Accessibility*
