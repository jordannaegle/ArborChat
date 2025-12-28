/**
 * SlashCommandMenu Component
 * Displays autocomplete suggestions for slash commands above the chat input
 * 
 * @author Alex Chen (Design Lead)
 * @phase Phase 4: Slash Commands
 */

import { useEffect, useRef } from 'react'
import { 
  User, 
  List, 
  X,
  ChevronRight,
  Command
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { SlashCommandState } from '../../hooks/useSlashCommands'

interface SlashCommandMenuProps {
  state: SlashCommandState
  onSelect: (index: number) => void
  onClose: () => void
}

export function SlashCommandMenu({ 
  state, 
  onSelect, 
  onClose 
}: SlashCommandMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      })
    }
  }, [state.selectedIndex])

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (state.isActive) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [state.isActive, onClose])

  if (!state.isActive || state.matches.length === 0) {
    return null
  }

  const getCommandIcon = (name: string, customIcon?: string) => {
    // If there's a custom emoji icon, use it
    if (customIcon && customIcon.length <= 4) {
      return (
        <span className="text-base leading-none">{customIcon}</span>
      )
    }
    
    // Otherwise use Lucide icons
    if (name.includes('list')) return <List size={14} />
    if (name.includes('clear')) return <X size={14} />
    if (name.includes('persona')) return <User size={14} />
    return <Command size={14} />
  }

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-2",
        "bg-secondary/95 backdrop-blur-md",
        "border border-tertiary rounded-xl",
        "shadow-xl shadow-black/30",
        "max-h-72 overflow-y-auto",
        "z-50",
        "animate-in fade-in slide-in-from-bottom-2 duration-150"
      )}
      role="listbox"
      aria-label="Command suggestions"
    >
      <div className="p-2">
        {/* Section Header */}
        <div className="flex items-center gap-2 text-xs text-text-muted px-2 py-1.5 mb-1">
          <Command size={12} />
          <span>Commands</span>
          <span className="ml-auto text-text-muted/50">
            {state.matches.length} result{state.matches.length !== 1 ? 's' : ''}
          </span>
        </div>
        
        {/* Command List */}
        {state.matches.map((match, index) => {
          const isSelected = index === state.selectedIndex
          const IconElement = getCommandIcon(match.command.name, match.command.icon)
          
          return (
            <button
              key={`${match.command.name}-${index}`}
              ref={isSelected ? selectedRef : null}
              onClick={() => onSelect(index)}
              onMouseEnter={() => onSelect(index)}
              role="option"
              aria-selected={isSelected}
              className={cn(
                "w-full flex items-center gap-3 p-2.5 rounded-lg",
                "text-left transition-all duration-100",
                isSelected
                  ? "bg-primary/20 text-white"
                  : "text-text-muted hover:bg-tertiary hover:text-text-normal"
              )}
            >
              {/* Icon Container */}
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                "transition-colors duration-100",
                isSelected ? "bg-primary/30" : "bg-tertiary"
              )}>
                {IconElement}
              </div>
              
              {/* Command Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className={cn(
                    "font-mono text-sm",
                    isSelected ? "text-white" : "text-text-normal"
                  )}>
                    {match.command.syntax}
                  </code>
                  {isSelected && (
                    <ChevronRight size={12} className="text-primary shrink-0" />
                  )}
                </div>
                <span className={cn(
                  "text-xs line-clamp-1",
                  isSelected ? "text-text-muted" : "text-text-muted/70"
                )}>
                  {match.command.description}
                </span>
              </div>
            </button>
          )
        })}
      </div>
      
      {/* Footer Hints */}
      <div className="border-t border-tertiary/50 px-3 py-2 flex items-center gap-4 text-xs text-text-muted/60">
        <span className="inline-flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-tertiary rounded text-[10px] font-mono">↑↓</kbd>
          <span>navigate</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-tertiary rounded text-[10px] font-mono">Enter</kbd>
          <span>select</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <kbd className="px-1.5 py-0.5 bg-tertiary rounded text-[10px] font-mono">Esc</kbd>
          <span>cancel</span>
        </span>
      </div>
    </div>
  )
}
