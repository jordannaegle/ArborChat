import { cn } from '../../../lib/utils'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

export function ToggleSwitch({ 
  checked, 
  onChange, 
  disabled = false,
  size = 'md' 
}: ToggleSwitchProps) {
  const sizes = {
    sm: { track: 'h-5 w-9', thumb: 'h-3 w-3', translate: 'translate-x-5' },
    md: { track: 'h-6 w-11', thumb: 'h-4 w-4', translate: 'translate-x-6' }
  }

  const s = sizes[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center rounded-full",
        "transition-colors duration-200 ease-in-out",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
        s.track,
        checked ? "bg-primary" : "bg-secondary",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-lg",
          "transform transition-transform duration-200 ease-in-out",
          s.thumb,
          checked ? s.translate : "translate-x-1"
        )}
      />
    </button>
  )
}
