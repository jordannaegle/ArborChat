// src/renderer/src/components/agent/AgentTemplateSelector.tsx
// Template picker for quick agent configuration (Phase 6)

import { 
  Search, 
  Bug, 
  FileText, 
  RefreshCw, 
  TestTube, 
  Sparkles, 
  FolderTree,
  Check
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { AgentTemplate } from '../../types/agent'
import { DEFAULT_AGENT_TEMPLATES } from '../../data/agentTemplates'

// Icon mapping for templates
const ICON_MAP: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Search,
  Bug,
  FileText,
  RefreshCw,
  TestTube,
  Sparkles,
  FolderTree
}

interface AgentTemplateSelectorProps {
  selectedTemplateId: string | null
  onSelectTemplate: (template: AgentTemplate | null) => void
}

export function AgentTemplateSelector({
  selectedTemplateId,
  onSelectTemplate
}: AgentTemplateSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-text-muted">
        Quick Start Templates
      </label>
      <div className="grid grid-cols-2 gap-2">
        {DEFAULT_AGENT_TEMPLATES.slice(0, 6).map((template) => {
          const Icon = ICON_MAP[template.icon] || Sparkles
          const isSelected = selectedTemplateId === template.id
          
          return (
            <button
              key={template.id}
              onClick={() => onSelectTemplate(isSelected ? null : template)}
              className={cn(
                "flex items-start gap-2 p-3 rounded-lg border text-left transition-all",
                isSelected
                  ? "bg-primary/10 border-primary/50 ring-1 ring-primary/30"
                  : "bg-secondary/30 border-secondary/50 hover:bg-secondary/50 hover:border-secondary"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-md flex-shrink-0 mt-0.5",
                isSelected ? "bg-primary/20 text-primary" : "bg-secondary text-text-muted"
              )}>
                <Icon size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "text-sm font-medium truncate",
                    isSelected ? "text-primary" : "text-white"
                  )}>
                    {template.name}
                  </span>
                  {isSelected && <Check size={12} className="text-primary flex-shrink-0" />}
                </div>
                <p className="text-xs text-text-muted line-clamp-2 mt-0.5">
                  {template.description}
                </p>
              </div>
            </button>
          )
        })}
      </div>
      
      {selectedTemplateId && (
        <p className="text-xs text-text-muted mt-1">
          Template selected. Instructions will be pre-filled.
        </p>
      )}
    </div>
  )
}

export default AgentTemplateSelector
