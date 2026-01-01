/**
 * ExportMenu
 *
 * Dropdown menu for notebook export options.
 *
 * @module components/notebook/ExportMenu
 */

import { useState } from 'react'
import { Download, FileText, FileJson, Copy, Check, Loader2 } from 'lucide-react'

interface ExportMenuProps {
  notebookName: string
  onExportMarkdown: () => Promise<string | null>
  onExportJSON: () => Promise<string | null>
  onExportText: () => Promise<string | null>
}

export function ExportMenu({
  notebookName,
  onExportMarkdown,
  onExportJSON,
  onExportText
}: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleExport = async (
    format: 'markdown' | 'json' | 'text',
    action: 'download' | 'copy'
  ) => {
    setIsExporting(true)
    try {
      let content: string | null = null
      let extension = ''
      let mimeType = ''

      switch (format) {
        case 'markdown':
          content = await onExportMarkdown()
          extension = 'md'
          mimeType = 'text/markdown'
          break
        case 'json':
          content = await onExportJSON()
          extension = 'json'
          mimeType = 'application/json'
          break
        case 'text':
          content = await onExportText()
          extension = 'txt'
          mimeType = 'text/plain'
          break
      }

      if (!content) return

      if (action === 'copy') {
        await navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } else {
        const blob = new Blob([content], { type: mimeType })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${notebookName}.${extension}`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setIsExporting(false)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="p-1.5 rounded-lg hover:bg-secondary text-text-muted hover:text-text-normal transition-colors disabled:opacity-50"
        title="Export notebook"
      >
        {isExporting ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Download size={18} />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-tertiary border border-secondary rounded-lg shadow-xl py-1 min-w-[180px]">
            {/* Markdown */}
            <div className="px-2 py-1">
              <p className="text-xs text-text-muted uppercase tracking-wide px-2 mb-1">
                Markdown
              </p>
              <button
                onClick={() => handleExport('markdown', 'download')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                <FileText size={14} />
                Download .md
              </button>
              <button
                onClick={() => handleExport('markdown', 'copy')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                Copy to clipboard
              </button>
            </div>

            <div className="border-t border-secondary/50 my-1" />

            {/* JSON */}
            <div className="px-2 py-1">
              <p className="text-xs text-text-muted uppercase tracking-wide px-2 mb-1">
                JSON
              </p>
              <button
                onClick={() => handleExport('json', 'download')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                <FileJson size={14} />
                Download .json
              </button>
            </div>

            <div className="border-t border-secondary/50 my-1" />

            {/* Plain Text */}
            <div className="px-2 py-1">
              <p className="text-xs text-text-muted uppercase tracking-wide px-2 mb-1">
                Plain Text
              </p>
              <button
                onClick={() => handleExport('text', 'download')}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-text-muted hover:text-text-normal hover:bg-secondary rounded transition-colors"
              >
                <FileText size={14} />
                Download .txt
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default ExportMenu
