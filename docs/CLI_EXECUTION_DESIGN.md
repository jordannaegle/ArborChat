# ArborChat CLI Execution System - Technical Design Document

## Executive Summary

This document outlines the architecture for enabling ArborChat's AI to execute CLI commands on the local machine. The system follows a **human-in-the-loop** approval model where the AI can suggest commands, but execution requires explicit user consent.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RENDERER PROCESS                               │
│  ┌─────────────────┐    ┌──────────────────┐    ┌───────────────────┐   │
│  │   ChatWindow    │───▶│ CommandApproval  │───▶│  TerminalOutput   │   │
│  │  (AI suggests)  │    │    (User Y/N)    │    │   (Live stream)   │   │
│  └─────────────────┘    └──────────────────┘    └───────────────────┘   │
│           │                      │                        ▲              │
│           ▼                      ▼                        │              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                     window.api.cli.*                             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ IPC (contextBridge)
┌──────────────────────────────────┼──────────────────────────────────────┐
│                           PRELOAD SCRIPT                                 │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  Exposes: execute, cancel, getRunning, onOutput, onExit, etc.   │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ ipcRenderer ↔ ipcMain
┌──────────────────────────────────┼──────────────────────────────────────┐
│                            MAIN PROCESS                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                        CLIExecutor                                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │   │
│  │  │  Security   │  │   Process   │  │      Output Streamer     │  │   │
│  │  │  Validator  │  │   Manager   │  │   (stdout/stderr → IPC)  │  │   │
│  │  └─────────────┘  └─────────────┘  └──────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                   │                                      │
│                        ┌──────────┴──────────┐                          │
│                        │  child_process.spawn │                          │
│                        └─────────────────────┘                          │
└─────────────────────────────────────────────────────────────────────────┘
                                   │
                            ┌──────┴──────┐
                            │   SYSTEM    │
                            │  (bash/zsh) │
                            └─────────────┘
```

---

## Security Model

### 1. Human-in-the-Loop Approval

**Every command requires explicit user approval before execution.**

```typescript
interface CommandRequest {
  id: string // Unique request ID
  command: string // The command to execute
  args: string[] // Command arguments (parsed)
  rawCommand: string // Original unparsed command string
  workingDir: string // Execution directory
  explanation: string // AI's explanation of what this does
  riskLevel: 'safe' | 'moderate' | 'dangerous'
  estimatedDuration?: string // "instant" | "seconds" | "minutes" | "long-running"
}

interface CommandApproval {
  requestId: string
  approved: boolean
  modifiedCommand?: string // User can modify before approving
}
```

### 2. Risk Classification

Commands are automatically classified by risk level:

| Risk Level    | Examples                                    | UI Treatment                          |
| ------------- | ------------------------------------------- | ------------------------------------- |
| **Safe**      | `ls`, `pwd`, `cat`, `echo`, `date`          | Green indicator, single-click approve |
| **Moderate**  | `npm install`, `git commit`, `mkdir`        | Yellow indicator, confirm dialog      |
| **Dangerous** | `rm -rf`, `sudo`, `chmod 777`, `curl \| sh` | Red indicator, type-to-confirm        |

### 3. Blocklist (Never Execute)

```typescript
const BLOCKED_COMMANDS = [
  'rm -rf /',
  'rm -rf ~',
  'mkfs',
  'dd if=',
  ':(){:|:&};:', // Fork bomb
  '> /dev/sda',
  'chmod -R 777 /',
  'curl * | sudo bash', // Piped execution
  'wget * | sh'
]

const BLOCKED_PATTERNS = [
  /sudo\s+rm\s+-rf\s+\/(?!tmp)/, // sudo rm -rf outside /tmp
  />\s*\/dev\/[sh]d[a-z]/, // Writing to disk devices
  /curl.*\|\s*(sudo\s+)?bash/ // Pipe to bash
]
```

### 4. Sandboxing Options

```typescript
interface CLIConfig {
  // Restrict to specific directories
  allowedDirectories: string[] // e.g., ['~/projects', '/tmp']

  // Environment restrictions
  inheritEnv: boolean // Inherit parent environment
  customEnv: Record<string, string> // Override specific vars

  // Resource limits
  maxExecutionTime: number // Timeout in ms (default: 300000 = 5min)
  maxOutputSize: number // Max bytes to capture (default: 10MB)

  // Shell configuration
  shell: string // '/bin/zsh' | '/bin/bash' | 'powershell.exe'
}
```

---

## IPC Protocol

### Main Process Handlers

```typescript
// src/main/cli.ts

import { spawn, ChildProcess } from 'child_process'
import { ipcMain, BrowserWindow } from 'electron'
import { v4 as uuid } from 'uuid'

interface ProcessHandle {
  id: string
  process: ChildProcess
  command: string
  startTime: Date
  status: 'running' | 'completed' | 'failed' | 'cancelled'
}

const activeProcesses = new Map<string, ProcessHandle>()

// Execute a command (after approval)
ipcMain.handle(
  'cli:execute',
  async (
    event,
    request: {
      command: string
      workingDir?: string
      env?: Record<string, string>
      timeout?: number
    }
  ) => {
    const id = uuid()
    const { command, workingDir, env, timeout = 300000 } = request

    // Security validation
    const validation = validateCommand(command)
    if (!validation.allowed) {
      return { id, error: validation.reason, blocked: true }
    }

    return new Promise((resolve) => {
      const proc = spawn(command, [], {
        shell: true,
        cwd: workingDir || process.cwd(),
        env: { ...process.env, ...env },
        timeout
      })

      const handle: ProcessHandle = {
        id,
        process: proc,
        command,
        startTime: new Date(),
        status: 'running'
      }
      activeProcesses.set(id, handle)

      const win = BrowserWindow.fromWebContents(event.sender)

      // Stream stdout
      proc.stdout?.on('data', (data: Buffer) => {
        win?.webContents.send('cli:stdout', { id, data: data.toString() })
      })

      // Stream stderr
      proc.stderr?.on('data', (data: Buffer) => {
        win?.webContents.send('cli:stderr', { id, data: data.toString() })
      })

      // Process exit
      proc.on('close', (code, signal) => {
        handle.status = code === 0 ? 'completed' : 'failed'
        activeProcesses.delete(id)
        win?.webContents.send('cli:exit', { id, code, signal })
        resolve({ id, code, signal })
      })

      proc.on('error', (err) => {
        handle.status = 'failed'
        activeProcesses.delete(id)
        win?.webContents.send('cli:error', { id, error: err.message })
        resolve({ id, error: err.message })
      })

      // Return immediately with process ID
      resolve({ id, started: true })
    })
  }
)

// Cancel a running process
ipcMain.handle('cli:cancel', async (_, processId: string) => {
  const handle = activeProcesses.get(processId)
  if (handle) {
    handle.process.kill('SIGTERM')
    // Force kill after 5s if still running
    setTimeout(() => {
      if (!handle.process.killed) {
        handle.process.kill('SIGKILL')
      }
    }, 5000)
    handle.status = 'cancelled'
    activeProcesses.delete(processId)
    return { cancelled: true }
  }
  return { cancelled: false, reason: 'Process not found' }
})

// Get all running processes
ipcMain.handle('cli:list', async () => {
  return Array.from(activeProcesses.values()).map((h) => ({
    id: h.id,
    command: h.command,
    startTime: h.startTime.toISOString(),
    status: h.status,
    duration: Date.now() - h.startTime.getTime()
  }))
})

// Send input to a process (for interactive commands)
ipcMain.handle(
  'cli:stdin',
  async (
    _,
    {
      processId,
      input
    }: {
      processId: string
      input: string
    }
  ) => {
    const handle = activeProcesses.get(processId)
    if (handle && handle.process.stdin) {
      handle.process.stdin.write(input)
      return { sent: true }
    }
    return { sent: false }
  }
)
```

### Preload Exposure

```typescript
// src/preload/index.ts (additions)

const cliApi = {
  // Execute a command
  execute: (request: {
    command: string
    workingDir?: string
    env?: Record<string, string>
    timeout?: number
  }) => ipcRenderer.invoke('cli:execute', request),

  // Cancel a running process
  cancel: (processId: string) => ipcRenderer.invoke('cli:cancel', processId),

  // List running processes
  list: () => ipcRenderer.invoke('cli:list'),

  // Send input to a process
  sendInput: (processId: string, input: string) =>
    ipcRenderer.invoke('cli:stdin', { processId, input }),

  // Event listeners
  onStdout: (callback: (data: { id: string; data: string }) => void) =>
    ipcRenderer.on('cli:stdout', (_, data) => callback(data)),

  onStderr: (callback: (data: { id: string; data: string }) => void) =>
    ipcRenderer.on('cli:stderr', (_, data) => callback(data)),

  onExit: (callback: (data: { id: string; code: number; signal?: string }) => void) =>
    ipcRenderer.on('cli:exit', (_, data) => callback(data)),

  onError: (callback: (data: { id: string; error: string }) => void) =>
    ipcRenderer.on('cli:error', (_, data) => callback(data)),

  // Cleanup listeners
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('cli:stdout')
    ipcRenderer.removeAllListeners('cli:stderr')
    ipcRenderer.removeAllListeners('cli:exit')
    ipcRenderer.removeAllListeners('cli:error')
  }
}

// Add to contextBridge
contextBridge.exposeInMainWorld('api', {
  ...existingApi,
  cli: cliApi
})
```

---

## AI Integration

### System Prompt Augmentation

When CLI execution is enabled, augment the AI system prompt:

```typescript
const CLI_SYSTEM_PROMPT = `
You have the ability to execute commands on the user's local machine.

## Command Execution Format

When you want to run a command, use this exact format:

\`\`\`execute
{
  "command": "the command to run",
  "workingDir": "/optional/working/directory",
  "explanation": "Brief explanation of what this does and why",
  "riskLevel": "safe|moderate|dangerous"
}
\`\`\`

## Guidelines

1. **Always explain** what a command does before suggesting it
2. **Prefer safe operations** - read before write, list before delete
3. **Break down complex tasks** into multiple smaller commands
4. **Wait for results** before suggesting the next command
5. **Handle errors gracefully** - suggest fixes when commands fail

## Risk Levels

- **safe**: Read-only operations (ls, cat, pwd, git status)
- **moderate**: Write operations in project directories (npm install, git commit)
- **dangerous**: System-wide changes, deletions, elevated privileges
`
```

### Parsing AI Responses

````typescript
// src/renderer/src/lib/commandParser.ts

interface ParsedCommand {
  command: string
  workingDir?: string
  explanation: string
  riskLevel: 'safe' | 'moderate' | 'dangerous'
}

export function parseCommandBlocks(content: string): ParsedCommand[] {
  const regex = /```execute\n([\s\S]*?)\n```/g
  const commands: ParsedCommand[] = []

  let match
  while ((match = regex.exec(content)) !== null) {
    try {
      const parsed = JSON.parse(match[1])
      commands.push({
        command: parsed.command,
        workingDir: parsed.workingDir,
        explanation: parsed.explanation || 'No explanation provided',
        riskLevel: parsed.riskLevel || 'moderate'
      })
    } catch (e) {
      console.error('Failed to parse command block:', e)
    }
  }

  return commands
}

export function stripCommandBlocks(content: string): string {
  return content.replace(/```execute\n[\s\S]*?\n```/g, '[Command block]')
}
````

---

## UI Components

### CommandApprovalCard

```tsx
// src/renderer/src/components/CommandApprovalCard.tsx

interface CommandApprovalCardProps {
  command: ParsedCommand
  onApprove: (command: string) => void
  onReject: () => void
  onModify: (newCommand: string) => void
}

export function CommandApprovalCard({
  command,
  onApprove,
  onReject,
  onModify
}: CommandApprovalCardProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editedCommand, setEditedCommand] = useState(command.command)

  const riskColors = {
    safe: 'border-green-500/50 bg-green-500/10',
    moderate: 'border-yellow-500/50 bg-yellow-500/10',
    dangerous: 'border-red-500/50 bg-red-500/10'
  }

  return (
    <div className={cn('rounded-lg border-2 p-4 my-2', riskColors[command.riskLevel])}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Terminal size={16} />
        <span className="font-medium">Command Request</span>
        <RiskBadge level={command.riskLevel} />
      </div>

      {/* Explanation */}
      <p className="text-sm text-text-muted mb-3">{command.explanation}</p>

      {/* Command display/edit */}
      <div className="bg-tertiary rounded-md p-3 font-mono text-sm mb-3">
        {isEditing ? (
          <textarea
            value={editedCommand}
            onChange={(e) => setEditedCommand(e.target.value)}
            className="w-full bg-transparent focus:outline-none resize-none"
            rows={3}
          />
        ) : (
          <code>{command.command}</code>
        )}
      </div>

      {/* Working directory */}
      {command.workingDir && (
        <p className="text-xs text-text-muted mb-3">📁 {command.workingDir}</p>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onApprove(editedCommand)}
          className={cn(
            'px-4 py-2 rounded-md font-medium transition-colors',
            'bg-green-600 hover:bg-green-500 text-white'
          )}
        >
          ✓ Run
        </button>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 rounded-md bg-secondary hover:bg-secondary/80"
        >
          ✎ Edit
        </button>
        <button
          onClick={onReject}
          className="px-4 py-2 rounded-md bg-red-600/20 hover:bg-red-600/30 text-red-400"
        >
          ✕ Reject
        </button>
      </div>
    </div>
  )
}
```

### TerminalOutput

```tsx
// src/renderer/src/components/TerminalOutput.tsx

interface TerminalOutputProps {
  processId: string
  onCancel: () => void
}

export function TerminalOutput({ processId, onCancel }: TerminalOutputProps) {
  const [output, setOutput] = useState<Array<{ type: 'stdout' | 'stderr'; text: string }>>([])
  const [status, setStatus] = useState<'running' | 'completed' | 'failed'>('running')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleStdout = (data: { id: string; data: string }) => {
      if (data.id === processId) {
        setOutput((prev) => [...prev, { type: 'stdout', text: data.data }])
      }
    }

    const handleStderr = (data: { id: string; data: string }) => {
      if (data.id === processId) {
        setOutput((prev) => [...prev, { type: 'stderr', text: data.data }])
      }
    }

    const handleExit = (data: { id: string; code: number }) => {
      if (data.id === processId) {
        setStatus(data.code === 0 ? 'completed' : 'failed')
        setExitCode(data.code)
      }
    }

    window.api.cli.onStdout(handleStdout)
    window.api.cli.onStderr(handleStderr)
    window.api.cli.onExit(handleExit)

    return () => window.api.cli.removeAllListeners()
  }, [processId])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [output])

  return (
    <div className="rounded-lg border border-secondary bg-tertiary overflow-hidden my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/50 border-b border-secondary">
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span className="text-xs font-mono text-text-muted">PID: {processId.slice(0, 8)}</span>
        </div>
        {status === 'running' && (
          <button
            onClick={onCancel}
            className="text-xs px-2 py-1 rounded bg-red-600/20 text-red-400 hover:bg-red-600/30"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Output */}
      <div ref={scrollRef} className="p-3 font-mono text-xs max-h-64 overflow-y-auto">
        {output.map((line, i) => (
          <pre
            key={i}
            className={cn('whitespace-pre-wrap', line.type === 'stderr' && 'text-red-400')}
          >
            {line.text}
          </pre>
        ))}
        {status === 'running' && <span className="animate-pulse">▊</span>}
      </div>

      {/* Footer */}
      {status !== 'running' && (
        <div
          className={cn(
            'px-3 py-2 text-xs border-t border-secondary',
            status === 'completed' ? 'text-green-400' : 'text-red-400'
          )}
        >
          Process exited with code {exitCode}
        </div>
      )}
    </div>
  )
}
```

---

## Database Schema Extension

Store command execution history for context:

```typescript
// src/main/db.ts (additions)

interface CommandExecution {
  id: string
  conversationId: string
  messageId: string // The AI message that suggested the command
  command: string
  workingDir: string | null
  output: string
  exitCode: number | null
  status: 'approved' | 'rejected' | 'completed' | 'failed' | 'cancelled'
  executedAt: string
  duration: number | null // ms
}

// Add to schema
db.exec(`
  CREATE TABLE IF NOT EXISTS command_executions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    command TEXT NOT NULL,
    working_dir TEXT,
    output TEXT,
    exit_code INTEGER,
    status TEXT NOT NULL,
    executed_at TEXT NOT NULL,
    duration INTEGER,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  )
`)
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)

- [ ] Create `src/main/cli.ts` with basic execute/cancel
- [ ] Update preload with CLI API
- [ ] Update type definitions
- [ ] Basic CommandApprovalCard component
- [ ] Basic TerminalOutput component

### Phase 2: Security

- [ ] Command validation and blocklist
- [ ] Risk classification logic
- [ ] Directory sandboxing
- [ ] Timeout enforcement

### Phase 3: AI Integration

- [ ] System prompt augmentation
- [ ] Command block parser
- [ ] Integrate with message rendering
- [ ] Result feedback to AI context

### Phase 4: Polish

- [ ] Command history storage
- [ ] Settings UI for CLI config
- [ ] Keyboard shortcuts (Cmd+Enter to approve)
- [ ] Copy output button
- [ ] Collapsible output sections

---

## Configuration UI

Add a settings section for CLI preferences:

```tsx
// Settings modal section
<SettingsSection title="CLI Execution">
  <Toggle
    label="Enable command execution"
    description="Allow the AI to suggest terminal commands"
    checked={cliEnabled}
    onChange={setCLIEnabled}
  />

  <DirectoryPicker
    label="Allowed directories"
    description="Restrict command execution to these paths"
    paths={allowedDirs}
    onChange={setAllowedDirs}
  />

  <NumberInput
    label="Timeout (seconds)"
    description="Maximum time a command can run"
    value={timeout}
    onChange={setTimeout}
    min={10}
    max={3600}
  />

  <Select
    label="Default shell"
    options={[
      { value: '/bin/zsh', label: 'Zsh' },
      { value: '/bin/bash', label: 'Bash' }
    ]}
    value={shell}
    onChange={setShell}
  />
</SettingsSection>
```

---

## Open Questions

1. **Should command output be persisted to disk or kept in memory only?**
   - Pro: Searchable history, survives restart
   - Con: Privacy concerns, storage growth

2. **Should we support interactive commands (e.g., `vim`, `less`)?**
   - Requires PTY allocation (node-pty)
   - Significant complexity increase

3. **How should we handle long-running processes (e.g., `npm run dev`)?**
   - Background process management
   - System tray integration?

4. **Should there be a "trusted commands" list that skips approval?**
   - User convenience vs security tradeoff

---

## Appendix: Security Considerations

### Never Allow

- Root/sudo access without extreme user confirmation
- Writing to system directories
- Network requests with piped execution
- Recursive deletions outside project directories
- Forking/backgrounding processes that could outlive the app

### Always Log

- Every command suggestion (even rejected)
- All executions with full output
- User modifications to commands
- Approval/rejection decisions

### Escape Hatches

- Global kill switch in settings
- Emergency "kill all" button
- Automatic cleanup on app quit
