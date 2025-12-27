import { ChevronDown, Sparkles } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { AVAILABLE_MODELS } from '../types'
import { cn } from '../lib/utils'

interface ModelSelectorProps {
    selectedModel: string
    onModelChange: (modelId: string) => void
    disabled?: boolean
}

export function ModelSelector({ selectedModel, onModelChange, disabled }: ModelSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel)
        ?? AVAILABLE_MODELS[0]

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg w-full",
                    "bg-tertiary border border-gray-700 text-white",
                    "hover:bg-tertiary/80 transition-colors",
                    disabled && "opacity-50 cursor-not-allowed"
                )}
            >
                <Sparkles size={16} className="text-primary" />
                <span className="text-sm font-medium flex-1 text-left">{currentModel.name}</span>
                <ChevronDown size={14} className={cn(
                    "text-text-muted transition-transform",
                    isOpen && "rotate-180"
                )} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-secondary border border-tertiary rounded-lg shadow-xl z-50 overflow-hidden">
                    {AVAILABLE_MODELS.map((model) => (
                        <button
                            key={model.id}
                            onClick={() => {
                                onModelChange(model.id)
                                setIsOpen(false)
                            }}
                            className={cn(
                                "w-full px-4 py-3 text-left hover:bg-tertiary/50 transition-colors",
                                model.id === selectedModel && "bg-primary/10 border-l-2 border-primary"
                            )}
                        >
                            <div className="text-sm font-medium text-white">{model.name}</div>
                            <div className="text-xs text-text-muted">{model.description}</div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
