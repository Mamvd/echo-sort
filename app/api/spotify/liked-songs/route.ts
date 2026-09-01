import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return NextResponse.json({ error: "No authorization header" }, { status: 401 })
    }

    let allTracks: any[] = []
    let nextUrl = "https://api.spotify.com/v1/me/tracks?limit=50"

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
        throw new Error(data.error?.message || "Failed to fetch liked songs")
      }

      allTracks = [...allTracks, ...data.items]
      nextUrl = data.next
    }

    return NextResponse.json({ items: allTracks })
  } catch (error) {
    console.error("Fetch liked songs error:", error)
    return NextResponse.json({ error: "Failed to fetch liked songs" }, { status: 500 })
  }
}
