// src/renderer/src/data/agentTemplates.ts
// Built-in agent templates for common tasks (Phase 6)

import type { AgentTemplate } from '../types/agent'

/**
 * Default agent templates - predefined configurations for common coding tasks
 */
export const DEFAULT_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'template-code-review',
    name: 'Code Review',
    description: 'Analyze code for bugs, performance issues, and best practices',
    icon: 'Search',
    category: 'development',
    instructions: `Please review the code in this project for:
1. Potential bugs and edge cases
2. Performance issues
3. Security vulnerabilities
4. Code style and best practices
5. Opportunities for refactoring

Provide specific, actionable feedback with file locations and code examples.`,
    toolPermission: 'standard',
    tags: ['review', 'quality', 'analysis'],
    isBuiltIn: true,
    requiresDirectory: true
  },
  {
    id: 'template-bug-fix',
    name: 'Bug Fix',
    description: 'Investigate and fix a reported bug or issue',
    icon: 'Bug',
    category: 'development',
    instructions: `I need help fixing a bug. Please:
1. First, understand the issue by reading relevant code
2. Identify the root cause
3. Propose a fix with explanation
4. Implement the fix
5. Verify the fix works by reading the updated code

Be methodical and explain your reasoning at each step.`,
    toolPermission: 'standard',
    tags: ['debug', 'fix', 'troubleshoot'],
    isBuiltIn: true,
    requiresDirectory: true
  },
  {
    id: 'template-documentation',
    name: 'Documentation',
    description: 'Generate or improve code documentation',
    icon: 'FileText',
    category: 'documentation',
    instructions: `Please help with documentation:
1. Analyze the codebase structure
2. Identify undocumented or poorly documented sections
3. Generate comprehensive documentation including:
   - Function/method descriptions
   - Parameter explanations
   - Return value documentation
   - Usage examples
4. Create or update README files as needed

Follow JSDoc/TSDoc conventions for code comments.`,
    toolPermission: 'standard',
    tags: ['docs', 'readme', 'comments'],
    isBuiltIn: true,
    requiresDirectory: true
  },
  {
    id: 'template-refactor',
    name: 'Refactoring',
    description: 'Improve code structure and maintainability',
    icon: 'RefreshCw',
    category: 'development',
    instructions: `Please help refactor this code to improve:
1. Code organization and structure
2. Readability and maintainability
3. Adherence to SOLID principles
4. Elimination of code duplication
5. Better separation of concerns

Make incremental changes, testing each step, and explain the improvements made.`,
    toolPermission: 'standard',
    tags: ['refactor', 'clean', 'improve'],
    isBuiltIn: true,
    requiresDirectory: true
  },
  {
    id: 'template-test-generation',
    name: 'Test Generation',
    description: 'Create unit tests for existing code',
    icon: 'TestTube',
    category: 'development',
    instructions: `Please generate comprehensive tests:
1. Analyze the code to understand functionality
2. Identify edge cases and error conditions
3. Write unit tests covering:
   - Happy path scenarios
   - Edge cases
   - Error handling
   - Boundary conditions
4. Use the project's existing test framework

Aim for high coverage while focusing on meaningful tests.`,
    toolPermission: 'standard',
    tags: ['testing', 'unit-tests', 'coverage'],
    isBuiltIn: true,
    requiresDirectory: true
  },
  {
    id: 'template-feature-implementation',
    name: 'Feature Implementation',
    description: 'Build a new feature from requirements',
    icon: 'Sparkles',
    category: 'development',
    instructions: `Please implement the following feature:

1. Understand the requirements
2. Plan the implementation approach
3. Create necessary files and components
4. Implement the feature step by step
5. Test and verify the implementation
6. Report on completion

Ask clarifying questions if requirements are unclear.`,
    toolPermission: 'autonomous',
    tags: ['feature', 'implement', 'build'],
    isBuiltIn: true,
    requiresDirectory: true
  },
  {
    id: 'template-codebase-exploration',
    name: 'Codebase Explorer',
    description: 'Learn and summarize a codebase structure',
    icon: 'FolderTree',
    category: 'analysis',
    instructions: `Please explore this codebase and provide:
1. High-level architecture overview
2. Key directories and their purposes
3. Main entry points and workflows
4. Dependencies and their roles
5. Configuration and environment setup
6. Suggested areas for improvement

Create a mental map of how the system works.`,
    toolPermission: 'standard',
    tags: ['explore', 'understand', 'architecture'],
    isBuiltIn: true,
    requiresDirectory: true
  }
]

/**
 * Get a template by ID
 */
export function getTemplateById(id: string): AgentTemplate | undefined {
  return DEFAULT_AGENT_TEMPLATES.find(t => t.id === id)
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: string): AgentTemplate[] {
  return DEFAULT_AGENT_TEMPLATES.filter(t => t.category === category)
}
