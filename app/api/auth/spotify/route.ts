import { type NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"

const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!

const getRedirectUri = (): string => {
  const envRedirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI

  if (!envRedirectUri) {
    throw new Error(
      "Missing NEXT_PUBLIC_SPOTIFY_REDIRECT_URI environment variable. Please set it in your Vercel project settings."
    )
  }

  return envRedirectUri
}

// 5 token exchanges per 15 minutes per IP
const TOKEN_EXCHANGE_LIMIT = {
  max: 5,
  window: "15 m",
  windowMs: 15 * 60 * 1000,
  prefix: "auth:token",
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit
    const { response: rateLimited } = await rateLimit(request, TOKEN_EXCHANGE_LIMIT)
    if (rateLimited) return rateLimited

    // Validate Origin to prevent CSRF token exchange from malicious sites
    const origin = request.headers.get("origin")
    const host = request.headers.get("host")
    if (origin && host) {
      const originUrl = new URL(origin)
      if (originUrl.host !== host) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 })
      }
    }

    const { code, codeVerifier } = await request.json()
    const redirectUri = getRedirectUri()

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error("Spotify token error:", data)
      throw new Error(data.error_description || "Failed to exchange code for token")
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Spotify auth error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
