/**
 * KeyboardShortcutsHelp
 *
 * Shows available keyboard shortcuts for notebook operations.
 *
 * @module components/notebook/KeyboardShortcutsHelp
 */

import { Keyboard } from 'lucide-react'
import { cn } from '../../lib/utils'

interface ShortcutItem {
  keys: string[]
  description: string
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ['⌘', 'N'], description: 'New notebook' },
  { keys: ['⌘', 'F'], description: 'Search' },
  { keys: ['⌘', 'E'], description: 'Export' },
  { keys: ['Esc'], description: 'Close / Go back' },
  { keys: ['⌘', '⌫'], description: 'Delete' },
  { keys: ['⌘', 'S'], description: 'Save (when editing)' }
]

export function KeyboardShortcutsHelp() {
  return (
    <div className="p-3 border-t border-secondary/50">
      <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
        <Keyboard size={12} />
        <span>Keyboard Shortcuts</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {SHORTCUTS.map((shortcut, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-0.5">
              {shortcut.keys.map((key, j) => (
                <kbd
                  key={j}
                  className={cn(
                    'px-1.5 py-0.5 rounded',
                    'bg-secondary border border-secondary/80',
                    'text-text-muted font-mono text-[10px]'
                  )}
                >
                  {key}
                </kbd>
              ))}
            </div>
            <span className="text-text-muted/70">{shortcut.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default KeyboardShortcutsHelp
