// src/renderer/src/lib/serverIcons.ts
// Phase 7: Facade for backward compatibility
// Author: Alex Chen (Distinguished Software Architect)
//
// All logic has been moved to serverIconRegistry.ts for:
// - Prefix-based tool inference (scales without manual updates)
// - Runtime registration of new MCP servers
// - Dynamic icon generation for unknown servers
//
// This module is maintained ONLY for backward compatibility.
// New code should import from './serverIconRegistry' directly.

/**
 * @deprecated Import from './serverIconRegistry' for full API access.
 * This module is maintained for backward compatibility only.
 * 
 * Migration guide:
 * - `SERVER_ICONS` → `serverIconRegistry.getAllServers()`
 * - `getServerIcon()` → `serverIconRegistry.getServerIcon()`
 * - `getServerFromToolName()` → `serverIconRegistry.inferServerFromTool()`
 * - `getServerIconFromToolName()` → `serverIconRegistry.getIconFromTool()`
 */

export {
  serverIconRegistry,
  getServerIcon,
  getServerFromToolName,
  getServerIconFromToolName,
  type ServerIconConfig
} from './serverIconRegistry'

// Re-export SERVER_ICONS for any direct consumers
import { serverIconRegistry } from './serverIconRegistry'

/**
 * @deprecated Access via `serverIconRegistry.getAllServers()` instead.
 * 
 * This static object is maintained for backward compatibility.
 * Note: It only contains servers registered at module initialization time.
 * Use `serverIconRegistry.getAllServers()` to get all currently registered
 * servers, including those registered at runtime.
 */
export const SERVER_ICONS = Object.fromEntries(serverIconRegistry.getAllServers())

/**
 * @deprecated Import `TOOL_SERVER_MAP` is no longer exported.
 * 
 * Tool-to-server mapping now uses multiple strategies:
 * 1. Server hints from MCP metadata
 * 2. Prefix-based inference (e.g., 'gh_' → 'github')
 * 3. Explicit mappings (internal to registry)
 * 
 * Use `serverIconRegistry.inferServerFromTool(toolName, serverHint?)` instead.
 */
