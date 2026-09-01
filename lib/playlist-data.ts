// Shared types and data layer for EchoSort

export interface Track {
  id: string
  uri: string
  name: string
  artists: string[]
  albumName: string
  albumArt: string
  durationMs: number
  addedAt: string
  explicit?: boolean
  releaseDate?: string
  popularity?: number
}

export interface Playlist {
  id: string
  name: string
  ownerId: string
  ownerName: string
  category: "spotify" | "own" | "others"
  imageUrl: string
  snapshotId: string
  collaborative: boolean
  public: boolean
  tracks: Track[]
  totalExpected: number
}

export type FetchStage =
  | "idle"
  | "fetching_profile"
  | "fetching_playlists"
  | "fetching_tracks"
  | "fetching_liked_songs"
  | "done"
  | "error"

export interface FetchProgress {
  stage: FetchStage
  completed: number
  total: number
  currentItem: string
  rateLimitedUntil: number | null
  error: string | null
  // Track-level progress
  tracksCompleted: number
  tracksTotal: number
}

export type ProgressListener = (progress: FetchProgress) => void

// Simple event emitter for progress updates
class ProgressEmitter {
  private listeners: Set<ProgressListener> = new Set()

  subscribe(fn: ProgressListener) {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  emit(progress: FetchProgress) {
    this.listeners.forEach((fn) => fn(progress))
  }
}

export const progressEmitter = new ProgressEmitter()

// Rate-limited request queue
const MAX_CONCURRENT = 4

class RequestQueue {
  private queue: Array<() => Promise<void>> = []
  private running = 0

  async add<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          resolve(await fn())
        } catch (e) {
          reject(e)
        }
      })
      this.tick()
    })
  }

  private tick() {
    while (this.running < MAX_CONCURRENT && this.queue.length > 0) {
      const task = this.queue.shift()!
      this.running++
      task().finally(() => {
        this.running--
        this.tick()
      })
    }
  }
}

export const requestQueue = new RequestQueue()

// Fetch with automatic 429 retry and token refresh
export async function spotifyFetch(
  url: string,
  token: string,
  options: RequestInit = {},
  onRateLimit?: (retryAfterMs: number) => void,
): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "3", 10)
      const waitMs = (retryAfter + 1) * 1000
      onRateLimit?.(waitMs)
      await new Promise((r) => setTimeout(r, waitMs))
      continue
    }

    return res
  }

  throw new Error("Too many rate-limit retries")
}

// Normalize track from Spotify API response
function normalizeTrack(item: any, addedAt?: string): Track | null {
  const track = item.track ?? item
  if (!track || !track.id || track.type === "episode") return null

  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artists: (track.artists ?? []).map((a: any) => a.name),
    albumName: track.album?.name ?? "",
    albumArt: track.album?.images?.[0]?.url ?? "",
    durationMs: track.duration_ms ?? 0,
    addedAt: addedAt ?? item.added_at ?? "",
    explicit: track.explicit ?? false,
    releaseDate: track.album?.release_date ?? "",
    popularity: track.popularity ?? 0,
  }
}

// Fetch all tracks for a playlist (paginated)
async function fetchAllTracks(
  playlistId: string,
  token: string,
  onRateLimit?: (ms: number) => void,
): Promise<Track[]> {
  const tracks: Track[] = []
  let nextUrl =
    playlistId === "liked-songs"
      ? "https://api.spotify.com/v1/me/tracks?limit=50&fields=items(added_at,track(id,uri,name,duration_ms,explicit,popularity,artists(name),album(name,images,release_date))),next,total"
      : `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&fields=items(added_at,track(id,uri,name,duration_ms,explicit,popularity,artists(name),album(name,images,release_date))),next,total`

  while (nextUrl) {
    const res = await requestQueue.add(() => spotifyFetch(nextUrl, token, {}, onRateLimit))
    if (!res.ok) {
      if (res.status === 401) throw new Error("TOKEN_EXPIRED")
      break
    }
    const data = await res.json()
    for (const item of data.items ?? []) {
      const t = normalizeTrack(item, item.added_at)
      if (t) tracks.push(t)
    }
    nextUrl = data.next ?? null
  }

  return tracks
}

// Main fetch pipeline — fetches all playlists + tracks, emits progress
export async function fetchAllPlaylistData(
  token: string,
  getValidToken: () => Promise<string | null>,
  signal?: AbortSignal,
): Promise<Playlist[]> {
  let currentToken = token

  const getToken = async (): Promise<string> => {
    const fresh = await getValidToken()
    if (fresh) { currentToken = fresh; return fresh }
    throw new Error("SESSION_EXPIRED")
  }

  const emit = (partial: Partial<FetchProgress> & { stage: FetchStage }) => {
    progressEmitter.emit({
      completed: 0,
      total: 0,
      currentItem: "",
      rateLimitedUntil: null,
      error: null,
      tracksCompleted: 0,
      tracksTotal: 0,
      ...partial,
    })
  }

  const onRateLimit = (waitMs: number) => {
    progressEmitter.emit({
      stage: "fetching_tracks",
      completed: 0,
      total: 0,
      currentItem: "",
      tracksCompleted: 0,
      tracksTotal: 0,
      rateLimitedUntil: Date.now() + waitMs,
      error: null,
    })
  }

  // 1. Fetch current user profile
  emit({ stage: "fetching_profile", currentItem: "Fetching your profile..." })
  const profileRes = await spotifyFetch("https://api.spotify.com/v1/me", currentToken)
  if (!profileRes.ok) throw new Error("Failed to fetch user profile")
  const profile = await profileRes.json()
  const userId = profile.id

  if (signal?.aborted) throw new Error("ABORTED")

  // 2. Fetch all playlists (paginated)
  emit({ stage: "fetching_playlists", currentItem: "Fetching your playlists..." })
  const rawPlaylists: any[] = []
  let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50"
  while (nextUrl) {
    if (signal?.aborted) throw new Error("ABORTED")
    const res = await spotifyFetch(nextUrl, currentToken, {}, onRateLimit)
    if (!res.ok) {
      if (res.status === 401) { currentToken = await getToken() ; continue }
      break
    }
    const data = await res.json()
    rawPlaylists.push(...(data.items ?? []))
    emit({ stage: "fetching_playlists", completed: rawPlaylists.length, total: data.total, currentItem: `Found ${rawPlaylists.length} playlists...` })
    nextUrl = data.next ?? null
  }

  if (signal?.aborted) throw new Error("ABORTED")

  // Categorize playlists
  const categorized: Omit<Playlist, "tracks">[] = rawPlaylists.map((p: any) => ({
    id: p.id,
    name: p.name,
    ownerId: p.owner.id,
    ownerName: p.owner.display_name ?? p.owner.id,
    category: p.owner.id === "spotify" ? "spotify" : p.owner.id === userId ? "own" : "others",
    imageUrl: p.images?.[0]?.url ?? "",
    snapshotId: p.snapshot_id ?? "",
    collaborative: p.collaborative ?? false,
    public: p.public ?? false,
    totalExpected: p.tracks?.total ?? 0,
  }))

  // Check liked songs total
  let likedSongsTotal = 0
  try {
    const likedRes = await spotifyFetch("https://api.spotify.com/v1/me/tracks?limit=1", currentToken, {}, onRateLimit)
    if (likedRes.ok) {
      const likedData = await likedRes.json()
      likedSongsTotal = likedData.total ?? 0
    }
  } catch {}

  const allToFetch: Omit<Playlist, "tracks">[] = []
  if (likedSongsTotal > 0) {
    allToFetch.push({
      id: "liked-songs",
      name: "Liked Songs",
      ownerId: userId,
      ownerName: profile.display_name ?? "You",
      category: "own",
      imageUrl: "",
      snapshotId: "",
      collaborative: false,
      public: false,
      totalExpected: likedSongsTotal,
    })
  }
  allToFetch.push(...categorized)

  const totalTracks = allToFetch.reduce((sum, p) => sum + p.totalExpected, 0)

  // 3. Fetch tracks for all playlists
  const results: Playlist[] = []
  let tracksCompleted = 0

  for (let i = 0; i < allToFetch.length; i++) {
    if (signal?.aborted) throw new Error("ABORTED")

    const p = allToFetch[i]
    emit({
      stage: "fetching_tracks",
      completed: i,
      total: allToFetch.length,
      currentItem: `Scanning ${p.name} (${i + 1} of ${allToFetch.length})`,
      tracksCompleted,
      tracksTotal: totalTracks,
    })

    try {
      const tracks = await fetchAllTracks(p.id, currentToken, onRateLimit)
      tracksCompleted += tracks.length
      results.push({ ...p, tracks })
    } catch (err) {
      if (err instanceof Error && err.message === "TOKEN_EXPIRED") {
        currentToken = await getToken()
        // Retry this playlist once with fresh token
        try {
          const tracks = await fetchAllTracks(p.id, currentToken, onRateLimit)
          tracksCompleted += tracks.length
          results.push({ ...p, tracks })
        } catch {
          results.push({ ...p, tracks: [] })
        }
      } else {
        // Non-fatal — push empty tracks so the playlist still shows
        results.push({ ...p, tracks: [] })
      }
    }

    emit({
      stage: "fetching_tracks",
      completed: i + 1,
      total: allToFetch.length,
      currentItem: `Scanned ${p.name}`,
      tracksCompleted,
      tracksTotal: totalTracks,
    })
  }

  emit({ stage: "done", currentItem: "Done", completed: allToFetch.length, total: allToFetch.length, tracksCompleted, tracksTotal: totalTracks })

  return results
}

// Fuzzy match key: normalize name + first artist for cross-ID duplicate detection
export function fuzzyKey(name: string, artists: string[]): string {
  const artist = artists[0] ?? ""
  return `${name}|${artist}`
    .toLowerCase()
    .replace(/[^a-z0-9|]/g, "")
    .replace(/\s+/g, "")
}

// Jaccard similarity between two sets
export function jaccard(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0
  let intersection = 0
  setA.forEach((id) => { if (setB.has(id)) intersection++ })
  const union = setA.size + setB.size - intersection
  return union === 0 ? 0 : intersection / union
}
