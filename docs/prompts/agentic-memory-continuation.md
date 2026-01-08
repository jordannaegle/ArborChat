# Agentic Memory System - Implementation Continuation Prompt

> **STATUS: PARTIALLY COMPLETE** - See `agentic-memory-continuation-2.md` for current state

## Session Context

You are continuing implementation of the Agentic Memory System for ArborChat. This system enables autonomous learning from agent execution outcomes using a Review Agent (Sentinel) pattern.

## What Was Completed

### Files Created

**Type Definitions:**
- `src/shared/types/playbook.ts` - Playbook entry types, interfaces, service interface
- `src/shared/types/review.ts` - Review Agent types, configuration, DEFAULT_REVIEW_CONFIG

**Main Process Services:**
- `src/main/services/PlaybookService.ts` - Complete playbook storage, retrieval, deduplication, scoring
- `src/main/services/ReviewAgentService.ts` - Automated session evaluation (Sentinel pattern)
- `src/main/services/CuratorService.ts` - Processes reviews into playbook entries
- `src/main/services/ReflectorService.ts` - Orchestrates the learning loop

**IPC & Preload:**
- `src/main/playbook/handlers.ts` - IPC handlers for all playbook operations
- `src/main/playbook/index.ts` - Module barrel export
- `src/preload/playbook.ts` - Preload API for renderer access

**Renderer Components:**
- `src/renderer/src/hooks/usePlaybook.ts` - React hook for playbook access
- `src/renderer/src/components/agent/SessionFeedback.tsx` - User feedback UI component

**Documentation:**
- `docs/designs/AGENTIC_MEMORY_IMPLEMENTATION.md` - Full design doc with integration steps

**Updated:**
- `src/main/services/index.ts` - Added exports for new services

## What Needs To Be Done

### 1. Update Shared Types Index
Add exports to `src/shared/types/index.ts`:
```typescript
export * from './playbook'
export * from './review'
```

### 2. Fix db.ts Import Issue
The ReviewAgentService imports `getDb` from `../db` but need to verify this function exists and is exported. Check `src/main/db.ts` and ensure there's a `getDb()` function that returns the database instance.

### 3. Register Handlers in Main Process
In `src/main/index.ts`, add:
```typescript
import { registerPlaybookHandlers } from './playbook'

// After WorkJournalManager init
registerPlaybookHandlers(workJournal)
```

### 4. Update Preload Script
In `src/preload/index.ts`, add:
```typescript
import { playbookApi } from './playbook'

// In the api object:
playbook: playbookApi
```

### 5. Configure AI Provider for Review Agent
Create an adapter to connect ReviewAgentService to one of the existing AI providers (Gemini recommended for cost efficiency).

### 6. Integrate with Agent Lifecycle
In the agent runner/completion logic:
- Inject playbook context at agent spawn
- Trigger reflection on session completion

### 7. TypeScript Compilation Check
Run `npm run typecheck` to identify and fix any type errors.

### 8. Test the System
- Seed initial playbook entries
- Run an agent session
- Verify review agent triggers
- Check playbook entries are created
- Test user feedback flow

## Architecture Overview

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

## Key Design Decisions

1. **Review Agent (Sentinel)** - Automated evaluation replaces reliance on user feedback (users rarely click)
2. **Sampling** - Not every session reviewed (cost control): 30% sampling, always review 5+ min sessions
3. **Deduplication** - Jaccard similarity (0.7 threshold) prevents duplicate entries
4. **Security** - Forbidden patterns reject credentials from playbook storage
5. **Non-blocking** - Reflection is async, doesn't block agent completion

## Files to Reference

- `/Users/cory.naegle/ArborChat/docs/designs/AGENTIC_MEMORY_IMPLEMENTATION.md` - Full design doc
- `/Users/cory.naegle/ArborChat/src/main/services/WorkJournalManager.ts` - Existing work journal
- `/Users/cory.naegle/ArborChat/src/main/index.ts` - Main process entry point
- `/Users/cory.naegle/ArborChat/src/preload/index.ts` - Preload script

## Commands

```bash
# Check types
npm run typecheck

# Run dev
npm run dev

# Check database
sqlite3 ~/Library/Application\ Support/ArborChat/arborchat.db ".tables"
```

## RAG Query for Context

```bash
ssh -i ~/.ssh/swarm_key root@134.199.235.140 "curl -s -X POST http://localhost:8082/api/rag/search -H 'Content-Type: application/json' -d '{\"query\": \"YOUR_QUERY\", \"repository\": \"ArborChat\", \"top_k\": 10}'"
```

Useful queries:
- "main process initialization index.ts"
- "preload script contextBridge"
- "useAgentRunner agent spawn"
- "AI provider interface generate"
