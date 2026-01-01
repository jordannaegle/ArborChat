// src/renderer/src/lib/errorAnalyzer.ts
// Intelligent error analysis and recovery guidance
// Author: Alex Chen (Distinguished Software Architect)
// Phase 1: Coding Capability Improvements

export type ErrorType = 
  | 'not_found' 
  | 'permission' 
  | 'parse' 
  | 'timeout' 
  | 'network'
  | 'rate_limit'
  | 'validation'
  | 'unknown'

/**
 * Analyze an error message to determine its type
 */
export function analyzeError(error: string): ErrorType {
  const errorLower = error.toLowerCase()
  
  if (errorLower.includes('enoent') || errorLower.includes('not found') || errorLower.includes('no such file')) {
    return 'not_found'
  }
  if (errorLower.includes('eacces') || errorLower.includes('permission denied') || errorLower.includes('access denied')) {
    return 'permission'
  }
  if (errorLower.includes('json') || errorLower.includes('parse') || errorLower.includes('syntax error')) {
    return 'parse'
  }
  if (errorLower.includes('timeout') || errorLower.includes('etimedout') || errorLower.includes('timed out')) {
    return 'timeout'
  }
  if (errorLower.includes('network') || errorLower.includes('econnrefused') || errorLower.includes('enotfound')) {
    return 'network'
  }
  if (errorLower.includes('rate limit') || errorLower.includes('429') || errorLower.includes('too many requests')) {
    return 'rate_limit'
  }
  if (errorLower.includes('invalid') || errorLower.includes('required') || errorLower.includes('must be')) {
    return 'validation'
  }
  
  return 'unknown'
}

/**
 * Generate recovery guidance based on error type and context
 */
export function generateErrorGuidance(
  toolName: string,
  args: Record<string, unknown>,
  errorType: ErrorType
): string {
  const path = args.path || args.file_path || args.source
  
  switch (errorType) {
    case 'not_found':
      return `The path "${path}" does not exist. Recovery steps:
1. Use \`list_directory\` to verify the correct path exists
2. Check for typos in the file or directory name
3. Verify you're using the correct working directory
4. The file may have been moved or deleted`

    case 'permission':
      return `Permission denied for "${path}". This may be because:
1. The file is read-only or owned by another user
2. It's in a protected system directory
3. Another process has the file locked
4. Try a different location or check file permissions`

    case 'parse':
      return `Content parsing failed. Common fixes:
1. Ensure JSON content is properly formatted
2. Check that quotes are properly escaped (use \\" for quotes inside strings)
3. Remove trailing commas from arrays and objects
4. Verify the content encoding is UTF-8`

    case 'timeout':
      return `The operation timed out. Try:
1. Breaking the operation into smaller steps
2. Running the command with a longer timeout
3. Checking if the target system is responsive
4. The process may still be running - use \`list_sessions\` to check`

    case 'network':
      return `Network error occurred. Check:
1. Internet connectivity is available
2. The target host/service is accessible
3. Firewall settings allow the connection
4. DNS resolution is working properly`

    case 'rate_limit':
      return `Rate limit exceeded. Wait a moment and:
1. Reduce the frequency of API calls
2. Batch multiple small operations together
3. Wait 30-60 seconds before retrying
4. Consider caching results to reduce API calls`

    case 'validation':
      return `Validation error for ${toolName}. Check:
1. All required parameters are provided
2. Parameter values match the expected types
3. File paths are absolute, not relative
4. String values don't contain invalid characters`

    default:
      return `An error occurred with ${toolName}. General recovery:
1. Review the error message for specific details
2. Verify all input parameters are correct
3. Try the operation again - it may be transient
4. Consider an alternative approach if this continues`
  }
}

/**
 * Format an error with guidance for the AI
 */
export function formatErrorWithGuidance(
  toolName: string,
  args: Record<string, unknown>,
  error: string
): string {
  const errorType = analyzeError(error)
  const guidance = generateErrorGuidance(toolName, args, errorType)
  
  return `<tool_result name="${toolName}" status="error">
${error}
</tool_result>

<error_analysis type="${errorType}">
${guidance}
</error_analysis>`
}

/**
 * Check if an error is potentially recoverable
 */
export function isRecoverableError(error: string): boolean {
  const errorType = analyzeError(error)
  
  // These error types may resolve on retry
  const recoverableTypes: ErrorType[] = ['timeout', 'network', 'rate_limit']
  return recoverableTypes.includes(errorType)
}

/**
 * Get retry delay suggestion based on error type
 */
export function getSuggestedRetryDelay(error: string): number {
  const errorType = analyzeError(error)
  
  switch (errorType) {
    case 'rate_limit':
      return 30000 // 30 seconds
    case 'timeout':
      return 5000  // 5 seconds
    case 'network':
      return 10000 // 10 seconds
    default:
      return 1000  // 1 second
  }
}

/**
 * Extract the most relevant error message from a verbose error
 */
export function extractErrorSummary(error: string, maxLength: number = 200): string {
  // Try to find the most meaningful part of the error
  const lines = error.split('\n').filter(l => l.trim())
  
  // Look for common error message patterns
  for (const line of lines) {
    if (line.includes('Error:') || line.includes('error:')) {
      const summary = line.split(/[Ee]rror:/).pop()?.trim()
      if (summary && summary.length <= maxLength) {
        return summary
      }
    }
  }
  
  // Fall back to first line, truncated if needed
  const firstLine = lines[0] || error
  if (firstLine.length > maxLength) {
    return firstLine.substring(0, maxLength - 3) + '...'
  }
  
  return firstLine
}
