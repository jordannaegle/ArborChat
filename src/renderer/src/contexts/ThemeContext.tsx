// src/renderer/src/contexts/ThemeContext.tsx
// Theme state management with React Context

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { Theme } from '../themes/types'
import { themes, DEFAULT_THEME_ID } from '../themes'
import { applyThemeToDOM } from '../themes/utils'

/**
 * Theme context value interface
 */
interface ThemeContextValue {
  /** The currently active theme */
  currentTheme: Theme
  /** The ID of the current theme */
  themeId: string
  /** Set a new theme by ID */
  setTheme: (themeId: string) => void
  /** All available themes */
  availableThemes: Theme[]
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'arborchat-theme'

interface ThemeProviderProps {
  children: React.ReactNode
}

/**
 * ThemeProvider component
 * Manages theme state, persistence, and DOM application
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  // Initialize from localStorage or use default
  const [themeId, setThemeId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored && themes[stored] ? stored : DEFAULT_THEME_ID
  })

  // Get current theme object (with fallback)
  const currentTheme = themes[themeId] || themes[DEFAULT_THEME_ID]

  /**
   * Set a new theme by ID
   * Validates the ID exists before applying
   */
  const setTheme = useCallback((newThemeId: string) => {
    if (themes[newThemeId]) {
      setThemeId(newThemeId)
      localStorage.setItem(STORAGE_KEY, newThemeId)
    } else {
      console.warn(`[ThemeContext] Unknown theme ID: ${newThemeId}`)
    }
  }, [])

  /**
   * Apply theme CSS variables whenever theme changes
   * This runs on mount and whenever currentTheme changes
   */
  useEffect(() => {
    applyThemeToDOM(currentTheme)
    console.log(`[ThemeContext] Applied theme: ${currentTheme.id}`)
    
    // Update dock icon to match theme (macOS only)
    if (window.api?.setDockIcon) {
      window.api.setDockIcon(currentTheme.id).catch((err: Error) => {
        console.warn('[ThemeContext] Failed to update dock icon:', err)
      })
    }
  }, [currentTheme])

  /**
   * Build the context value object
   */
  const value: ThemeContextValue = {
    currentTheme,
    themeId,
    setTheme,
    availableThemes: Object.values(themes),
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Hook to access theme context
 * Must be used within a ThemeProvider
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
