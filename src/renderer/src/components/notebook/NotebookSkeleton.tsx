/**
 * NotebookSkeleton
 *
 * Skeleton loading placeholders for notebook components.
 * Provides better perceived performance during data loading.
 *
 * @module components/notebook/NotebookSkeleton
 */

export function NotebookCardSkeleton() {
  return (
    <div className="p-3 rounded-lg bg-secondary/50 border border-secondary/30 animate-pulse">
      <div className="flex items-start gap-3">
        {/* Emoji placeholder */}
        <div className="w-10 h-10 rounded-lg bg-secondary" />
        <div className="flex-1 space-y-2">
          {/* Title */}
          <div className="h-4 bg-secondary rounded w-3/4" />
          {/* Meta */}
          <div className="h-3 bg-secondary rounded w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function NotebookListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 space-y-2" role="status" aria-label="Loading notebooks">
      {Array.from({ length: count }).map((_, i) => (
        <NotebookCardSkeleton key={i} />
      ))}
      <span className="sr-only">Loading notebooks...</span>
    </div>
  )
}

export function NotebookEntrySkeleton() {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 border border-secondary/20 animate-pulse">
      {/* Title */}
      <div className="h-4 bg-secondary rounded w-2/3 mb-3" />
      {/* Content lines */}
      <div className="space-y-2">
        <div className="h-3 bg-secondary rounded w-full" />
        <div className="h-3 bg-secondary rounded w-5/6" />
        <div className="h-3 bg-secondary rounded w-4/6" />
      </div>
      {/* Footer */}
      <div className="mt-3 flex justify-between">
        <div className="h-3 bg-secondary rounded w-24" />
        <div className="h-3 bg-secondary rounded w-16" />
      </div>
    </div>
  )
}

export function NotebookEntriesListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="p-3 space-y-3" role="status" aria-label="Loading entries">
      {Array.from({ length: count }).map((_, i) => (
        <NotebookEntrySkeleton key={i} />
      ))}
      <span className="sr-only">Loading entries...</span>
    </div>
  )
}
