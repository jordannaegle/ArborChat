# Phase 6: Tool Window Enhancement - Polish & Accessibility

**Project:** ArborChat (`/Users/cory.naegle/ArborChat`)  
**Persona:** Alex Chen - Distinguished Software Architect  
**Design Reference:** `/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`
**Previous Phase:** Phase 5 (Foundation, Components, Integration)

---

## Context

Phase 5 established the core tool step display system with `ToolStepGroup`, accordion behavior, and integration into both `ChatWindow` and `AgentStepTimeline`. Phase 6 focuses on polish, accessibility, performance optimization, and real-time thinking extraction for a production-ready experience.

## Goals

1. **Keyboard Navigation**: Full keyboard support for step navigation and expansion
2. **Accessibility Compliance**: WCAG 2.1 AA compliance with proper ARIA attributes
3. **Performance Optimization**: Virtualization for conversations with many tool calls
4. **Real-time Thinking Extraction**: Extract thinking patterns during streaming
5. **Animation Polish**: Reduced motion support and smooth transitions
6. **Focus Management**: Proper focus handling during accordion interactions

---

## Implementation Phases

### Phase 6.1: Keyboard Navigation System

#### 1. Create `useStepKeyboardNav.ts` Hook

Location: `/src/renderer/src/hooks/useStepKeyboardNav.ts`

```typescript
interface UseStepKeyboardNavOptions {
  stepIds: string[]
  expandedId: string | null
  onExpandStep: (id: string | null) => void
  onFocusStep: (id: string) => void
  containerRef: React.RefObject<HTMLElement>
}

interface UseStepKeyboardNavReturn {
  focusedStepId: string | null
  handleKeyDown: (e: React.KeyboardEvent) => void
  setFocusedStep: (id: string | null) => void
}
```

**Keyboard mappings:**
- `ArrowUp` / `ArrowDown`: Navigate between steps
- `Enter` / `Space`: Toggle expansion of focused step
- `Escape`: Collapse current step, then collapse group
- `Home` / `End`: Jump to first/last step
- `Tab`: Move focus to next interactive element

#### 2. Update `ToolStepGroup.tsx` with Keyboard Support

Add keyboard navigation wrapper:

```tsx
export function ToolStepGroup({ ... }: ToolStepGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stepIds = useMemo(() => steps.map(s => s.id), [steps])
  
  const { focusedStepId, handleKeyDown, setFocusedStep } = useStepKeyboardNav({
    stepIds,
    expandedId: expandedStepId,
    onExpandStep: toggleStep,
    onFocusStep: (id) => { /* scroll into view */ },
    containerRef
  })

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Tool execution steps"
      onKeyDown={handleKeyDown}
    >
      {/* ... */}
    </div>
  )
}
```

#### 3. Update `ToolStepItem.tsx` Focus States

Add visual focus indicators:

```tsx
<div
  role="button"
  tabIndex={isFocused ? 0 : -1}
  aria-expanded={isExpanded}
  className={cn(
    // ... existing classes
    isFocused && 'ring-2 ring-primary/50 ring-offset-1 ring-offset-background'
  )}
>
```

---

### Phase 6.2: Accessibility Enhancements

#### 4. Create `AccessibleStepGroup.tsx` Wrapper

Higher-order component for accessibility:

```typescript
interface AccessibleStepGroupProps {
  groupLabel: string
  stepCount: number
  children: React.ReactNode
}
```

Features:
- Live region announcements for step changes
- Screen reader descriptions for tool status
- Proper heading hierarchy

#### 5. Add ARIA Live Regions

Create `/src/renderer/src/components/mcp/StepAnnouncer.tsx`:

```tsx
export function StepAnnouncer({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  )
}
```

#### 6. Update Status Announcements

When tool status changes:
- "Tool read_file pending approval"
- "Tool read_file approved, executing"
- "Tool read_file completed successfully"
- "Tool read_file failed: [error summary]"

---

### Phase 6.3: Performance Optimization

#### 7. Create `VirtualizedStepList.tsx`

For conversations with 20+ tool calls, implement windowed rendering:

Location: `/src/renderer/src/components/mcp/VirtualizedStepList.tsx`

```typescript
interface VirtualizedStepListProps {
  steps: ToolStep[]
  itemHeight: number // Estimated height per collapsed step
  overscan?: number  // Extra items to render above/below viewport
  onApprove?: ToolApprovalCallbacks['onApprove']
  onAlwaysApprove?: ToolApprovalCallbacks['onAlwaysApprove']
  onReject?: ToolApprovalCallbacks['onReject']
}
```

**Implementation approach:**
- Use `react-virtual` or custom intersection observer
- Dynamic height adjustment when steps expand
- Maintain scroll position during updates

#### 8. Add Step Memoization

Ensure proper memoization in step components:

```tsx
// In ToolStepItem.tsx
export const ToolStepItem = memo(function ToolStepItem({ ... }) {
  // ...
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-renders
  return (
    prevProps.step.id === nextProps.step.id &&
    prevProps.step.toolCall?.status === nextProps.step.toolCall?.status &&
    prevProps.isExpanded === nextProps.isExpanded &&
    prevProps.isFocused === nextProps.isFocused
  )
})
```

#### 9. Lazy Load Expanded Content

Defer rendering of expanded content until needed:

```tsx
const ExpandedContent = lazy(() => import('./ToolExpandedContent'))

// In ToolStepItem
{isExpanded && (
  <Suspense fallback={<div className="h-20 animate-pulse bg-secondary/30" />}>
    <ExpandedContent step={step} />
  </Suspense>
)}
```

---

### Phase 6.4: Real-time Thinking Extraction

#### 10. Create `useStreamingStepExtractor.ts` Hook

Extract thinking patterns from streaming assistant messages:

```typescript
interface UseStreamingStepExtractorOptions {
  streamingContent: string
  isStreaming: boolean
  onThinkingDetected: (content: string) => void
  onVerificationDetected: (content: string) => void
}

export function useStreamingStepExtractor(options: UseStreamingStepExtractorOptions) {
  // Debounced pattern matching on streaming content
  // Emit thinking/verification steps as they're detected
}
```

#### 11. Update `ChatWindow.tsx` for Streaming Extraction

Integrate streaming step extraction:

```tsx
const { thinkingSteps, verificationSteps } = useStreamingStepExtractor({
  streamingContent: lastMessage?.content || '',
  isStreaming: isLastMessageStreaming,
  onThinkingDetected: (content) => {
    // Add to current step group
  },
  onVerificationDetected: (content) => {
    // Add to current step group
  }
})
```

---

### Phase 6.5: Animation Polish

#### 12. Add Reduced Motion Support

Create `/src/renderer/src/hooks/useReducedMotion.ts`:

```typescript
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mql.matches)
    
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return prefersReducedMotion
}
```

#### 13. Update Animation Classes

In all step components:

```tsx
const prefersReducedMotion = useReducedMotion()

const expandAnimation = cn(
  'grid',
  !prefersReducedMotion && 'transition-all duration-200 ease-out',
  isExpanded 
    ? 'grid-rows-[1fr] opacity-100' 
    : 'grid-rows-[0fr] opacity-0'
)
```

#### 14. Add Stagger Animation for Group Reveal

When master toggle reveals steps:

```tsx
// In ToolStepGroup content area
{steps.map((step, index) => (
  <div
    key={step.id}
    style={{
      animationDelay: prefersReducedMotion ? '0ms' : `${index * 30}ms`
    }}
    className={cn(
      'animate-in fade-in slide-in-from-left-2',
      prefersReducedMotion && 'animate-none'
    )}
  >
    {/* step content */}
  </div>
))}
```

---

### Phase 6.6: Focus Management

#### 15. Create `useFocusTrap.ts` Hook

For modal-like behavior when editing tool args:

```typescript
export function useFocusTrap(isActive: boolean, containerRef: React.RefObject<HTMLElement>) {
  // Trap focus within container when active
  // Return focus to trigger element on deactivate
}
```

#### 16. Implement Focus Restoration

When a step collapses, return focus appropriately:

```tsx
const handleToggleExpand = useCallback(() => {
  const wasExpanded = isExpanded
  onToggleExpand()
  
  if (wasExpanded) {
    // Return focus to the step header
    headerRef.current?.focus()
  }
}, [isExpanded, onToggleExpand])
```

---

## File Structure Updates

```
src/renderer/src/
├── components/mcp/
│   ├── AccessibleStepGroup.tsx   # NEW: A11y wrapper
│   ├── StepAnnouncer.tsx         # NEW: Live region
│   ├── VirtualizedStepList.tsx   # NEW: Performance
│   ├── ToolStepGroup.tsx         # UPDATED: Keyboard nav
│   ├── ToolStepItem.tsx          # UPDATED: Focus states
│   ├── InlineToolCallV2.tsx      # UPDATED: A11y
│   └── index.ts                  # UPDATED: New exports
├── hooks/
│   ├── useStepKeyboardNav.ts     # NEW
│   ├── useReducedMotion.ts       # NEW
│   ├── useFocusTrap.ts           # NEW
│   ├── useStreamingStepExtractor.ts # NEW
│   └── index.ts                  # UPDATED
└── lib/
    └── stepExtractor.ts          # UPDATED: Streaming support
```

---

## Implementation Order

1. **Phase 6.1** (Keyboard Navigation):
   - Create `useStepKeyboardNav.ts`
   - Update `ToolStepGroup.tsx`
   - Update `ToolStepItem.tsx`
   - Run `npm run typecheck`

2. **Phase 6.2** (Accessibility):
   - Create `StepAnnouncer.tsx`
   - Create `AccessibleStepGroup.tsx`
   - Add status announcements
   - Run `npm run typecheck`

3. **Phase 6.3** (Performance):
   - Create `VirtualizedStepList.tsx`
   - Add memoization optimizations
   - Implement lazy loading
   - Run `npm run typecheck`

4. **Phase 6.4** (Streaming Extraction):
   - Create `useStreamingStepExtractor.ts`
   - Update `ChatWindow.tsx` integration
   - Run `npm run typecheck`

5. **Phase 6.5** (Animation Polish):
   - Create `useReducedMotion.ts`
   - Update animation classes
   - Add stagger animations
   - Run `npm run typecheck`

6. **Phase 6.6** (Focus Management):
   - Create `useFocusTrap.ts`
   - Implement focus restoration
   - Run `npm run typecheck`

---

## Accessibility Checklist

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigable | Arrow keys, Enter, Escape, Tab |
| Screen reader support | ARIA labels, live regions, role attributes |
| Focus visible | Ring indicators on focused elements |
| Reduced motion | Respects `prefers-reduced-motion` |
| Color contrast | 4.5:1 minimum for text |
| Focus order | Logical tab sequence |

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial render (50 steps) | <100ms | React DevTools Profiler |
| Expand/collapse | <16ms (60fps) | Performance timeline |
| Memory (100 steps) | <10MB | Chrome DevTools Memory |
| Keyboard response | <50ms | Input latency |

---

## Test Scenarios

### Keyboard Navigation
1. Tab to step group → Focus on first step
2. Arrow down → Move to next step
3. Enter → Expand focused step
4. Escape → Collapse step
5. Escape again → Collapse entire group

### Screen Reader
1. Navigate to tool step → Announces tool name and status
2. Expand step → Announces "expanded, showing request and response"
3. Status change → Live announcement of new status

### Performance
1. Load conversation with 50+ tool calls → Smooth scroll
2. Rapid expand/collapse → No jank
3. Streaming with step extraction → Real-time updates

### Reduced Motion
1. Enable reduced motion → No animations
2. Expand/collapse → Instant state change
3. Group reveal → No stagger delay

---

## Commands

```bash
cd /Users/cory.naegle/ArborChat
npm run typecheck     # Verify types after each sub-phase
npm run dev           # Test in dev server
npm run lint          # Check for accessibility issues
```

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Keyboard navigation complete | 100% of interactions |
| WCAG 2.1 AA compliance | Pass all criteria |
| Performance (50 steps) | <100ms render |
| Reduced motion support | Full coverage |
| TypeScript compilation | Zero errors |

---

## Dependencies

Consider adding if not already present:
- `@tanstack/react-virtual` - For virtualization (optional)
- No new dependencies required for core functionality

---

## Notes

- Phase 6 builds on Phase 5's foundation without breaking changes
- All enhancements are additive and backward compatible
- Performance optimizations can be enabled progressively
- Accessibility features should be tested with actual screen readers (VoiceOver on macOS)

---

Enter **Alex Chen mode** and begin implementation with Phase 6.1.
