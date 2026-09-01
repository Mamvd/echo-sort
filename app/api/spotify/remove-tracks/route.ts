import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    const body = await request.json()
    const { playlistId, trackUris } = body

    if (!playlistId || !trackUris || !Array.isArray(trackUris)) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    // Validate playlist ID format
    if (playlistId !== "liked-songs" && !/^[a-zA-Z0-9]{1,50}$/.test(playlistId)) {
      return NextResponse.json({ error: "Invalid playlist ID" }, { status: 400 })
    }

    // Validate track URIs
    const validUris = trackUris.filter((uri: string) =>
      typeof uri === "string" && /^spotify:(?:track|album|artist):[a-zA-Z0-9]+$/.test(uri)
    )
    if (validUris.length === 0) {
      return NextResponse.json({ error: "No valid track URIs provided" }, { status: 400 })
    }

    if (playlistId === "liked-songs") {
      // For Liked Songs, use DELETE /me/tracks endpoint
      const response = await fetch("https://api.spotify.com/v1/me/tracks", {
        method: "DELETE",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: validUris.map((uri: string) => uri.split(":")[2]),
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        return NextResponse.json(
          { error: `Failed to remove tracks from Liked Songs: ${error}` },
          { status: response.status },
        )
      }

      return NextResponse.json({ success: true })
    }

    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: "DELETE",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracks: validUris.map((uri: string) => ({ uri })),
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error("Spotify API error:", error)

      if (response.status === 403) {
        return NextResponse.json({ error: "You don't have permission to modify this playlist" }, { status: 403 })
      }

      return NextResponse.json({ error: `Failed to remove tracks: ${error}` }, { status: response.status })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error removing tracks:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove tracks" },
      { status: 500 },
    )
  }
}
