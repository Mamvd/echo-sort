"use client"

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react"
import { fetchAllPlaylistData, type Playlist, type FetchProgress, progressEmitter } from "@/lib/playlist-data"

interface PlaylistDataContextValue {
  playlists: Playlist[]
  userId: string | null
  progress: FetchProgress | null
  isLoading: boolean
  hasData: boolean
  fetchData: (token: string, getValidToken: () => Promise<string | null>) => Promise<void>
  reset: () => void
  updatePlaylist: (id: string, updater: (p: Playlist) => Playlist) => void
}

const PlaylistDataContext = createContext<PlaylistDataContextValue | null>(null)

const IDLE_PROGRESS: FetchProgress = {
  stage: "idle",
  completed: 0,
  total: 0,
  currentItem: "",
  rateLimitedUntil: null,
  error: null,
  tracksCompleted: 0,
  tracksTotal: 0,
}

export function PlaylistDataProvider({ children }: { children: ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [progress, setProgress] = useState<FetchProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (token: string, getValidToken: () => Promise<string | null>) => {
    // Cancel any in-flight fetch
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setIsLoading(true)
    setPlaylists([])
    setProgress(IDLE_PROGRESS)

    const unsubscribe = progressEmitter.subscribe((p) => {
      setProgress(p)
      // Parse userId from profile stage isn't needed — we get it from playlists
    })

    try {
      const data = await fetchAllPlaylistData(token, getValidToken, controller.signal)

      if (!controller.signal.aborted) {
        setPlaylists(data)
        // Infer userId from own playlists
        const ownPlaylist = data.find((p) => p.category === "own")
        if (ownPlaylist) setUserId(ownPlaylist.ownerId)
      }
    } catch (err) {
      if (err instanceof Error && err.message === "ABORTED") return
      setProgress((prev) => ({
        ...(prev ?? IDLE_PROGRESS),
        stage: "error",
        error: err instanceof Error ? err.message : "Failed to load library",
      }))
    } finally {
      unsubscribe()
      setIsLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setPlaylists([])
    setProgress(null)
    setIsLoading(false)
    setUserId(null)
  }, [])

  const updatePlaylist = useCallback((id: string, updater: (p: Playlist) => Playlist) => {
    setPlaylists((prev) => prev.map((p) => (p.id === id ? updater(p) : p)))
  }, [])

  return (
    <PlaylistDataContext.Provider
      value={{
        playlists,
        userId,
        progress,
        isLoading,
        hasData: playlists.length > 0,
        fetchData,
        reset,
        updatePlaylist,
      }}
    >
      {children}
    </PlaylistDataContext.Provider>
  )
}

export function usePlaylistData() {
  const ctx = useContext(PlaylistDataContext)
  if (!ctx) throw new Error("usePlaylistData must be used inside PlaylistDataProvider")
  return ctx
}
