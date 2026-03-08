import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { randomUUID } from 'crypto'

const dbPath = join(app.getPath('userData'), 'arborchat.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

/**
 * Get the database instance
 * Used by services that need direct database access
 */
export function getDb(): Database.Database {
  return db;
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  parent_message_id: string | null
  created_at: string
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ModelAccessCacheRow {
  provider_id: string
  token_fingerprint: string
  model_id: string
  display_name: string
  description: string
  status: 'verified' | 'denied' | 'transient_error' | 'stale'
  last_checked_at: number
  expires_at: number
  deny_code: string | null
  deny_message: string | null
}

export interface ProviderDiscoveryStateRow {
  provider_id: string
  token_fingerprint: string
  last_refresh_at: number
  refresh_status: 'idle' | 'refreshing' | 'ready' | 'no_key' | 'error'
  error_code: string | null
  error_message: string | null
}

export function initDB(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      role TEXT CHECK(role IN ('user', 'assistant', 'system')),
      content TEXT,
      parent_message_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    CREATE TABLE IF NOT EXISTS model_access_cache (
      provider_id TEXT NOT NULL,
      token_fingerprint TEXT NOT NULL,
      model_id TEXT NOT NULL,
      display_name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('verified', 'denied', 'transient_error', 'stale')),
      last_checked_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      deny_code TEXT,
      deny_message TEXT,
      PRIMARY KEY (provider_id, token_fingerprint, model_id)
    );
    CREATE TABLE IF NOT EXISTS provider_discovery_state (
      provider_id TEXT NOT NULL,
      token_fingerprint TEXT NOT NULL,
      last_refresh_at INTEGER NOT NULL,
      refresh_status TEXT NOT NULL CHECK(refresh_status IN ('idle', 'refreshing', 'ready', 'no_key', 'error')),
      error_code TEXT,
      error_message TEXT,
      PRIMARY KEY (provider_id, token_fingerprint)
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_message_id);
    CREATE INDEX IF NOT EXISTS idx_model_access_provider_token ON model_access_cache(provider_id, token_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_model_access_provider_token_status ON model_access_cache(provider_id, token_fingerprint, status);
    CREATE INDEX IF NOT EXISTS idx_model_access_expires ON model_access_cache(expires_at);
    CREATE INDEX IF NOT EXISTS idx_provider_discovery_provider_token ON provider_discovery_state(provider_id, token_fingerprint);
  `)
}

export function upsertModelAccessCache(row: ModelAccessCacheRow): void {
  db.prepare(
    `INSERT INTO model_access_cache (
      provider_id, token_fingerprint, model_id, display_name, description,
      status, last_checked_at, expires_at, deny_code, deny_message
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider_id, token_fingerprint, model_id)
    DO UPDATE SET
      display_name = excluded.display_name,
      description = excluded.description,
      status = excluded.status,
      last_checked_at = excluded.last_checked_at,
      expires_at = excluded.expires_at,
      deny_code = excluded.deny_code,
      deny_message = excluded.deny_message`
  ).run(
    row.provider_id,
    row.token_fingerprint,
    row.model_id,
    row.display_name,
    row.description,
    row.status,
    row.last_checked_at,
    row.expires_at,
    row.deny_code,
    row.deny_message
  )
}

export function getModelAccessCacheRows(
  providerId: string,
  tokenFingerprint: string
): ModelAccessCacheRow[] {
  return db
    .prepare(
      `SELECT
        provider_id, token_fingerprint, model_id, display_name, description,
        status, last_checked_at, expires_at, deny_code, deny_message
      FROM model_access_cache
      WHERE provider_id = ? AND token_fingerprint = ?`
    )
    .all(providerId, tokenFingerprint) as ModelAccessCacheRow[]
}

export function getUsableModelAccessCacheRows(
  providerId: string,
  tokenFingerprint: string,
  now: number
): ModelAccessCacheRow[] {
  return db
    .prepare(
      `SELECT
        provider_id, token_fingerprint, model_id, display_name, description,
        status, last_checked_at, expires_at, deny_code, deny_message
      FROM model_access_cache
      WHERE provider_id = ?
        AND token_fingerprint = ?
        AND status IN ('verified', 'stale')
        AND expires_at > ?
      ORDER BY last_checked_at DESC`
    )
    .all(providerId, tokenFingerprint, now) as ModelAccessCacheRow[]
}

export function deleteModelAccessCacheForProvider(
  providerId: string,
  tokenFingerprint?: string
): void {
  if (tokenFingerprint) {
    db.prepare('DELETE FROM model_access_cache WHERE provider_id = ? AND token_fingerprint = ?').run(
      providerId,
      tokenFingerprint
    )
    return
  }
  db.prepare('DELETE FROM model_access_cache WHERE provider_id = ?').run(providerId)
}

export function deleteExpiredModelAccessCache(now: number): void {
  db.prepare('DELETE FROM model_access_cache WHERE expires_at <= ?').run(now)
}

export function deleteModelAccessCacheMissingModels(
  providerId: string,
  tokenFingerprint: string,
  modelIds: string[]
): void {
  if (modelIds.length === 0) {
    db.prepare('DELETE FROM model_access_cache WHERE provider_id = ? AND token_fingerprint = ?').run(
      providerId,
      tokenFingerprint
    )
    return
  }

  const placeholders = modelIds.map(() => '?').join(', ')
  db.prepare(
    `DELETE FROM model_access_cache
      WHERE provider_id = ?
        AND token_fingerprint = ?
        AND model_id NOT IN (${placeholders})`
  ).run(providerId, tokenFingerprint, ...modelIds)
}

export function upsertProviderDiscoveryState(row: ProviderDiscoveryStateRow): void {
  db.prepare(
    `INSERT INTO provider_discovery_state (
      provider_id, token_fingerprint, last_refresh_at, refresh_status, error_code, error_message
    ) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider_id, token_fingerprint)
    DO UPDATE SET
      last_refresh_at = excluded.last_refresh_at,
      refresh_status = excluded.refresh_status,
      error_code = excluded.error_code,
      error_message = excluded.error_message`
  ).run(
    row.provider_id,
    row.token_fingerprint,
    row.last_refresh_at,
    row.refresh_status,
    row.error_code,
    row.error_message
  )
}

export function getProviderDiscoveryStateRow(
  providerId: string,
  tokenFingerprint: string
): ProviderDiscoveryStateRow | undefined {
  return db
    .prepare(
      `SELECT
        provider_id, token_fingerprint, last_refresh_at, refresh_status, error_code, error_message
      FROM provider_discovery_state
      WHERE provider_id = ? AND token_fingerprint = ?`
    )
    .get(providerId, tokenFingerprint) as ProviderDiscoveryStateRow | undefined
}

export function deleteProviderDiscoveryState(
  providerId: string,
  tokenFingerprint?: string
): void {
  if (tokenFingerprint) {
    db.prepare(
      'DELETE FROM provider_discovery_state WHERE provider_id = ? AND token_fingerprint = ?'
    ).run(providerId, tokenFingerprint)
    return
  }
  db.prepare('DELETE FROM provider_discovery_state WHERE provider_id = ?').run(providerId)
}

// --- Conversations ---
export function createConversation(title: string = 'New Chat'): Conversation {
  const id = randomUUID()
  const now = new Date().toISOString()
  const stmt = db.prepare(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
  )
  stmt.run(id, title, now, now)
  return { id, title, created_at: now, updated_at: now }
}

export function getConversations(): Conversation[] {
  return db.prepare('SELECT * FROM conversations ORDER BY updated_at DESC').all() as Conversation[]
}

export function deleteConversation(id: string): void {
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
}

export function updateConversationTitle(id: string, title: string): void {
  db.prepare('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?').run(
    title,
    new Date().toISOString(),
    id
  )
}

// --- Messages ---
export function addMessage(
  conversationId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  parentId: string | null = null
): Message {
  const id = randomUUID()
  const created_at = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO messages (id, conversation_id, role, content, parent_message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, conversationId, role, content, parentId, created_at)

  // Update conversation timestamp
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(created_at, conversationId)

  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    parent_message_id: parentId,
    created_at
  }
}

export function getMessages(conversationId: string): Message[] {
  // Get all messages for the conversation, primarily to reconstruct logic in renderer
  // But for "Context Isolated" view, we might filter.
  // For V1, let's return all and let frontend/IPC filter or specific methods.
  return db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conversationId) as Message[]
}

export function getThread(): Message[] {
  // This is tricky in SQL recursive.
  // For V1, simplest: Get all messages where parent is root, OR parent is child of root...
  // Actually, "Thread" in this context:
  // A thread starts at a Root Message.
  // Clarifying questions (Children) point to Root? Or sequential?
  // "Thread" usually means: Root -> Child -> Child.
  // Child1 has parent Root. Child2 has parent Child1? Or Child2 also parent Root?
  // Discord/Slack threads: Flat list under a parent.
  // "Response from AI... ask clarifying questions".
  // So:
  // User: Hi
  // AI: Hello (ID: A)
  // User (Thread on A): What do you mean? (Parent: A)
  // AI (Thread on A): I mean X. (Parent: A? Or Parent: UserMessage?)
  // Usually threads are a separate linear timeline.
  // We can say: Messages in a thread all share a `root_message_id`? Or just linked list?
  // Linked list is most flexible (parent_id).
  // Recursive query is best to get full thread.

  // For V1 simpler approach:
  // We fetch ALL messages for conversation and build tree in frontend?
  // Or recursive CTE. SQLite supports CTE.

  // Let's stick to: Frontend gets all messages for conv, or we provide a specialized query.
  // Let's standard getMessages for now.
  return []
}

// --- Settings ---
export function setApiKey(key: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'openai_api_key',
    key
  )
}

export function getApiKey(): string | undefined {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('openai_api_key') as
    | { value: string }
    | undefined
  return row?.value
}

export function getSelectedModel(): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('selected_model') as
    | { value: string }
    | undefined
  return row?.value ?? 'gemini-2.5-flash'
}

export function setSelectedModel(model: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'selected_model',
    model
  )
}

export function getOllamaServerUrl(): string {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_server_url') as
    | { value: string }
    | undefined
  return row?.value ?? 'http://localhost:11434'
}

export function setOllamaServerUrl(url: string): void {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'ollama_server_url',
    url
  )
}
