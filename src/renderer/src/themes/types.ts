// src/renderer/src/themes/types.ts
// Type definitions for the ArborChat theme system

/**
 * Theme color definitions
 * These map directly to CSS custom properties for consistent styling
 */
export interface ThemeColors {
  // Base colors
  background: string        // Main app background
  backgroundSoft: string    // Slightly elevated surfaces
  backgroundMuted: string   // Cards, panels

  // Surface colors (for glassmorphism)
  surface: string           // Primary surface color
  surfaceHover: string      // Hover state
  surfaceActive: string     // Active/selected state

  // Border colors
  border: string            // Default borders
  borderSubtle: string      // Subtle dividers
  borderFocus: string       // Focus rings

  // Text colors
  textPrimary: string       // Main text
  textSecondary: string     // Secondary/muted text
  textMuted: string         // Disabled/hint text
  textInverse: string       // Text on primary color

  // Accent colors
  primary: string           // Primary brand color
  primaryHover: string      // Primary hover state
  primaryMuted: string      // Primary at low opacity

  // Semantic colors
  success: string
  successMuted: string
  warning: string
  warningMuted: string
  error: string
  errorMuted: string
  info: string
  infoMuted: string

  // Special effects
  glow: string              // Glow/shadow color for neon effects
  glass: string             // Glass panel background
  glassBorder: string       // Glass panel border

  // Logo colors
  logoBackground: string    // Logo background color (defaults to primary if not set)
  logoForeground: string    // Logo tree/icon color (typically white)
}

/**
 * Theme effect configurations
 * Controls visual effects like glass, shadows, and animations
 */
export interface ThemeEffects {
  // Glassmorphism
  enableGlass: boolean
  glassBlur: string         // e.g., "20px"
  glassOpacity: number      // 0-1

  // Shadows
  shadowSm: string
  shadowMd: string
  shadowLg: string
  shadowGlow: string        // Colored glow shadow

  // Border radius
  radiusSm: string
  radiusMd: string
  radiusLg: string
  radiusXl: string

  // Transitions
  transitionFast: string
  transitionNormal: string
  transitionSlow: string
}

/**
 * Complete theme definition
 */
export interface Theme {
  id: string
  name: string
  description: string
  category: 'dark' | 'light' | 'colorful'
  colors: ThemeColors
  effects: ThemeEffects
}

/**
 * Theme registry - maps theme IDs to theme objects
 */
export type ThemeRegistry = Record<string, Theme>
