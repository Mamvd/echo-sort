export interface Track {
  id: string
  name: string
  artists: Array<{ name: string }>
  album: { name: string; images: Array<{ url: string }> }
  external_urls: { spotify: string }
  uri: string
}

export interface PlaylistTrack {
  track: Track
}

export interface PlaylistData {
  id: string
  name: string
  tracks: PlaylistTrack[]
}

export interface DuplicateGroup {
  trackId: string
  trackName: string
  artist: string
  album: string
  imageUrl: string
  spotifyUrl: string
  occurrences: number
  positions: number[]
}

export interface OverlapResult {
  trackId: string
  trackName: string
  artist: string
  album: string
  imageUrl: string
  spotifyUrl: string
  playlists: Array<{
    id: string
    name: string
    positions: number[]
  }>
}

export function findDuplicatesInPlaylist(playlist: PlaylistData): DuplicateGroup[] {
  const trackMap = new Map<
    string,
    {
      track: Track
      positions: number[]
    }
  >()

  playlist.tracks.forEach((item, index) => {
    if (!item.track || !item.track.id) return

    const trackId = item.track.id
    if (trackMap.has(trackId)) {
      trackMap.get(trackId)!.positions.push(index + 1)
    } else {
      trackMap.set(trackId, {
        track: item.track,
        positions: [index + 1],
      })
    }
  })

  return Array.from(trackMap.entries())
    .filter(([_, data]) => data.positions.length > 1)
    .map(([trackId, data]) => ({
      trackId,
      trackName: data.track.name,
      artist: data.track.artists.map((a) => a.name).join(", "),
      album: data.track.album.name,
      imageUrl: data.track.album.images[0]?.url || "",
      spotifyUrl: data.track.external_urls.spotify,
      occurrences: data.positions.length,
      positions: data.positions,
    }))
}

export function findOverlapsBetweenPlaylists(playlists: PlaylistData[]): OverlapResult[] {
  const trackMap = new Map<
    string,
    {
      track: Track
      playlists: Array<{
        id: string
        name: string
        positions: number[]
      }>
    }
  >()

  playlists.forEach((playlist) => {
    const playlistTrackMap = new Map<string, number[]>()

    playlist.tracks.forEach((item, index) => {
      if (!item.track || !item.track.id) return

      const trackId = item.track.id
      if (playlistTrackMap.has(trackId)) {
        playlistTrackMap.get(trackId)!.push(index + 1)
      } else {
        playlistTrackMap.set(trackId, [index + 1])
      }
    })

    playlistTrackMap.forEach((positions, trackId) => {
      const track = playlist.tracks.find((item) => item.track?.id === trackId)?.track
      if (!track) return

      if (trackMap.has(trackId)) {
        trackMap.get(trackId)!.playlists.push({
          id: playlist.id,
          name: playlist.name,
          positions,
        })
      } else {
        trackMap.set(trackId, {
          track,
          playlists: [
            {
              id: playlist.id,
              name: playlist.name,
              positions,
            },
          ],
        })
      }
    })
  })

  return Array.from(trackMap.entries())
    .filter(([_, data]) => data.playlists.length > 1)
    .map(([trackId, data]) => ({
      trackId,
      trackName: data.track.name,
      artist: data.track.artists.map((a) => a.name).join(", "),
      album: data.track.album.name,
      imageUrl: data.track.album.images[0]?.url || "",
      spotifyUrl: data.track.external_urls.spotify,
      playlists: data.playlists,
    }))
}
