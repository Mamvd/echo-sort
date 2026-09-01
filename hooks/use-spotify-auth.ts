"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  saveTokenData,
  getStoredTokenData,
  isTokenValid,
  clearStoredTokens,
  getTimeUntilExpiry,
} from "@/lib/token-storage"

interface UseSpotifyAuthReturn {
  accessToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
  login: () => void
  logout: () => void
  timeUntilExpiry: number | null
  getValidToken: () => Promise<string | null>
}

export function useSpotifyAuth(): UseSpotifyAuthReturn {
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null)
  const refreshingRef = useRef<Promise<boolean> | null>(null)

  const logout = useCallback(() => {
    clearStoredTokens()
    setAccessToken(null)
    setTimeUntilExpiry(null)
  }, [])

  const refreshToken = useCallback(
    async (refreshTokenValue: string): Promise<boolean> => {
      // Deduplicate concurrent refresh calls
      if (refreshingRef.current) {
        return refreshingRef.current
      }

      const doRefresh = async (): Promise<boolean> => {
        try {
          const response = await fetch("/api/auth/spotify/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: refreshTokenValue }),
          })

          if (response.ok) {
            const data = await response.json()
            saveTokenData(data)
            setAccessToken(data.access_token)
            const newTokenData = getStoredTokenData()
            if (newTokenData) {
              setTimeUntilExpiry(getTimeUntilExpiry(newTokenData))
            }
            return true
          } else {
            logout()
            return false
          }
        } catch {
          logout()
          return false
        } finally {
          refreshingRef.current = null
        }
      }

      refreshingRef.current = doRefresh()
      return refreshingRef.current
    },
    [logout],
  )

  // Returns a valid token, refreshing if necessary. Use this before every API call.
  const getValidToken = useCallback(async (): Promise<string | null> => {
    const tokenData = getStoredTokenData()
    if (!tokenData) return null

    if (isTokenValid(tokenData)) {
      return tokenData.accessToken
    }

    if (tokenData.refreshToken) {
      const success = await refreshToken(tokenData.refreshToken)
      if (success) {
        const refreshed = getStoredTokenData()
        return refreshed?.accessToken ?? null
      }
    }

    return null
  }, [refreshToken])

  const checkAndRefreshToken = useCallback(async () => {
    const tokenData = getStoredTokenData()

    if (!tokenData) {
      setIsLoading(false)
      return
    }

    if (isTokenValid(tokenData)) {
      setAccessToken(tokenData.accessToken)
      setTimeUntilExpiry(getTimeUntilExpiry(tokenData))
      setIsLoading(false)
      return
    }

    if (tokenData.refreshToken) {
      await refreshToken(tokenData.refreshToken)
    } else {
      logout()
    }

    setIsLoading(false)
  }, [refreshToken, logout])

  const login = useCallback(() => {}, [])

  useEffect(() => {
    checkAndRefreshToken()
  }, [checkAndRefreshToken])

  // Auto-refresh token 5 minutes before expiry
  useEffect(() => {
    if (!accessToken) return

    const interval = setInterval(() => {
      const tokenData = getStoredTokenData()
      if (tokenData) {
        const remaining = getTimeUntilExpiry(tokenData)
        setTimeUntilExpiry(remaining)

        if (remaining < 300000 && remaining > 0 && tokenData.refreshToken) {
          refreshToken(tokenData.refreshToken)
        }
      }
    }, 60000)

    return () => clearInterval(interval)
  }, [accessToken, refreshToken])

  return {
    accessToken,
    isAuthenticated: !!accessToken,
    isLoading,
    login,
    logout,
    timeUntilExpiry,
    getValidToken,
  }
}
