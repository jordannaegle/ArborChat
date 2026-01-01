# Phase 4: Token Tracking - Implementation Summary

**Author:** Alex Chen (Distinguished Software Architect)  
**Date:** December 31, 2025  
**Status:** ✅ Complete

---

## Overview

Phase 4 implements accurate token tracking and context window management for the Agent Monitoring system. This ensures agents don't exceed model context limits and provides users visibility into token usage.

## Implementation Details

### 1. TokenizerService (`src/renderer/src/lib/tokenizerService.ts`)

A comprehensive tokenization service using `js-tiktoken` for accurate BPE-based token counting.

**Features:**
- Model-specific tokenization using tiktoken encodings
- Support for OpenAI, Anthropic Claude, Google Gemini, DeepSeek, Mistral, and Ollama models
- Message array token counting with overhead calculation
- Context overflow analysis with truncation recommendations
- Auto-truncation with notification

**Key Functions:**
```typescript
// Count tokens for text
TokenizerService.countTokens(text: string, modelId: string): TokenCountResult

// Count tokens for message array
TokenizerService.countMessagesTokens(messages: MessageForCounting[], modelId: string): TokenCountResult

// Analyze context for overflow
TokenizerService.analyzeContextOverflow(messages, modelId, maxTokens, reserveTokens): ContextOverflowAnalysis

// Auto-truncate messages to fit
TokenizerService.truncateMessages(messages, modelId, maxTokens, reserveTokens): TruncationResult
```

**Encoding Mappings:**
- GPT-4o series → o200k_base (exact)
- GPT-4 series → cl100k_base (exact)
- Claude models → cl100k_base (approximate)
- Gemini models → cl100k_base (approximate)
- DeepSeek models → cl100k_base (approximate)

### 2. Updated useAgentRunner Hook

Enhanced the agent runner to use TokenizerService:

**Changes:**
- Import TokenizerService
- Updated `updateTokenMetrics()` to use accurate token counting
- Enhanced `buildContextMessages()` with auto-truncation
- Returns truncation notification for UI display
- Logs token counts with encoding information

**Auto-truncation Strategy:**
1. Preserve system prompt (index 0)
2. Preserve recent messages (last 2)
3. Remove older messages from middle of conversation
4. Reserve 2000 tokens for response
5. Add notification step when truncation occurs

### 3. Enhanced ExecutionProgressBar UI

Updated the TokenUsageBar component:

**Improvements:**
- More prominent visual warnings
- Animated critical state indicator
- Contextual warning messages
- Background color changes based on warning level
- Shows percentage at all levels
- Clear indicator when auto-truncation is active

**Warning Levels:**
- `normal`: Violet bar, no special indication
- `warning`: Amber bar, "Context window filling up" message (70%+)
- `critical`: Red pulsing bar, "Auto-truncation active" message (90%+)

---

## Files Changed

| File | Changes |
|------|---------|
| `src/renderer/src/lib/tokenizerService.ts` | **NEW** - TokenizerService implementation |
| `src/renderer/src/lib/index.ts` | Export TokenizerService |
| `src/renderer/src/hooks/useAgentRunner.ts` | Use TokenizerService, add auto-truncation |
| `src/renderer/src/components/agent/ExecutionProgressBar.tsx` | Enhanced token warning UI |

---

## Technical Notes

### Token Estimation Accuracy

- **Exact encoding**: OpenAI GPT models have exact tiktoken support
- **Approximate encoding**: Other models use cl100k_base approximation
- **Overhead**: ~4 tokens per message for role markers and structure

### Truncation Algorithm

```
1. Calculate total tokens with TokenizerService
2. If exceeds (maxTokens - reserveTokens):
   a. Identify messages to remove (middle of conversation)
   b. Preserve system prompt and last 2 messages
   c. Remove oldest non-system messages first
3. Return truncated messages + notification
```

### Context Limits by Model

| Model | Context Limit |
|-------|---------------|
| Gemini 2.5 Pro | 1,048,576 |
| Gemini 1.5 Pro | 2,097,152 |
| Claude Sonnet 4 | 200,000 |
| GPT-4o | 128,000 |
| DeepSeek R1 | 128,000 |
| Default | 100,000 |

---

## Testing Checklist

- [x] TypeScript compilation passes
- [ ] Token counting matches tiktoken reference
- [ ] Auto-truncation triggers at correct threshold
- [ ] UI shows warning at 70% usage
- [ ] UI shows critical at 90% usage
- [ ] Truncation notification appears in agent steps
- [ ] System prompt never truncated
- [ ] Recent messages preserved during truncation

---

## Usage Example

```typescript
// Token counting
const result = TokenizerService.countTokens(text, 'gpt-4o')
console.log(`Tokens: ${result.count} (${result.encoding}, approximate: ${result.isApproximate})`)

// Context analysis
const analysis = TokenizerService.analyzeContextOverflow(messages, 'claude-sonnet-4-20250514', 200000)
if (analysis.needsTruncation) {
  console.log(`Need to remove ${analysis.messagesToTruncate.length} messages`)
}

// Auto-truncate
const { messages: truncated, notification } = TokenizerService.truncateMessages(
  messages, 'gpt-4o', 128000, 2000
)
```

---

## Future Enhancements

1. **Streaming token counting**: Count tokens as they stream in
2. **Token budget allocation**: Allocate tokens across system prompt, history, and response
3. **Smart truncation**: Use summarization for removed messages instead of deletion
4. **Per-model tokenizer caching**: Improve performance for repeated counts
