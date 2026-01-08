# Abyssal Theme Refinement - Continuation Prompt

## Project Context
You are continuing work on ArborChat, a desktop AI chat application at `/Users/cory.naegle/ArborChat`. Use the RAG system for code lookups:

```bash
ssh -i ~/.ssh/swarm_key root@134.199.235.140 "curl -s -X POST http://localhost:8082/api/rag/search -H 'Content-Type: application/json' -d '{\"query\": \"YOUR_SEARCH_QUERY\", \"repository\": \"ArborChat\", \"top_k\": 10}'"
```

## Current Abyssal Theme Implementation

### What's Complete

**1. Base Ocean Background** (`src/renderer/src/assets/themes.css`)
- Multi-layered gradient system on `[data-theme="abyssal"]`
- Marine snow particles (static background)
- Distant bioluminescent glows
- Deep current shimmer effects
- Pressure gradient from surface to void
- Fixed background-attachment for depth parallax
- All CSS animations slowed by 50% (1.5x duration)

**2. Underwater Ripple Animation** (CSS `::before` pseudo-element)
- `underwater-ripple` keyframes: 18s cycle (was 12s)
- `current-drift` keyframes: 30s horizontal flow (was 20s)
- Cyan bioluminescent shimmer layers
- Water caustics via conic-gradient (23s cycle)

**3. Enhanced AbyssalBackground Component** (`src/renderer/src/components/backgrounds/AbyssalBackground.tsx`)
- **Jellyfish (60% smaller, 30% more transparent, 50% slower)**
  - 5 jellyfish with randomized movement
  - Size: 12-32px (was 30-80px)
  - Opacity: 0.28-0.56 (was 0.4-0.8)
  - Pulse cycle: 4500ms (was 3000ms)
  - Depth-based blur for distant jellyfish
  - Multiple hues: cyan, blue, magenta

- **Particle Systems**
  - Plankton: 25 tiny particles (0.5-2px), slow upward drift
  - Debris: 15 particles (1-3px), slow sinking motion
  - Bioluminescent: 8 glowing particles with pulsing opacity

- **Light Rays from Above**
  - 5 god rays with gradient fade
  - Subtle wobble animation
  - Opacity pulsing for atmospheric effect

- **Bubble Streams**
  - 12 bubbles rising with wobble
  - Size reduction and fade as they rise
  - Spawn interval: 3000ms
  - Gradient fill with highlight

- **Bioluminescent Flashes**
  - Random position/timing (4.5-12s intervals)
  - Fade in/out over 1500ms
  - Cyan-blue hue range

- **Depth Fog/Vignette**
  - Radial gradient darkening toward edges
  - Linear gradient darkening at top/bottom
  - Creates depth and focus effect

- **Performance Optimizations**
  - Frame throttling (target 30 FPS)
  - `prefers-reduced-motion` support (static fallback)
  - Efficient state updates with refs
  - Cleanup on theme switch
  - Memoized calculations

**4. Legacy JellyfishBackground** (kept for reference)
- Original component at `src/renderer/src/components/backgrounds/JellyfishBackground.tsx`
- Still exported but no longer used in App.tsx

**5. CSS Animation Timing Updates**
All abyssal CSS animations slowed by 50%:
- `bio-pulse`: 6s (was 4s)
- `abyssal-drift`: 12s (was 8s)
- `caustics`: 23s (was 15s)
- `marine-snow-fall/drift`: 23s/12s (was 15s/8s)
- `jelly-swim-slow`: 9s (was 6s)
- `jelly-swim-fast`: 4.5s (was 3s)
- `bubble-rise`: 18s (was 12s)
- `current-flow`: 15s (was 10s)

### Key Files
- `/src/renderer/src/assets/themes.css` - All CSS animations and base gradients
- `/src/renderer/src/components/backgrounds/AbyssalBackground.tsx` - Enhanced background component
- `/src/renderer/src/components/backgrounds/JellyfishBackground.tsx` - Original (deprecated)
- `/src/renderer/src/components/backgrounds/index.ts` - Barrel exports both components
- `/src/renderer/src/App.tsx` - AbyssalBackground mounted inside ThemeProvider

### Architecture Pattern
The theme animation system uses:
1. Base gradients on `[data-theme="theme-name"]` selector
2. CSS pseudo-elements (`::before`, `::after`) for layered animations
3. React component (AbyssalBackground) for complex interactive elements
4. `THEME_ANIMATION_CLASSES` map in utils.ts to apply animation class
5. Transparent wrapper layers to let backgrounds show through
6. Performance-aware rendering with reduced motion support

---

## Configuration Constants

Located in AbyssalBackground.tsx `CONFIG` object:

```typescript
const CONFIG = {
  // Jellyfish
  JELLYFISH_COUNT: 5,
  JELLYFISH_SIZE_MIN: 12,      // 40% of original
  JELLYFISH_SIZE_MAX: 32,      // 40% of original
  JELLYFISH_OPACITY_MIN: 0.28, // 70% of original
  JELLYFISH_OPACITY_MAX: 0.56, // 70% of original
  JELLYFISH_PULSE_CYCLE: 4500, // 1.5x slower
  
  // Particles
  PLANKTON_COUNT: 25,
  DEBRIS_COUNT: 15,
  BIOLUMINESCENT_COUNT: 8,
  
  // Bubbles
  BUBBLE_COUNT: 12,
  BUBBLE_SPAWN_INTERVAL: 3000,
  
  // Bio flashes
  FLASH_INTERVAL_MIN: 4500,
  FLASH_INTERVAL_MAX: 12000,
  FLASH_DURATION: 1500,
  
  // Light rays
  LIGHT_RAY_COUNT: 5,
  
  // Performance
  TARGET_FPS: 30,
}
```

---

## Potential Future Refinements

### Visual Enhancements
1. **Interactive Elements** - Jellyfish subtle reaction when cursor passes near
2. **More Creature Variety** - Add different deep-sea creatures (anglerfish lure, etc.)
3. **Dynamic Density** - Adjust particle count based on viewport size

### UI Integration
1. **Panel Effects** - Subtle underwater distortion on hover
2. **Button Glow** - Bioluminescent hover states matching theme
3. **Toast Animations** - Bubble-rise animation for toasts
4. **Loading States** - Jellyfish-inspired loading spinner

### Technical Improvements
1. **Canvas Rendering** - Consider WebGL/Canvas2D for even better performance
2. **Adaptive Quality** - Reduce effects on lower-end hardware
3. **Memory Profiling** - Monitor for leaks in long sessions

---

## Commands

**Build and launch:**
```bash
cd /Users/cory.naegle/ArborChat && npm run build && npm run dev
```

**Type check only:**
```bash
cd /Users/cory.naegle/ArborChat && npm run typecheck:web
```

**View theme in action:**
Settings → Appearance → Select "Abyssal"

---

## Last Updated
- **Date:** January 2, 2026
- **Changes:** 
  - Created enhanced AbyssalBackground component with all effects
  - Slowed all animations by 50%
  - Made jellyfish 60% smaller and 30% more transparent
  - Added particle systems (plankton, debris, bioluminescent)
  - Added light rays from above
  - Added bubble streams
  - Added depth fog/vignette
  - Added bioluminescent flashes
  - Implemented performance optimizations (frame throttling, reduced motion support)
