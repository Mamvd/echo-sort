const TOKEN_KEY = "spotify_access_token"
const TOKEN_EXPIRY_KEY = "spotify_token_expiry"
const REFRESH_TOKEN_KEY = "spotify_refresh_token"

// Use sessionStorage so tokens are discarded when the tab closes.
// This matches the privacy policy: "browser memory only".
const store = typeof window !== "undefined" ? sessionStorage : null

export interface StoredTokenData {
  accessToken: string
  refreshToken?: string
  expiresAt: number
}

export function saveTokenData(data: {
  access_token: string
  refresh_token?: string
  expires_in: number
}): void {
  if (!store) return
  const expiresAt = Date.now() + data.expires_in * 1000 - 60000 // Subtract 1 minute for safety

  store.setItem(TOKEN_KEY, data.access_token)
  store.setItem(TOKEN_EXPIRY_KEY, expiresAt.toString())

  if (data.refresh_token) {
    store.setItem(REFRESH_TOKEN_KEY, data.refresh_token)
  }
}

export function getStoredTokenData(): StoredTokenData | null {
  if (!store) return null

  const accessToken = store.getItem(TOKEN_KEY)
  const expiryStr = store.getItem(TOKEN_EXPIRY_KEY)
  const refreshToken = store.getItem(REFRESH_TOKEN_KEY)

  if (!accessToken || !expiryStr) {
    return null
  }

  const expiresAt = Number.parseInt(expiryStr)

  return {
    accessToken,
    refreshToken: refreshToken || undefined,
    expiresAt,
  }
}

export function isTokenValid(tokenData: StoredTokenData): boolean {
  return Date.now() < tokenData.expiresAt
}

export function clearStoredTokens(): void {
  if (!store) return
  store.removeItem(TOKEN_KEY)
  store.removeItem(TOKEN_EXPIRY_KEY)
  store.removeItem(REFRESH_TOKEN_KEY)
}

export function getTimeUntilExpiry(tokenData: StoredTokenData): number {
  return Math.max(0, tokenData.expiresAt - Date.now())
}

export function formatTimeRemaining(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }
  return `${minutes}m`
}
