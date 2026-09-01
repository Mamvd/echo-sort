"use client"

import { useFetchProgress } from "@/hooks/use-fetch-progress"
import { AlertTriangle, Loader2 } from "lucide-react"

export function FetchProgressBar() {
  const { progress, overallPercent, stageLabel, estimatedSecondsRemaining, isRateLimited } = useFetchProgress()

  if (!progress || progress.stage === "idle" || progress.stage === "done") return null

  const isError = progress.stage === "error"

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-0 left-0 right-0 z-50 border-t transition-colors ${
        isError
          ? "bg-destructive/10 border-destructive/30"
          : isRateLimited
          ? "bg-yellow-500/10 border-yellow-500/30"
          : "bg-card border-border"
      }`}
    >
      {/* Progress fill bar */}
      {!isError && (
        <div className="h-0.5 bg-muted w-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${isRateLimited ? "bg-yellow-500" : "bg-primary"}`}
            style={{ width: `${overallPercent}%` }}
          />
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3">
        {/* Icon */}
        <div className="flex-shrink-0">
          {isError ? (
            <AlertTriangle className="w-4 h-4 text-destructive" />
          ) : (
            <Loader2 className={`w-4 h-4 ${isRateLimited ? "text-yellow-500" : "text-primary"} animate-spin`} />
          )}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate text-foreground">{stageLabel}</p>
          {!isError && progress.stage === "fetching_tracks" && progress.total > 0 && (
            <p className="text-xs text-muted-foreground">
              {progress.completed} of {progress.total} playlists
              {estimatedSecondsRemaining !== null && estimatedSecondsRemaining > 5 && (
                <> &middot; ~{estimatedSecondsRemaining < 60
                  ? `${estimatedSecondsRemaining}s`
                  : `${Math.ceil(estimatedSecondsRemaining / 60)}m`} remaining</>
              )}
            </p>
          )}
        </div>

        {/* Percentage */}
        {!isError && (
          <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
            {overallPercent}%
          </span>
        )}
      </div>
    </div>
  )
}
