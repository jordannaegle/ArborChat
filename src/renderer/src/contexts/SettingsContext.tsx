// src/renderer/src/contexts/SettingsContext.tsx
// Context for managing application settings (Phase 4)

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useMemo,
  useEffect
} from 'react'

// Storage key for persistence
const SETTINGS_KEY = 'arborchat:settings'

// Settings interface
export interface Settings {
  /** Enable Claude Desktop-style grouped tool display */
  enhancedToolDisplay: boolean
}

// Default settings values
const DEFAULT_SETTINGS: Settings = {
  enhancedToolDisplay: true
}

// State type
interface SettingsState {
  settings: Settings
  isLoaded: boolean
}

// Action types
type SettingsAction =
  | { type: 'SET_SETTINGS'; payload: Settings }
  | { type: 'UPDATE_SETTING'; payload: Partial<Settings> }
  | { type: 'RESET_SETTINGS' }

// Initial state
const initialState: SettingsState = {
  settings: DEFAULT_SETTINGS,
  isLoaded: false
}

// Reducer
function settingsReducer(
  state: SettingsState,
  action: SettingsAction
): SettingsState {
  switch (action.type) {
    case 'SET_SETTINGS':
      return {
        ...state,
        settings: action.payload,
        isLoaded: true
      }

    case 'UPDATE_SETTING':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload
        }
      }

    case 'RESET_SETTINGS':
      return {
        ...state,
        settings: DEFAULT_SETTINGS
      }

    default:
      return state
  }
}

// Context type
interface SettingsContextType {
  /** Current settings */
  settings: Settings
  
  /** Whether settings have been loaded from storage */
  isLoaded: boolean
  
  /** Update one or more settings */
  updateSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void
  
  /** Update multiple settings at once */
  updateSettings: (updates: Partial<Settings>) => void
  
  /** Reset all settings to defaults */
  resetSettings: () => void
}

const SettingsContext = createContext<SettingsContextType | null>(null)

// Provider component
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, initialState)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Settings>
        // Merge with defaults to handle new fields
        const merged: Settings = {
          ...DEFAULT_SETTINGS,
          ...parsed
        }
        dispatch({ type: 'SET_SETTINGS', payload: merged })
      } else {
        // No stored settings, use defaults but mark as loaded
        dispatch({ type: 'SET_SETTINGS', payload: DEFAULT_SETTINGS })
      }
    } catch (err) {
      console.warn('[SettingsContext] Failed to load settings:', err)
      dispatch({ type: 'SET_SETTINGS', payload: DEFAULT_SETTINGS })
    }
  }, [])

  // Save settings to localStorage on change (only after initial load)
  useEffect(() => {
    if (!state.isLoaded) return
    
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings))
    } catch (err) {
      console.warn('[SettingsContext] Failed to save settings:', err)
    }
  }, [state.settings, state.isLoaded])

  // Update a single setting
  const updateSetting = useCallback(<K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    dispatch({ type: 'UPDATE_SETTING', payload: { [key]: value } })
  }, [])

  // Update multiple settings
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    dispatch({ type: 'UPDATE_SETTING', payload: updates })
  }, [])

  // Reset to defaults
  const resetSettings = useCallback(() => {
    dispatch({ type: 'RESET_SETTINGS' })
  }, [])

  // Memoized context value
  const contextValue = useMemo<SettingsContextType>(
    () => ({
      settings: state.settings,
      isLoaded: state.isLoaded,
      updateSetting,
      updateSettings,
      resetSettings
    }),
    [state.settings, state.isLoaded, updateSetting, updateSettings, resetSettings]
  )

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  )
}

// Hook to use settings context
export function useSettings(): SettingsContextType {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider')
  }
  return context
}

export { DEFAULT_SETTINGS }
export default SettingsContext
