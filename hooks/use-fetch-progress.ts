"use client"

import { useState, useEffect, useRef } from "react"
import { progressEmitter, type FetchProgress } from "@/lib/playlist-data"

interface UseFetchProgressReturn {
  progress: FetchProgress | null
  overallPercent: number
  stageLabel: string
  estimatedSecondsRemaining: number | null
  isRateLimited: boolean
  rateLimitSecondsRemaining: number
}

// Stage weights (must sum to 1.0)
const STAGE_WEIGHTS = {
  idle: 0,
  fetching_profile: 0.02,
  fetching_playlists: 0.08,
  fetching_liked_songs: 0.05,
  fetching_tracks: 0.85,
  computing_overlaps: 0,
  fetching_genres: 0,
  done: 1,
  error: 0,
}

function stageBasePercent(stage: string): number {
  switch (stage) {
    case "fetching_profile": return 0
    case "fetching_playlists": return 0.02
    case "fetching_liked_songs": return 0.10
    case "fetching_tracks": return 0.15
    case "done": return 1
    default: return 0
  }
}

function calcOverallPercent(p: FetchProgress): number {
  if (p.stage === "done") return 100
  if (p.stage === "error" || p.stage === "idle") return 0

  const base = stageBasePercent(p.stage)
  const weight = STAGE_WEIGHTS[p.stage as keyof typeof STAGE_WEIGHTS] ?? 0

  let stageProgress = 0
  if (p.stage === "fetching_tracks" && p.tracksTotal > 0) {
    stageProgress = p.tracksCompleted / p.tracksTotal
  } else if (p.total > 0) {
    stageProgress = p.completed / p.total
  }

  return Math.round(Math.min((base + weight * stageProgress) * 100, 99))
}

function stageLabelText(p: FetchProgress): string {
  if (p.rateLimitedUntil && p.rateLimitedUntil > Date.now()) {
    const secs = Math.ceil((p.rateLimitedUntil - Date.now()) / 1000)
    return `Spotify is rate-limiting requests, resuming in ${secs}s...`
  }
  switch (p.stage) {
    case "idle": return "Waiting..."
    case "fetching_profile": return "Fetching your profile..."
    case "fetching_playlists":
      return p.total > 0
        ? `Fetching playlists (${p.completed} of ${p.total})...`
        : "Fetching your playlists..."
    case "fetching_tracks":
      return p.currentItem || "Scanning tracks..."
    case "done": return "Done"
    case "error": return p.error ?? "An error occurred"
    default: return p.currentItem || "Loading..."
  }
}

export function useFetchProgress(): UseFetchProgressReturn {
  const [progress, setProgress] = useState<FetchProgress | null>(null)
  const [rateLimitTick, setRateLimitTick] = useState(0)
  // Rolling average for ETA: store array of { timestamp, tracksCompleted }
  const samplesRef = useRef<Array<{ ts: number; completed: number }>>([])
  const etaRef = useRef<number | null>(null)

  useEffect(() => {
    const unsub = progressEmitter.subscribe((p) => {
      setProgress(p)

      // Update rolling avg
      if (p.stage === "fetching_tracks" && p.tracksCompleted > 0) {
        const now = Date.now()
        samplesRef.current.push({ ts: now, completed: p.tracksCompleted })
        if (samplesRef.current.length > 10) samplesRef.current.shift()

        if (samplesRef.current.length >= 2) {
          const first = samplesRef.current[0]
          const last = samplesRef.current[samplesRef.current.length - 1]
          const elapsed = last.ts - first.ts
          const processed = last.completed - first.completed
          if (processed > 0 && elapsed > 0) {
            const msPerTrack = elapsed / processed
            const remaining = (p.tracksTotal - p.tracksCompleted) * msPerTrack
            etaRef.current = remaining / 1000
          }
        }
      }

      if (p.stage === "done" || p.stage === "error") {
        etaRef.current = null
        samplesRef.current = []
      }
    })
    return unsub
  }, [])

  // Tick every second to update rate-limit countdown
  useEffect(() => {
    const interval = setInterval(() => setRateLimitTick((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  if (!progress) {
    return {
      progress: null,
      overallPercent: 0,
      stageLabel: "",
      estimatedSecondsRemaining: null,
      isRateLimited: false,
      rateLimitSecondsRemaining: 0,
    }
  }

  const isRateLimited = !!(progress.rateLimitedUntil && progress.rateLimitedUntil > Date.now())
  const rateLimitSecondsRemaining = isRateLimited
    ? Math.max(0, Math.ceil((progress.rateLimitedUntil! - Date.now()) / 1000))
    : 0

  return {
    progress,
    overallPercent: calcOverallPercent(progress),
    stageLabel: stageLabelText(progress),
    estimatedSecondsRemaining: etaRef.current !== null ? Math.ceil(etaRef.current) : null,
    isRateLimited,
    rateLimitSecondsRemaining,
  }
}
