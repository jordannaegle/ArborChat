import React, { useState, useCallback } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface CodeBlockProps {
  code: string
  language?: string
  className?: string
}

export function CodeBlock({
  code,
  language = 'text',
  className
}: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy code:', err)
    }
  }, [code])

  // Normalize language name
  const normalizedLanguage = language?.toLowerCase().replace(/^language-/, '') || 'text'

  return (
    <div className={cn('code-block group relative my-3 rounded-lg overflow-hidden', className)}>
      {/* Header with language label and copy button */}
      <div className="code-block-header flex items-center justify-between px-4 py-2 bg-tertiary/80 border-b border-tertiary">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
          {normalizedLanguage}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
            'transition-all duration-150',
            'hover:bg-background/50',
            copied ? 'text-success' : 'text-text-muted hover:text-text-normal'
          )}
          aria-label={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check size={14} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with syntax highlighting */}
      <div className="code-block-content overflow-x-auto">
        <SyntaxHighlighter
          language={normalizedLanguage}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'var(--color-tertiary)',
            fontSize: '0.875rem',
            lineHeight: '1.5'
          }}
          showLineNumbers={code.split('\n').length > 3}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: 'var(--color-text-muted)',
            opacity: 0.5
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}
