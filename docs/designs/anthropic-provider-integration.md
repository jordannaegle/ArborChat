# Anthropic Provider Integration Design

**Design Lead:** Alex Chen  
**Version:** 1.0  
**Date:** December 27, 2024  
**Status:** Draft

---

## Executive Summary

This design extends ArborChat's AI provider architecture to support Anthropic Claude models (Opus 4.5 and Sonnet 4.5) with a secure, extensible API key management system. The solution leverages Electron's `safeStorage` API for encrypted credential storage and introduces a unified provider key registry that automatically injects the correct API key based on the selected model.

---

## Table of Contents

1. [Goals & Non-Goals](#goals--non-goals)
2. [Current Architecture Analysis](#current-architecture-analysis)
3. [Proposed Architecture](#proposed-architecture)
4. [Type Definitions](#type-definitions)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [Security Considerations](#security-considerations)
8. [Implementation Phases](#implementation-phases)
9. [Testing Strategy](#testing-strategy)
10. [Future Extensions](#future-extensions)

---

## Goals & Non-Goals

### Goals

1. **Add Anthropic Support** - Integrate Claude Opus 4.5 and Sonnet 4.5 models
2. **Extensible Key Management** - Create a unified system for storing/retrieving API keys per provider
3. **Automatic Key Injection** - Inject the correct API key based on selected model without user intervention
4. **Secure Storage** - Use Electron's `safeStorage` API for encrypted credential storage
5. **Consistent UI/UX** - Extend existing settings UI patterns for seamless experience
6. **Provider Parity** - Ensure Anthropic provider has feature parity with Gemini (streaming, system prompts)

### Non-Goals

- Token counting/usage tracking (future enhancement)
- Multi-key support per provider (single key per provider for V1)
- Provider-specific model configuration (temperature, etc.) - use defaults
- Migration from current single-key storage (provide upgrade path only)

---

## Current Architecture Analysis

### Strengths to Leverage

1. **Well-defined Provider Interface** (`src/main/providers/base.ts`)
   - `AIProvider` interface with `canHandleModel()`, `streamResponse()`, etc.
   - Clean separation of concerns

2. **Provider Registry Pattern** (`src/main/ai.ts`)
   - Array-based provider lookup via `getProviderForModel()`
   - Easy to extend with new providers

3. **Existing Settings Infrastructure** (`src/main/db.ts`)
   - Key-value `settings` table in SQLite
   - Functions for `getApiKey()`/`setApiKey()`

4. **MCP Credentials Pattern** (`src/main/mcp/credentials.ts`)
   - Already uses `safeStorage` for GitHub tokens
   - Proven encrypted storage pattern

### Current Limitations

1. **Single API Key Storage** - Only stores one key (originally for OpenAI, now used for Gemini)
2. **No Provider-Key Mapping** - No way to associate keys with specific providers
3. **Hardcoded Provider Types** - `ModelProvider = 'gemini' | 'ollama'` needs extension


---

## Proposed Architecture

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌───────────────────────────────────┐  │
│  │  Model Selector │    │      API Keys Section             │  │
│  │  ┌───────────┐  │    │  ┌──────────┐ ┌──────────┐        │  │
│  │  │ Anthropic │◀─┼────┼──│ Anthropic│ │ Gemini   │ ...    │  │
│  │  │ Gemini    │  │    │  │  Key: *** │ │ Key: *** │        │  │
│  │  │ Ollama    │  │    │  └──────────┘ └──────────┘        │  │
│  │  └───────────┘  │    └───────────────────────────────────┘  │
│  └────────┬────────┘                                            │
└───────────┼─────────────────────────────────────────────────────┘
            │ IPC: models:get-available
            ▼
┌───────────────────────────────────────────────────────────────┐
│                      Main Process                              │
├───────────────────────────────────────────────────────────────┤
│  ┌──────────────────────┐    ┌──────────────────────────────┐│
│  │   Provider Registry  │    │   Credential Manager         ││
│  │  ┌─────────────────┐ │    │  ┌────────────────────────┐  ││
│  │  │AnthropicProvider│ │    │  │ safeStorage Encrypted  │  ││
│  │  │ GeminiProvider  │ │    │  │ {                      │  ││
│  │  │ OllamaProvider  │ │    │  │   anthropic: "sk-...", │  ││
│  │  └─────────────────┘ │    │  │   gemini: "AIza...",   │  ││
│  └──────────┬───────────┘    │  │   openai: "sk-..."     │  ││
│             │                │  │ }                      │  ││
│             ▼                │  └──────────┬─────────────┘  ││
│  ┌──────────────────────┐    └─────────────┼────────────────┘│
│  │   AI Router          │◀─────────────────┘                 │
│  │  getKeyForProvider() │   Automatic key injection          │
│  │  streamResponse()    │                                    │
│  └──────────────────────┘                                    │
└───────────────────────────────────────────────────────────────┘
```

### Component Overview

| Component | Location | Responsibility |
|-----------|----------|----------------|
| `CredentialManager` | `src/main/credentials/` | Encrypted storage & retrieval of API keys |
| `AnthropicProvider` | `src/main/providers/anthropic.ts` | Claude API integration |
| `ProviderRegistry` | `src/main/providers/registry.ts` | Model-to-provider mapping |
| `APIKeysSection` | `src/renderer/.../settings/` | UI for managing API keys |
| `ModelSelector` | `src/renderer/src/components/` | Extended for Anthropic models |

---

## Type Definitions

### Shared Types (`src/shared/types/providers.ts`)

```typescript
/**
 * Supported AI provider identifiers
 */
export type ProviderId = 'anthropic' | 'gemini' | 'ollama' | 'openai';

/**
 * Provider metadata for UI display
 */
export interface ProviderInfo {
  id: ProviderId;
  name: string;
  icon: string;
  description: string;
  isLocal: boolean;
  requiresApiKey: boolean;
  helpUrl?: string;
  keyPlaceholder?: string;
  keyPattern?: RegExp;
}

/**
 * Extended model type with provider info
 */
export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: ProviderId;
  isLocal: boolean;
  capabilities?: ModelCapabilities;
}

/**
 * Model capabilities for feature detection
 */
export interface ModelCapabilities {
  streaming: boolean;
  systemPrompt: boolean;
  vision: boolean;
  toolUse: boolean;
  maxTokens?: number;
}
```

### Credential Types (`src/main/credentials/types.ts`)

```typescript
/**
 * Encrypted credentials structure
 */
export interface EncryptedCredentials {
  version: number;
  providers: {
    [K in ProviderId]?: ProviderCredential;
  };
}

/**
 * Individual provider credential
 */
export interface ProviderCredential {
  apiKey: string;
  createdAt: string;
  lastUsedAt?: string;
  metadata?: Record<string, unknown>;
}
```


---

## Backend Implementation

### 1. Credential Manager (`src/main/credentials/manager.ts`)

```typescript
import { safeStorage, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderId, EncryptedCredentials, ProviderCredential } from './types';

const CREDENTIALS_FILE = 'provider-credentials.enc';
const SCHEMA_VERSION = 1;

/**
 * Centralized credential management for all AI providers
 */
class CredentialManager {
  private credentialsPath: string;
  private cache: EncryptedCredentials | null = null;

  constructor() {
    this.credentialsPath = path.join(app.getPath('userData'), CREDENTIALS_FILE);
  }

  isSecureStorageAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  private async loadCredentials(): Promise<EncryptedCredentials> {
    if (this.cache) return this.cache;

    if (!fs.existsSync(this.credentialsPath)) {
      return { version: SCHEMA_VERSION, providers: {} };
    }

    try {
      const encryptedData = fs.readFileSync(this.credentialsPath);
      const decryptedString = safeStorage.decryptString(encryptedData);
      this.cache = JSON.parse(decryptedString);
      return this.cache!;
    } catch (error) {
      console.error('[Credentials] Failed to load:', error);
      return { version: SCHEMA_VERSION, providers: {} };
    }
  }

  private async saveCredentials(credentials: EncryptedCredentials): Promise<void> {
    const jsonString = JSON.stringify(credentials);
    const encryptedBuffer = safeStorage.encryptString(jsonString);
    fs.writeFileSync(this.credentialsPath, encryptedBuffer);
    this.cache = credentials;
  }

  async getApiKey(providerId: ProviderId): Promise<string | null> {
    const credentials = await this.loadCredentials();
    return credentials.providers[providerId]?.apiKey || null;
  }

  async setApiKey(providerId: ProviderId, apiKey: string): Promise<void> {
    if (!this.isSecureStorageAvailable()) {
      throw new Error('Secure storage is not available');
    }

    const credentials = await this.loadCredentials();
    credentials.providers[providerId] = {
      apiKey,
      createdAt: new Date().toISOString(),
    };
    await this.saveCredentials(credentials);
  }

  async deleteApiKey(providerId: ProviderId): Promise<void> {
    const credentials = await this.loadCredentials();
    delete credentials.providers[providerId];
    await this.saveCredentials(credentials);
  }

  async hasApiKey(providerId: ProviderId): Promise<boolean> {
    const key = await this.getApiKey(providerId);
    return key !== null && key.length > 0;
  }

  async getConfiguredProviders(): Promise<Record<ProviderId, boolean>> {
    const credentials = await this.loadCredentials();
    const result: Record<string, boolean> = {};
    for (const providerId of Object.keys(credentials.providers)) {
      result[providerId] = true;
    }
    return result as Record<ProviderId, boolean>;
  }

  clearCache(): void {
    this.cache = null;
  }
}

export const credentialManager = new CredentialManager();
```


### 2. Anthropic Provider (`src/main/providers/anthropic.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { AIProvider } from './base';
import { AIModel, StreamParams } from './types';

const ANTHROPIC_MODELS: AIModel[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most intelligent - Complex reasoning & analysis',
    provider: 'anthropic',
    isLocal: false,
    capabilities: {
      streaming: true,
      systemPrompt: true,
      vision: true,
      toolUse: true,
      maxTokens: 32000,
    }
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced - Fast & capable',
    provider: 'anthropic',
    isLocal: false,
    capabilities: {
      streaming: true,
      systemPrompt: true,
      vision: true,
      toolUse: true,
      maxTokens: 16000,
    }
  },
];

export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  canHandleModel(modelId: string): boolean {
    return ANTHROPIC_MODELS.some(m => m.id === modelId) || 
           modelId.startsWith('claude-');
  }

  async validateConnection(apiKey?: string): Promise<boolean> {
    if (!apiKey) return false;

    try {
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      });
      return true;
    } catch (error: any) {
      console.error('[Anthropic] Validation failed:', error.message);
      return false;
    }
  }

  async getAvailableModels(_apiKey?: string): Promise<AIModel[]> {
    return ANTHROPIC_MODELS;
  }

  async streamResponse(params: StreamParams, apiKey?: string): Promise<void> {
    if (!apiKey) {
      throw new Error('API key is required for Anthropic provider');
    }

    const { window, messages, modelId } = params;
    const client = new Anthropic({ apiKey });

    // Extract system message
    const systemMessage = messages.find(m => m.role === 'system');
    
    // Convert messages to Anthropic format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      }));

    try {
      const stream = await client.messages.stream({
        model: modelId,
        max_tokens: 8192,
        system: systemMessage?.content,
        messages: anthropicMessages,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && 
            event.delta.type === 'text_delta') {
          window.webContents.send('ai:token', event.delta.text);
        }
      }

      window.webContents.send('ai:done');
    } catch (error: any) {
      console.error('[Anthropic] streamResponse ERROR:', error);
      window.webContents.send('ai:error', error.message || 'Unknown error');
      throw error;
    }
  }
}
```


### 3. Updated Provider Types (`src/main/providers/types.ts`)

```typescript
import { BrowserWindow } from 'electron';

// Extended provider type
export type ModelProvider = 'gemini' | 'ollama' | 'anthropic' | 'openai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamParams {
  window: BrowserWindow;
  messages: ChatMessage[];
  modelId: string;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  provider: ModelProvider;
  isLocal: boolean;
  capabilities?: {
    streaming: boolean;
    systemPrompt: boolean;
    vision: boolean;
    toolUse: boolean;
    maxTokens?: number;
  };
}
```

### 4. Updated AI Router (`src/main/ai.ts`)

```typescript
import { BrowserWindow } from 'electron';
import { GeminiProvider } from './providers/gemini';
import { OllamaProvider } from './providers/ollama';
import { AnthropicProvider } from './providers/anthropic';
import { AIProvider } from './providers/base';
import { ChatMessage, StreamParams, ModelProvider } from './providers/types';
import { credentialManager } from './credentials/manager';

const DEFAULT_MODEL = 'gemini-2.5-flash';

const geminiProvider = new GeminiProvider();
const ollamaProvider = new OllamaProvider();
const anthropicProvider = new AnthropicProvider();

const providers: AIProvider[] = [
  anthropicProvider,  // Check first for claude- prefix
  geminiProvider,
  ollamaProvider,
];

function getProviderForModel(modelId: string): AIProvider {
  const provider = providers.find(p => p.canHandleModel(modelId));
  if (!provider) return geminiProvider;
  return provider;
}

function getProviderIdFromModel(modelId: string): ModelProvider {
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'gemini';
  if (modelId.includes(':')) return 'ollama';
  return 'gemini';
}

export async function streamResponse(
  window: BrowserWindow,
  _apiKey: string | null,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  modelName: string = DEFAULT_MODEL
): Promise<void> {
  const provider = getProviderForModel(modelName);
  const providerId = getProviderIdFromModel(modelName);
  
  let apiKey: string | null = null;
  if (providerId !== 'ollama') {
    apiKey = await credentialManager.getApiKey(providerId);
    if (!apiKey) {
      window.webContents.send('ai:error', `No API key configured for ${providerId}`);
      throw new Error(`No API key configured for ${providerId}`);
    }
  }

  const params: StreamParams = {
    window,
    messages: messages.map(m => ({ role: m.role, content: m.content })),
    modelId: modelName
  };

  await provider.streamResponse(params, apiKey || undefined);
}
```

### 5. IPC Handlers (`src/main/index.ts` additions)

```typescript
import { credentialManager } from './credentials/manager';

// Credential Management Handlers
ipcMain.handle('credentials:get-configured', async () => {
  return credentialManager.getConfiguredProviders();
});

ipcMain.handle('credentials:has-key', async (_, providerId: string) => {
  return credentialManager.hasApiKey(providerId as ProviderId);
});

ipcMain.handle('credentials:set-key', async (_, { providerId, apiKey }) => {
  await credentialManager.setApiKey(providerId, apiKey);
  return { success: true };
});

ipcMain.handle('credentials:delete-key', async (_, providerId: string) => {
  await credentialManager.deleteApiKey(providerId as ProviderId);
  return { success: true };
});

ipcMain.handle('credentials:validate-key', async (_, { providerId, apiKey }) => {
  switch (providerId) {
    case 'anthropic':
      return new AnthropicProvider().validateConnection(apiKey);
    case 'gemini':
      return new GeminiProvider().validateConnection(apiKey);
    default:
      return false;
  }
});

// Updated models handler
ipcMain.handle('models:get-available', async () => {
  const [anthropicModels, geminiModels, ollamaModels] = await Promise.all([
    new AnthropicProvider().getAvailableModels(),
    new GeminiProvider().getAvailableModels(),
    new OllamaProvider().getAvailableModels()
  ]);
  return [...anthropicModels, ...geminiModels, ...ollamaModels];
});
```


---

## Frontend Implementation

### 1. Updated Provider Data (`src/renderer/src/types.ts`)

```typescript
export type ModelProvider = 'gemini' | 'ollama' | 'anthropic' | 'openai';

export interface ProviderInfo {
  id: ModelProvider;
  name: string;
  icon: string;
  description: string;
  isLocal: boolean;
  requiresApiKey: boolean;
  helpUrl?: string;
  placeholder?: string;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    icon: '🧠',
    description: 'Claude Opus 4.5, Sonnet 4.5 - Advanced reasoning',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://console.anthropic.com/settings/keys',
    placeholder: 'sk-ant-api...'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    icon: '🔮',
    description: 'Gemini 2.5 Flash, Pro, and more',
    isLocal: false,
    requiresApiKey: true,
    helpUrl: 'https://aistudio.google.com/app/apikey',
    placeholder: 'AIzaSy...'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '🦙',
    description: 'Run models locally on your machine',
    isLocal: true,
    requiresApiKey: false
  }
];

export const ANTHROPIC_MODELS: Model[] = [
  {
    id: 'claude-opus-4-5-20251101',
    name: 'Claude Opus 4.5',
    description: 'Most intelligent - Complex reasoning',
    provider: 'anthropic',
    isLocal: false
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    description: 'Balanced - Fast & capable',
    provider: 'anthropic',
    isLocal: false
  }
];
```

### 2. Updated Preload API (`src/preload/index.ts`)

```typescript
const api = {
  // ... existing methods ...
  
  credentials: {
    getConfigured: () => ipcRenderer.invoke('credentials:get-configured'),
    hasKey: (providerId: string) => 
      ipcRenderer.invoke('credentials:has-key', providerId),
    setKey: (providerId: string, apiKey: string) => 
      ipcRenderer.invoke('credentials:set-key', { providerId, apiKey }),
    deleteKey: (providerId: string) => 
      ipcRenderer.invoke('credentials:delete-key', providerId),
    validateKey: (providerId: string, apiKey: string) =>
      ipcRenderer.invoke('credentials:validate-key', { providerId, apiKey })
  },
};
```

### 3. Updated ModelSelector UI

```tsx
// Group models by provider with icons
const providerSections = [
  {
    id: 'anthropic',
    icon: <Brain size={14} className="text-orange-400" />,
    label: 'Anthropic Claude',
    models: models.filter(m => m.provider === 'anthropic')
  },
  {
    id: 'gemini',
    icon: <Cloud size={14} className="text-blue-400" />,
    label: 'Google Gemini',
    models: models.filter(m => m.provider === 'gemini')
  },
  {
    id: 'ollama',
    icon: <HardDrive size={14} className="text-green-400" />,
    label: 'Ollama Local',
    models: models.filter(m => m.provider === 'ollama')
  }
];
```


---

## Security Considerations

### Encrypted Storage

1. **Electron safeStorage API**
   - Uses OS-level encryption (Keychain on macOS, Credential Vault on Windows)
   - Keys never stored in plaintext
   - Automatic encryption/decryption

2. **File Location**
   - Stored in `{userData}/provider-credentials.enc`
   - User-specific, not accessible to other users

3. **Memory Handling**
   - Keys cached in memory only during session
   - Cache cleared on app quit
   - No logging of key values

### Key Validation

- Keys validated before storage to prevent storing invalid credentials
- Validation uses minimal API calls (small prompt, low tokens)
- Failed validation provides clear error messaging

### Migration Path

For users with existing Gemini keys in old storage:

```typescript
async function migrateExistingKeys(): Promise<void> {
  const oldKey = await db.getApiKey();
  
  if (oldKey && !await credentialManager.hasApiKey('gemini')) {
    console.log('[Migration] Migrating existing Gemini API key');
    await credentialManager.setApiKey('gemini', oldKey);
  }
}
```

---

## Implementation Phases

### Phase 1: Credential Manager (Est: 2 hours)
- [ ] Create `src/main/credentials/` directory structure
- [ ] Implement `CredentialManager` class with safeStorage
- [ ] Add IPC handlers for credential operations
- [ ] Update preload with credentials API
- [ ] Write migration for existing Gemini keys

### Phase 2: Anthropic Provider (Est: 2 hours)
- [ ] Install `@anthropic-ai/sdk` package
- [ ] Create `AnthropicProvider` class
- [ ] Add Claude Opus 4.5 and Sonnet 4.5 models
- [ ] Implement streaming with Anthropic SDK
- [ ] Update provider types for 'anthropic'

### Phase 3: AI Router Updates (Est: 1 hour)
- [ ] Register AnthropicProvider in providers array
- [ ] Update `getProviderIdFromModel()` for claude- prefix
- [ ] Modify `streamResponse()` for automatic key injection
- [ ] Update models handler to include Anthropic

### Phase 4: Frontend Updates (Est: 2 hours)
- [ ] Update types with Anthropic models and PROVIDERS
- [ ] Extend APIKeysSection for multi-provider
- [ ] Update ModelSelector with provider grouping
- [ ] Add Anthropic section with proper styling

### Phase 5: Testing & Polish (Est: 1 hour)
- [ ] Test Anthropic streaming end-to-end
- [ ] Verify key validation flow
- [ ] Test model switching between providers
- [ ] Error handling and edge cases

**Total Estimated Time: 8 hours**

---

## Testing Strategy

### Unit Tests

```typescript
describe('CredentialManager', () => {
  it('should store and retrieve API keys', async () => {
    await credentialManager.setApiKey('anthropic', 'test-key');
    const key = await credentialManager.getApiKey('anthropic');
    expect(key).toBe('test-key');
  });

  it('should report configured providers correctly', async () => {
    await credentialManager.setApiKey('gemini', 'gemini-key');
    const configured = await credentialManager.getConfiguredProviders();
    expect(configured.gemini).toBe(true);
    expect(configured.anthropic).toBe(false);
  });
});
```

### Integration Tests

1. **Model Selection Flow**
   - Select Anthropic model → verify correct API key injected
   - Switch to Gemini → verify key switches
   - Select Ollama → verify no key required

2. **Key Management Flow**
   - Add new Anthropic key → validate → store
   - Update existing key → re-validate → update
   - Delete key → confirm removal

3. **Streaming Tests**
   - Anthropic model + valid key → stream works
   - Anthropic model + no key → proper error
   - Anthropic model + invalid key → validation error

---

## Future Extensions

### OpenAI Support

```typescript
const OPENAI_MODELS: AIModel[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Latest multimodal model',
    provider: 'openai',
    isLocal: false
  },
];

export class OpenAIProvider implements AIProvider {
  // Same pattern as other providers
}
```

### Provider-Specific Settings (Future)

```typescript
interface ProviderSettings {
  anthropic?: {
    defaultMaxTokens: number;
    defaultTemperature: number;
  };
  gemini?: {
    safetySettings: SafetySetting[];
  };
}
```

### Usage Tracking (Future)

```typescript
interface UsageRecord {
  providerId: ProviderId;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
  cost?: number;
}
```

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `src/main/credentials/manager.ts` | Create | Credential storage |
| `src/main/credentials/types.ts` | Create | Credential types |
| `src/main/credentials/index.ts` | Create | Barrel export |
| `src/main/providers/anthropic.ts` | Create | Anthropic provider |
| `src/main/providers/types.ts` | Modify | Add 'anthropic' type |
| `src/main/ai.ts` | Modify | Add Anthropic, auto key injection |
| `src/main/models.ts` | Modify | Include Anthropic models |
| `src/main/index.ts` | Modify | Add credential IPC handlers |
| `src/preload/index.ts` | Modify | Add credentials API |
| `src/renderer/src/types.ts` | Modify | Add Anthropic types |
| `src/renderer/.../APIKeysSection.tsx` | Modify | Multi-provider UI |
| `src/renderer/.../ModelSelector.tsx` | Modify | Provider grouping |
| `package.json` | Modify | Add @anthropic-ai/sdk |

---

*End of Design Document*
