/**
 * Placeholder shown on first load only. Mirrors the post card's proportions so
 * the list does not jump when real content replaces it.
 */
export function PostSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="relative overflow-hidden p-4">
        <div className="flex gap-3">
          <div className="h-11 w-11 shrink-0 rounded-full bg-raised" />
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-3.5 w-2/5 rounded bg-raised" />
            <div className="h-3 w-3/5 rounded bg-raised" />
          </div>
        </div>
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full rounded bg-raised" />
          <div className="h-3 w-11/12 rounded bg-raised" />
          <div className="h-3 w-4/5 rounded bg-raised" />
        </div>
        <div
          className="absolute inset-0 -translate-x-full animate-shimmer
                     bg-gradient-to-r from-transparent via-white/15 to-transparent"
        />
      </div>
    </div>
  )
}
