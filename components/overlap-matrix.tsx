"use client"

import { useMemo, useState, useCallback } from "react"
import { usePlaylistData } from "@/contexts/playlist-data-context"
import type { Playlist, Track } from "@/lib/playlist-data"
import { jaccard } from "@/lib/playlist-data"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Slider } from "@/components/ui/slider"
import Image from "next/image"
import { Music } from "lucide-react"

type CategoryFilter = "all" | "own" | "spotify" | "others"

interface CellData {
  jaccardScore: number
  sharedCount: number
  sharedTracks: Track[]
}

interface MatrixData {
  playlists: Playlist[]
  cells: Map<string, CellData>
}

function cellKey(a: string, b: string) {
  return a < b ? `${a}||${b}` : `${b}||${a}`
}

// HSL interpolation for perceptually uniform color scale
function overlapColor(score: number): string {
  if (score === 0) return "transparent"
  // 0 → muted, 1 → primary accent
  // Use HSL lightness: low overlap = high lightness (subtle), high = lower lightness (saturated)
  const lightness = 75 - score * 45 // 75% down to 30%
  const alpha = 0.15 + score * 0.75
  return `hsla(262, 75%, ${lightness}%, ${alpha})`
}

function computeMatrix(playlists: Playlist[]): MatrixData {
  const cells = new Map<string, CellData>()

  const trackSets = new Map<string, Set<string>>()
  for (const p of playlists) {
    trackSets.set(p.id, new Set(p.tracks.map((t) => t.id)))
  }

  for (let i = 0; i < playlists.length; i++) {
    for (let j = i + 1; j < playlists.length; j++) {
      const a = playlists[i]
      const b = playlists[j]
      const setA = trackSets.get(a.id)!
      const setB = trackSets.get(b.id)!

      const score = jaccard(setA, setB)
      if (score === 0) continue

      // Find shared tracks
      const sharedIds = [...setA].filter((id) => setB.has(id))
      const sharedTracks = a.tracks.filter((t) => sharedIds.includes(t.id))

      cells.set(cellKey(a.id, b.id), {
        jaccardScore: score,
        sharedCount: sharedIds.length,
        sharedTracks,
      })
    }
  }

  return { playlists, cells }
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + "…" : s
}

interface DrawerState {
  playlistA: Playlist
  playlistB: Playlist
  cell: CellData
}

export default function OverlapMatrix() {
  const { playlists, isLoading } = usePlaylistData()
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [minOverlap, setMinOverlap] = useState(0)
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null)

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return playlists
    return playlists.filter((p) => p.category === categoryFilter)
  }, [playlists, categoryFilter])

  const matrix = useMemo(() => computeMatrix(filtered), [filtered])

  const handleCellClick = useCallback(
    (a: Playlist, b: Playlist) => {
      const cell = matrix.cells.get(cellKey(a.id, b.id))
      if (cell && cell.sharedCount > 0) {
        setDrawerState({ playlistA: a, playlistB: b, cell })
      }
    },
    [matrix],
  )

  if (playlists.length === 0 && !isLoading) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No playlist data loaded yet.</p>
      </div>
    )
  }

  const visiblePlaylists = matrix.playlists.filter((p) => p.tracks.length > 0)
  const CELL_SIZE = 40

  const categoryTabs: { value: CategoryFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "own", label: "Your playlists" },
    { value: "others", label: "Others" },
    { value: "spotify", label: "Spotify" },
  ]

  return (
    <div className="w-full space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        {/* Category filter */}
        <div className="flex gap-1.5 flex-wrap">
          {categoryTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setCategoryFilter(tab.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === tab.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Min overlap slider */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            Min overlap: {minOverlap}%
          </span>
          <div className="w-32">
            <Slider
              min={0}
              max={80}
              step={5}
              value={[minOverlap]}
              onValueChange={([v]) => setMinOverlap(v)}
            />
          </div>
        </div>
      </div>

      {visiblePlaylists.length === 0 && (
        <div className="py-16 text-center text-muted-foreground text-sm">
          No playlists with tracks in this category.
        </div>
      )}

      {visiblePlaylists.length > 0 && (
        <div className="overflow-auto rounded-xl border border-border bg-card">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `160px repeat(${visiblePlaylists.length}, ${CELL_SIZE}px)`,
              minWidth: `${160 + visiblePlaylists.length * CELL_SIZE}px`,
            }}
          >
            {/* Top-left corner */}
            <div className="sticky left-0 z-20 bg-card border-b border-r border-border" />

            {/* Column headers (rotated) */}
            {visiblePlaylists.map((p) => (
              <div
                key={p.id}
                className="border-b border-border flex items-end justify-center pb-1"
                style={{ height: 120 }}
                title={p.name}
              >
                <div
                  className="text-xs text-muted-foreground whitespace-nowrap origin-bottom-left"
                  style={{
                    transform: "rotate(-45deg) translateX(-50%)",
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {truncate(p.name, 18)}
                </div>
              </div>
            ))}

            {/* Rows */}
            {visiblePlaylists.map((rowPlaylist) => (
              <>
                {/* Row label */}
                <div
                  key={`row-${rowPlaylist.id}`}
                  className="sticky left-0 z-10 bg-card border-r border-b border-border flex items-center px-3 gap-2"
                  style={{ height: CELL_SIZE }}
                  title={rowPlaylist.name}
                >
                  <div className="w-6 h-6 flex-shrink-0 rounded-sm overflow-hidden bg-muted">
                    {rowPlaylist.imageUrl ? (
                      <Image src={rowPlaylist.imageUrl} alt="" width={24} height={24} className="object-cover w-full h-full" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Music className="w-3 h-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs truncate text-foreground">{truncate(rowPlaylist.name, 18)}</span>
                </div>

                {/* Row cells */}
                {visiblePlaylists.map((colPlaylist) => {
                  const isSelf = rowPlaylist.id === colPlaylist.id
                  const cell = isSelf ? null : matrix.cells.get(cellKey(rowPlaylist.id, colPlaylist.id))
                  const score = cell?.jaccardScore ?? 0
                  const pct = Math.round(score * 100)
                  const dimmed = !isSelf && pct < minOverlap
                  const hasOverlap = !isSelf && pct >= minOverlap && pct > 0

                  return (
                    <div
                      key={`cell-${rowPlaylist.id}-${colPlaylist.id}`}
                      onClick={() => hasOverlap && handleCellClick(rowPlaylist, colPlaylist)}
                      title={
                        isSelf
                          ? `${rowPlaylist.name}: ${rowPlaylist.tracks.length} tracks`
                          : cell
                          ? `${rowPlaylist.name} & ${colPlaylist.name}: ${cell.sharedCount} shared (${pct}% Jaccard)`
                          : undefined
                      }
                      className={`border-b border-border flex items-center justify-center text-[10px] font-medium transition-opacity ${
                        hasOverlap ? "cursor-pointer hover:ring-1 hover:ring-primary" : ""
                      } ${dimmed ? "opacity-20" : ""}`}
                      style={{
                        height: CELL_SIZE,
                        backgroundColor: isSelf ? "hsl(var(--muted) / 0.5)" : overlapColor(dimmed ? 0 : score),
                      }}
                    >
                      {isSelf ? (
                        <span className="text-muted-foreground/60">{rowPlaylist.tracks.length}</span>
                      ) : pct > 0 && !dimmed ? (
                        <span className="text-foreground/80">{pct}%</span>
                      ) : null}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
        </div>
      )}

      {/* Overlap drawer */}
      <Sheet open={!!drawerState} onOpenChange={(open) => !open && setDrawerState(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {drawerState && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-base leading-snug">
                  {drawerState.cell.sharedCount} shared tracks
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {drawerState.playlistA.name} &amp; {drawerState.playlistB.name}
                  &nbsp;&middot;&nbsp;
                  {Math.round(drawerState.cell.jaccardScore * 100)}% Jaccard similarity
                </p>
              </SheetHeader>

              <div className="divide-y divide-border/40">
                {drawerState.cell.sharedTracks.map((track, i) => (
                  <div key={track.id} className="flex items-center gap-3 py-3">
                    <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0">{i + 1}</span>
                    <div className="w-9 h-9 flex-shrink-0 rounded-sm overflow-hidden bg-muted">
                      {track.albumArt ? (
                        <Image src={track.albumArt} alt="" width={36} height={36} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Music className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{track.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artists.join(", ")}</p>
                    </div>
                    <a
                      href={`https://open.spotify.com/track/${track.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex-shrink-0"
                    >
                      Open
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
