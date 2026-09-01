"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import { usePlaylistData } from "@/contexts/playlist-data-context"
import type { Playlist, Track } from "@/lib/playlist-data"
import Image from "next/image"
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
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Music, Trash2, Undo2, AlertTriangle, Check, ChevronDown, ChevronRight, Lock } from "lucide-react"

interface DupGroup {
  trackId: string
  name: string
  artists: string
  albumName: string
  albumArt: string
  positions: number[]
  tracks: Track[] // all occurrences
  recommended: number // index of recommended keep
}

interface PlaylistDups {
  playlist: Playlist
  groups: DupGroup[]
}

// Pick recommended version: prefer non-explicit, then most recently added, then most popular
function pickRecommended(tracks: Track[]): number {
  const scores = tracks.map((t, i) => {
    let score = 0
    if (!t.explicit) score += 100
    if (t.popularity) score += t.popularity
    return { score, i }
  })
  return scores.sort((a, b) => b.score - a.score)[0].i
}

function findDups(playlist: Playlist): DupGroup[] {
  const byId = new Map<string, { tracks: Track[]; positions: number[] }>()

  playlist.tracks.forEach((t, idx) => {
    const existing = byId.get(t.id)
    if (existing) {
      existing.tracks.push(t)
      existing.positions.push(idx)
    } else {
      byId.set(t.id, { tracks: [t], positions: [idx] })
    }
  })

  const groups: DupGroup[] = []
  byId.forEach(({ tracks, positions }, trackId) => {
    if (positions.length < 2) return
    groups.push({
      trackId,
      name: tracks[0].name,
      artists: tracks[0].artists.join(", "),
      albumName: tracks[0].albumName,
      albumArt: tracks[0].albumArt,
      positions,
      tracks,
      recommended: pickRecommended(tracks),
    })
  })

  return groups.sort((a, b) => b.positions.length - a.positions.length)
}

interface UndoEntry {
  playlistId: string
  playlistName: string
  snapshotId: string
  removedUris: string[]
  removedPositions: number[]
  removedTracks: Track[]
}

interface CleanupPanelProps {
  accessToken: string
  getValidToken: () => Promise<string | null>
}

export default function CleanupPanel({ accessToken, getValidToken }: CleanupPanelProps) {
  const { playlists, updatePlaylist } = usePlaylistData()
  const [keepSelections, setKeepSelections] = useState<Record<string, number>>({})
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([])
  const [undoToast, setUndoToast] = useState<UndoEntry | null>(null)
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playlistDups = useMemo((): PlaylistDups[] => {
    return playlists
      .filter((p) => {
        // Skip Spotify-owned; skip others unless collaborative
        if (p.category === "spotify") return false
        if (p.category === "others" && !p.collaborative) return false
        return true
      })
      .map((p) => ({ playlist: p, groups: findDups(p) }))
      .filter((pd) => pd.groups.length > 0)
  }, [playlists])

  const totalDuplicates = useMemo(
    () => playlistDups.reduce((sum, pd) => sum + pd.groups.reduce((s, g) => s + g.positions.length - 1, 0), 0),
    [playlistDups],
  )

  const getKeepIdx = (groupKey: string, defaultIdx: number) =>
    keepSelections[groupKey] ?? defaultIdx

  const toggleExpand = (key: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  // Build removal plan: positions to remove for each playlist
  const buildRemovalPlan = useCallback(() => {
    return playlistDups.map(({ playlist, groups }) => {
      const toRemove: { uri: string; position: number; track: Track }[] = []
      groups.forEach((group) => {
        const keepIdx = getKeepIdx(`${playlist.id}:${group.trackId}`, group.recommended)
        group.positions.forEach((pos, idx) => {
          if (idx !== keepIdx) {
            toRemove.push({ uri: group.tracks[idx].uri, position: pos, track: group.tracks[idx] })
          }
        })
      })
      return { playlist, toRemove }
    }).filter((p) => p.toRemove.length > 0)
  }, [playlistDups, keepSelections])

  const handleConfirmCleanup = async () => {
    setRemoving(true)
    setRemoveError(null)
    const plan = buildRemovalPlan()

    try {
      const token = (await getValidToken()) ?? accessToken

      for (const { playlist, toRemove } of plan) {
        // Store undo snapshot
        const undoEntry: UndoEntry = {
          playlistId: playlist.id,
          playlistName: playlist.name,
          snapshotId: playlist.snapshotId,
          removedUris: toRemove.map((r) => r.uri),
          removedPositions: toRemove.map((r) => r.position),
          removedTracks: toRemove.map((r) => r.track),
        }

        // Batch into chunks of 100
        const chunks: typeof toRemove[] = []
        for (let i = 0; i < toRemove.length; i += 100) {
          chunks.push(toRemove.slice(i, i + 100))
        }

        let currentSnapshotId = playlist.snapshotId
        for (const chunk of chunks) {
          // Use positions to target specific occurrences
          const body: { tracks: { uri: string; positions: number[] }[] } = {
            tracks: chunk.map((r) => ({ uri: r.uri, positions: [r.position] })),
          }

          const res = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...body, snapshot_id: currentSnapshotId }),
          })

          if (!res.ok) {
            // Snapshot stale — refetch and retry once
            if (res.status === 409 || res.status === 400) {
              const freshRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}`, {
                headers: { Authorization: `Bearer ${token}` },
              })
              if (freshRes.ok) {
                const freshData = await freshRes.json()
                currentSnapshotId = freshData.snapshot_id
                // Retry with fresh snapshot
                const retryRes = await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
                  method: "DELETE",
                  headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ ...body, snapshot_id: currentSnapshotId }),
                })
                if (retryRes.ok) {
                  const retryData = await retryRes.json()
                  currentSnapshotId = retryData.snapshot_id
                }
              }
            } else {
              throw new Error(`Failed to remove tracks from ${playlist.name}: ${res.status}`)
            }
          } else {
            const resData = await res.json()
            currentSnapshotId = resData.snapshot_id ?? currentSnapshotId
          }
        }

        // Patch in-memory state
        const removedIds = new Set(toRemove.map((r) => r.uri))
        updatePlaylist(playlist.id, (p) => ({
          ...p,
          snapshotId: currentSnapshotId,
          tracks: p.tracks.filter((t) => !removedIds.has(t.uri)),
        }))

        // Add to undo stack
        undoEntry.snapshotId = currentSnapshotId
        setUndoStack((prev) => [undoEntry, ...prev])

        // Show undo toast (10 second window)
        setUndoToast(undoEntry)
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
        undoTimerRef.current = setTimeout(() => setUndoToast(null), 10_000)
      }
    } catch (err) {
      setRemoveError(err instanceof Error ? err.message : "Removal failed")
    } finally {
      setRemoving(false)
      setConfirmOpen(false)
    }
  }

  const handleUndo = async (entry: UndoEntry) => {
    setUndoToast(null)
    try {
      const token = (await getValidToken()) ?? accessToken
      const chunks: string[][] = []
      for (let i = 0; i < entry.removedUris.length; i += 100) {
        chunks.push(entry.removedUris.slice(i, i + 100))
      }

      for (const chunk of chunks) {
        await fetch(`https://api.spotify.com/v1/playlists/${entry.playlistId}/tracks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: chunk, position: Math.min(...entry.removedPositions) }),
        })
      }

      // Patch in-memory state
      updatePlaylist(entry.playlistId, (p) => ({
        ...p,
        tracks: [...p.tracks, ...entry.removedTracks],
      }))
    } catch {}
  }

  const removalPlan = buildRemovalPlan()
  const totalToRemove = removalPlan.reduce((sum, p) => sum + p.toRemove.length, 0)

  if (playlistDups.length === 0) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        <Check className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p className="text-sm font-semibold">No duplicates found</p>
        <p className="text-xs mt-2 opacity-60">Your playlists look perfectly clean!</p>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-base font-semibold">
            {totalDuplicates} duplicate{totalDuplicates !== 1 ? "s" : ""} found
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Across {playlistDups.length} playlist{playlistDups.length !== 1 ? "s" : ""}. Select which versions to keep.
          </p>
        </div>
        <button
          onClick={() => setConfirmOpen(true)}
          disabled={totalToRemove === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-destructive text-destructive-foreground text-sm font-bold disabled:opacity-40 hover:scale-[1.02] active:scale-[0.98] transition-transform whitespace-nowrap"
        >
          <Trash2 className="w-4 h-4" />
          Remove {totalToRemove}
        </button>
      </div>

      {removeError && (
        <div className="flex items-start gap-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Error removing tracks</p>
            <p className="text-xs mt-1 opacity-80">{removeError}</p>
          </div>
        </div>
      )}

      {/* Playlist groups */}
      {playlistDups.map(({ playlist, groups }) => (
        <div key={playlist.id} className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="w-8 h-8 flex-shrink-0 rounded-sm overflow-hidden bg-muted">
              {playlist.imageUrl ? (
                <Image src={playlist.imageUrl} alt="" width={32} height={32} className="object-cover w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{playlist.name}</p>
              <p className="text-xs text-muted-foreground">
                {groups.length} duplicate group{groups.length !== 1 ? "s" : ""}
                {playlist.category === "others" && playlist.collaborative && (
                  <span className="ml-2 text-primary">Collaborative</span>
                )}
              </p>
            </div>
            {playlist.category === "spotify" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="w-3.5 h-3.5" />
                Read-only
              </div>
            )}
          </div>

          <div className="divide-y divide-border/40">
            {groups.map((group) => {
              const groupKey = `${playlist.id}:${group.trackId}`
              const keepIdx = getKeepIdx(groupKey, group.recommended)
              const isExpanded = expandedGroups.has(groupKey)

              return (
                <div key={groupKey} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 flex-shrink-0 rounded-sm overflow-hidden bg-muted">
                      {group.albumArt ? (
                        <Image src={group.albumArt} alt="" width={36} height={36} className="object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{group.artists}</p>
                    </div>
                    <Badge variant="secondary" className="flex-shrink-0 text-xs">
                      {group.positions.length}x
                    </Badge>
                    <button
                      onClick={() => toggleExpand(groupKey)}
                      className="flex-shrink-0 p-1 rounded hover:bg-muted transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-2 pl-12">
                      <p className="text-xs text-muted-foreground mb-2">
                        Select the version to keep (others will be removed):
                      </p>
                      {group.positions.map((pos, idx) => (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-colors ${
                            keepIdx === idx
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <Checkbox
                            checked={keepIdx === idx}
                            onCheckedChange={() =>
                              setKeepSelections((prev) => ({ ...prev, [groupKey]: idx }))
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium">Position {pos}</p>
                            <p className="text-xs text-muted-foreground">
                              Added: {group.tracks[idx]?.addedAt ? new Date(group.tracks[idx].addedAt).toLocaleDateString() : "—"}
                              {group.tracks[idx]?.explicit && (
                                <span className="ml-2 bg-muted px-1 rounded text-[10px]">E</span>
                              )}
                            </p>
                          </div>
                          {idx === group.recommended && (
                            <Badge variant="outline" className="text-[10px] flex-shrink-0">
                              Recommended
                            </Badge>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {totalToRemove} tracks?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>This will remove duplicate tracks from {removalPlan.length} playlist{removalPlan.length !== 1 ? "s" : ""}:</p>
                <ul className="mt-2 space-y-1">
                  {removalPlan.map(({ playlist, toRemove }) => (
                    <li key={playlist.id} className="text-sm">
                      <span className="font-medium">{playlist.name}</span>
                      {" "}— {toRemove.length} track{toRemove.length !== 1 ? "s" : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground mt-3">
                  An undo option will be available for this session only. Closing the tab will discard undo history.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCleanup}
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removing ? "Removing..." : `Remove ${totalToRemove} tracks`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Undo toast */}
      {undoToast && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-foreground text-background rounded-full px-4 py-2.5 shadow-xl text-sm font-medium">
          <span>
            Removed {undoToast.removedUris.length} track{undoToast.removedUris.length !== 1 ? "s" : ""} from {undoToast.playlistName}
          </span>
          <button
            onClick={() => handleUndo(undoToast)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-background text-foreground text-xs font-bold hover:opacity-80 transition-opacity"
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </button>
          <button
            onClick={() => setUndoToast(null)}
            className="opacity-60 hover:opacity-100 transition-opacity text-xs"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
