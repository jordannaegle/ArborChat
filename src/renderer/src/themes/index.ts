// src/renderer/src/themes/index.ts
// Main theme system exports

import {
  midnightTheme,
  auroraGlassTheme,
  linearMinimalTheme,
  forestDeepTheme,
  neonCyberTheme,
  goldenHourTheme,
  abyssalTheme,
  celestialTheme,
  emberTheme
} from './themes'
import type { Theme, ThemeRegistry } from './types'

// Re-export types
export type { Theme, ThemeColors, ThemeEffects, ThemeRegistry } from './types'

// Re-export utilities
export { applyThemeToDOM, getThemePreviewColors, isGlassTheme, getCategoryDisplayName } from './utils'

// Re-export individual themes
export {
  midnightTheme,
  auroraGlassTheme,
  linearMinimalTheme,
  forestDeepTheme,
  neonCyberTheme,
  goldenHourTheme,
  abyssalTheme,
  celestialTheme,
  emberTheme
}

/**
 * Default theme ID
 */
export const DEFAULT_THEME_ID = 'midnight'

/**
 * Theme registry - all available themes indexed by ID
 */
export const themes: ThemeRegistry = {
  [midnightTheme.id]: midnightTheme,
  [auroraGlassTheme.id]: auroraGlassTheme,
  [linearMinimalTheme.id]: linearMinimalTheme,
  [forestDeepTheme.id]: forestDeepTheme,
  [neonCyberTheme.id]: neonCyberTheme,
  [goldenHourTheme.id]: goldenHourTheme,
  [abyssalTheme.id]: abyssalTheme,
  [celestialTheme.id]: celestialTheme,
  [emberTheme.id]: emberTheme,
}

/**
 * Get all themes as an array
 */
export function getAllThemes(): Theme[] {
  return Object.values(themes)
}

/**
 * Get a theme by ID, with fallback to default
 */
export function getTheme(themeId: string): Theme {
  return themes[themeId] || themes[DEFAULT_THEME_ID]
}
