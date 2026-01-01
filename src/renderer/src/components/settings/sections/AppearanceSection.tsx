// src/renderer/src/components/settings/sections/AppearanceSection.tsx
// Settings section for display and appearance preferences

import { Layers, Monitor, Check, Sparkles } from 'lucide-react'
import { cn } from '../../../lib/utils'
import { ToggleSwitch } from '../shared/ToggleSwitch'
import { useSettings } from '../../../contexts/SettingsContext'
import { useTheme } from '../../../contexts/ThemeContext'
import type { Theme } from '../../../themes/types'

export function AppearanceSection() {
  const { settings, updateSetting } = useSettings()
  const { themeId, setTheme, availableThemes } = useTheme()

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Appearance</h2>
        <p className="text-sm text-text-muted mt-1">
          Customize how ArborChat looks and displays information.
        </p>
      </div>

      {/* Theme Selection */}
      <div className="space-y-4">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Theme
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {availableThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={themeId === theme.id}
              onClick={() => setTheme(theme.id)}
            />
          ))}
        </div>
      </div>

      {/* Tool Display Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-text-muted uppercase tracking-wider">
          Tool Display
        </h3>

        {/* Enhanced Tool Display Toggle */}
        <div className={cn(
          "flex items-center justify-between p-4 rounded-xl border transition-all",
          settings.enhancedToolDisplay
            ? "bg-green-500/5 border-green-500/20"
            : "bg-secondary/30 border-secondary/50"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              settings.enhancedToolDisplay
                ? "bg-primary/20 text-primary"
                : "bg-secondary text-text-muted"
            )}>
              <Layers size={20} />
            </div>
            <div>
              <h4 className="font-medium text-white">Enhanced Tool Display</h4>
              <p className="text-sm text-text-muted">
                Group tool calls with thinking & verification steps
              </p>
            </div>
          </div>
          <ToggleSwitch
            checked={settings.enhancedToolDisplay}
            onChange={(checked) => updateSetting('enhancedToolDisplay', checked)}
          />
        </div>

        {/* Description of what this does */}
        <div className="p-4 rounded-xl bg-secondary/20 border border-secondary/30">
          <div className="flex items-start gap-3">
            <Monitor size={18} className="text-text-muted mt-0.5 flex-shrink-0" />
            <div className="text-sm text-text-muted">
              <p>
                When enabled, tool executions are displayed in collapsible groups 
                with an exclusive accordion for request/response details.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Theme card component for theme selection
 */
interface ThemeCardProps {
  theme: Theme
  isActive: boolean
  onClick: () => void
}

function ThemeCard({ theme, isActive, onClick }: ThemeCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-4 rounded-xl text-left transition-all duration-200',
        'border-2 group',
        isActive
          ? 'border-primary bg-primary/10'
          : 'border-secondary hover:border-primary/50 bg-secondary/30'
      )}
    >
      {/* Theme Preview */}
      <div 
        className="h-20 rounded-lg mb-3 overflow-hidden relative"
        style={{ background: theme.colors.background }}
      >
        {/* Mini preview of theme UI */}
        <div className="flex h-full">
          {/* Sidebar preview */}
          <div 
            className="w-1/4 h-full"
            style={{ background: theme.colors.backgroundSoft }}
          />
          {/* Content preview */}
          <div className="flex-1 p-2 flex flex-col gap-1">
            <div 
              className="h-3 w-3/4 rounded"
              style={{ background: theme.colors.surface }}
            />
            <div 
              className="h-3 w-1/2 rounded"
              style={{ background: theme.colors.primary }}
            />
            <div 
              className="h-3 w-2/3 rounded mt-auto"
              style={{ background: theme.colors.surface }}
            />
          </div>
        </div>
        
        {/* Glow effect for active state */}
        {isActive && (
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{ boxShadow: `inset 0 0 20px ${theme.colors.glow}` }}
          />
        )}
      </div>

      {/* Theme Info */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-white group-hover:text-white transition-colors">
            {theme.name}
          </h4>
          <p className="text-xs text-text-muted mt-0.5">
            {theme.description}
          </p>
        </div>
        
        {isActive && (
          <div 
            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: theme.colors.primary }}
          >
            <Check size={12} className="text-white" />
          </div>
        )}
      </div>

      {/* Glass indicator badge */}
      {theme.effects.enableGlass && (
        <div 
          className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] flex items-center gap-1"
          style={{ 
            background: theme.colors.glass, 
            color: theme.colors.textSecondary,
            border: `1px solid ${theme.colors.glassBorder}`
          }}
        >
          <Sparkles size={10} />
          Glass
        </div>
      )}
    </button>
  )
}

export default AppearanceSection
