# ArborChat Theme System Design

## Overview

This document outlines the design for a comprehensive, user-selectable theme system for ArborChat. The system will allow users to switch between multiple pre-built themes and persist their preference across sessions.

## Goals

1. **User Choice** - Allow users to select from multiple curated themes
2. **Persistence** - Remember theme selection across app restarts
3. **Performance** - Theme switching should be instantaneous with no flicker
4. **Extensibility** - Easy to add new themes in the future
5. **Consistency** - All UI components respect theme variables
6. **Accessibility** - Ensure sufficient contrast ratios in all themes

---

## Architecture

### Component Hierarchy

```
App.tsx
└── ThemeProvider (new)
    └── Layout
        ├── Sidebar
        ├── ChatWindow
        ├── AgentPanel
        └── Settings
            └── ThemeSelector (new)
```

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  localStorage   │────▶│  ThemeContext    │────▶│  CSS Variables  │
│  (persistence)  │     │  (React state)   │     │  (applied to    │
└─────────────────┘     └──────────────────┘     │   :root)        │
                               │                 └─────────────────┘
                               ▼
                        ┌──────────────────┐
                        │  ThemeSelector   │
                        │  (UI component)  │
                        └──────────────────┘
```

---

## Theme Definitions

### Theme Interface

```typescript
// src/renderer/src/types/theme.ts

export interface ThemeColors {
  // Base colors
  background: string;        // Main app background
  backgroundSoft: string;    // Slightly elevated surfaces
  backgroundMuted: string;   // Cards, panels
  
  // Surface colors (for glassmorphism)
  surface: string;           // Primary surface color
  surfaceHover: string;      // Hover state
  surfaceActive: string;     // Active/selected state
  
  // Border colors
  border: string;            // Default borders
  borderSubtle: string;      // Subtle dividers
  borderFocus: string;       // Focus rings
  
  // Text colors
  textPrimary: string;       // Main text
  textSecondary: string;     // Secondary/muted text
  textMuted: string;         // Disabled/hint text
  textInverse: string;       // Text on primary color
  
  // Accent colors
  primary: string;           // Primary brand color
  primaryHover: string;      // Primary hover state
  primaryMuted: string;      // Primary at low opacity
  
  // Semantic colors
  success: string;
  successMuted: string;
  warning: string;
  warningMuted: string;
  error: string;
  errorMuted: string;
  info: string;
  infoMuted: string;
  
  // Special effects
  glow: string;              // Glow/shadow color for neon effects
  glass: string;             // Glass panel background
  glassBorder: string;       // Glass panel border
}

export interface ThemeEffects {
  // Glassmorphism
  enableGlass: boolean;
  glassBlur: string;         // e.g., "20px"
  glassOpacity: number;      // 0-1
  
  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowGlow: string;        // Colored glow shadow
  
  // Border radius
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  
  // Transitions
  transitionFast: string;
  transitionNormal: string;
  transitionSlow: string;
}

export interface Theme {
  id: string;
  name: string;
  description: string;
  category: 'dark' | 'light' | 'colorful';
  colors: ThemeColors;
  effects: ThemeEffects;
}
```

---

## Pre-Built Themes

### 1. Midnight (Default - Current Theme)

The existing ArborChat dark theme, refined and formalized.

```typescript
const midnightTheme: Theme = {
  id: 'midnight',
  name: 'Midnight',
  description: 'The classic ArborChat dark theme',
  category: 'dark',
  colors: {
    background: '#0a0a0f',
    backgroundSoft: '#12121a',
    backgroundMuted: '#1a1a24',
    surface: '#1e1e2a',
    surfaceHover: '#252532',
    surfaceActive: '#2a2a3a',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.04)',
    borderFocus: 'rgba(99, 102, 241, 0.5)',
    textPrimary: '#e2e2e8',
    textSecondary: '#a0a0b0',
    textMuted: '#71717a',
    textInverse: '#ffffff',
    primary: '#6366f1',
    primaryHover: '#7c7ff2',
    primaryMuted: 'rgba(99, 102, 241, 0.15)',
    success: '#22c55e',
    successMuted: 'rgba(34, 197, 94, 0.15)',
    warning: '#f59e0b',
    warningMuted: 'rgba(245, 158, 11, 0.15)',
    error: '#ef4444',
    errorMuted: 'rgba(239, 68, 68, 0.15)',
    info: '#3b82f6',
    infoMuted: 'rgba(59, 130, 246, 0.15)',
    glow: 'rgba(99, 102, 241, 0.4)',
    glass: 'rgba(30, 30, 50, 0.6)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
  },
  effects: {
    enableGlass: false,
    glassBlur: '0px',
    glassOpacity: 1,
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.3)',
    shadowMd: '0 4px 6px rgba(0, 0, 0, 0.3)',
    shadowLg: '0 10px 15px rgba(0, 0, 0, 0.3)',
    shadowGlow: '0 0 20px rgba(99, 102, 241, 0.3)',
    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '20px',
    transitionFast: '100ms',
    transitionNormal: '200ms',
    transitionSlow: '300ms',
  },
};
```

### 2. Aurora Glass

Glassmorphic theme with frosted glass effects and gradient backgrounds.

```typescript
const auroraGlassTheme: Theme = {
  id: 'aurora-glass',
  name: 'Aurora Glass',
  description: 'Elegant glassmorphic design with frosted panels',
  category: 'dark',
  colors: {
    background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0a2e 50%, #0a1628 100%)',
    backgroundSoft: 'rgba(20, 20, 35, 0.8)',
    backgroundMuted: 'rgba(30, 30, 50, 0.6)',
    surface: 'rgba(30, 30, 50, 0.4)',
    surfaceHover: 'rgba(40, 40, 60, 0.5)',
    surfaceActive: 'rgba(50, 50, 70, 0.6)',
    border: 'rgba(255, 255, 255, 0.1)',
    borderSubtle: 'rgba(255, 255, 255, 0.05)',
    borderFocus: 'rgba(139, 92, 246, 0.5)',
    textPrimary: '#f0f0f5',
    textSecondary: '#b0b0c0',
    textMuted: '#808090',
    textInverse: '#ffffff',
    primary: '#8b5cf6',
    primaryHover: '#a78bfa',
    primaryMuted: 'rgba(139, 92, 246, 0.2)',
    success: '#34d399',
    successMuted: 'rgba(52, 211, 153, 0.2)',
    warning: '#fbbf24',
    warningMuted: 'rgba(251, 191, 36, 0.2)',
    error: '#f87171',
    errorMuted: 'rgba(248, 113, 113, 0.2)',
    info: '#60a5fa',
    infoMuted: 'rgba(96, 165, 250, 0.2)',
    glow: 'rgba(139, 92, 246, 0.5)',
    glass: 'rgba(30, 30, 50, 0.4)',
    glassBorder: 'rgba(255, 255, 255, 0.1)',
  },
  effects: {
    enableGlass: true,
    glassBlur: '20px',
    glassOpacity: 0.4,
    shadowSm: '0 2px 4px rgba(0, 0, 0, 0.2)',
    shadowMd: '0 8px 16px rgba(0, 0, 0, 0.2)',
    shadowLg: '0 20px 40px rgba(0, 0, 0, 0.3)',
    shadowGlow: '0 0 30px rgba(139, 92, 246, 0.4)',
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '16px',
    radiusXl: '24px',
    transitionFast: '100ms',
    transitionNormal: '200ms',
    transitionSlow: '300ms',
  },
};
```

### 3. Linear Minimal

Ultra-clean, Linear-inspired minimalist design.

```typescript
const linearMinimalTheme: Theme = {
  id: 'linear-minimal',
  name: 'Linear Minimal',
  description: 'Clean, focused design inspired by Linear',
  category: 'dark',
  colors: {
    background: '#09090b',
    backgroundSoft: '#0c0c0e',
    backgroundMuted: '#18181b',
    surface: '#1c1c1f',
    surfaceHover: '#222225',
    surfaceActive: '#27272a',
    border: 'rgba(255, 255, 255, 0.06)',
    borderSubtle: 'rgba(255, 255, 255, 0.03)',
    borderFocus: 'rgba(59, 130, 246, 0.5)',
    textPrimary: '#fafafa',
    textSecondary: '#a1a1aa',
    textMuted: '#71717a',
    textInverse: '#ffffff',
    primary: '#3b82f6',
    primaryHover: '#60a5fa',
    primaryMuted: 'rgba(59, 130, 246, 0.15)',
    success: '#22c55e',
    successMuted: 'rgba(34, 197, 94, 0.15)',
    warning: '#eab308',
    warningMuted: 'rgba(234, 179, 8, 0.15)',
    error: '#ef4444',
    errorMuted: 'rgba(239, 68, 68, 0.15)',
    info: '#0ea5e9',
    infoMuted: 'rgba(14, 165, 233, 0.15)',
    glow: 'rgba(59, 130, 246, 0.3)',
    glass: 'rgba(28, 28, 31, 0.9)',
    glassBorder: 'rgba(255, 255, 255, 0.06)',
  },
  effects: {
    enableGlass: false,
    glassBlur: '0px',
    glassOpacity: 1,
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.4)',
    shadowMd: '0 4px 8px rgba(0, 0, 0, 0.4)',
    shadowLg: '0 12px 24px rgba(0, 0, 0, 0.4)',
    shadowGlow: '0 0 16px rgba(59, 130, 246, 0.2)',
    radiusSm: '4px',
    radiusMd: '8px',
    radiusLg: '12px',
    radiusXl: '16px',
    transitionFast: '80ms',
    transitionNormal: '150ms',
    transitionSlow: '250ms',
  },
};
```

### 4. Forest Deep

Warm, eye-friendly green theme for long coding sessions.

```typescript
const forestDeepTheme: Theme = {
  id: 'forest-deep',
  name: 'Forest Deep',
  description: 'Warm green tones, easy on the eyes',
  category: 'dark',
  colors: {
    background: '#0d1210',
    backgroundSoft: '#0f1512',
    backgroundMuted: '#1a2420',
    surface: '#1e2a25',
    surfaceHover: '#243029',
    surfaceActive: '#2a3830',
    border: 'rgba(34, 197, 94, 0.15)',
    borderSubtle: 'rgba(34, 197, 94, 0.08)',
    borderFocus: 'rgba(34, 197, 94, 0.5)',
    textPrimary: '#e8f0ec',
    textSecondary: '#a0b8a8',
    textMuted: '#6b8070',
    textInverse: '#ffffff',
    primary: '#22c55e',
    primaryHover: '#4ade80',
    primaryMuted: 'rgba(34, 197, 94, 0.2)',
    success: '#34d399',
    successMuted: 'rgba(52, 211, 153, 0.2)',
    warning: '#fbbf24',
    warningMuted: 'rgba(251, 191, 36, 0.2)',
    error: '#f87171',
    errorMuted: 'rgba(248, 113, 113, 0.2)',
    info: '#38bdf8',
    infoMuted: 'rgba(56, 189, 248, 0.2)',
    glow: 'rgba(34, 197, 94, 0.4)',
    glass: 'rgba(30, 42, 37, 0.7)',
    glassBorder: 'rgba(34, 197, 94, 0.15)',
  },
  effects: {
    enableGlass: false,
    glassBlur: '0px',
    glassOpacity: 1,
    shadowSm: '0 1px 3px rgba(0, 0, 0, 0.3)',
    shadowMd: '0 4px 8px rgba(0, 0, 0, 0.3)',
    shadowLg: '0 12px 24px rgba(0, 0, 0, 0.3)',
    shadowGlow: '0 0 20px rgba(34, 197, 94, 0.3)',
    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '20px',
    transitionFast: '100ms',
    transitionNormal: '200ms',
    transitionSlow: '300ms',
  },
};
```

### 5. Neon Cyber

Bold cyberpunk aesthetic with neon accents.

```typescript
const neonCyberTheme: Theme = {
  id: 'neon-cyber',
  name: 'Neon Cyber',
  description: 'Bold cyberpunk vibes with neon accents',
  category: 'colorful',
  colors: {
    background: '#0a0a0f',
    backgroundSoft: '#0d0d14',
    backgroundMuted: '#14141f',
    surface: '#1a1a28',
    surfaceHover: '#20202f',
    surfaceActive: '#262638',
    border: 'rgba(244, 114, 182, 0.2)',
    borderSubtle: 'rgba(244, 114, 182, 0.1)',
    borderFocus: 'rgba(34, 211, 238, 0.5)',
    textPrimary: '#f0f0f8',
    textSecondary: '#b0b0c8',
    textMuted: '#8080a0',
    textInverse: '#ffffff',
    primary: '#f472b6',
    primaryHover: '#f9a8d4',
    primaryMuted: 'rgba(244, 114, 182, 0.2)',
    success: '#22d3ee',
    successMuted: 'rgba(34, 211, 238, 0.2)',
    warning: '#fde047',
    warningMuted: 'rgba(253, 224, 71, 0.2)',
    error: '#fb7185',
    errorMuted: 'rgba(251, 113, 133, 0.2)',
    info: '#818cf8',
    infoMuted: 'rgba(129, 140, 248, 0.2)',
    glow: 'rgba(244, 114, 182, 0.5)',
    glass: 'rgba(26, 26, 40, 0.8)',
    glassBorder: 'rgba(244, 114, 182, 0.2)',
  },
  effects: {
    enableGlass: true,
    glassBlur: '12px',
    glassOpacity: 0.8,
    shadowSm: '0 2px 4px rgba(0, 0, 0, 0.4)',
    shadowMd: '0 4px 12px rgba(0, 0, 0, 0.4)',
    shadowLg: '0 12px 32px rgba(0, 0, 0, 0.5)',
    shadowGlow: '0 0 30px rgba(244, 114, 182, 0.4)',
    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '20px',
    transitionFast: '80ms',
    transitionNormal: '150ms',
    transitionSlow: '250ms',
  },
};
```

---

## New Files Structure

```
src/renderer/src/
├── contexts/
│   └── ThemeContext.tsx        # Theme state management
├── themes/
│   ├── index.ts                # Theme exports
│   ├── types.ts                # TypeScript interfaces
│   ├── themes/
│   │   ├── midnight.ts         # Default theme
│   │   ├── aurora-glass.ts     # Glassmorphic theme
│   │   ├── linear-minimal.ts   # Minimalist theme
│   │   ├── forest-deep.ts      # Green theme
│   │   └── neon-cyber.ts       # Cyberpunk theme
│   └── utils.ts                # Theme utilities
├── components/
│   └── settings/
│       └── sections/
│           └── ThemeSection.tsx # Theme selector UI
└── assets/
    └── themes.css              # CSS variable definitions
```

---

## Implementation Components

### 1. ThemeContext.tsx

```typescript
// src/renderer/src/contexts/ThemeContext.tsx

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Theme } from '../themes/types';
import { themes, DEFAULT_THEME_ID } from '../themes';
import { applyThemeToDOM } from '../themes/utils';

interface ThemeContextValue {
  currentTheme: Theme;
  themeId: string;
  setTheme: (themeId: string) => void;
  availableThemes: Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'arborchat-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && themes[stored] ? stored : DEFAULT_THEME_ID;
  });

  const currentTheme = themes[themeId] || themes[DEFAULT_THEME_ID];

  const setTheme = useCallback((newThemeId: string) => {
    if (themes[newThemeId]) {
      setThemeId(newThemeId);
      localStorage.setItem(STORAGE_KEY, newThemeId);
    }
  }, []);

  // Apply theme CSS variables whenever theme changes
  useEffect(() => {
    applyThemeToDOM(currentTheme);
  }, [currentTheme]);

  const value: ThemeContextValue = {
    currentTheme,
    themeId,
    setTheme,
    availableThemes: Object.values(themes),
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
```

### 2. Theme Utilities

```typescript
// src/renderer/src/themes/utils.ts

import { Theme } from './types';

/**
 * Apply theme colors and effects as CSS custom properties
 */
export function applyThemeToDOM(theme: Theme): void {
  const root = document.documentElement;
  
  // Apply colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    const cssVar = `--theme-${camelToKebab(key)}`;
    root.style.setProperty(cssVar, value);
  });
  
  // Apply effects
  Object.entries(theme.effects).forEach(([key, value]) => {
    const cssVar = `--theme-${camelToKebab(key)}`;
    root.style.setProperty(cssVar, String(value));
  });
  
  // Set theme ID as data attribute for conditional CSS
  root.setAttribute('data-theme', theme.id);
  
  // Set glass mode attribute
  root.setAttribute('data-glass', String(theme.effects.enableGlass));
}

/**
 * Convert camelCase to kebab-case for CSS variables
 */
function camelToKebab(str: string): string {
  return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/**
 * Generate preview gradient for theme card
 */
export function getThemePreviewColors(theme: Theme): string[] {
  return [
    theme.colors.background,
    theme.colors.primary,
    theme.colors.surface,
  ];
}
```

### 3. ThemeSection.tsx (Settings UI)

```typescript
// src/renderer/src/components/settings/sections/ThemeSection.tsx

import React from 'react';
import { useTheme } from '../../../contexts/ThemeContext';
import { Check, Palette } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function ThemeSection() {
  const { currentTheme, themeId, setTheme, availableThemes } = useTheme();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-normal mb-1">
          Theme
        </h3>
        <p className="text-sm text-text-muted">
          Choose a visual theme for ArborChat
        </p>
      </div>

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
  );
}

function ThemeCard({ 
  theme, 
  isActive, 
  onClick 
}: { 
  theme: Theme; 
  isActive: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-4 rounded-xl text-left transition-all duration-200',
        'border-2',
        isActive
          ? 'border-primary bg-primary/10'
          : 'border-secondary hover:border-primary/50 bg-secondary/50'
      )}
    >
      {/* Theme Preview */}
      <div 
        className="h-20 rounded-lg mb-3 overflow-hidden"
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
      </div>

      {/* Theme Info */}
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-medium text-text-normal">
            {theme.name}
          </h4>
          <p className="text-xs text-text-muted mt-0.5">
            {theme.description}
          </p>
        </div>
        
        {isActive && (
          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
            <Check size={12} className="text-white" />
          </div>
        )}
      </div>

      {/* Glass indicator */}
      {theme.effects.enableGlass && (
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-text-muted">
          Glass
        </div>
      )}
    </button>
  );
}
```

---

## CSS Integration

### Updated Tailwind Config

```javascript
// tailwind.config.js - Theme-aware colors

module.exports = {
  theme: {
    extend: {
      colors: {
        // Map to CSS variables
        background: 'var(--theme-background)',
        'background-soft': 'var(--theme-background-soft)',
        'background-muted': 'var(--theme-background-muted)',
        
        surface: 'var(--theme-surface)',
        'surface-hover': 'var(--theme-surface-hover)',
        'surface-active': 'var(--theme-surface-active)',
        
        border: 'var(--theme-border)',
        'border-subtle': 'var(--theme-border-subtle)',
        'border-focus': 'var(--theme-border-focus)',
        
        'text-primary': 'var(--theme-text-primary)',
        'text-secondary': 'var(--theme-text-secondary)',
        'text-muted': 'var(--theme-text-muted)',
        
        primary: 'var(--theme-primary)',
        'primary-hover': 'var(--theme-primary-hover)',
        'primary-muted': 'var(--theme-primary-muted)',
        
        success: 'var(--theme-success)',
        warning: 'var(--theme-warning)',
        error: 'var(--theme-error)',
        info: 'var(--theme-info)',
      },
      
      boxShadow: {
        'theme-sm': 'var(--theme-shadow-sm)',
        'theme-md': 'var(--theme-shadow-md)',
        'theme-lg': 'var(--theme-shadow-lg)',
        'theme-glow': 'var(--theme-shadow-glow)',
      },
      
      borderRadius: {
        'theme-sm': 'var(--theme-radius-sm)',
        'theme-md': 'var(--theme-radius-md)',
        'theme-lg': 'var(--theme-radius-lg)',
        'theme-xl': 'var(--theme-radius-xl)',
      },
    },
  },
};
```

### Glass Effect Utility Classes

```css
/* src/renderer/src/assets/themes.css */

/* Glass panels - only active when theme has glass enabled */
[data-glass="true"] .glass-panel {
  background: var(--theme-glass);
  backdrop-filter: blur(var(--theme-glass-blur));
  -webkit-backdrop-filter: blur(var(--theme-glass-blur));
  border: 1px solid var(--theme-glass-border);
}

[data-glass="false"] .glass-panel {
  background: var(--theme-surface);
  border: 1px solid var(--theme-border);
}

/* Glow effects for neon theme */
.glow-primary {
  box-shadow: var(--theme-shadow-glow);
}

/* Smooth theme transitions */
:root {
  transition: 
    --theme-background var(--theme-transition-normal),
    --theme-primary var(--theme-transition-normal);
}

* {
  transition: 
    background-color var(--theme-transition-fast),
    border-color var(--theme-transition-fast),
    box-shadow var(--theme-transition-fast);
}
```

---

## Migration Strategy

### Phase 1: Infrastructure (Non-Breaking)
1. Create theme types and interfaces
2. Create ThemeContext and ThemeProvider
3. Create theme definition files
4. Add theme utilities

### Phase 2: CSS Variable Migration
1. Update Tailwind config to use CSS variables
2. Update base.css to include theme variables
3. Create themes.css for glass effects

### Phase 3: Component Updates
1. Wrap App in ThemeProvider
2. Add ThemeSection to Settings
3. Update components to use new color classes where needed

### Phase 4: Testing & Polish
1. Test all themes across all components
2. Verify accessibility contrast ratios
3. Add theme preview animations
4. Performance testing for theme switching

---

## Settings Panel Integration

The theme selector will be added as a new section in the existing Settings panel:

```typescript
// In SettingsPanel.tsx, add to tabs array:
{ id: 'appearance', label: 'Appearance', icon: Palette }

// In settings sections:
{activeTab === 'appearance' && <ThemeSection />}
```

---

## Accessibility Considerations

1. **Contrast Ratios**: All themes must maintain WCAG AA compliance (4.5:1 for text)
2. **Focus Indicators**: Clear focus states using `borderFocus` color
3. **Motion**: Respect `prefers-reduced-motion` for transitions
4. **Color Blindness**: Avoid relying solely on color for meaning

---

## Future Enhancements

1. **Custom Themes**: Allow users to create their own themes
2. **Theme Import/Export**: Share themes as JSON files
3. **Scheduled Themes**: Auto-switch based on time of day
4. **System Theme Sync**: Follow OS light/dark mode preference
5. **Per-Conversation Themes**: Different themes for different contexts

---

## Implementation Checklist

- [x] Create `src/renderer/src/themes/` directory structure
- [x] Define TypeScript interfaces in `types.ts`
- [x] Create all 5 theme definition files
- [x] Implement `ThemeContext.tsx`
- [x] Create theme utility functions
- [x] Update Tailwind configuration (mapped via utils.ts)
- [x] Create `themes.css` for effects
- [x] Implement `ThemeSection.tsx` component (AppearanceSection.tsx)
- [x] Add Appearance tab to Settings
- [x] Wrap App in ThemeProvider
- [x] Test theme switching
- [x] Verify localStorage persistence
- [ ] Accessibility audit
- [ ] Performance testing

### Implementation Notes (Added 2024)

The theme system was implemented with the following architecture:

1. **Theme definitions** in `/src/renderer/src/themes/themes/` - All 5 themes implemented:
   - `midnight.ts` - Classic ArborChat dark theme
   - `aurora-glass.ts` - Glassmorphic design with frosted panels
   - `linear-minimal.ts` - Clean, Linear-inspired minimalist theme
   - `forest-deep.ts` - Warm green tones for eye comfort
   - `neon-cyber.ts` - Bold cyberpunk aesthetic with neon accents

2. **ThemeContext** provides React Context API for theme state management with:
   - `currentTheme` - Active theme object
   - `themeId` - Active theme ID string
   - `setTheme()` - Function to change themes
   - `availableThemes` - Array of all themes

3. **Theme utilities** in `utils.ts`:
   - `applyThemeToDOM()` - Applies CSS variables to document root
   - Maps both `--theme-*` variables (new) and `--color-*` variables (Tailwind v4 compatibility)

4. **Glass effects** handled via `[data-glass]` CSS attribute selector in `themes.css`

5. **Settings integration** via `AppearanceSection.tsx` with visual theme cards
