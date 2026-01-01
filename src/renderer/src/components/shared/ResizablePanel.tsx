/**
 * ResizablePanel
 * 
 * A wrapper component that makes right-side panels resizable by dragging.
 * Users can drag the left edge to make the panel wider or narrower.
 * Width is persisted to localStorage.
 * 
 * @module components/shared/ResizablePanel
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface ResizablePanelProps {
  /** Unique identifier for localStorage persistence */
  storageKey: string
  /** Default width in pixels */
  defaultWidth: number
  /** Minimum width in pixels */
  minWidth?: number
  /** Maximum width in pixels */
  maxWidth?: number
  /** Panel content */
  children: ReactNode
  /** Additional className for the container */
  className?: string
  /** Whether the panel is currently open/visible */
  isOpen?: boolean
}

export function ResizablePanel({
  storageKey,
  defaultWidth,
  minWidth = 320,
  maxWidth = 800,
  children,
  className,
  isOpen = true
}: ResizablePanelProps) {
  // Load persisted width from localStorage
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(`panel-width-${storageKey}`)
    if (stored) {
      const parsed = parseInt(stored, 10)
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed
      }
    }
    return defaultWidth
  })

  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Persist width to localStorage
  useEffect(() => {
    localStorage.setItem(`panel-width-${storageKey}`, String(width))
  }, [storageKey, width])

  // Handle mouse down on resize handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
  }, [width])

  // Handle mouse move during resize
  useEffect(() => {
    if (!isResizing) return

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate delta (negative because dragging left increases width)
      const delta = startXRef.current - e.clientX
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta))
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Add cursor style to body during resize
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isResizing, minWidth, maxWidth])

  if (!isOpen) {
    return null
  }

  return (
    <div
      ref={panelRef}
      className={cn('relative flex', className)}
      style={{ width: `${width}px` }}
    >
      {/* Resize Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute left-0 top-0 bottom-0 w-1 z-50',
          'cursor-ew-resize group',
          'hover:bg-primary/50',
          isResizing && 'bg-primary/70'
        )}
        title="Drag to resize"
      >
        {/* Visual indicator on hover */}
        <div className={cn(
          'absolute inset-y-0 -left-0.5 w-2',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          isResizing && 'opacity-100'
        )}>
          <div className="h-full w-full flex items-center justify-center">
            <div className={cn(
              'w-0.5 h-12 rounded-full',
              'bg-primary/60 group-hover:bg-primary',
              isResizing && 'bg-primary'
            )} />
          </div>
        </div>
      </div>

      {/* Panel Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  )
}

export default ResizablePanel
