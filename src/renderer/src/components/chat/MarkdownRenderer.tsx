import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { CodeBlock } from './CodeBlock'
import { cn } from '../../lib/utils'

interface MarkdownRendererProps {
  content: string
  className?: string
}

export function MarkdownRenderer({
  content,
  className
}: MarkdownRendererProps): React.ReactElement {
  const components: Components = {
    // Code blocks and inline code
    code({ className: codeClassName, children, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '')
      const codeString = String(children).replace(/\n$/, '')

      // Check if this is a code block (has language class or is multi-line)
      const isCodeBlock = match || codeString.includes('\n')

      if (isCodeBlock) {
        return <CodeBlock code={codeString} language={match?.[1] || 'text'} />
      }

      // Inline code
      return (
        <code
          className="inline-code px-1.5 py-0.5 rounded text-sm font-mono bg-tertiary text-primary"
          {...props}
        >
          {children}
        </code>
      )
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-3 last:mb-0">{children}</p>
    },

    // Headers
    h1({ children }) {
      return <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h3>
    },

    // Lists
    ul({ children }) {
      return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>
    },

    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {children}
        </a>
      )
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="border-l-4 border-primary/50 pl-4 my-3 italic text-text-muted">
          {children}
        </blockquote>
      )
    },

    // Horizontal rule
    hr() {
      return <hr className="my-4 border-tertiary" />
    },

    // Strong/Bold
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>
    },

    // Emphasis/Italic
    em({ children }) {
      return <em className="italic">{children}</em>
    },

    // Pre (wrapper for code blocks - we handle this in code component)
    pre({ children }) {
      return <>{children}</>
    }
  }

  return (
    <div className={cn('markdown-content', className)}>
      <ReactMarkdown components={components}>{content}</ReactMarkdown>
    </div>
  )
}
