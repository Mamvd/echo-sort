"use client"

import { useState, useEffect, useMemo } from "react"
import { Loader2, Music, Search, Heart, CheckSquare, Square, ArrowUpDown, Users, User, Music2 } from "lucide-react"
import Image from "next/image"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import UserProfile from "@/components/user-profile"
import { ThemeToggle } from "@/components/theme-toggle"

interface Playlist {
  id: string
  name: string
  tracks: { total: number }
  images: Array<{ url: string }>
  owner: { display_name: string; id: string }
  collaborative?: boolean
  public?: boolean
}

interface PlaylistSelectorProps {
  accessToken: string
  onAnalyze: (selectedPlaylists: string[]) => void
  onLogout: () => void
  timeUntilExpiry: number | null
}

type SortOption = "name" | "tracks" | "owner"
type SortDirection = "asc" | "desc"
type FilterOption = "all" | "me" | "others" | "spotify"

export default function PlaylistSelector({ accessToken, onAnalyze, onLogout, timeUntilExpiry }: PlaylistSelectorProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [likedSongs, setLikedSongs] = useState<Playlist | null>(null)
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterOption>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("name")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [singlePlaylistMode, setSinglePlaylistMode] = useState(false)
  const [userProfile, setUserProfile] = useState<{ id: string; display_name: string } | null>(null)

  useEffect(() => {
    fetchPlaylistsAndLikedSongs()
  }, [accessToken])

  const fetchPlaylistsAndLikedSongs = async () => {
    try {
      setLoading(true)
      setError(null)

      const profileResponse = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      let profile = null
      if (profileResponse.ok) {
        profile = await profileResponse.json()
        setUserProfile(profile)
      }

      let allPlaylists: Playlist[] = []
      let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50"
      let pageCount = 0

      while (nextUrl && pageCount < 20) {
        pageCount++
        const response = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (!response.ok) throw new Error(`Failed to fetch playlists: ${response.status}`)
        const data = await response.json()
        if (data.items?.length > 0) allPlaylists = [...allPlaylists, ...data.items]
        nextUrl = data.next ?? null
        if (!data.next) break
      }
      setPlaylists(allPlaylists)

      try {
        const likedSongsResponse = await fetch("https://api.spotify.com/v1/me/tracks?limit=1", {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
        if (likedSongsResponse.ok) {
          const likedSongsData = await likedSongsResponse.json()
          if (likedSongsData.total > 0) {
            setLikedSongs({
              id: "liked-songs",
              name: "Liked Songs",
              tracks: { total: likedSongsData.total },
              images: [{ url: "" }],
              owner: { display_name: profile?.display_name ?? "You", id: profile?.id ?? "current-user" },
            })
          }
        }
      } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlists")
    } finally {
      setLoading(false)
    }
  }

  const handlePlaylistToggle = (playlistId: string) => {
    if (singlePlaylistMode) {
      setSelectedPlaylists([playlistId])
    } else {
      setSelectedPlaylists((prev) =>
        prev.includes(playlistId) ? prev.filter((id) => id !== playlistId) : [...prev, playlistId],
      )
    }
  }

  const filteredAndSorted = useMemo(() => {
    let filtered = [...playlists]

    if (userProfile) {
      if (filter === "me") filtered = playlists.filter((p) => p.owner.id === userProfile.id)
      else if (filter === "others") filtered = playlists.filter((p) => p.owner.id !== userProfile.id && p.owner.id !== "spotify")
      else if (filter === "spotify") filtered = playlists.filter((p) => p.owner.id === "spotify")
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.owner.display_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    }

    filtered.sort((a, b) => {
      let cmp = 0
      if (sortBy === "name") cmp = a.name.localeCompare(b.name)
      else if (sortBy === "tracks") cmp = a.tracks.total - b.tracks.total
      else if (sortBy === "owner") cmp = a.owner.display_name.localeCompare(b.owner.display_name)
      return sortDirection === "desc" ? -cmp : cmp
    })

    const all: Playlist[] = []
    if (likedSongs) {
      const matchesFilter = filter === "all" || (filter === "me" && likedSongs.owner.id === userProfile?.id)
      const matchesSearch = !searchQuery || likedSongs.name.toLowerCase().includes(searchQuery.toLowerCase())
      if (matchesFilter && matchesSearch) all.push(likedSongs)
    }
    all.push(...filtered)
    return all
  }, [playlists, likedSongs, filter, searchQuery, sortBy, sortDirection, userProfile])

  const stats = useMemo(() => {
    if (!userProfile) return { me: 0, others: 0, spotify: 0 }
    return {
      me: playlists.filter((p) => p.owner.id === userProfile.id).length + (likedSongs ? 1 : 0),
      spotify: playlists.filter((p) => p.owner.id === "spotify").length,
      others: playlists.filter((p) => p.owner.id !== userProfile.id && p.owner.id !== "spotify").length,
    }
  }, [playlists, likedSongs, userProfile])

  const totalItems = playlists.length + (likedSongs ? 1 : 0)
  const minRequired = singlePlaylistMode ? 1 : 2
  const canAnalyze = selectedPlaylists.length >= minRequired
  const allVisible = filteredAndSorted.length > 0 && filteredAndSorted.every((p) => selectedPlaylists.includes(p.id))

  const filterTabs: { value: FilterOption; label: string; icon: React.ReactNode; count: number }[] = [
    { value: "all", label: "All", icon: <Music className="w-3.5 h-3.5" />, count: totalItems },
    { value: "me", label: "My playlists", icon: <User className="w-3.5 h-3.5" />, count: stats.me },
    { value: "others", label: "Others", icon: <Users className="w-3.5 h-3.5" />, count: stats.others },
    { value: "spotify", label: "Spotify", icon: <Music2 className="w-3.5 h-3.5" />, count: stats.spotify },
  ]

  const sortOptions: { value: string; label: string }[] = [
    { value: "name-asc", label: "Name (A–Z)" },
    { value: "name-desc", label: "Name (Z–A)" },
    { value: "tracks-desc", label: "Most tracks" },
    { value: "tracks-asc", label: "Fewest tracks" },
    { value: "owner-asc", label: "Owner (A–Z)" },
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-sm font-medium">Loading your library...</p>
          <p className="text-xs text-muted-foreground mt-1">This may take a moment for large libraries</p>
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
            onClick={fetchPlaylistsAndLikedSongs}
            className="px-6 py-2 rounded-full bg-foreground text-background text-sm font-bold hover:scale-105 transition-transform"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">Your Library</h1>
            <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {filteredAndSorted.length}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="single-mode"
                checked={singlePlaylistMode}
                onCheckedChange={(checked) => {
                  setSinglePlaylistMode(checked)
                  if (checked && selectedPlaylists.length > 1) setSelectedPlaylists([selectedPlaylists[0]])
                }}
              />
              <Label htmlFor="single-mode" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                Single mode
              </Label>
            </div>
            <ThemeToggle />
            <UserProfile accessToken={accessToken} onLogout={onLogout} timeUntilExpiry={timeUntilExpiry} />
          </div>
        </div>

        {/* Search + Sort */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 h-10 rounded-full bg-muted text-sm placeholder:text-muted-foreground border-0 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="relative">
            <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <select
              value={`${sortBy}-${sortDirection}`}
              onChange={(e) => {
                const [sort, dir] = e.target.value.split("-") as [SortOption, SortDirection]
                setSortBy(sort)
                setSortDirection(dir)
              }}
              className="pl-8 pr-3 h-10 rounded-full bg-muted text-sm text-foreground border-0 focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter chips */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-3 flex gap-2 overflow-x-auto scrollbar-none">
          {filterTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                filter === tab.value
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
              <span className="opacity-70">{tab.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Playlist list */}
      <div className="flex-1 w-full px-4 sm:px-6 py-2">
        <div className="max-w-6xl mx-auto">

        {/* Select all / clear */}
        {!singlePlaylistMode && filteredAndSorted.length > 0 && (
          <div className="flex items-center gap-3 py-2 px-1">
            <button
              onClick={allVisible ? () => setSelectedPlaylists([]) : () => setSelectedPlaylists(filteredAndSorted.map((p) => p.id))}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allVisible ? (
                <><CheckSquare className="w-3.5 h-3.5" /> Clear all</>
              ) : (
                <><Square className="w-3.5 h-3.5" /> Select all visible</>
              )}
            </button>
            {selectedPlaylists.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedPlaylists.length} selected
              </span>
            )}
          </div>
        )}

        {/* Playlist rows */}
        <div className="divide-y divide-border/40">
          {filteredAndSorted.map((playlist, index) => {
            const isSelected = selectedPlaylists.includes(playlist.id)
            const isLiked = playlist.id === "liked-songs"

            return (
              <div
                key={playlist.id}
                onClick={() => handlePlaylistToggle(playlist.id)}
                className={`group flex items-center gap-3 px-2 py-2.5 rounded-sm cursor-pointer transition-colors hover:bg-accent ${
                  isSelected ? "bg-accent/60" : ""
                }`}
              >
                {/* Index / checkbox */}
                <div className="w-8 flex items-center justify-center flex-shrink-0">
                  {isSelected ? (
                    <div className="w-5 h-5 rounded-sm bg-primary flex items-center justify-center">
                      <svg viewBox="0 0 12 12" className="w-3 h-3 fill-primary-foreground">
                        <path d="M10 3L5 8.5L2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground group-hover:hidden">{index + 1}</span>
                  )}
                  {!isSelected && (
                    <div className="w-5 h-5 rounded-sm border border-border hidden group-hover:flex items-center justify-center" />
                  )}
                </div>

                {/* Cover art */}
                <div className="w-10 h-10 flex-shrink-0 rounded-sm overflow-hidden bg-muted shadow-sm">
                  {isLiked ? (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#450af5] to-[#c4efd9]">
                      <Heart className="w-5 h-5 text-white fill-white" />
                    </div>
                  ) : playlist.images?.[0]?.url ? (
                    <Image src={playlist.images[0].url} alt={playlist.name} width={40} height={40} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <Music className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isSelected ? "text-primary" : "group-hover:text-foreground"}`}>
                    {playlist.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {playlist.owner.id === "spotify" ? (
                      <span className="text-primary">Spotify</span>
                    ) : (
                      playlist.owner.display_name
                    )}
                    {playlist.collaborative && <span className="ml-1 text-muted-foreground/60">· Collaborative</span>}
                  </p>
                </div>

                {/* Track count */}
                <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                  {playlist.tracks.total.toLocaleString()}
                </span>
              </div>
            )
          })}

          {filteredAndSorted.length === 0 && (
            <div className="py-24 text-center">
              <Music className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No playlists found</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 bg-card/95 backdrop-blur-md border-t border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            {selectedPlaylists.length > 0 ? (
              <span>
                <span className="text-foreground font-semibold">{selectedPlaylists.length}</span> playlist{selectedPlaylists.length !== 1 ? "s" : ""} selected
              </span>
            ) : (
              <span>Select {minRequired === 1 ? "a playlist" : "2 or more playlists"} to analyze</span>
            )}
          </p>
          <button
            onClick={() => canAnalyze && onAnalyze(selectedPlaylists)}
            disabled={!canAnalyze}
            className="px-6 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] transition-transform"
          >
            {singlePlaylistMode ? "Find Duplicates" : "Analyze"}
          </button>
        </div>
        </div>
      </div>
    </div>
  )
}
