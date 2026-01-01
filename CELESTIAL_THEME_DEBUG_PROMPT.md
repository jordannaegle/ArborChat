# Celestial Theme Animation Debug Prompt

Use this prompt in a new Claude window to investigate why the Celestial theme animations aren't working.

---

## PROMPT START

I'm working on ArborChat, an Electron + React + TypeScript application located at `/Users/cory.naegle/ArborChat`. 

The **Celestial theme** is supposed to have animated, layered gradient backgrounds with stars and nebula effects, but it's displaying as a flat dark background with no animations.

### What We've Already Tried

1. **Added animation class application** in `/Users/cory.naegle/ArborChat/src/renderer/src/themes/utils.ts`:
   - The CSS requires `[data-theme="celestial"].celestial-animated` for animations
   - We added code to apply `celestial-animated` class to `document.documentElement` when the celestial theme is active

2. **Added transparent wrapper CSS** in `/Users/cory.naegle/ArborChat/src/renderer/src/assets/themes.css`:
   - Added rules to make `.bg-background` transparent for celestial theme so the root gradient shows through

### Key Files to Investigate

1. **Theme definition**: `/Users/cory.naegle/ArborChat/src/renderer/src/themes/themes/celestial.ts`
2. **Theme application logic**: `/Users/cory.naegle/ArborChat/src/renderer/src/themes/utils.ts`
3. **Theme CSS with animations**: `/Users/cory.naegle/ArborChat/src/renderer/src/assets/themes.css` (search for "CELESTIAL THEME" section around line 550-800)
4. **Theme Context**: `/Users/cory.naegle/ArborChat/src/renderer/src/contexts/ThemeContext.tsx`
5. **Layout wrapper**: `/Users/cory.naegle/ArborChat/src/renderer/src/components/Layout.tsx`
6. **Main entry**: `/Users/cory.naegle/ArborChat/src/renderer/src/main.tsx`
7. **Index HTML**: `/Users/cory.naegle/ArborChat/src/renderer/index.html`

### What Should Happen

When Celestial theme is active:
1. `<html>` element should have `data-theme="celestial"` attribute
2. `<html>` element should have `celestial-animated` class
3. The CSS selector `[data-theme="celestial"]` should apply multi-layered radial gradients as background
4. The CSS selector `[data-theme="celestial"].celestial-animated` should apply `nebula-drift` animation
5. Child elements with `bg-background` should be transparent so root gradient shows through

### Debugging Steps Needed

1. **Check if themes.css is being imported** - verify it's in the build chain
2. **Inspect the DOM** - verify `data-theme` and class are being set on `<html>`
3. **Check CSS specificity** - something might be overriding the gradient background
4. **Check if animation keyframes are defined** - `@keyframes nebula-drift` should exist
5. **Verify Tailwind isn't purging the styles** - check Tailwind/Vite config
6. **Check for CSS-in-JS conflicts** - verify no inline styles overriding
7. **Check the index.html** - see if there's a base background set

### Expected CSS Behavior

The celestial background in themes.css should create:
```css
[data-theme="celestial"] {
  background: 
    /* Multiple radial-gradient layers for stars */
    radial-gradient(1px 1px at 20% 30%, rgba(255, 255, 255, 0.8), transparent),
    /* ... more star layers ... */
    /* Nebula clouds */
    radial-gradient(ellipse 80% 50% at 70% 20%, rgba(255, 110, 180, 0.08), transparent 60%),
    /* Deep space base */
    linear-gradient(180deg, #080510 0%, #0a0815 50%, #0d0a1a 100%);
  background-attachment: fixed;
}
```

Please investigate why this isn't rendering and fix it. Use the Don Norman persona (expert UI/UX designer) if helpful.

## PROMPT END
