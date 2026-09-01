"use client"

import { useState, useEffect } from "react"
import SpotifyLogin from "@/components/spotify-login"
import UserProfile from "@/components/user-profile"
import PlaylistSelector from "@/components/playlist-selector"
import CleanupPanel from "@/components/cleanup-panel"
import SimpleStats from "@/components/simple-stats"
import { ThemeToggle } from "@/components/theme-toggle"
import { useSpotifyAuth } from "@/hooks/use-spotify-auth"
import { usePlaylistData } from "@/contexts/playlist-data-context"
import { saveTokenData } from "@/lib/token-storage"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { BarChart2, Trash2, ArrowLeft } from "lucide-react"

export default function Home() {
  const [appState, setAppState] = useState<"login" | "playlist-select" | "analyzing">("login")
  const [selectedPlaylists, setSelectedPlaylists] = useState<string[]>([])
  const { accessToken, isAuthenticated, isLoading, logout, timeUntilExpiry, getValidToken } = useSpotifyAuth()
  const { reset, isLoading: dataLoading, hasData, progress } = usePlaylistData()

  // Handle OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get("code")
    const state = urlParams.get("state")
    if (urlParams.get("error")) return
    if (code && state) {
      const storedState = sessionStorage.getItem("spotify_state")
      const codeVerifier = sessionStorage.getItem("spotify_code_verifier")
      if (state === storedState && codeVerifier) {
        exchangeCodeForToken(code, codeVerifier)
      }
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated && appState === "login") {
      setAppState("playlist-select")
    }
  }, [isAuthenticated, appState])

  const exchangeCodeForToken = async (code: string, codeVerifier: string) => {
    try {
      const response = await fetch("/api/auth/spotify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, codeVerifier }),
      })
      const data = await response.json()
      if (response.ok) {
        saveTokenData(data)
        setAppState("app")
        window.history.replaceState({}, document.title, window.location.pathname)
        sessionStorage.removeItem("spotify_state")
        sessionStorage.removeItem("spotify_code_verifier")
      }
    } catch {}
  }

  const handleLogout = () => {
    logout()
    reset()
    setAppState("login")
    setSelectedPlaylists([])
  }

  const handleSelectPlaylists = (ids: string[]) => {
    setSelectedPlaylists(ids)
    setAppState("analyzing")
  }

  const handleBackToSelect = () => {
    setAppState("playlist-select")
    setSelectedPlaylists([])
  }

  if (isLoading) {
    return <SpotifyLogin onLogin={() => {}} isLoading={true} />
  }

  if (!isAuthenticated || !accessToken) {
    return <SpotifyLogin onLogin={() => {}} />
  }

  if (appState === "playlist-select") {
    return <PlaylistSelector accessToken={accessToken} onAnalyze={handleSelectPlaylists} />
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 h-14 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="w-6 h-6 fill-foreground" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          <span className="font-bold text-sm tracking-tight">EchoSort</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleBackToSelect}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Return</span>
          </button>
          <ThemeToggle />
          <UserProfile accessToken={accessToken} onLogout={handleLogout} timeUntilExpiry={timeUntilExpiry} />
        </div>
      </header>

      {/* Main tabs */}
      <main className="flex-1 w-full px-4 sm:px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="stats" className="w-full">
            <TabsList className="mb-8 bg-muted w-full sm:w-auto">
              <TabsTrigger value="stats" className="flex items-center gap-2 text-xs sm:text-sm">
                <BarChart2 className="w-4 h-4" />
                <span>Stats</span>
              </TabsTrigger>
              <TabsTrigger value="cleanup" className="flex items-center gap-2 text-xs sm:text-sm">
                <Trash2 className="w-4 h-4" />
                <span>Cleanup</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="stats" className="mt-0">
              <SimpleStats selectedPlaylists={selectedPlaylists} accessToken={accessToken} getValidToken={getValidToken} />
            </TabsContent>

            <TabsContent value="cleanup" className="mt-0">
              <CleanupPanel accessToken={accessToken} getValidToken={getValidToken} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}
