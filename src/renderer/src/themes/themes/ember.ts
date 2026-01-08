// src/renderer/src/themes/themes/ember.ts
// "Ember" - Volcanic Magma Fissure Experience
// Designed by Don Norman - Where fire meets interface
//
// ═══════════════════════════════════════════════════════════════════════════
// THE PRIMAL FIRE
// ═══════════════════════════════════════════════════════════════════════════
//
// Deep beneath the Earth's crust, rock becomes liquid. Pressure builds.
// And through the cracks, we see the glow of creation itself.
//
// Ember isn't just a dark theme with orange accents. It's a window into
// the volcanic heart of the planet. The background appears CRACKED,
// with molten light bleeding through from below.
//
// This taps into something ancient in our psychology:
// - Fire = survival, warmth, protection
// - Volcanic imagery = raw power, transformation, creation
// - The contrast of cool dark and hot bright = maximum visual impact
//
// The deep charcoal surfaces are the cooled crust. The orange-red accents
// are the magma showing through. Every interaction feels like you're
// disturbing the surface, letting more heat escape.
//
// PSYCHOLOGICAL FOUNDATION:
// - Fire colors increase arousal, energy, and engagement
// - Dark backgrounds with bright accents create focus
// - Volcanic imagery suggests power and transformation
// - The warmth counters the clinical feel of most dark themes
//
// ═══════════════════════════════════════════════════════════════════════════

import { Theme } from '../types'

export const emberTheme: Theme = {
  id: 'ember',
  name: 'Ember',
  description: 'Volcanic depths—where molten fire bleeds through the dark',
  category: 'dark',
  colors: {
    // ─────────────────────────────────────────────────────────────────────
    // THE CRUST - Cooled volcanic rock, deep and heavy
    // ─────────────────────────────────────────────────────────────────────
    background: '#0d0a09',           // Obsidian black with warm undertone
    backgroundSoft: '#141110',       // Slightly elevated basalt
    backgroundMuted: '#1a1614',      // Cooled lava rock

    // ─────────────────────────────────────────────────────────────────────
    // VOLCANIC SURFACES - Where heat still radiates
    // ─────────────────────────────────────────────────────────────────────
    surface: '#201a17',              // Warm volcanic stone
    surfaceHover: '#2a2220',         // Heat rising
    surfaceActive: '#352b28',        // Disturbed surface

    // ─────────────────────────────────────────────────────────────────────
    // MAGMA FISSURES - Borders that glow with heat
    // ─────────────────────────────────────────────────────────────────────
    border: 'rgba(255, 107, 53, 0.15)',
    borderSubtle: 'rgba(255, 107, 53, 0.08)',
    borderFocus: 'rgba(255, 147, 41, 0.6)',

    // ─────────────────────────────────────────────────────────────────────
    // ASH AND FLAME - Text that glows against the dark
    // ─────────────────────────────────────────────────────────────────────
    textPrimary: '#faf5f0',          // Pale ash white
    textSecondary: '#bfaa98',        // Cooled stone
    textMuted: '#756358',            // Deep shadow
    textInverse: '#0d0a09',          // For light backgrounds

    // ─────────────────────────────────────────────────────────────────────
    // THE CORE - Molten primary that BURNS
    // This is the color of magma at 1000°C - where rock becomes light
    // ─────────────────────────────────────────────────────────────────────
    primary: '#ff6b35',              // Molten orange - the heart of fire
    primaryHover: '#ff8c5a',         // Intensified - fresh lava flow
    primaryMuted: 'rgba(255, 107, 53, 0.18)',

    // ─────────────────────────────────────────────────────────────────────
    // VOLCANIC SEMANTICS - Fire-forged meanings
    // ─────────────────────────────────────────────────────────────────────
    success: '#7cb342',              // Life finding a way (volcanic soil)
    successMuted: 'rgba(124, 179, 66, 0.18)',
    warning: '#ffb300',              // Bright flame warning
    warningMuted: 'rgba(255, 179, 0, 0.18)',
    error: '#ff4444',                // Red hot danger
    errorMuted: 'rgba(255, 68, 68, 0.18)',
    info: '#5c9eff',                 // Cool contrast - water meeting fire
    infoMuted: 'rgba(92, 158, 255, 0.18)',

    // ─────────────────────────────────────────────────────────────────────
    // THERMAL EFFECTS
    // ─────────────────────────────────────────────────────────────────────
    glow: 'rgba(255, 107, 53, 0.5)', // Magma glow
    glass: 'rgba(20, 17, 16, 0.85)', // Volcanic glass (obsidian)
    glassBorder: 'rgba(255, 107, 53, 0.12)',
    logoBackground: '#ff6b35',       // Molten orange
    logoForeground: '#ffffff',
  },
  effects: {
    // Obsidian glass effect
    enableGlass: true,
    glassBlur: '16px',
    glassOpacity: 0.85,

    // Shadows with ember glow
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.6), 0 0 4px rgba(255, 107, 53, 0.08)',
    shadowMd: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 12px rgba(255, 107, 53, 0.1)',
    shadowLg: '0 16px 48px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 107, 53, 0.12)',
    shadowGlow: '0 0 20px rgba(255, 107, 53, 0.5), 0 0 40px rgba(255, 107, 53, 0.25), 0 0 60px rgba(255, 68, 68, 0.15)',

    // Slightly rougher edges - volcanic rock isn't perfectly smooth
    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '20px',

    // Quick, energetic transitions - fire moves fast
    transitionFast: '100ms',
    transitionNormal: '200ms',
    transitionSlow: '350ms',
  },
}
