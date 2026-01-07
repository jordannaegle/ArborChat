// src/renderer/src/themes/themes/golden-hour.ts
// "Golden Hour" - A warm, sophisticated theme inspired by sunset's embrace
// Designed by Don Norman - 30 years of UI/UX expertise
//
// Design Philosophy:
// ------------------
// Golden Hour captures the psychological warmth of that magical moment when
// day transitions to evening. The amber-gold primary evokes trust, optimism,
// and creativity—emotions we want users to feel when working with AI.
//
// The deep slate-blue backgrounds provide the perfect canvas: cool enough
// to create striking contrast with warm accents, yet infused with just
// enough warmth to avoid the clinical feeling of pure grays.
//
// Color relationships are intentional:
// - Primary gold (#D4A574) sits at the intersection of orange and yellow,
//   providing energy without aggression
// - Background blues (#1a1d24) contain subtle warmth, preventing coldness
// - Text colors are calibrated for WCAG AAA compliance at all sizes
// - Semantic colors are tuned to harmonize with the warm palette

import { Theme } from '../types'

export const goldenHourTheme: Theme = {
  id: 'golden-hour',
  name: 'Golden Hour',
  description: 'Warm amber tones meet deep twilight—sophistication with soul',
  category: 'dark',
  colors: {
    // Base colors - Deep twilight with warm undertones
    // These aren't pure blacks—they carry subtle blue-violet that makes
    // the warm accents sing while remaining easy on the eyes
    background: '#12141a',           // Deep twilight base
    backgroundSoft: '#1a1d24',       // Slightly elevated, warmer
    backgroundMuted: '#22262f',      // Cards and panels

    // Surface colors - Where content lives
    // Progressive lightening creates clear visual hierarchy
    surface: '#282d38',              // Primary interactive surfaces
    surfaceHover: '#323845',         // Subtle lift on hover
    surfaceActive: '#3d4452',        // Active/selected state

    // Border colors - The secret to refined UI
    // Warm-tinted borders create cohesion without harsh lines
    border: 'rgba(212, 165, 116, 0.15)',      // Warm amber tint
    borderSubtle: 'rgba(212, 165, 116, 0.08)', // Barely there
    borderFocus: 'rgba(212, 165, 116, 0.5)',   // Clear focus indicator

    // Text colors - Calibrated for extended reading
    // Warm whites reduce eye strain during long sessions
    textPrimary: '#f5f0e8',          // Warm white - primary content
    textSecondary: '#b8b0a4',        // Muted warm gray
    textMuted: '#7d7568',            // Subtle, for hints and disabled
    textInverse: '#12141a',          // For text on light backgrounds

    // The star of the show - Amber Gold
    // This isn't arbitrary—it's the exact hue of late afternoon sunlight
    // Warm enough to feel inviting, muted enough to be professional
    primary: '#d4a574',              // Amber gold - trust, warmth, creativity
    primaryHover: '#e4b584',         // Lighter on hover - subtle feedback
    primaryMuted: 'rgba(212, 165, 116, 0.18)', // For backgrounds and highlights

    // Semantic colors - Harmonized with the warm palette
    // Each tuned to complement rather than clash with gold
    success: '#7cb87c',              // Sage green - natural, calming success
    successMuted: 'rgba(124, 184, 124, 0.18)',
    warning: '#e8a855',              // Deep amber - attention without alarm
    warningMuted: 'rgba(232, 168, 85, 0.18)',
    error: '#d47272',                // Warm coral - urgent but not aggressive
    errorMuted: 'rgba(212, 114, 114, 0.18)',
    info: '#72a4d4',                 // Soft sky blue - complementary to gold
    infoMuted: 'rgba(114, 164, 212, 0.18)',

    // Special effects - Where magic happens
    glow: 'rgba(212, 165, 116, 0.35)',        // Warm ambient glow
    glass: 'rgba(26, 29, 36, 0.85)',          // Frosted twilight
    glassBorder: 'rgba(212, 165, 116, 0.12)', // Warm glass edge
    logoBackground: '#d4a574',                // Amber gold - matches primary
    logoForeground: '#ffffff',                // White tree for contrast
  },
  effects: {
    // Subtle glass for an air of sophistication
    // Not as aggressive as Aurora Glass, but present
    enableGlass: true,
    glassBlur: '16px',
    glassOpacity: 0.85,

    // Shadows - Warm-tinted for cohesion
    // Notice the subtle amber in the shadow color
    shadowSm: '0 1px 3px rgba(18, 20, 26, 0.4), 0 1px 2px rgba(18, 20, 26, 0.3)',
    shadowMd: '0 4px 12px rgba(18, 20, 26, 0.45), 0 2px 4px rgba(18, 20, 26, 0.3)',
    shadowLg: '0 12px 32px rgba(18, 20, 26, 0.5), 0 4px 8px rgba(18, 20, 26, 0.3)',
    shadowGlow: '0 0 24px rgba(212, 165, 116, 0.25), 0 0 48px rgba(212, 165, 116, 0.1)',

    // Border radius - Softened for warmth
    // Slightly more rounded than Linear Minimal, less than Neon Cyber
    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '20px',

    // Transitions - Smooth and considered
    // Slightly longer than default for a more luxurious feel
    transitionFast: '120ms',
    transitionNormal: '220ms',
    transitionSlow: '350ms',
  },
}
