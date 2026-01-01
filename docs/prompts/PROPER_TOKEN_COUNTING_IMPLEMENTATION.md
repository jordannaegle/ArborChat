# Proper Token Counting Implementation

**Reference Design:** This prompt is self-contained  
**Estimated Effort:** 2-3 hours  
**Priority:** Medium-High (Accuracy improvement)

---

## Problem Statement

ArborChat currently uses a rough token estimation (`text.length / 4`) in three locations:
1. `src/renderer/src/lib/contextManager.ts` - Context budget management
2. `src/main/services/WorkJournalManager.ts` - Work journal token tracking
3. `src/main/services/ArborMemoryService.ts` - Memory system token budgets

This approximation can be significantly inaccurate (up to 50% off for code/structured content), leading to:
- Context window overflows or underutilization
- Inaccurate token budget displays
- Potential API errors when hitting actual token limits

---

## Solution Overview

Implement a centralized `TokenizerService` in the main process that:
1. Uses provider-specific tokenizers for accurate counting
2. Exposes IPC methods for renderer access
3. Caches tokenizer instances for performance
4. Falls back gracefully if tokenization fails

### Recommended Library: `js-tiktoken`

We'll use `js-tiktoken` because:
- Pure JavaScript implementation (no native bindings needed)
- Works in both Node.js and browser environments
- Supports multiple encodings (cl100k_base for GPT-4/Claude, o200k_base for newer models)
- Actively maintained with good performance

---

## Prerequisites

- Understand the current token estimation locations (listed above)
- Familiarity with ArborChat's IPC patterns
- Access to install npm packages

---

## Implementation Steps

### Step 1: Install Dependencies

```bash
npm install js-tiktoken
```

---

### Step 2: Create TokenizerService

**File:** `src/main/services/TokenizerService.ts`

```typescript
/**
 * TokenizerService
 * 
 * Centralized token counting service with provider-specific tokenizers.
 * Uses js-tiktoken for accurate token counting across different AI models.
 * 
 * Design principles:
 * - Provider-aware tokenization (different models use different encodings)
 * - Cached tokenizer instances for performance
 * - Graceful fallback if tokenization fails
 * - Singleton pattern for efficiency
 */

import { Tiktoken, getEncoding, encodingForModel } from 'js-tiktoken';

// ============================================================================
// Types
// ============================================================================

export type TokenizerEncoding = 'cl100k_base' | 'o200k_base' | 'p50k_base';

export interface TokenCountResult {
  tokens: number;
  encoding: TokenizerEncoding;
  cached: boolean;
}

export interface TokenCountOptions {
  /** Override the encoding to use */
  encoding?: TokenizerEncoding;
  /** Model ID to determine encoding automatically */
  modelId?: string;
}

// ============================================================================
// Model-to-Encoding Mapping
// ============================================================================

/**
 * Maps model IDs to their tokenizer encodings.
 * 
 * Encoding reference:
 * - cl100k_base: GPT-4, GPT-3.5-turbo, Claude (approximate), text-embedding-ada-002
 * - o200k_base: GPT-4o, GPT-4o-mini (newer OpenAI models)
 * - p50k_base: Codex models, older GPT-3 models
 */
const MODEL_ENCODINGS: Record<string, TokenizerEncoding> = {
  // OpenAI models
  'gpt-4': 'cl100k_base',
  'gpt-4-turbo': 'cl100k_base',
  'gpt-4-turbo-preview': 'cl100k_base',
  'gpt-4o': 'o200k_base',
  'gpt-4o-mini': 'o200k_base',
  'gpt-3.5-turbo': 'cl100k_base',
  'text-embedding-ada-002': 'cl100k_base',
  
  // Anthropic models (cl100k_base is a reasonable approximation)
  // Note: Anthropic doesn't publish their exact tokenizer, but cl100k_base
  // provides a good approximation for context management purposes
  'claude-opus-4-5-20251101': 'cl100k_base',
  'claude-sonnet-4-5-20250929': 'cl100k_base',
  'claude-3-opus': 'cl100k_base',
  'claude-3-sonnet': 'cl100k_base',
  'claude-3-haiku': 'cl100k_base',
  
  // Gemini models (use cl100k_base as approximation)
  // Google also doesn't publish their exact tokenizer
  'gemini-2.0-flash': 'cl100k_base',
  'gemini-2.5-flash': 'cl100k_base',
  'gemini-2.5-flash-lite': 'cl100k_base',
  'gemini-2.5-pro': 'cl100k_base',
  'gemini-pro': 'cl100k_base',
  'gemini-1.5-pro': 'cl100k_base',
  'gemini-1.5-flash': 'cl100k_base',
  
  // Mistral models (cl100k_base approximation)
  'mistral-large': 'cl100k_base',
  'mistral-medium': 'cl100k_base',
  'mistral-small': 'cl100k_base',
  'mistral': 'cl100k_base',
  
  // Local models (cl100k_base is a reasonable default)
  'llama3': 'cl100k_base',
  'llama2': 'cl100k_base',
  'codellama': 'cl100k_base',
  
  // Default fallback
  'default': 'cl100k_base',
};

// ============================================================================
// TokenizerService Class
// ============================================================================

export class TokenizerService {
  private static instance: TokenizerService;
  private encodings: Map<TokenizerEncoding, Tiktoken> = new Map();
  private initialized = false;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): TokenizerService {
    if (!TokenizerService.instance) {
      TokenizerService.instance = new TokenizerService();
    }
    return TokenizerService.instance;
  }

  /**
   * Initialize the service (lazy loads encodings on first use)
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[Tokenizer] Initializing TokenizerService...');
    
    // Pre-load the most commonly used encoding
    try {
      await this.getOrCreateEncoding('cl100k_base');
      this.initialized = true;
      console.log('[Tokenizer] Initialized successfully');
    } catch (error) {
      console.error('[Tokenizer] Failed to initialize:', error);
      // Continue anyway - we'll use fallback estimation
    }
  }

  /**
   * Get or create a tokenizer for the specified encoding
   */
  private async getOrCreateEncoding(encoding: TokenizerEncoding): Promise<Tiktoken> {
    if (this.encodings.has(encoding)) {
      return this.encodings.get(encoding)!;
    }

    console.log(`[Tokenizer] Loading encoding: ${encoding}`);
    const tokenizer = getEncoding(encoding);
    this.encodings.set(encoding, tokenizer);
    return tokenizer;
  }

  /**
   * Get the appropriate encoding for a model ID
   */
  getEncodingForModel(modelId: string): TokenizerEncoding {
    // Check for exact match
    if (MODEL_ENCODINGS[modelId]) {
      return MODEL_ENCODINGS[modelId];
    }

    // Check for partial matches (e.g., 'gpt-4-0613' matches 'gpt-4')
    for (const [key, encoding] of Object.entries(MODEL_ENCODINGS)) {
      if (modelId.startsWith(key)) {
        return encoding;
      }
    }

    return MODEL_ENCODINGS['default'];
  }

  /**
   * Count tokens in text
   * 
   * @param text - Text to count tokens for
   * @param options - Optional model ID or encoding override
   * @returns Token count result with encoding info
   */
  async countTokens(text: string, options?: TokenCountOptions): Promise<TokenCountResult> {
    if (!text) {
      return { tokens: 0, encoding: 'cl100k_base', cached: true };
    }

    // Determine encoding
    const encoding = options?.encoding ?? 
      (options?.modelId ? this.getEncodingForModel(options.modelId) : 'cl100k_base');

    try {
      const tokenizer = await this.getOrCreateEncoding(encoding);
      const tokens = tokenizer.encode(text);
      
      return {
        tokens: tokens.length,
        encoding,
        cached: this.encodings.has(encoding),
      };
    } catch (error) {
      console.warn(`[Tokenizer] Error counting tokens, using fallback:`, error);
      return {
        tokens: this.fallbackEstimate(text),
        encoding,
        cached: false,
      };
    }
  }

  /**
   * Count tokens synchronously (uses cached tokenizer or fallback)
   * Prefer countTokens() for accuracy, use this for hot paths
   */
  countTokensSync(text: string, modelId?: string): number {
    if (!text) return 0;

    const encoding = modelId ? this.getEncodingForModel(modelId) : 'cl100k_base';
    
    if (this.encodings.has(encoding)) {
      try {
        const tokenizer = this.encodings.get(encoding)!;
        return tokenizer.encode(text).length;
      } catch {
        return this.fallbackEstimate(text);
      }
    }

    return this.fallbackEstimate(text);
  }

  /**
   * Fallback estimation when tokenizer is unavailable
   * Uses improved heuristics beyond simple length/4
   */
  private fallbackEstimate(text: string): number {
    if (!text) return 0;

    // Improved estimation:
    // - Average English word is ~4-5 characters
    // - Average token is ~4 characters for English prose
    // - Code and special characters tend to produce more tokens
    
    // Count different character types
    const words = text.split(/\s+/).filter(w => w.length > 0).length;
    const codeChars = (text.match(/[{}[\]()<>:;,."'`=+\-*/%&|^~!?@#$\\]/g) || []).length;
    const newlines = (text.match(/\n/g) || []).length;
    
    // Base estimation from character count
    let tokens = Math.ceil(text.length / 4);
    
    // Adjust for code-heavy content (adds more tokens)
    if (codeChars > text.length * 0.1) {
      tokens = Math.ceil(tokens * 1.3);
    }
    
    // Each newline typically adds at least one token
    tokens += Math.ceil(newlines * 0.3);
    
    return tokens;
  }

  /**
   * Decode tokens back to text (useful for truncation)
   */
  async decodeTokens(tokens: number[], encoding?: TokenizerEncoding): Promise<string> {
    const enc = encoding ?? 'cl100k_base';
    const tokenizer = await this.getOrCreateEncoding(enc);
    return tokenizer.decode(tokens);
  }

  /**
   * Truncate text to fit within a token limit
   */
  async truncateToTokenLimit(
    text: string, 
    maxTokens: number, 
    options?: TokenCountOptions & { suffix?: string }
  ): Promise<string> {
    const encoding = options?.encoding ?? 
      (options?.modelId ? this.getEncodingForModel(options.modelId) : 'cl100k_base');
    
    try {
      const tokenizer = await this.getOrCreateEncoding(encoding);
      const tokens = tokenizer.encode(text);
      
      if (tokens.length <= maxTokens) {
        return text;
      }

      const suffix = options?.suffix ?? '\n\n[... truncated ...]';
      const suffixTokens = tokenizer.encode(suffix).length;
      const targetTokens = maxTokens - suffixTokens;
      
      if (targetTokens <= 0) {
        return suffix;
      }

      const truncatedTokens = tokens.slice(0, targetTokens);
      return tokenizer.decode(truncatedTokens) + suffix;
    } catch {
      // Fallback to character-based truncation
      const approxChars = maxTokens * 4;
      if (text.length <= approxChars) return text;
      return text.slice(0, approxChars - 20) + '\n\n[... truncated ...]';
    }
  }

  /**
   * Get statistics about tokenizer cache
   */
  getStats(): { loadedEncodings: string[]; initialized: boolean } {
    return {
      loadedEncodings: Array.from(this.encodings.keys()),
      initialized: this.initialized,
    };
  }

  /**
   * Clear cached tokenizers (for memory management)
   */
  clearCache(): void {
    this.encodings.clear();
    this.initialized = false;
  }
}

// Export singleton accessor
export const tokenizer = TokenizerService.getInstance();

// Export convenience functions for direct use
export async function countTokens(text: string, modelId?: string): Promise<number> {
  const result = await tokenizer.countTokens(text, { modelId });
  return result.tokens;
}

export function countTokensSync(text: string, modelId?: string): number {
  return tokenizer.countTokensSync(text, modelId);
}

export async function truncateToTokens(text: string, maxTokens: number, modelId?: string): Promise<string> {
  return tokenizer.truncateToTokenLimit(text, maxTokens, { modelId });
}
```

---

### Step 3: Add IPC Handlers

**File:** `src/main/ipc/tokenizer.ts`

```typescript
/**
 * IPC handlers for token counting
 * Exposes TokenizerService methods to the renderer process
 */

import { ipcMain } from 'electron';
import { tokenizer, countTokens, countTokensSync } from '../services/TokenizerService';

export function registerTokenizerHandlers(): void {
  console.log('[IPC] Registering tokenizer handlers...');

  /**
   * Count tokens in text (async, more accurate)
   */
  ipcMain.handle('tokenizer:count', async (_event, text: string, modelId?: string): Promise<number> => {
    return countTokens(text, modelId);
  });

  /**
   * Count tokens synchronously (uses cache, faster for hot paths)
   */
  ipcMain.handle('tokenizer:countSync', (_event, text: string, modelId?: string): number => {
    return countTokensSync(text, modelId);
  });

  /**
   * Truncate text to token limit
   */
  ipcMain.handle(
    'tokenizer:truncate', 
    async (_event, text: string, maxTokens: number, modelId?: string): Promise<string> => {
      return tokenizer.truncateToTokenLimit(text, maxTokens, { modelId });
    }
  );

  /**
   * Get tokenizer stats
   */
  ipcMain.handle('tokenizer:stats', (): { loadedEncodings: string[]; initialized: boolean } => {
    return tokenizer.getStats();
  });

  console.log('[IPC] Tokenizer handlers registered');
}
```

---

### Step 4: Update Preload API

**File:** Update `src/preload/index.ts` (add to existing exports)

```typescript
// Add to the existing contextBridge.exposeInMainWorld('api', { ... })

  // Tokenizer API
  tokenizer: {
    count: (text: string, modelId?: string): Promise<number> => 
      ipcRenderer.invoke('tokenizer:count', text, modelId),
    countSync: (text: string, modelId?: string): Promise<number> => 
      ipcRenderer.invoke('tokenizer:countSync', text, modelId),
    truncate: (text: string, maxTokens: number, modelId?: string): Promise<string> =>
      ipcRenderer.invoke('tokenizer:truncate', text, maxTokens, modelId),
    getStats: (): Promise<{ loadedEncodings: string[]; initialized: boolean }> =>
      ipcRenderer.invoke('tokenizer:stats'),
  },
```

---

### Step 5: Update Preload Types

**File:** Update `src/preload/index.d.ts`

```typescript
// Add to the existing API interface

interface TokenizerAPI {
  count: (text: string, modelId?: string) => Promise<number>;
  countSync: (text: string, modelId?: string) => Promise<number>;
  truncate: (text: string, maxTokens: number, modelId?: string) => Promise<string>;
  getStats: () => Promise<{ loadedEncodings: string[]; initialized: boolean }>;
}

// Add to the main API interface
interface API {
  // ... existing properties ...
  tokenizer: TokenizerAPI;
}
```

---

### Step 6: Register IPC Handlers in Main Process

**File:** Update `src/main/index.ts`

```typescript
// Add import
import { registerTokenizerHandlers } from './ipc/tokenizer';
import { tokenizer } from './services/TokenizerService';

// In the app initialization section (after app.whenReady()):
async function initializeApp() {
  // ... existing initialization ...
  
  // Initialize tokenizer service
  await tokenizer.init();
  
  // Register IPC handlers
  registerTokenizerHandlers();
  
  // ... rest of initialization ...
}
```

---

### Step 7: Update contextManager.ts to Use Real Tokenizer

**File:** `src/renderer/src/lib/contextManager.ts`

```typescript
// Replace the existing estimateTokens function with:

/**
 * Estimate tokens using the tokenizer service (async)
 * Falls back to character-based estimation if service unavailable
 */
async function estimateTokensAsync(text: string, modelId?: string): Promise<number> {
  if (!text) return 0;
  try {
    return await window.api.tokenizer.count(text, modelId);
  } catch {
    // Fallback to simple estimation
    return Math.ceil(text.length / 4);
  }
}

/**
 * Synchronous token estimation for hot paths
 * Uses cached tokenizer or falls back to character estimation
 */
function estimateTokens(text: string): number {
  if (!text) return 0;
  // For synchronous calls in the renderer, we still use estimation
  // The main process tokenizer is the source of truth
  return Math.ceil(text.length / 4);
}

// Update buildOptimizedContext to accept modelId and use async counting:
export async function buildOptimizedContextAsync(
  messages: Message[],
  modelId: string
): Promise<Message[]> {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default'];
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools;

  // Count tokens for system prompt
  const systemPrompt = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  let currentTokens = systemPrompt 
    ? await estimateTokensAsync(systemPrompt.content, modelId) 
    : 0;
  const result: Message[] = systemPrompt ? [systemPrompt] : [];

  const messagesToAdd: Message[] = [];
  
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const msgTokens = await estimateTokensAsync(msg.content, modelId);

    if (currentTokens + msgTokens < availableTokens) {
      messagesToAdd.unshift(msg);
      currentTokens += msgTokens;
    } else {
      console.log(`[ContextManager] Truncating context at message ${i}, used ${currentTokens} tokens`);
      break;
    }
  }

  result.push(...messagesToAdd);
  
  console.log(`[ContextManager] Built context with ${result.length} messages, ${currentTokens} tokens`);
  return result;
}

// Keep the synchronous version for backward compatibility
export function buildOptimizedContext(messages: Message[], modelId: string): Message[] {
  // Synchronous version uses estimation - call buildOptimizedContextAsync for accuracy
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default'];
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools;

  const systemPrompt = messages.find(m => m.role === 'system');
  const conversationMessages = messages.filter(m => m.role !== 'system');

  let currentTokens = systemPrompt ? estimateTokens(systemPrompt.content) : 0;
  const result: Message[] = systemPrompt ? [systemPrompt] : [];

  const messagesToAdd: Message[] = [];
  
  for (let i = conversationMessages.length - 1; i >= 0; i--) {
    const msg = conversationMessages[i];
    const msgTokens = estimateTokens(msg.content);

    if (currentTokens + msgTokens < availableTokens) {
      messagesToAdd.unshift(msg);
      currentTokens += msgTokens;
    } else {
      break;
    }
  }

  result.push(...messagesToAdd);
  return result;
}

// Add async version of getContextStats
export async function getContextStatsAsync(
  messages: Message[],
  modelId: string
): Promise<{
  currentTokens: number;
  availableTokens: number;
  usagePercent: number;
  messagesCount: number;
}> {
  const budget = MODEL_LIMITS[modelId] || MODEL_LIMITS['default'];
  const availableTokens = budget.maxTokens - budget.reservedForOutput - budget.reservedForTools;
  
  let currentTokens = 0;
  for (const msg of messages) {
    currentTokens += await estimateTokensAsync(msg.content, modelId);
  }
  
  return {
    currentTokens,
    availableTokens,
    usagePercent: (currentTokens / availableTokens) * 100,
    messagesCount: messages.length,
  };
}
```

---

### Step 8: Update WorkJournalManager.ts

**File:** `src/main/services/WorkJournalManager.ts`

```typescript
// Replace the existing estimateTokens function with import:

import { countTokensSync } from './TokenizerService';

// Update the function to use the tokenizer:
function estimateTokens(text: string): number {
  if (!text) return 0;
  return countTokensSync(text);
}

// The rest of the file remains unchanged - it will now use accurate token counts
```

---

### Step 9: Update ArborMemoryService.ts

**File:** `src/main/services/ArborMemoryService.ts`

```typescript
// Import the tokenizer
import { countTokensSync } from './TokenizerService';

// Update the CONFIG to remove CHARS_PER_TOKEN (no longer needed)
const CONFIG = {
  // ... keep other settings ...
  // Remove: CHARS_PER_TOKEN: 4
} as const;

// Replace the estimateTokens function:
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return countTokensSync(text);
}
```

---

## Verification Checklist

After implementation, verify:

- [ ] `npm install js-tiktoken` completes successfully
- [ ] TypeScript compiles without errors: `npm run typecheck`
- [ ] App starts without errors: `npm run dev`
- [ ] Console shows `[Tokenizer] Initialized successfully`
- [ ] Token counts in UI are more accurate (compare before/after)
- [ ] Context truncation works correctly for long conversations
- [ ] Work Journal token estimates are reasonable
- [ ] Memory service token budgets function correctly

## Testing

### Manual Testing

1. Start the app and open DevTools console
2. Check for tokenizer initialization log
3. Have a conversation and observe context stats
4. Test with code-heavy content (should show higher token counts than simple length/4)
5. Test context truncation by creating a very long conversation

### Comparison Test

Before implementing, capture token counts for sample texts:
- Simple prose: "Hello, how are you today?"
- Code: `function hello() { console.log('world'); }`
- Mixed: A typical AI response with markdown

After implementing, compare:
- The new counts should be closer to actual API usage
- Code should show higher relative token counts

---

## Performance Notes

- Tokenizer instances are cached after first use
- `countTokensSync` uses cached tokenizers for hot paths
- Initial load of cl100k_base encoding is ~2MB but only happens once
- For very long texts (>100KB), consider chunked processing

---

## Future Enhancements

1. **Provider-specific tokenizers**: When Anthropic/Google publish official tokenizers, integrate them
2. **Token usage tracking**: Add a TokenUsageTracker for API cost estimation
3. **Visual token counter**: Show live token count in the message input area
4. **Token budget warnings**: Alert users when approaching context limits
