# Agentic Memory System - Continuation Prompt (Session 2)

## Session Context

You are continuing implementation of the Agentic Memory System for ArborChat. The core services are complete and the main process compiles cleanly. The remaining work is fixing renderer-side type declarations and integrating playbook context into agent spawning.

## What Was Completed in Previous Sessions

### Files Created (All Complete)

**Type Definitions:**
- `src/shared/types/playbook.ts` - Playbook entry types, interfaces, service interface
- `src/shared/types/review.ts` - Review Agent types, configuration, DEFAULT_REVIEW_CONFIG
- `src/shared/types/index.ts` - Already exports playbook and review types ✅

**Main Process Services:**
- `src/main/services/PlaybookService.ts` - Complete playbook storage, retrieval, deduplication, scoring
- `src/main/services/ReviewAgentService.ts` - Automated session evaluation (Sentinel pattern)
- `src/main/services/CuratorService.ts` - Processes reviews into playbook entries
- `src/main/services/ReflectorService.ts` - Orchestrates the learning loop
- `src/main/services/ReviewAgentAdapter.ts` - Bridges ReviewAgent to Gemini provider
- `src/main/services/index.ts` - Exports all new services ✅

**IPC & Preload:**
- `src/main/playbook/handlers.ts` - IPC handlers for all playbook operations ✅
- `src/main/playbook/index.ts` - Module barrel export ✅
- `src/preload/playbook.ts` - Preload API for renderer access ✅
- `src/preload/index.ts` - Already imports and exposes playbookApi ✅
- `src/main/index.ts` - Already registers playbook handlers ✅

**Renderer Components:**
- `src/renderer/src/hooks/usePlaybook.ts` - React hook for playbook access
- `src/renderer/src/components/agent/SessionFeedback.tsx` - User feedback UI component

### TypeScript Fixes Applied This Session

1. ✅ Removed unused `getReflectorService` import from `handlers.ts`
2. ✅ Removed unused `PlaybookEntryType` import from `CuratorService.ts`
3. ✅ Fixed `userFeedback` null vs undefined type issue in `ReflectorService.ts` (used `?? undefined`)
4. ✅ Fixed unused `workingDirectory` parameter in `ReviewAgentService.ts` (prefixed with underscore)

### Current Compilation Status

**Main process (typecheck:node):** ✅ CLEAN

**Renderer process (typecheck:web):** ❌ Errors remain

## What Needs To Be Done

### 1. Add Playbook Types to Preload Declaration File

The file `src/preload/index.d.ts` needs to be updated to include:

1. **Playbook type definitions** (copy from `src/shared/types/playbook.ts`):
   - PlaybookEntry
   - PlaybookEntryType  
   - PlaybookCategory
   - NewPlaybookEntry
   - GetPlaybookOptions
   - PlaybookStats
   - FormattedPlaybook

2. **Learning stats type** (from `src/shared/types/review.ts`):
   - LearningStats

3. **PlaybookAPI interface** matching `src/preload/playbook.ts`:
```typescript
interface PlaybookAPI {
  // Entry operations
  getEntries: (options?: GetPlaybookOptions) => Promise<PlaybookEntry[]>
  getRelevant: (workingDirectory?: string, limit?: number) => Promise<PlaybookEntry[]>
  formatForContext: (entries: PlaybookEntry[]) => Promise<FormattedPlaybook>
  generateContext: (workingDirectory?: string, maxTokens?: number) => Promise<string>
  addEntry: (entry: NewPlaybookEntry) => Promise<PlaybookEntry>
  updateScore: (entryId: string, helpful: boolean) => Promise<void>
  getStats: () => Promise<PlaybookStats>
  seed: () => Promise<void>
  
  // Learning system
  submitFeedback: (sessionId: string, rating: 'helpful' | 'unhelpful', comment?: string) => Promise<void>
  getLearningStats: () => Promise<LearningStats>
  triggerReflection: (sessionId: string) => Promise<void>
  runMaintenance: () => Promise<void>
}
```

4. **Add to window.api interface:**
```typescript
playbook: PlaybookAPI
```

5. **Export types at bottom of file:**
```typescript
export type {
  // ... existing exports ...
  PlaybookEntry,
  PlaybookEntryType,
  PlaybookCategory,
  NewPlaybookEntry,
  GetPlaybookOptions,
  PlaybookStats,
  FormattedPlaybook,
  LearningStats,
  PlaybookAPI
}
```

### 2. Fix usePlaybook.ts Import Paths

The file `src/renderer/src/hooks/usePlaybook.ts` has incorrect import paths:
```typescript
// WRONG - shared types not accessible from renderer via relative path
import type { PlaybookEntry, ... } from '../../shared/types/playbook'
import type { LearningStats } from '../../shared/types/review'
```

Should import from preload types instead:
```typescript
// CORRECT - use preload type exports
import type { 
  PlaybookEntry, 
  PlaybookEntryType, 
  PlaybookStats, 
  FormattedPlaybook, 
  NewPlaybookEntry,
  GetPlaybookOptions,
  LearningStats 
} from '../../../preload/index.d'
```

### 3. Integrate Playbook Context into Agent Spawn

After types compile clean, integrate playbook into agent lifecycle:

**In `src/renderer/src/contexts/AgentContext.tsx`:**

Find the agent spawn logic (around line 671 based on error) and inject playbook context:

```typescript
// When building agent system prompt, add playbook context
const playbookContext = await window.api.playbook.generateContext(workingDirectory, 2000)

// Inject into system prompt before agent runs
const enhancedSystemPrompt = `${baseSystemPrompt}

${playbookContext}`
```

### 4. Test the Complete Flow

1. Run `npm run typecheck` to verify compilation
2. Run `npm run dev` to start the app
3. Test playbook seeding: Call `window.api.playbook.seed()` from devtools
4. Verify entries created: Call `window.api.playbook.getStats()`
5. Run an agent session
6. Check if reflection triggers on completion
7. Verify new playbook entries are created from lessons

## Architecture Reference

```
Agent Session → Work Journal → Review Agent (Sentinel)
                                      ↓
                               Curator Service
                                      ↓
                               Playbook Store
                                      ↓
                              Next Agent Spawn
                           (playbook injected)
```

## Key Files to Reference

- `src/preload/index.d.ts` - **NEEDS UPDATES** - Type declarations for window.api
- `src/preload/playbook.ts` - Preload API implementation (reference for types)
- `src/shared/types/playbook.ts` - Source type definitions
- `src/shared/types/review.ts` - Review/Learning types
- `src/renderer/src/hooks/usePlaybook.ts` - **NEEDS IMPORT FIX**
- `src/renderer/src/contexts/AgentContext.tsx` - **NEEDS INTEGRATION**

## Commands

```bash
# Check types (run after each fix to verify progress)
npm run typecheck

# Run dev to test
npm run dev

# Check database for playbook entries
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db "SELECT * FROM playbook_entries LIMIT 5;"
```

## RAG Query for Context

```bash
ssh -i ~/.ssh/swarm_key root@134.199.235.140 "curl -s -X POST http://localhost:8082/api/rag/search -H 'Content-Type: application/json' -d '{\"query\": \"YOUR_QUERY\", \"repository\": \"ArborChat\", \"top_k\": 10}'"
```

Useful queries:
- "AgentContext spawn agent system prompt"
- "usePlaybook hook window.api"
- "preload index.d.ts window api type"
