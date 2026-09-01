"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, User, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface UserProfileProps {
  accessToken: string
  onLogout: () => void
  timeUntilExpiry?: number | null
}

interface SpotifyUser {
  display_name: string
  images: Array<{ url: string }>
  followers: { total: number }
  id: string
}

export default function UserProfile({ accessToken, onLogout }: UserProfileProps) {
  const [user, setUser] = useState<SpotifyUser | null>(null)

  useEffect(() => {
    fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => data && setUser(data))
      .catch(() => {})
  }, [accessToken])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 bg-black/40 hover:bg-black/60 rounded-full px-2 py-1 transition-colors cursor-pointer border border-transparent hover:border-border">
          <Avatar className="w-7 h-7">
            <AvatarImage src={user?.images[0]?.url} alt={user?.display_name} />
            <AvatarFallback className="text-xs bg-muted text-muted-foreground">
              {user?.display_name?.charAt(0) ?? <User className="w-3 h-3" />}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold pr-1 max-w-28 truncate hidden sm:block">
            {user?.display_name ?? "User"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 bg-popover border-border rounded-sm shadow-xl">
        <div className="flex items-center gap-3 px-3 py-3">
          <Avatar className="w-9 h-9">
            <AvatarImage src={user?.images[0]?.url} alt={user?.display_name} />
            <AvatarFallback className="text-xs bg-muted">{user?.display_name?.charAt(0) ?? "U"}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{user?.display_name ?? "Spotify User"}</p>
            <p className="text-xs text-muted-foreground">{user?.followers?.total.toLocaleString()} followers</p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem asChild>
          <a
            href="https://www.spotify.com/account/apps/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm cursor-pointer flex items-center text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Revoke Spotify access
          </a>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-border" />
        <DropdownMenuItem
          onClick={onLogout}
          className="text-sm cursor-pointer rounded-sm focus:bg-accent text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
