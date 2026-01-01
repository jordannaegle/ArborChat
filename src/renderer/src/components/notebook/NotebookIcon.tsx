/**
 * NotebookIcon
 *
 * Small icon button that appears on message hover.
 * Triggers the SaveToNotebookModal when clicked.
 *
 * @module components/notebook/NotebookIcon
 */

import { BookOpen } from 'lucide-react'
import { cn } from '../../lib/utils'

interface NotebookIconProps {
  onClick: () => void
  className?: string
  size?: number
  showLabel?: boolean
}

export function NotebookIcon({
  onClick,
  className,
  size = 14,
  showLabel = true
}: NotebookIconProps) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
        'text-text-muted hover:text-amber-400 hover:bg-amber-500/10',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-amber-500/30',
        className
      )}
      aria-label="Save to notebook"
      title="Save to notebook"
    >
      <BookOpen size={size} />
      {showLabel && <span>Save</span>}
    </button>
  )
}

export default NotebookIcon
