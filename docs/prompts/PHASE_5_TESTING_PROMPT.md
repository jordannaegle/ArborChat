# ArborChat Tool Window Enhancement - Phase 5 Prompt

## Project Context
Working on ArborChat at `/Users/cory.naegle/ArborChat`

**Feature:** Tool Window Enhancement (Claude Desktop style)
**Design Doc:** `/Users/cory.naegle/ArborChat/docs/designs/TOOL_WINDOW_ENHANCEMENT_DESIGN.md`

## Previous Work Completed

### Phase 4 ✅ Settings Integration
- `SettingsContext.tsx` with `enhancedToolDisplay: boolean` setting
- `AppearanceSection.tsx` toggle in Settings → Appearance
- `ChatWindow.tsx` uses `useEnhancedToolDisplay` for timeline rendering
- `AgentPanel.tsx` uses `useEnhancedToolDisplay` for tool display
- `AgentStepTimeline.tsx` fully implemented with conditional rendering
- All typechecks pass

### Accessibility Components (Already Implemented)
The following accessibility features from the design doc are already in place:

| Component | Location | Status |
|-----------|----------|--------|
| `useStepKeyboardNav` | `/src/renderer/src/hooks/useStepKeyboardNav.ts` | ✅ Complete |
| `useReducedMotion` | `/src/renderer/src/hooks/useReducedMotion.ts` | ✅ Complete |
| `StepAnnouncer` | `/src/renderer/src/components/mcp/StepAnnouncer.tsx` | ✅ Complete |
| `AccessibleStepGroup` | `/src/renderer/src/components/mcp/AccessibleStepGroup.tsx` | ✅ Complete |
| `VirtualizedStepList` | `/src/renderer/src/components/mcp/VirtualizedStepList.tsx` | ✅ Complete |
| `ToolStepGroup` | `/src/renderer/src/components/mcp/ToolStepGroup.tsx` | ✅ Accessibility integrated |
| `InlineToolCallV2` | `/src/renderer/src/components/mcp/InlineToolCallV2.tsx` | ✅ Accessibility integrated |

---

## Phase 5: Testing, Verification & Documentation

### Task 5.1: Typecheck Verification
```bash
cd /Users/cory.naegle/ArborChat && npm run typecheck
```
Confirm all types pass before proceeding.

### Task 5.2: Functional Testing Matrix

#### 5.2.1 Settings Toggle Tests
| Test | Expected Result |
|------|-----------------|
| Open Settings → Appearance | Toggle for "Enhanced Tool Display" visible |
| Toggle ON → OFF | Immediate UI feedback (green → gray) |
| Toggle OFF → ON | Immediate UI feedback (gray → green) |
| Refresh app | Setting persists (check localStorage `arborchat:settings`) |

#### 5.2.2 ChatWindow Enhanced Mode Tests
With **enhancedToolDisplay: true**:
| Test | Expected Result |
|------|-----------------|
| Trigger single tool call | Renders inside `ToolStepGroup` |
| Trigger multiple tool calls | All grouped with master toggle |
| Click master toggle | Collapses/expands all steps |
| Click individual step | Accordion expands (others collapse) |
| Pending tool approval | Shows inline with Approve/Reject buttons |

#### 5.2.3 ChatWindow Legacy Mode Tests
With **enhancedToolDisplay: false**:
| Test | Expected Result |
|------|-----------------|
| Trigger tool call | Renders as individual `InlineToolCall` card |
| Multiple tool calls | Each renders separately |
| No master toggle | No grouping header visible |

#### 5.2.4 AgentPanel Tests
| Test | Expected Result |
|------|-----------------|
| Launch agent with tools | Timeline uses correct display mode |
| Toggle setting mid-session | Display updates reactively |
| Pending approval in agent | Shows correct approval UI |

### Task 5.3: Keyboard Navigation Testing

Test these keyboard interactions in `ToolStepGroup`:

| Key | Action |
|-----|--------|
| `Tab` | Move focus into step group |
| `↑` / `↓` | Navigate between steps |
| `Enter` / `Space` | Expand/collapse focused step |
| `Escape` | Collapse current step, then collapse group |
| `Home` | Jump to first step |
| `End` | Jump to last step |

Verify:
- [ ] Focus ring visible on focused step
- [ ] Only one step expanded at a time (accordion behavior)
- [ ] Roving tabindex works (only focused item has tabIndex=0)

### Task 5.4: Screen Reader Testing (Manual)

Test with VoiceOver (macOS) or NVDA (Windows):
- [ ] Group announces "Tool execution steps (N steps)"
- [ ] Status changes announced ("Tool X completed successfully")
- [ ] Expansion state announced ("Expanded/Collapsed")
- [ ] Focus announcements include step position ("Step 2 of 5")

### Task 5.5: Reduced Motion Testing

1. Enable reduced motion in System Preferences
2. Verify:
   - [ ] No CSS transitions on expand/collapse
   - [ ] No stagger animations on step reveal
   - [ ] Scroll behavior uses `auto` instead of `smooth`

### Task 5.6: Performance Testing (Optional)

For conversations with 20+ tool calls:
- [ ] `VirtualizedStepList` activates automatically
- [ ] Scrolling remains smooth
- [ ] Memory usage stable during long sessions

---

## Task 5.7: Documentation Updates

Update the design document with implementation status:

```markdown
## Implementation Status

### Completed
- [x] Phase 1: Core Components (ToolStepGroup, ToolStepItem, InlineToolCallV2)
- [x] Phase 2: ChatWindow Integration
- [x] Phase 3: AgentPanel Integration
- [x] Phase 4: Settings Integration
- [x] Phase 5: Accessibility (keyboard nav, screen reader, reduced motion)
- [x] Phase 6: Performance (virtualization)

### Success Metrics Achieved
| Metric | Target | Actual |
|--------|--------|--------|
| Visual match to Claude Desktop | >90% | ✅ |
| Accordion toggle responsiveness | <100ms | ✅ |
| Keyboard navigation | WCAG 2.1 AA | ✅ |
| Reduced motion support | Full | ✅ |
```

---

## Success Criteria Checklist

- [ ] `npm run typecheck` passes
- [ ] All functional tests pass (Settings, ChatWindow, AgentPanel)
- [ ] Keyboard navigation works per spec
- [ ] Screen reader announces correctly
- [ ] Reduced motion respected
- [ ] Design document updated with implementation status

---

## Instructions

1. Run typecheck verification
2. Perform functional testing matrix (manual)
3. Test keyboard navigation
4. (Optional) Test with screen reader
5. (Optional) Test reduced motion
6. Update design document
7. Report results

## Alex Chen Persona
Located at `/Users/cory.naegle/ArborChat/ARCHITECT_PERSONA.md`

---

## Known Issues to Verify

1. **AgentStepTimeline groupId uniqueness**: Uses `Date.now()` which may cause issues if rendered rapidly. Consider using a counter or UUID.

2. **ThoughtProcessSection/ToolStepItem accessibility**: Verify these components also have `isFocused` and `tabIndex` props like `InlineToolCallV2`.

3. **Barrel export updates**: Ensure `index.ts` exports all new components:
   - `AccessibleStepGroup`
   - `StepAnnouncer`
   - `VirtualizedStepList`
