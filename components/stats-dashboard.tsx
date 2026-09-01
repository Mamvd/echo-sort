"use client"

import { useMemo, useState, useEffect, useRef } from "react"
import { usePlaylistData } from "@/contexts/playlist-data-context"
import type { Playlist, Track } from "@/lib/playlist-data"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from "recharts"
import { Clock, Music, Users, Copy, TrendingUp, Calendar } from "lucide-react"

type Scope = "all" | "own" | "spotify" | "others"

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatNumber(n: number): string {
  return n.toLocaleString()
}

interface DashboardData {
  playlists: Playlist[]
  totalTracks: number
  uniqueTracks: number
  uniqueArtists: number
  totalDurationMs: number
  avgTracksPerPlaylist: number
  duplicateCount: number
  bloatPercent: number
  topDuplicatedTracks: Array<{ name: string; artist: string; count: number }>
  tracksByDecade: Array<{ decade: string; count: number }>
  newestAddition: Track | null
  oldestAddition: Track | null
}

function computeDashboardData(playlists: Playlist[]): DashboardData {
  if (playlists.length === 0) {
    return {
      playlists: [],
      totalTracks: 0,
      uniqueTracks: 0,
      uniqueArtists: 0,
      totalDurationMs: 0,
      avgTracksPerPlaylist: 0,
      duplicateCount: 0,
      bloatPercent: 0,
      topDuplicatedTracks: [],
      tracksByDecade: [],
      newestAddition: null,
      oldestAddition: null,
    }
  }

  const allTracks = playlists.flatMap((p) => p.tracks)
  const totalTracks = allTracks.length
  const totalDurationMs = allTracks.reduce((sum, t) => sum + t.durationMs, 0)

  // Unique tracks by ID
  const uniqueIds = new Set(allTracks.map((t) => t.id))
  const uniqueTracks = uniqueIds.size
  const duplicateCount = totalTracks - uniqueTracks

  // Unique artists
  const uniqueArtists = new Set(allTracks.flatMap((t) => t.artists)).size

  const avgTracksPerPlaylist = playlists.length > 0 ? Math.round(totalTracks / playlists.length) : 0
  const bloatPercent = totalTracks > 0 ? Math.round((duplicateCount / totalTracks) * 100) : 0

  // Top duplicated tracks — by ID frequency across playlists
  const trackPlaylistCount = new Map<string, { name: string; artist: string; count: number }>()
  for (const playlist of playlists) {
    const seen = new Set<string>()
    for (const track of playlist.tracks) {
      if (!seen.has(track.id)) {
        seen.add(track.id)
        const entry = trackPlaylistCount.get(track.id)
        if (entry) {
          entry.count++
        } else {
          trackPlaylistCount.set(track.id, { name: track.name, artist: track.artists[0] ?? "", count: 1 })
        }
      }
    }
  }
  const topDuplicatedTracks = Array.from(trackPlaylistCount.values())
    .filter((t) => t.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Track age by decade from release date
  const decadeMap = new Map<string, number>()
  for (const track of allTracks) {
    if (!track.releaseDate) continue
    const year = parseInt(track.releaseDate.slice(0, 4), 10)
    if (!isNaN(year)) {
      const decade = `${Math.floor(year / 10) * 10}s`
      decadeMap.set(decade, (decadeMap.get(decade) ?? 0) + 1)
    }
  }
  const tracksByDecade = Array.from(decadeMap.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => a.decade.localeCompare(b.decade))

  // Newest / oldest additions by added_at
  const withDates = allTracks.filter((t) => t.addedAt)
  const sortedByDate = withDates.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
  const oldestAddition = sortedByDate[0] ?? null
  const newestAddition = sortedByDate[sortedByDate.length - 1] ?? null

  return {
    playlists,
    totalTracks,
    uniqueTracks,
    uniqueArtists,
    totalDurationMs,
    avgTracksPerPlaylist,
    duplicateCount,
    bloatPercent,
    topDuplicatedTracks,
    tracksByDecade,
    newestAddition,
    oldestAddition,
  }
}

const CHART_COLORS = [
  "hsl(var(--primary) / 0.9)",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.5)",
  "hsl(var(--primary) / 0.4)",
  "hsl(var(--primary) / 0.3)",
]

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--muted-foreground))", "hsl(var(--accent-foreground))"]

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="rounded-xl bg-card border border-border p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="py-16 text-center text-muted-foreground">
      <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
      <p className="text-sm">{label}</p>
    </div>
  )
}

function DashboardPanel({ data, allData }: { data: DashboardData; allData?: DashboardData }) {
  if (data.playlists.length === 0) {
    return <EmptyState label="No playlists in this category" />
  }

  const splitChartData = allData
    ? [
        { name: "Your playlists", value: allData.playlists.filter((p) => p.category === "own").length },
        { name: "Spotify", value: allData.playlists.filter((p) => p.category === "spotify").length },
        { name: "Others", value: allData.playlists.filter((p) => p.category === "others").length },
      ].filter((d) => d.value > 0)
    : null

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Music} label="Playlists" value={formatNumber(data.playlists.length)} />
        <StatCard
          icon={TrendingUp}
          label="Total tracks"
          value={formatNumber(data.totalTracks)}
          sub={`${formatNumber(data.uniqueTracks)} unique`}
        />
        <StatCard icon={Users} label="Artists" value={formatNumber(data.uniqueArtists)} />
        <StatCard icon={Clock} label="Listening time" value={formatDuration(data.totalDurationMs)} sub={`~${data.avgTracksPerPlaylist} tracks/playlist avg`} />
        <StatCard
          icon={Copy}
          label="Duplicates"
          value={formatNumber(data.duplicateCount)}
          sub={`${data.bloatPercent}% library bloat`}
        />
        <StatCard
          icon={Calendar}
          label="Newest addition"
          value={data.newestAddition?.name.slice(0, 20) ?? "—"}
          sub={data.newestAddition?.addedAt ? new Date(data.newestAddition.addedAt).toLocaleDateString() : undefined}
        />
      </div>

      {/* All combined: stacked split chart */}
      {splitChartData && splitChartData.length > 1 && (
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-semibold mb-4">Library split</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={splitChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                {splitChartData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val: number) => [`${val} playlists`, ""]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top duplicated tracks */}
      {data.topDuplicatedTracks.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-semibold mb-4">Most duplicated tracks</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, data.topDuplicatedTracks.length * 32)}>
            <BarChart
              data={data.topDuplicatedTracks}
              layout="vertical"
              margin={{ left: 0, right: 24, top: 0, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={150}
                tick={{ fontSize: 11 }}
                tickFormatter={(v: string) => (v.length > 22 ? v.slice(0, 22) + "…" : v)}
              />
              <Tooltip
                formatter={(val: number, _: string, props: any) => [
                  `${val} playlists`,
                  props.payload?.artist ?? "",
                ]}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.topDuplicatedTracks.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[Math.min(i, CHART_COLORS.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Track age distribution */}
      {data.tracksByDecade.length > 0 && (
        <div className="rounded-xl bg-card border border-border p-4">
          <h3 className="text-sm font-semibold mb-4">Track age distribution</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data.tracksByDecade} margin={{ left: 0, right: 8, top: 0, bottom: 0 }}>
              <XAxis dataKey="decade" tick={{ fontSize: 11 }} />
              <YAxis hide />
              <Tooltip formatter={(val: number) => [`${val} tracks`, ""]} />
              <Bar dataKey="count" fill="hsl(var(--primary) / 0.8)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default function StatsDashboard() {
  const { playlists, isLoading, progress } = usePlaylistData()

  const allData = useMemo(() => computeDashboardData(playlists), [playlists])
  const ownData = useMemo(() => computeDashboardData(playlists.filter((p) => p.category === "own")), [playlists])
  const spotifyData = useMemo(() => computeDashboardData(playlists.filter((p) => p.category === "spotify")), [playlists])
  const othersData = useMemo(() => computeDashboardData(playlists.filter((p) => p.category === "others")), [playlists])

  const isStillLoading = isLoading && progress?.stage !== "done"

  return (
    <div className="w-full">
      {isStillLoading && playlists.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          Still scanning... stats will update as more playlists load.
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="mb-6 bg-muted">
          <TabsTrigger value="all">All ({formatNumber(allData.totalTracks)} tracks)</TabsTrigger>
          <TabsTrigger value="own">Yours ({formatNumber(ownData.totalTracks)})</TabsTrigger>
          <TabsTrigger value="spotify">Spotify ({formatNumber(spotifyData.totalTracks)})</TabsTrigger>
          <TabsTrigger value="others">Others ({formatNumber(othersData.totalTracks)})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <DashboardPanel data={allData} allData={allData} />
        </TabsContent>
        <TabsContent value="own">
          <DashboardPanel data={ownData} />
        </TabsContent>
        <TabsContent value="spotify">
          <DashboardPanel data={spotifyData} />
        </TabsContent>
        <TabsContent value="others">
          <DashboardPanel data={othersData} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
