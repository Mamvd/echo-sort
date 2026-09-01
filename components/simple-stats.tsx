"use client"

import { useState, useEffect } from "react"
import { Music, Users, Loader2, AlertCircle } from "lucide-react"

interface Track {
  id: string
  name: string
  artists: string[]
  albumName: string
}

interface PlaylistStats {
  id: string
  name: string
  totalTracks: number
  uniqueTracks: number
  uniqueArtists: number
  duplicateCount: number
  bloatPercent: number
  trackIds: Set<string>
}

interface OverlapInfo {
  trackIds: Set<string>
  count: number
}

interface SimpleStatsProps {
  selectedPlaylists: string[]
  accessToken: string
  getValidToken: () => Promise<string | null>
}

export default function SimpleStats({ selectedPlaylists, accessToken, getValidToken }: SimpleStatsProps) {
  const [stats, setStats] = useState<PlaylistStats[]>([])
  const [overlaps, setOverlaps] = useState<Map<string, OverlapInfo>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (selectedPlaylists.length === 0) {
      setLoading(false)
      return
    }
    fetchStats()
  }, [selectedPlaylists])

  const fetchStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = await getValidToken() || accessToken
      const allPlaylistStats: PlaylistStats[] = []
      const allTracksByPlaylist: Map<string, Set<string>> = new Map()

      // Fetch stats for each playlist
      for (const playlistId of selectedPlaylists) {
        try {
          let tracks: Track[] = []
          let nextUrl: string | null =
            playlistId === "liked-songs"
              ? "https://api.spotify.com/v1/me/tracks?limit=50"
              : `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`

          // Fetch all tracks for this playlist
          while (nextUrl) {
            const res = await fetch(nextUrl, {
              headers: { Authorization: `Bearer ${token}` },
            })

            if (!res.ok) {
              throw new Error(`Failed to fetch tracks for playlist ${playlistId}`)
            }

            const data = await res.json()
            tracks = [
              ...tracks,
              ...data.items
                .map((item: any) => ({
                  id: item.track?.id || "",
                  name: item.track?.name || "",
                  artists: item.track?.artists?.map((a: any) => a.name) || [],
                  albumName: item.track?.album?.name || "",
                }))
                .filter((t) => t.id),
            ]
            nextUrl = data.next || null
          }

          // Get playlist name
          let playlistName = "Liked Songs"
          if (playlistId !== "liked-songs") {
            const playlistRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            if (playlistRes.ok) {
              const playlistData = await playlistRes.json()
              playlistName = playlistData.name
            }
          }

          // Calculate stats
          const uniqueTrackIds = new Set(tracks.map((t) => t.id))
          const uniqueArtistsSet = new Set(tracks.flatMap((t) => t.artists))
          const duplicateCount = tracks.length - uniqueTrackIds.size
          const bloatPercent =
            tracks.length > 0 ? Math.round((duplicateCount / tracks.length) * 100) : 0

          allPlaylistStats.push({
            id: playlistId,
            name: playlistName,
            totalTracks: tracks.length,
            uniqueTracks: uniqueTrackIds.size,
            uniqueArtists: uniqueArtistsSet.size,
            duplicateCount,
            bloatPercent,
            trackIds: uniqueTrackIds,
          })

          // Store track IDs for overlap calculation
          allTracksByPlaylist.set(playlistId, uniqueTrackIds)
        } catch (err) {
          console.error(`Error processing playlist ${playlistId}:`, err)
        }
      }

      // Calculate overlaps between playlists
      const overlapMap = new Map<string, OverlapInfo>()
      const playlistIds = Array.from(allTracksByPlaylist.keys())
      
      for (let i = 0; i < playlistIds.length; i++) {
        for (let j = i + 1; j < playlistIds.length; j++) {
          const id1 = playlistIds[i]
          const id2 = playlistIds[j]
          const tracks1 = allTracksByPlaylist.get(id1) || new Set()
          const tracks2 = allTracksByPlaylist.get(id2) || new Set()
          
          const overlappingTracks = new Set([...tracks1].filter(t => tracks2.has(t)))
          if (overlappingTracks.size > 0) {
            const key = `${id1}|${id2}`
            overlapMap.set(key, {
              trackIds: overlappingTracks,
              count: overlappingTracks.size,
            })
          }
        }
      }

      setStats(allPlaylistStats)
      setOverlaps(overlapMap)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats")
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-destructive">Error loading stats</p>
          <p className="text-xs text-destructive/80 mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (stats.length === 0) {
    return (
      <div className="text-center py-12">
        <Music className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">No playlists selected</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Overall summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-5 hover:bg-accent transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            Total tracks
          </p>
          <p className="text-3xl font-bold">{stats.reduce((sum, s) => sum + s.totalTracks, 0)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 hover:bg-accent transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            Unique tracks
          </p>
          <p className="text-3xl font-bold text-primary">{stats.reduce((sum, s) => sum + s.uniqueTracks, 0)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 hover:bg-accent transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            Duplicates
          </p>
          <p className="text-3xl font-bold text-destructive">
            {stats.reduce((sum, s) => sum + s.duplicateCount, 0)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-5 hover:bg-accent transition-colors">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-3">
            Unique artists
          </p>
          <p className="text-3xl font-bold">{stats.reduce((sum, s) => sum + s.uniqueArtists, 0)}</p>
        </div>
      </div>

      {/* Per-playlist stats */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Music className="w-5 h-5 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Breakdown by playlist</h3>
        </div>
        <div className="space-y-3">
          {stats.map((stat) => (
            <div key={stat.name} className="rounded-lg border border-border bg-card/50 p-5 hover:bg-card transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-foreground">{stat.name}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {stat.totalTracks} total • {stat.uniqueTracks} unique • {stat.uniqueArtists} artists
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-destructive">{stat.bloatPercent}%</p>
                  <p className="text-xs text-muted-foreground mt-1">bloat</p>
                </div>
              </div>
              <div className="w-full bg-muted/50 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-destructive to-destructive/70 transition-all"
                  style={{ width: `${Math.min(stat.bloatPercent, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Overlap info */}
      {stats.length > 1 && overlaps.size > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Overlaps between playlists</h3>
          </div>
          <div className="space-y-3">
            {Array.from(overlaps.entries()).map(([key, overlap]) => {
              const [id1, id2] = key.split("|")
              const playlist1 = stats.find(s => s.id === id1)
              const playlist2 = stats.find(s => s.id === id2)
              
              return (
                <div key={key} className="rounded-lg border border-border bg-card/50 p-5 hover:bg-card transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {playlist1?.name} ↔ {playlist2?.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {overlap.count} shared track{overlap.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-xl font-bold text-primary">{overlap.count}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-muted/30 border border-border">
            Use the Cleanup tab to manage and remove duplicate tracks across your playlists.
          </p>
        </div>
      )}

      {stats.length > 1 && overlaps.size === 0 && (
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">No overlaps found:</span> Your selected playlists don&apos;t share any tracks.
          </p>
        </div>
      )}
    </div>
  )
}
