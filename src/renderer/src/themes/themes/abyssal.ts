// src/renderer/src/themes/themes/abyssal.ts
// "Abyssal" - Bioluminescent Deep Ocean Experience
// Designed by Don Norman - Pushing the boundaries of what a theme can be
//
// ═══════════════════════════════════════════════════════════════════════════
// DESIGN MANIFESTO
// ═══════════════════════════════════════════════════════════════════════════
//
// At 3,000 meters below sea level, there is no sun. The pressure would crush
// a human instantly. And yet—life thrives. Not just survives, but GLOWS.
//
// Bioluminescent creatures have evolved to create their own light in the
// absolute darkness. There's something profoundly moving about this: life
// refusing to accept darkness, creating beauty where none should exist.
//
// This theme captures that defiance. That magic. That impossible beauty.
//
// The deep blue-black backgrounds simulate the crushing depth of the abyss.
// The cyan and magenta accents are the bioluminescent creatures—jellyfish,
// anglerfish, dinoflagellates—creating constellations of living light.
//
// When users work in Abyssal, they're not just using a dark theme.
// They're explorers in the deep. They're witnessing the impossible.
// They're creating light in darkness.
//
// PSYCHOLOGICAL FOUNDATION:
// - Deep blue triggers calm focus and reduces anxiety
// - Cyan bioluminescence creates wonder and engagement  
// - The contrast between void and light mirrors creative process
// - Subtle movement (via CSS) creates a living, breathing interface
//
// ═══════════════════════════════════════════════════════════════════════════

import { Theme } from '../types'

export const abyssalTheme: Theme = {
  id: 'abyssal',
  name: 'Abyssal',
  description: 'Bioluminescent deep-sea wonder—where light defies darkness',
  category: 'dark',
  colors: {
    // ─────────────────────────────────────────────────────────────────────
    // THE DEPTHS - Backgrounds that feel like pressure, like weight, like ocean
    // ─────────────────────────────────────────────────────────────────────
    background: '#050810',           // The absolute deep - almost void
    backgroundSoft: '#0a0f18',       // One layer up - still crushing dark
    backgroundMuted: '#0f1520',      // Where creatures begin to appear

    // ─────────────────────────────────────────────────────────────────────
    // THE WATERS - Surfaces with the subtle blue of deep ocean
    // ─────────────────────────────────────────────────────────────────────
    surface: '#141c28',              // Primary surface - deep water
    surfaceHover: '#1a2535',         // Light penetrating slightly
    surfaceActive: '#202d42',        // Active state - disturbed water

    // ─────────────────────────────────────────────────────────────────────
    // BIOLUMINESCENT EDGES - Borders that glow like deep-sea creatures
    // ─────────────────────────────────────────────────────────────────────
    border: 'rgba(0, 212, 170, 0.12)',        // Faint cyan glow
    borderSubtle: 'rgba(0, 212, 170, 0.06)',  // Barely perceptible
    borderFocus: 'rgba(0, 212, 170, 0.5)',    // Full bioluminescence on focus

    // ─────────────────────────────────────────────────────────────────────
    // LIGHT IN THE VOID - Text colors that feel ethereal
    // ─────────────────────────────────────────────────────────────────────
    textPrimary: '#e8f4f8',          // Cool white with ocean tint
    textSecondary: '#8ba4b4',        // Muted sea glass
    textMuted: '#546878',            // Deep water hints
    textInverse: '#050810',          // For light backgrounds

    // ─────────────────────────────────────────────────────────────────────
    // THE CREATURES - Primary bioluminescent cyan
    // This is the color of dinoflagellates, of jellyfish, of LIFE
    // ─────────────────────────────────────────────────────────────────────
    primary: '#00d4aa',              // Bioluminescent cyan-green
    primaryHover: '#00f5c4',         // Intensified - creature disturbed
    primaryMuted: 'rgba(0, 212, 170, 0.15)', // Distant glow

    // ─────────────────────────────────────────────────────────────────────
    // SEMANTIC COLORS - Each tuned to feel underwater
    // ─────────────────────────────────────────────────────────────────────
    success: '#00d4aa',              // Same as primary - life IS success here
    successMuted: 'rgba(0, 212, 170, 0.15)',
    warning: '#f0b429',              // Anglerfish lure - dangerous attraction
    warningMuted: 'rgba(240, 180, 41, 0.15)',
    error: '#ff6b8a',                // Deep sea coral - urgent but beautiful
    errorMuted: 'rgba(255, 107, 138, 0.15)',
    info: '#64b5f6',                 // Lighter water - information rises
    infoMuted: 'rgba(100, 181, 246, 0.15)',

    // ─────────────────────────────────────────────────────────────────────
    // SPECIAL EFFECTS - The magic
    // ─────────────────────────────────────────────────────────────────────
    glow: 'rgba(0, 212, 170, 0.4)',           // Bioluminescent aura
    glass: 'rgba(10, 15, 24, 0.75)',          // Deep water glass
    glassBorder: 'rgba(0, 212, 170, 0.1)',    // Glowing edges
  },
  effects: {
    // Heavy glass for that underwater distortion feeling
    enableGlass: true,
    glassBlur: '24px',               // Strong blur - looking through water
    glassOpacity: 0.75,

    // Shadows that feel like they're dissolving into the deep
    shadowSm: '0 2px 8px rgba(0, 0, 0, 0.5), 0 0 4px rgba(0, 212, 170, 0.05)',
    shadowMd: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 212, 170, 0.08)',
    shadowLg: '0 16px 48px rgba(0, 0, 0, 0.7), 0 0 24px rgba(0, 212, 170, 0.1)',
    shadowGlow: '0 0 30px rgba(0, 212, 170, 0.35), 0 0 60px rgba(0, 212, 170, 0.15), 0 0 90px rgba(0, 212, 170, 0.05)',

    // Soft, organic radii - nothing harsh survives the deep
    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '18px',
    radiusXl: '28px',

    // Slow, dreamlike transitions - time moves differently down here
    transitionFast: '150ms',
    transitionNormal: '300ms',
    transitionSlow: '500ms',
  },
}
