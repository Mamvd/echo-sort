import { type NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!

// 20 refresh attempts per 15 minutes per IP (legitimate users auto-refresh frequently)
const TOKEN_REFRESH_LIMIT = {
  max: 20,
  window: "15 m",
  windowMs: 15 * 60 * 1000,
  prefix: "auth:refresh",
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const { response: rateLimited } = await rateLimit(request, TOKEN_REFRESH_LIMIT)
    if (rateLimited) return rateLimited

    // Validate Origin to prevent CSRF token refresh from malicious sites
    const origin = request.headers.get("origin")
    const host = request.headers.get("host")
    if (origin && host) {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
      }
    }

    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json({ error: "No refresh token provided" }, { status: 400 })
    }

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error_description || "Failed to refresh token")
    }

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Token refresh failed" }, { status: 500 })
  }
}
