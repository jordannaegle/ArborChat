// src/main/mcp/servers/github.ts

import { MCPServerConfig } from '../types'

/**
 * GitHub MCP Server Configuration
 *
 * GitHub MCP Server enables AI-assisted GitHub operations including
 * repository management, issue tracking, PR handling, and code search.
 *
 * Requires a GitHub Personal Access Token (PAT) with appropriate scopes.
 */
export const GITHUB_MCP_CONFIG: MCPServerConfig = {
  name: 'github',
  // Uses the official GitHub MCP server via npx
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github'],
  enabled: false, // Disabled by default until credentials are configured
  env: {
    // Token will be injected from secure credential storage at runtime
    // GITHUB_PERSONAL_ACCESS_TOKEN: '' // Set dynamically
  }
}

/**
 * Alternative configuration using Docker
 * Useful for isolated environments or when npx is not available
 */
export const GITHUB_MCP_DOCKER_CONFIG: MCPServerConfig = {
  name: 'github',
  command: 'docker',
  args: [
    'run',
    '-i',
    '--rm',
    '-e',
    'GITHUB_PERSONAL_ACCESS_TOKEN',
    'ghcr.io/github/github-mcp-server'
  ],
  enabled: false,
  env: {}
}

/**
 * Tool categories for UI grouping and filtering
 */
export const GITHUB_TOOL_CATEGORIES: Record<string, string[]> = {
  repository: [
    'search_repositories',
    'create_repository',
    'get_file_contents',
    'list_commits',
    'fork_repository',
    'create_branch'
  ],
  files: [
    'create_or_update_file',
    'push_files',
    'get_file_contents'
  ],
  issues: [
    'create_issue',
    'list_issues',
    'update_issue',
    'add_issue_comment',
    'search_issues'
  ],
  pullRequests: [
    'create_pull_request',
    'list_pull_requests',
    'get_pull_request',
    'merge_pull_request',
    'get_pull_request_diff',
    'get_pull_request_reviews',
    'update_pull_request_branch'
  ],
  search: [
    'search_code',
    'search_issues',
    'search_repositories',
    'search_users'
  ],
  users: [
    'get_me',
    'search_users'
  ]
}

/**
 * Risk levels for GitHub tools
 *
 * - safe: Read-only operations, no side effects
 * - moderate: Create/update operations within repositories
 * - dangerous: Destructive operations, repository/org-level changes
 */
export const GITHUB_TOOL_RISK_LEVELS: Record<string, 'safe' | 'moderate' | 'dangerous'> = {
  // Safe - read-only operations
  get_file_contents: 'safe',
  list_commits: 'safe',
  list_issues: 'safe',
  list_pull_requests: 'safe',
  get_pull_request: 'safe',
  get_pull_request_diff: 'safe',
  get_pull_request_reviews: 'safe',
  search_repositories: 'safe',
  search_code: 'safe',
  search_issues: 'safe',
  search_users: 'safe',
  get_me: 'safe',

  // Moderate - create/update within existing repos
  create_issue: 'moderate',
  update_issue: 'moderate',
  add_issue_comment: 'moderate',
  create_or_update_file: 'moderate',
  push_files: 'moderate',
  create_branch: 'moderate',
  create_pull_request: 'moderate',
  update_pull_request_branch: 'moderate',

  // Dangerous - repository-level operations
  create_repository: 'dangerous',
  fork_repository: 'dangerous',
  merge_pull_request: 'dangerous',
  delete_branch: 'dangerous'
}

/**
 * Get the category for a GitHub tool
 */
export function getGitHubToolCategory(toolName: string): string | undefined {
  for (const [category, tools] of Object.entries(GITHUB_TOOL_CATEGORIES)) {
    if (tools.includes(toolName)) {
      return category
    }
  }
  return undefined
}

/**
 * Get the risk level for a GitHub tool (defaults to 'moderate' if unknown)
 */
export function getGitHubToolRiskLevel(toolName: string): 'safe' | 'moderate' | 'dangerous' {
  return GITHUB_TOOL_RISK_LEVELS[toolName] || 'moderate'
}

/**
 * Get human-readable description for a GitHub tool category
 */
export function getGitHubCategoryDescription(category: string): string {
  const descriptions: Record<string, string> = {
    repository: 'Repository Management',
    files: 'File Operations',
    issues: 'Issue Tracking',
    pullRequests: 'Pull Request Management',
    search: 'Search Operations',
    users: 'User Information'
  }
  return descriptions[category] || category
}

/**
 * Required PAT scopes for full GitHub MCP functionality
 */
export const REQUIRED_GITHUB_SCOPES = [
  'repo',           // Full control of private repositories
  'read:org',       // Read organization data
  'read:user',      // Read user profile data
  'workflow'        // Update GitHub Actions workflows (optional)
]

/**
 * Minimum PAT scopes for read-only access
 */
export const READONLY_GITHUB_SCOPES = [
  'public_repo',
  'read:user'
]
