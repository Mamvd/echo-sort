"use client"

import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ExternalLink, ArrowLeft, Loader2, Music, Heart, Trash2, ChevronDown } from "lucide-react"
import Image from "next/image"
import { useToast } from "@/hooks/use-toast"
import {
  type PlaylistData,
  type DuplicateGroup,
  type OverlapResult,
  findDuplicatesInPlaylist,
  findOverlapsBetweenPlaylists,
} from "@/lib/analysis"

interface AnalysisResultsProps {
  accessToken: string
  selectedPlaylistIds: string[]
  onBack: () => void
  getValidToken?: () => Promise<string | null>
}

export default function AnalysisResults({ accessToken, selectedPlaylistIds, onBack, getValidToken }: AnalysisResultsProps) {
  const [playlists, setPlaylists] = useState<PlaylistData[]>([])
  const [duplicates, setDuplicates] = useState<Map<string, DuplicateGroup[]>>(new Map())
  const [overlaps, setOverlaps] = useState<OverlapResult[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"duplicates" | "overlaps">("duplicates")
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set())
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [removalTarget, setRemovalTarget] = useState<{ playlistId: string; playlistName: string } | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchPlaylistsAndAnalyze()
  }, [selectedPlaylistIds, accessToken])

  // Fetch with automatic token refresh on 401
  const fetchWithAuth = async (url: string, options: RequestInit = {}, token: string): Promise<Response> => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    })

    if (res.status === 401 && getValidToken) {
      const newToken = await getValidToken()
      if (!newToken) throw new Error("Session expired. Please log in again.")
      return fetch(url, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${newToken}` },
      })
    }

    return res
  }

  const fetchPlaylistsAndAnalyze = async () => {
    try {
      setLoading(true)
      setError(null)

      // Always get the freshest token available before starting
      const token = getValidToken ? (await getValidToken()) ?? accessToken : accessToken

      const playlistsData: PlaylistData[] = []

      for (const playlistId of selectedPlaylistIds) {
        if (playlistId === "liked-songs") {
          const res = await fetchWithAuth("/api/spotify/liked-songs", {}, token)
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error === "Token expired" ? "Session expired. Please log in again." : "Failed to fetch liked songs")
          }
          const data = await res.json()
          playlistsData.push({
            id: "liked-songs",
            name: "Liked Songs",
            tracks: data.items.filter((item: any) => item.track && item.track.id),
          })
        } else {
          const [playlistRes, tracksRes] = await Promise.all([
            fetchWithAuth(`https://api.spotify.com/v1/playlists/${playlistId}`, {}, token),
            fetchWithAuth(`/api/spotify/playlist/${playlistId}/tracks`, {}, token),
          ])

          if (!playlistRes.ok || !tracksRes.ok) {
            const body = await (playlistRes.ok ? tracksRes : playlistRes).json().catch(() => ({}))
            throw new Error(body.error === "Token expired" ? "Session expired. Please log in again." : "Failed to fetch playlist data")
          }

          const [playlistData, tracksData] = await Promise.all([playlistRes.json(), tracksRes.json()])
          playlistsData.push({
            id: playlistData.id,
            name: playlistData.name,
            tracks: tracksData.items.filter((item: any) => item.track && item.track.id),
          })
        }
      }

      setPlaylists(playlistsData)

      const dupsMap = new Map<string, DuplicateGroup[]>()
      playlistsData.forEach((playlist) => {
        const dups = findDuplicatesInPlaylist(playlist)
        if (dups.length > 0) dupsMap.set(playlist.id, dups)
      })
      setDuplicates(dupsMap)

      if (playlistsData.length > 1) {
        setOverlaps(findOverlapsBetweenPlaylists(playlistsData))
      } else {
        setOverlaps([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setLoading(false)
    }
  }

  const toggleTrack = (trackId: string) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev)
      next.has(trackId) ? next.delete(trackId) : next.add(trackId)
      return next
    })
  }

  const selectAllTracks = (tracks: Array<{ trackId: string }>) => {
    setSelectedTracks((prev) => {
      const next = new Set(prev)
      tracks.forEach((t) => next.add(t.trackId))
      return next
    })
  }

  const handleRemoveTracks = async () => {
    if (!removalTarget || selectedTracks.size === 0) return
    setIsRemoving(true)
    try {
      const playlist = playlists.find((p) => p.id === removalTarget.playlistId)
      if (!playlist) throw new Error("Playlist not found")
      const trackUris: string[] = []
      selectedTracks.forEach((trackId) => {
        const track = playlist.tracks.find((t) => t.track?.id === trackId)
        if (track?.track?.uri) trackUris.push(track.track.uri)
      })

      const res = await fetch("/api/spotify/remove-tracks", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ playlistId: removalTarget.playlistId, trackUris }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to remove tracks")
      }

      toast({ title: "Done", description: `Removed ${selectedTracks.size} track(s) from ${removalTarget.playlistName}` })
      setSelectedTracks(new Set())
      setShowRemoveDialog(false)
      setRemovalTarget(null)
      await fetchPlaylistsAndAnalyze()
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to remove tracks", variant: "destructive" })
    } finally {
      setIsRemoving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm font-medium">Analyzing playlists...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-sm">
          <p className="text-destructive font-medium mb-4">{error}</p>
          <button
            onClick={onBack}
            className="flex items-center gap-2 mx-auto px-5 py-2 rounded-full border border-border text-sm font-semibold hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Library
          </button>
        </div>
      </div>
    )
  }

  const totalDuplicates = Array.from(duplicates.values()).reduce((sum, d) => sum + d.length, 0)
  const isSingle = playlists.length === 1

  const TrackRow = ({ track, playlistId }: { track: DuplicateGroup | OverlapResult; playlistId?: string }) => {
    const isOverlap = "playlists" in track
    const isSelected = selectedTracks.has(track.trackId)

    return (
      <div
        className={`group flex items-center gap-3 px-4 py-2.5 rounded-sm transition-colors hover:bg-accent cursor-pointer ${isSelected ? "bg-accent/60" : ""}`}
        onClick={() => toggleTrack(track.trackId)}
      >
        {/* Checkbox */}
        <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
          {isSelected ? (
            <div className="w-4 h-4 rounded-sm bg-primary flex items-center justify-center">
              <svg viewBox="0 0 12 12" className="w-3 h-3" fill="none">
                <path d="M2 6L5 9L10 3" stroke="black" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <div className="w-4 h-4 rounded-sm border border-border group-hover:border-muted-foreground" />
          )}
        </div>

        {/* Art */}
        <div className="w-10 h-10 flex-shrink-0 rounded-sm overflow-hidden bg-muted">
          {track.imageUrl ? (
            <Image src={track.imageUrl} alt={track.trackName} width={40} height={40} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music className="w-5 h-5 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : ""}`}>{track.trackName}</p>
          <p className="text-xs text-muted-foreground truncate">{track.artist} · {track.album}</p>
          {isOverlap && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(track as OverlapResult).playlists.map((p) => (
                <span key={p.id} className="text-xs bg-muted text-muted-foreground rounded px-1.5 py-0.5">
                  {p.id === "liked-songs" ? "Liked Songs" : p.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!isOverlap && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {(track as DuplicateGroup).occurrences}x
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); window.open(track.spotifyUrl, "_blank") }}
            className="w-8 h-8 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
            aria-label="Open in Spotify"
          >
            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/60 transition-colors flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate">Analysis Results</h1>
            <p className="text-xs text-muted-foreground truncate">
              {playlists.map((p) => p.name).join(" · ")}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 flex gap-6">
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{totalDuplicates}</span>
            <span className="text-xs text-muted-foreground">Duplicates</span>
          </div>
          {!isSingle && (
            <div className="flex flex-col">
              <span className="text-2xl font-bold">{overlaps.length}</span>
              <span className="text-xs text-muted-foreground">Overlaps</span>
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-2xl font-bold">{playlists.reduce((s, p) => s + p.tracks.length, 0).toLocaleString()}</span>
            <span className="text-xs text-muted-foreground">Tracks analyzed</span>
          </div>
        </div>

        {/* Tabs */}
        {!isSingle && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-0 flex gap-0 border-b border-border">
            {(["duplicates", "overlaps"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px capitalize ${
                  activeTab === tab
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab} ({tab === "duplicates" ? totalDuplicates : overlaps.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selection toolbar */}
      {selectedTracks.size > 0 && (
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-3 flex items-center justify-between gap-4 bg-accent/30 border-b border-border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold">{selectedTracks.size} selected</span>
            <button onClick={() => setSelectedTracks(new Set())} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              Clear
            </button>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold disabled:opacity-50">
                {isRemoving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Remove
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border rounded-sm">
              {playlists.map((playlist) => (
                <DropdownMenuItem
                  key={playlist.id}
                  onClick={() => { setRemovalTarget({ playlistId: playlist.id, playlistName: playlist.name }); setShowRemoveDialog(true) }}
                  className="text-sm cursor-pointer"
                >
                  {playlist.id === "liked-songs" && <Heart className="w-4 h-4 mr-2 text-primary" />}
                  From {playlist.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 max-w-5xl mx-auto w-full px-0 sm:px-0">
        {(isSingle || activeTab === "duplicates") && (
          <div className="py-2">
            {duplicates.size === 0 ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Music className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="font-semibold mb-1">No duplicates found</p>
                <p className="text-sm text-muted-foreground">This playlist looks clean!</p>
              </div>
            ) : (
              Array.from(duplicates.entries()).map(([playlistId, dups]) => {
                const playlist = playlists.find((p) => p.id === playlistId)
                return (
                  <div key={playlistId}>
                    <div className="flex items-center justify-between px-4 sm:px-6 py-3 sticky top-[calc(var(--header-h,160px))] bg-background/95 backdrop-blur-sm z-10">
                      <div className="flex items-center gap-2">
                        {playlistId === "liked-songs" && <Heart className="w-4 h-4 text-primary" />}
                        <span className="text-sm font-semibold">{playlist?.name}</span>
                        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">{dups.length}</span>
                      </div>
                      <button
                        onClick={() => selectAllTracks(dups)}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Select all
                      </button>
                    </div>
                    <div>
                      {dups.map((track) => (
                        <TrackRow key={track.trackId} track={track} playlistId={playlistId} />
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {!isSingle && activeTab === "overlaps" && (
          <div className="py-2">
            {overlaps.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                  <Music className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="font-semibold mb-1">No overlaps found</p>
                <p className="text-sm text-muted-foreground">Your playlists have no tracks in common</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                  <span className="text-sm font-semibold">Shared tracks</span>
                  <button
                    onClick={() => selectAllTracks(overlaps)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Select all
                  </button>
                </div>
                {overlaps.map((track) => (
                  <TrackRow key={track.trackId} track={track} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remove confirmation dialog */}
      <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
        <AlertDialogContent className="bg-popover border-border rounded-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {selectedTracks.size} track{selectedTracks.size !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently remove the selected tracks from{" "}
              <span className="text-foreground font-medium">{removalTarget?.playlistName}</span>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" onClick={() => setRemovalTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveTracks}
              disabled={isRemoving}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRemoving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Removing...</> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
