# ArborChat Web Enablement Specification

> Enable ArborChat to run as both a desktop Electron app AND a web application accessible from mobile devices (iPhone Safari).

## Problem Statement

ArborChat is currently an Electron-only application. To enable remote development from iPhone, we need web access without sacrificing the desktop experience.

**Constraints:**
- iPhone cannot run Electron apps
- X11 forwarding not viable on iOS (no X server)
- RDP works but provides suboptimal touch UX for a chat interface
- Must preserve full desktop app functionality

## Solution: Hybrid Architecture

Refactor ArborChat to share a common backend between Electron and web modes. The UI remains unchanged; only the communication layer adapts.

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHARED BACKEND                               │
│  src/server/                                                     │
│  ├── index.ts       Express server entrypoint                   │
│  ├── api.ts         REST + WebSocket routes                     │
│  ├── ai.ts          AI provider orchestration (from main/)      │
│  ├── db.ts          SQLite operations (from main/)              │
│  ├── mcp/           MCP integration (from main/)                │
│  ├── providers/     Anthropic, Gemini, Ollama (from main/)      │
│  ├── credentials/   API key management (from main/)             │
│  └── personas/      Persona management (from main/)             │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┴───────────────────┐
          ▼                                       ▼
┌──────────────────────────┐        ┌──────────────────────────┐
│     ELECTRON MODE        │        │       WEB MODE           │
│                          │        │                          │
│  src/main/index.ts       │        │  npm run server          │
│  - Spawns embedded server│        │  - Standalone Express    │
│  - Creates BrowserWindow │        │  - Serves static build   │
│  - IPC proxies to HTTP   │        │  - CORS enabled          │
│                          │        │                          │
│  npm run dev / build     │        │  npm run web             │
│  Desktop App             │        │  Browser Access          │
└──────────────────────────┘        └──────────────────────────┘
```

## Architecture Details

### Mode Detection

The renderer detects which mode it's running in:

```typescript
// src/renderer/src/lib/api-client.ts
const isElectron = typeof window !== 'undefined' && window.electron !== undefined

export const apiClient = isElectron 
  ? createIPCClient()      // Uses window.api.* via preload
  : createHTTPClient()     // Uses fetch() to server
```

### API Surface

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/conversations` | GET | List all conversations |
| `/api/conversations` | POST | Create conversation |
| `/api/conversations/:id` | DELETE | Delete conversation |
| `/api/conversations/:id/messages` | GET | Get messages |
| `/api/conversations/:id/messages` | POST | Add message |
| `/api/ai/stream` | POST | SSE stream AI response |
| `/api/models` | GET | List available models |
| `/api/credentials/:provider` | GET/PUT/DELETE | Manage API keys |
| `/api/personas` | GET/POST | List/create personas |
| `/api/personas/:id` | GET/PUT/DELETE | Manage persona |
| `/api/mcp/tools` | GET | List MCP tools |
| `/api/mcp/execute` | POST | Execute MCP tool |
| `/ws` | WebSocket | Real-time events |

### AI Streaming

**Current (Electron IPC):**
```typescript
window.api.askAI(apiKey, messages, model)
window.api.onToken((token) => { /* append */ })
window.api.onDone(() => { /* complete */ })
```

**Web Mode (Server-Sent Events):**
```typescript
const eventSource = new EventSource('/api/ai/stream', {
  method: 'POST',
  body: JSON.stringify({ messages, model })
})
eventSource.onmessage = (e) => {
  if (e.data === '[DONE]') { /* complete */ }
  else { /* append token */ }
}
```

## File Migration Plan

### Phase 1: Extract Server Module

Move business logic from `src/main/` to `src/server/`:

| From | To | Notes |
|------|----|-------|
| `src/main/ai.ts` | `src/server/ai.ts` | Remove Electron imports |
| `src/main/db.ts` | `src/server/db.ts` | Parameterize db path |
| `src/main/providers/*` | `src/server/providers/*` | No changes needed |
| `src/main/credentials/*` | `src/server/credentials/*` | Abstract keytar |
| `src/main/mcp/*` | `src/server/mcp/*` | No changes needed |
| `src/main/personas/*` | `src/server/personas/*` | No changes needed |
| `src/main/models.ts` | `src/server/models.ts` | No changes needed |

### Phase 2: Create Express API

New file: `src/server/index.ts`

```typescript
import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { apiRouter } from './api'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/api', apiRouter)

// Serve static files in production web mode
if (process.env.MODE === 'web') {
  app.use(express.static('dist/renderer'))
}

const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/ws' })

export { app, server, wss }
```

New file: `src/server/api.ts`

```typescript
import { Router } from 'express'
import { streamResponse } from './ai'
import { getConversations, createConversation, ... } from './db'

export const apiRouter = Router()

// Conversations
apiRouter.get('/conversations', (req, res) => {
  res.json(getConversations())
})

apiRouter.post('/conversations', (req, res) => {
  const { title } = req.body
  res.json(createConversation(title))
})

// AI Streaming via SSE
apiRouter.post('/ai/stream', async (req, res) => {
  const { messages, model } = req.body
  
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  
  await streamResponseSSE(res, messages, model)
})

// ... additional routes
```

### Phase 3: Slim Down Electron Main

Refactored `src/main/index.ts`:

```typescript
import { app, BrowserWindow } from 'electron'
import { fork } from 'child_process'
import path from 'path'

let serverProcess: ChildProcess | null = null

function startEmbeddedServer() {
  serverProcess = fork(path.join(__dirname, '../server/index.js'), [], {
    env: { ...process.env, PORT: '3001', MODE: 'electron' }
  })
}

app.whenReady().then(() => {
  startEmbeddedServer()
  
  const mainWindow = new BrowserWindow({
    // ... existing config
  })
  
  // Load renderer which connects to localhost:3001
  mainWindow.loadFile('dist/renderer/index.html')
})

app.on('quit', () => {
  serverProcess?.kill()
})
```

### Phase 4: Update Preload Bridge

Keep IPC for Electron-specific features, proxy API calls:

```typescript
// src/preload/index.ts
const api = {
  // Proxy to embedded server
  getConversations: () => fetch('http://localhost:3001/api/conversations').then(r => r.json()),
  
  // Keep native dialogs via IPC
  selectDirectory: () => ipcRenderer.invoke('dialog:select-directory'),
  
  // AI streaming via EventSource wrapper
  askAI: (messages, model, onToken, onDone, onError) => {
    const eventSource = new EventSource(`http://localhost:3001/api/ai/stream?...`)
    eventSource.onmessage = (e) => {
      if (e.data === '[DONE]') { onDone(); eventSource.close() }
      else onToken(e.data)
    }
    eventSource.onerror = (e) => { onError(e); eventSource.close() }
  }
}
```

### Phase 5: Renderer API Abstraction

New file: `src/renderer/src/lib/api-client.ts`

```typescript
const isElectron = typeof window !== 'undefined' && 'electron' in window

const BASE_URL = isElectron ? 'http://localhost:3001' : ''

export async function getConversations() {
  if (isElectron && window.api?.getConversations) {
    return window.api.getConversations()
  }
  return fetch(`${BASE_URL}/api/conversations`).then(r => r.json())
}

export function streamAI(messages, model, callbacks) {
  if (isElectron && window.api?.askAI) {
    window.api.askAI(messages, model, callbacks.onToken, callbacks.onDone, callbacks.onError)
    return
  }
  
  // Web mode - use fetch + ReadableStream for POST with SSE
  fetch(`${BASE_URL}/api/ai/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, model })
  }).then(async (response) => {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) { callbacks.onDone(); break }
      callbacks.onToken(decoder.decode(value))
    }
  }).catch(callbacks.onError)
}
```

## Package.json Scripts

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build && electron-builder",
    "server": "tsx src/server/index.ts",
    "web:dev": "concurrently \"npm run server\" \"vite --config vite.web.config.ts\"",
    "web:build": "vite build --config vite.web.config.ts",
    "web:start": "MODE=web node dist/server/index.js"
  }
}
```

## New Dependencies

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "ws": "^8.14.2"
  },
  "devDependencies": {
    "concurrently": "^8.2.2",
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/ws": "^8.5.10"
  }
}
```

## Vite Web Config

New file: `vite.web.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src')
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/ws': { target: 'ws://localhost:3001', ws: true }
    }
  }
})
```

## Deployment Architecture

### Control Plane VM Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│  Control Plane VM (10.0.0.100)                                  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  PM2 Process: arborchat-web                                 ││
│  │  PORT=8080 MODE=web node dist/server/index.js               ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  http://10.0.0.100:8080                                     ││
│  │  - /api/*        → Express API                              ││
│  │  - /ws           → WebSocket                                ││
│  │  - /*            → Static React app                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
          ▲
          │ Tailscale VPN
          │
    ┌─────┴─────┐
    │  iPhone   │
    │  Safari   │
    │  http://100.x.x.x:8080
    └───────────┘
```

### Access Methods

| Method | URL | Use Case |
|--------|-----|----------|
| **Tailscale** | `http://100.x.x.x:8080` | iPhone Safari (recommended) |
| **SSH Tunnel** | `localhost:8080` via Termius | Backup if Tailscale unavailable |
| **Direct VM** | `http://10.0.0.100:8080` | From droplet host |

## Security Considerations

### API Key Protection

In web mode, API keys should NOT be sent from browser. Options:

1. **Server-side injection** (recommended)
   - Keys stored in server env or encrypted file
   - Browser never sees raw keys
   
2. **Session-based auth**
   - User logs in, gets JWT
   - Server associates JWT with stored keys

### CORS Configuration

```typescript
app.use(cors({
  origin: process.env.MODE === 'web' 
    ? ['http://localhost:5173', 'http://100.*.*.*:8080']  // Tailscale range
    : 'http://localhost:3001',
  credentials: true
}))
```

### Rate Limiting

```typescript
import rateLimit from 'express-rate-limit'

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 20,              // 20 requests per minute
  message: 'Too many AI requests'
})

apiRouter.use('/ai', aiLimiter)
```

## Implementation Phases

### Phase 1: Foundation (2-3 hours)
- [ ] Create `src/server/` directory structure
- [ ] Move business logic files
- [ ] Create basic Express server with health check
- [ ] Test server starts independently

### Phase 2: API Routes (2-3 hours)
- [ ] Implement conversation CRUD routes
- [ ] Implement message routes
- [ ] Implement AI streaming via SSE
- [ ] Implement credentials routes
- [ ] Test all routes via curl/Postman

### Phase 3: Electron Integration (1-2 hours)
- [ ] Update main process to spawn server
- [ ] Update preload to proxy through HTTP
- [ ] Test desktop app still works

### Phase 4: Web Build (1 hour)
- [ ] Create `vite.web.config.ts`
- [ ] Create api-client abstraction
- [ ] Build and test static web version

### Phase 5: Deployment (1 hour)
- [ ] Deploy to Control Plane VM
- [ ] Configure PM2
- [ ] Set up Tailscale access
- [ ] Test from iPhone Safari

## Testing Checklist

### Desktop Mode
- [ ] App launches normally
- [ ] Conversations persist
- [ ] AI streaming works
- [ ] MCP tools execute
- [ ] Personas load/save
- [ ] All providers (Anthropic, Gemini, Ollama) work

### Web Mode
- [ ] Server starts on configured port
- [ ] Static files serve correctly
- [ ] API routes respond
- [ ] AI streaming works in browser
- [ ] WebSocket connects
- [ ] Mobile touch interactions work
- [ ] Responsive layout on iPhone

## Rollback Plan

If issues arise, the original Electron-only architecture remains in git history. The refactor is additive - existing `src/main/` code paths continue to work until fully migrated.

## Future Enhancements

1. **PWA Support** - Add service worker for offline capability
2. **Push Notifications** - Alert when long AI response completes
3. **Collaborative Mode** - Multiple users sharing conversations
4. **Voice Input** - iOS speech-to-text integration

---

*Document created: December 28, 2025*
*Status: Planning*
