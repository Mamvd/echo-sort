const CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!

const getRedirectUri = (): string => {
  const envRedirectUri = process.env.NEXT_PUBLIC_SPOTIFY_REDIRECT_URI

  if (!envRedirectUri) {
    throw new Error(
      "Missing NEXT_PUBLIC_SPOTIFY_REDIRECT_URI environment variable. Please set it in your Vercel project settings to match your deployment URL.",
    )
  }

  return envRedirectUri
}

export const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-read-private",
  "user-library-read",
  "playlist-modify-public", // Added for removing tracks from public playlists
  "playlist-modify-private", // Added for removing tracks from private playlists
  "user-library-modify", // Added for removing tracks from Liked Songs
].join(" ")

export function generateCodeVerifier(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(verifier)
  const digest = await crypto.subtle.digest("SHA-256", data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
}

export function getSpotifyAuthUrl(codeChallenge: string, state: string): string {
  const redirectUri = getRedirectUri()

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri,
    code_challenge_method: "S256",
    code_challenge: codeChallenge,
    scope: SPOTIFY_SCOPES,
    state,
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}
