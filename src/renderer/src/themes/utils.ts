// src/renderer/src/themes/utils.ts
// Theme utility functions

import { Theme } from './types'

/**
 * Convert camelCase to kebab-case for CSS variables
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
}

/**
 * Theme-specific animation class mappings
 * These enable the animated background effects defined in themes.css
 * Only themes with root-level background animations are listed here
 */
const THEME_ANIMATION_CLASSES: Record<string, string> = {
  'celestial': 'celestial-animated',
  'ember': 'ember-animated',
  'abyssal': 'abyssal-animated',
}

/**
 * Apply theme colors and effects as CSS custom properties to the DOM
 */
export function applyThemeToDOM(theme: Theme): void {
  const root = document.documentElement

  // Apply colors as CSS variables
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVar = `--theme-${camelToKebab(key)}`
    root.style.setProperty(cssVar, value)
  })

  // Apply effects as CSS variables
  Object.entries(theme.effects).forEach(([key, value]) => {
    const cssVar = `--theme-${camelToKebab(key)}`
    root.style.setProperty(cssVar, String(value))
  })

  // Set theme ID as data attribute for conditional CSS
  root.setAttribute('data-theme', theme.id)

  // Set glass mode attribute for glass effect styling
  root.setAttribute('data-glass', String(theme.effects.enableGlass))

  // Remove all previous theme animation classes, then add the current one
  // This enables the living background animations defined in themes.css
  Object.values(THEME_ANIMATION_CLASSES).forEach(cls => {
    root.classList.remove(cls)
  })
  
  const animationClass = THEME_ANIMATION_CLASSES[theme.id]
  if (animationClass) {
    root.classList.add(animationClass)
  }

  // Map theme colors to existing Tailwind v4 @theme variables for compatibility
  // This ensures existing components continue to work while allowing gradual migration
  root.style.setProperty('--color-background', theme.colors.background)
  root.style.setProperty('--color-secondary', theme.colors.backgroundSoft)
  root.style.setProperty('--color-tertiary', theme.colors.backgroundMuted)
  root.style.setProperty('--color-primary', theme.colors.primary)
  root.style.setProperty('--color-text-normal', theme.colors.textPrimary)
  root.style.setProperty('--color-text-muted', theme.colors.textMuted)
  root.style.setProperty('--color-success', theme.colors.success)
  root.style.setProperty('--color-warning', theme.colors.warning)
  root.style.setProperty('--color-danger', theme.colors.error)

  // Logo colors - used by ArborLogo component
  root.style.setProperty('--theme-logo-background', theme.colors.logoBackground || theme.colors.primary)
  root.style.setProperty('--theme-logo-foreground', theme.colors.logoForeground || '#ffffff')
}

/**
 * Generate preview colors for theme cards
 */
export function getThemePreviewColors(theme: Theme): string[] {
  return [
    theme.colors.background,
    theme.colors.primary,
    theme.colors.surface,
  ]
}

/**
 * Check if a theme supports glass effects
 */
export function isGlassTheme(theme: Theme): boolean {
  return theme.effects.enableGlass
}

/**
 * Get the category display name
 */
export function getCategoryDisplayName(category: Theme['category']): string {
  const names: Record<Theme['category'], string> = {
    dark: 'Dark',
    light: 'Light',
    colorful: 'Colorful'
  }
  return names[category]
}
