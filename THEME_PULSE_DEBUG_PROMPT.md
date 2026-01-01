# Theme Background Pulse Animation Debug Prompt

Use this prompt in a new Claude window to investigate why the pulsing background animations aren't working.

---

## PROMPT START

I'm working on ArborChat, an Electron + React + TypeScript application located at `/Users/cory.naegle/ArborChat`.

The **Celestial** and **Ember** themes have animated backgrounds using CSS pseudo-elements on `<html>`. The problem is:

- ✅ **`::after` animations WORK** - Star twinkle (Celestial) and ember float (Ember) are visible
- ❌ **`::before` animations DON'T WORK** - Nebula drift (Celestial) and magma pulse (Ember) are NOT visible

### Current Implementation

Both themes use this pattern on the `<html>` element:

```css
/* This WORKS - twinkling stars visible */
[data-theme="celestial"].celestial-animated::after {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  background: radial-gradient(...);
  animation: star-twinkle 3s ease-in-out infinite;
}

/* This DOESN'T WORK - nebula clouds not visible */
[data-theme="celestial"].celestial-animated::before {
  content: '';
  position: fixed;
  inset: -10%;
  width: 120%;
  height: 120%;
  pointer-events: none;
  z-index: -1;
  background: radial-gradient(...);
  animation: nebula-drift 20s ease-in-out infinite;
}
```

### Key Files

1. **Theme CSS with animations**: `/Users/cory.naegle/ArborChat/src/renderer/src/assets/themes.css`
   - Search for "nebula-drift" around line 585-650
   - Search for "magma-pulse" around line 1010-1070

2. **Theme application logic**: `/Users/cory.naegle/ArborChat/src/renderer/src/themes/utils.ts`

3. **Main CSS**: `/Users/cory.naegle/ArborChat/src/renderer/src/assets/main.css`

4. **Layout component**: `/Users/cory.naegle/ArborChat/src/renderer/src/components/Layout.tsx`

5. **Index HTML**: `/Users/cory.naegle/ArborChat/src/renderer/index.html`

### What We Know

1. The `celestial-animated` and `ember-animated` classes ARE being applied (because `::after` works)
2. The `::after` pseudo-element renders and animates correctly
3. The `::before` pseudo-element either doesn't render or is hidden
4. Both use `position: fixed` and `z-index: -1`

### Differences Between Working and Non-Working

| Property | `::after` (WORKS) | `::before` (BROKEN) |
|----------|-------------------|---------------------|
| `inset` | `0` | `-10%` |
| `width` | (auto from inset) | `120%` |
| `height` | (auto from inset) | `120%` |
| Animation | `star-twinkle` (opacity only) | `nebula-drift` (opacity + transform) |

### Hypotheses to Test

1. **Transform animation issue**: Does `transform` on `::before` of `<html>` cause problems?
2. **Sizing issue**: Does `inset: -10%` with explicit width/height cause issues?
3. **Stacking context**: Is `::before` rendered behind something that `::after` is in front of?
4. **z-index battle**: Both have `z-index: -1` - maybe `::before` needs `-2`?
5. **Pseudo-element order**: In CSS, `::before` comes before `::after` in DOM order - maybe it's being covered?

### Debugging Steps

1. **Check if `::before` renders at all**:
   - Try changing its background to a solid bright color like `background: red !important;`
   - Remove the animation temporarily

2. **Check z-index stacking**:
   - Try `z-index: -2` for `::before`
   - Or try `z-index: 0` for `::after`

3. **Simplify the animation**:
   - Try removing `transform` from `nebula-drift`, keep only `opacity`
   - See if `transform: scale()` is the culprit

4. **Check sizing**:
   - Try `inset: 0` instead of `inset: -10%` with width/height
   - See if the negative inset is causing issues

5. **Inspect in DevTools**:
   - Open Electron DevTools (Cmd+Option+I)
   - Select the `<html>` element
   - Check if `::before` appears in the element tree
   - Verify computed styles are being applied

### Expected Behavior

When Celestial theme is active:
1. Background should show slow-drifting nebula clouds (::before) - 20 second cycle
2. Stars should twinkle (::after) - 3 second cycle

When Ember theme is active:
1. Background should show pulsing magma glow (::before) - 4 second cycle  
2. Ember particles should float (::after) - 5 second cycle

### Quick Fix Option

If pseudo-element approach can't work, consider:
1. Creating a dedicated `<AnimatedBackground />` React component
2. Rendering it as a fixed-position div at the root of Layout
3. Using React state or CSS classes to switch between theme backgrounds

Please investigate and fix the `::before` animations so both the pulsing backgrounds and the particle effects are visible.

## PROMPT END
