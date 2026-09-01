import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const authHeader = request.headers.get("authorization")

    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    // Validate playlist ID format (Spotify IDs are alphanumeric, typically 22 chars)
    if (!/^[a-zA-Z0-9]{1,50}$/.test(id)) {
      return NextResponse.json({ error: "Invalid playlist ID" }, { status: 400 })
    }

    let allTracks: any[] = []
    let nextUrl = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: authHeader,
        },
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          return NextResponse.json({ error: "Token expired" }, { status: 401 })
        }
        throw new Error(data.error?.message || "Failed to fetch tracks")
      }

      allTracks = [...allTracks, ...data.items]
      nextUrl = data.next
    }

    return NextResponse.json({ items: allTracks })
  } catch (error) {
    console.error("Fetch tracks error:", error)
    return NextResponse.json({ error: "Failed to fetch tracks" }, { status: 500 })
  }
}
