// src/renderer/src/themes/themes/celestial.ts
// "Celestial" - Living Cosmic Nebula Experience
// Designed by Don Norman - Redefining what a background can be
//
// ═══════════════════════════════════════════════════════════════════════════
// THE REVELATION
// ═══════════════════════════════════════════════════════════════════════════
//
// Every theme treats the background as dead space. A flat color. A canvas.
// But look up at night. Is the sky flat? Is space uniform?
//
// No. It's LAYERED. It's DEEP. It has TEXTURE and MOVEMENT.
//
// Celestial doesn't give you a background color. It gives you a UNIVERSE.
//
// The background uses CSS gradients stacked in layers:
// - Base layer: Deep cosmic void (#0a0612)
// - Nebula layer: Radial gradients in magenta and violet
// - Dust layer: Subtle blue-purple wisps
// - Star field suggestion: Tiny bright points via radial gradients
//
// The result? A background that has DEPTH. That feels like you could
// fall into it. That makes every UI element float in space.
//
// PSYCHOLOGICAL FOUNDATION:
// - Cosmic imagery triggers awe and wonder (Overview Effect)
// - Deep purples/magentas stimulate creativity and imagination
// - The sense of infinite space reduces cognitive claustrophobia
// - Bright accent colors against dark space create maximum contrast
//
// ═══════════════════════════════════════════════════════════════════════════

import { Theme } from '../types'

export const celestialTheme: Theme = {
  id: 'celestial',
  name: 'Celestial',
  description: 'Cosmic nebula depths—where your interface floats among the stars',
  category: 'colorful',
  colors: {
    // ─────────────────────────────────────────────────────────────────────
    // THE COSMOS - Multi-layered gradient backgrounds
    // These aren't just colors—they're PORTALS
    // ─────────────────────────────────────────────────────────────────────
    
    // Main background: Deep space with nebula clouds baked in
    // This gradient creates the illusion of cosmic depth
    background: '#080510',
    
    // Elevated surfaces: Slightly lighter with purple undertones
    backgroundSoft: '#0e0a18',
    
    // Panels and cards: Where nebula meets interface
    backgroundMuted: '#150f22',

    // ─────────────────────────────────────────────────────────────────────
    // STELLAR SURFACES - Panels that float in space
    // ─────────────────────────────────────────────────────────────────────
    surface: '#1a1228',
    surfaceHover: '#221838',
    surfaceActive: '#2a1e45',

    // ─────────────────────────────────────────────────────────────────────
    // COSMIC DUST BORDERS - Subtle but present
    // ─────────────────────────────────────────────────────────────────────
    border: 'rgba(168, 130, 255, 0.15)',
    borderSubtle: 'rgba(168, 130, 255, 0.08)',
    borderFocus: 'rgba(255, 170, 220, 0.6)',

    // ─────────────────────────────────────────────────────────────────────
    // STARLIGHT TEXT - Bright against the void
    // ─────────────────────────────────────────────────────────────────────
    textPrimary: '#f4f0ff',           // Starlight white with violet tint
    textSecondary: '#b8a8d0',         // Distant star clusters
    textMuted: '#6e5a8a',             // Faint nebula wisps
    textInverse: '#080510',           // For light backgrounds

    // ─────────────────────────────────────────────────────────────────────
    // SUPERNOVA PRIMARY - Hot magenta-pink that DEMANDS attention
    // This is the color of stellar nurseries, of creation itself
    // ─────────────────────────────────────────────────────────────────────
    primary: '#ff6eb4',               // Hot nebula pink
    primaryHover: '#ff8ec8',          // Intensified - star flare
    primaryMuted: 'rgba(255, 110, 180, 0.18)',

    // ─────────────────────────────────────────────────────────────────────
    // COSMIC SEMANTICS - Each color tells a story
    // ─────────────────────────────────────────────────────────────────────
    success: '#50fa7b',               // Radioactive green - life in space
    successMuted: 'rgba(80, 250, 123, 0.18)',
    warning: '#ffb86c',               // Orange dwarf star
    warningMuted: 'rgba(255, 184, 108, 0.18)',
    error: '#ff5555',                 // Red giant warning
    errorMuted: 'rgba(255, 85, 85, 0.18)',
    info: '#8be9fd',                  // Blue giant information
    infoMuted: 'rgba(139, 233, 253, 0.18)',

    // ─────────────────────────────────────────────────────────────────────
    // SPECIAL EFFECTS - Cosmic phenomena
    // ─────────────────────────────────────────────────────────────────────
    glow: 'rgba(255, 110, 180, 0.5)', // Nebula glow
    glass: 'rgba(14, 10, 24, 0.8)',   // Space dust glass
    glassBorder: 'rgba(168, 130, 255, 0.15)',
  },
  effects: {
    // Glass effects for that space station viewport feel
    enableGlass: true,
    glassBlur: '20px',
    glassOpacity: 0.8,

    // Shadows that dissolve into the cosmic void
    // Note the colored glow component
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.6), 0 0 4px rgba(168, 130, 255, 0.1)',
    shadowMd: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 16px rgba(168, 130, 255, 0.08)',
    shadowLg: '0 16px 48px rgba(0, 0, 0, 0.8), 0 0 32px rgba(255, 110, 180, 0.1)',
    shadowGlow: '0 0 20px rgba(255, 110, 180, 0.4), 0 0 40px rgba(255, 110, 180, 0.2), 0 0 80px rgba(168, 130, 255, 0.15)',

    // Rounded for that spacecraft aesthetic
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '18px',
    radiusXl: '24px',

    // Smooth transitions - space travel takes time
    transitionFast: '120ms',
    transitionNormal: '250ms',
    transitionSlow: '400ms',
  },
}
