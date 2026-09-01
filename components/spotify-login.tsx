"use client"

import { useState } from "react"
import { generateCodeVerifier, generateCodeChallenge, getSpotifyAuthUrl } from "@/lib/spotify"
import { ChevronDown, ChevronUp, ShieldCheck, Database, LogOut } from "lucide-react"

interface SpotifyLoginProps {
  onLogin: (accessToken: string) => void
  isLoading?: boolean
}

const SCOPES = [
  {
    scope: "playlist-read-private",
    use: "Read your private playlists so EchoSort can analyze them.",
  },
  {
    scope: "playlist-read-collaborative",
    use: "Read collaborative playlists you follow or own.",
  },
  {
    scope: "playlist-modify-public",
    use: "Remove duplicate tracks from public playlists — only when you explicitly confirm.",
  },
  {
    scope: "playlist-modify-private",
    use: "Remove duplicate tracks from private playlists — only when you explicitly confirm.",
  },
  {
    scope: "user-read-private",
    use: "Read your Spotify user ID to categorize which playlists are yours.",
  },
  {
    scope: "user-library-read",
    use: "Read your Liked Songs so they can be analyzed for duplicates.",
  },
  {
    scope: "user-library-modify",
    use: "Remove duplicate tracks from Liked Songs — only when you explicitly confirm.",
  },
]

export default function SpotifyLogin({ onLogin, isLoading: externalLoading }: SpotifyLoginProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [trustOpen, setTrustOpen] = useState(false)
  const [scopeOpen, setScopeOpen] = useState(false)
  const [consentShown, setConsentShown] = useState(false)

  const handleLoginClick = () => {
    setConsentShown(true)
  }

  const handleConfirmLogin = async () => {
    setIsLoading(true)
    try {
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      const state = crypto.randomUUID()
      sessionStorage.setItem("spotify_code_verifier", codeVerifier)
      sessionStorage.setItem("spotify_state", state)
      window.location.href = getSpotifyAuthUrl(codeChallenge, state)
    } catch {
      setIsLoading(false)
    }
  }

  const loading = isLoading || externalLoading

  if (consentShown) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-[420px] flex flex-col gap-10">

          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight">Before you continue</h2>
            <p className="text-[15px] text-muted-foreground mt-2">
              A quick overview of what EchoSort will access.
            </p>
          </div>

          {/* Access summary — minimal list */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Read</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Your playlists, Liked Songs, and profile — used purely for analysis.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Write</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Only when you confirm a removal in the cleanup panel. Nothing automatic.
              </p>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Store</p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                Nothing. All data lives in your browser for this session only.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Permissions list — always visible, compact */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Permissions requested
            </p>
            <div className="flex flex-col gap-2">
              {SCOPES.map(({ scope, use }) => (
                <div key={scope} className="flex items-start gap-3">
                  <span className="mt-1 w-1 h-1 rounded-full bg-primary/60 flex-shrink-0" />
                  <p className="text-[13px] text-muted-foreground leading-relaxed">
                    <span className="text-foreground/70 font-medium">{scope.replace(/-/g, " ")}</span>
                    <span className="mx-1.5 text-border">—</span>
                    {use}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleConfirmLogin}
              disabled={loading}
              className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 flex items-center justify-center gap-2.5"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect with Spotify"
              )}
            </button>
            <button
              onClick={() => setConsentShown(false)}
              className="w-full h-10 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Go back
            </button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              Privacy policy
            </a>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-[400px] flex flex-col items-center text-center gap-0">
        {/* Logo */}
        <svg
          viewBox="0 0 24 24"
          className="w-14 h-14 mb-6 fill-foreground"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="EchoSort"
        >
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
        </svg>

        <h1 className="text-4xl font-bold tracking-tight mb-2">EchoSort</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Find duplicates and overlaps in your Spotify playlists
        </p>

        <div className="w-full flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground uppercase tracking-widest">Continue with</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <button
          onClick={handleLoginClick}
          disabled={loading}
          className="w-full h-12 rounded-full bg-primary text-primary-foreground font-bold text-sm tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 px-8 mb-6"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
              {externalLoading ? "Restoring session..." : "Connecting..."}
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Connect with Spotify
            </>
          )}
        </button>

        {/* Trust accordion */}
        <div className="w-full rounded-xl border border-border bg-card overflow-hidden mb-4">
          <button
            onClick={() => setTrustOpen((v) => !v)}
            className="flex items-center gap-2 w-full px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left font-medium">How your data is handled</span>
            {trustOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {trustOpen && (
            <div className="border-t border-border px-4 py-3 space-y-3 text-xs text-muted-foreground text-left">
              <div className="flex gap-3">
                <Database className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <p>All playlist and track data is fetched directly into your browser and held only in memory for the duration of your session — nothing is written to any database.</p>
              </div>
              <div className="flex gap-3">
                <ShieldCheck className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <p>Your Spotify access token is stored only in your browser&apos;s memory and is never logged or persisted beyond the session.</p>
              </div>
              <div className="flex gap-3">
                <LogOut className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
                <p>Closing the tab or logging out immediately discards all fetched data — nothing persists server-side to delete.</p>
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Free &bull; Secure &bull; No data stored &bull;{" "}
          <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy policy</a>
        </p>
      </div>
    </div>
  )
}
