import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { PlaylistDataProvider } from "@/contexts/playlist-data-context"
import { FetchProgressBar } from "@/components/fetch-progress-bar"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "EchoSort – Spotify Playlist Analyzer",
  description: "Find duplicates and overlaps in your Spotify playlists",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark bg-background">
      <body className={`${inter.variable} font-sans antialiased bg-background text-foreground`}>
        <ThemeProvider defaultTheme="dark" storageKey="echosort-theme" enableSystem={false}>
          <PlaylistDataProvider>
            {children}
            <FetchProgressBar />
          </PlaylistDataProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
