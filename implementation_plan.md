# V1 Implementation Plan - ArborChat (Local-First Edition)

## Goal

Build a standout desktop AI chat application with a unique "Context-Isolated Threading" feature. V1 will be local-first, fast, and use a specialized data model.

## User Review Required

> [!IMPORTANT]
> **V1 Auth/Billing Strategy**: To enable the "quickest implementation" as requested, **V1 will use Bring-Your-Own-Key (BYOK)**. The user will paste their OpenAI API Key into settings.
>
> _Reasoning_: "Managed Billing" requires setting up a backend server to proxy requests and hide our master keys. BYOK allows us to build the _App_ immediately without backend infrastructure code. We will transition to Managed/Cloud in V2.

## Technical Stack

- **Runtime**: [Electron](https://www.electronjs.org/) (Chromium + Node.js)
- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS (Configured for "Discord-Dark" aesthetic: `#36393f`, `#2f3136`)
- **Database**: `better-sqlite3` (Running in Electron Main Process)
- **AI Client**: `openai` node library (Calling directly from Main Process or Renderer via Context Bridge)

## Proposed Changes

### 1. Project Initialization

- Scaffold `electron-vite-react` project.
- Configure Tailwind with Discord-inspired color palette.

### 2. Core Data Layer (SQLite)

We will implement a relational schema to support the threading model.

#### Database Schema

- **Conversations**: `id, title, created_at, model_config`
- **Messages**: `id, conversation_id, role (user/assistant), content, parent_message_id, created_at`
- **Threads**: Implemented via `parent_message_id`. A message with a `parent_message_id` implies it belongs to a thread spawned from that parent.

### 3. IPC (Inter-Process Communication) Architecture

- **Main Process**: Holds the `SQLite` connection and API Key `Store`.
- **Renderer**: Calls sensitive operations via `window.electronAPI`.
  - `saveUserMessage(content, parentId)`
  - `streamAIResponse(history, threadContext)`

### 4. The "Threading" Logic

- **Normal Chat**: Query `WHERE conversation_id = X AND parent_message_id IS NULL`.
- **Thread Chat**: When entering a thread for Message A:
  - Fetch Message A (The Root).
  - Fetch all messages `WHERE parent_message_id = Message_A_ID`.
  - **Context Construction**: The AI will receive `SystemPrompt + Message A + ThreadHistory`. It will _NOT_ see the rest of the main conversation, ensuring the "clarification" is focused.

## Verification Plan

### Automated Tests

- N/A for V1 Prototype (Speed focus).

### Manual Verification

1.  **Launch**: App opens on Windows.
2.  **Settings**: Can save an OpenAI Key.
3.  **Chat**: Can send a message and get a reply.
4.  **Threading**:
    - Click a "Thread" icon on an AI response.
    - UI shifts or opens sidebar (Discord style).
    - Ask a question _specifically_ about that response.
    - Verify AI answers based on that context only.
5.  **Persistence**: Restart app, ensure chats remain.
