/**
 * useNotebookShortcuts
 *
 * Keyboard shortcut handler for notebook operations.
 *
 * @module hooks/useNotebookShortcuts
 */

import { useEffect, useCallback } from 'react'

interface NotebookShortcutHandlers {
  onNewNotebook?: () => void
  onSearch?: () => void
  onExport?: () => void
  onClosePanel?: () => void
  onNavigateBack?: () => void
  onDelete?: () => void
}

export function useNotebookShortcuts(
  handlers: NotebookShortcutHandlers,
  enabled: boolean = true
) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return

    // Don't trigger if typing in an input/textarea
    const target = e.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Allow Escape in inputs
      if (e.key !== 'Escape') return
    }

    const isMeta = e.metaKey || e.ctrlKey

    // ⌘/Ctrl + N - New notebook
    if (isMeta && e.key === 'n' && !e.shiftKey) {
      e.preventDefault()
      handlers.onNewNotebook?.()
      return
    }

    // ⌘/Ctrl + F - Focus search
    if (isMeta && e.key === 'f') {
      e.preventDefault()
      handlers.onSearch?.()
      return
    }

    // ⌘/Ctrl + E - Export
    if (isMeta && e.key === 'e') {
      e.preventDefault()
      handlers.onExport?.()
      return
    }

    // Escape - Close panel or go back
    if (e.key === 'Escape') {
      e.preventDefault()
      if (handlers.onNavigateBack) {
        handlers.onNavigateBack()
      } else {
        handlers.onClosePanel?.()
      }
      return
    }

    // Backspace - Navigate back (when not in input)
    if (e.key === 'Backspace' && !isMeta) {
      e.preventDefault()
      handlers.onNavigateBack?.()
      return
    }

    // ⌘/Ctrl + Backspace - Delete
    if (isMeta && e.key === 'Backspace') {
      e.preventDefault()
      handlers.onDelete?.()
      return
    }
  }, [enabled, handlers])

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
    return undefined
  }, [enabled, handleKeyDown])
}

export default useNotebookShortcuts
