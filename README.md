# EchoSort — Spotify Playlist Analyzer

Find duplicates and overlaps in your Spotify playlists.

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/mamvds-projects/v0-echo-sort)

## Tech Stack

- **Next.js 16** (App Router)
- **React 19** + **TypeScript 5.6**
- **Tailwind CSS 4** + **shadcn/ui**
- **Recharts** for data visualization
- **Spotify Web API** with PKCE OAuth

## Getting Started

### Prerequisites

- Node.js 18+
- A [Spotify Developer](https://developer.spotify.com/dashboard) app

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://localhost:3000` to **Redirect URIs** in the app settings
4. Copy your **Client ID** and **Client Secret**

### 2. Set Up Environment Variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your Spotify credentials:

```
NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_SPOTIFY_REDIRECT_URI=http://localhost:3000
```

### 3. Install Dependencies & Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |
| `npm run lint` | Run linting |

## Project Structure

```
app/                    # Next.js App Router routes & API handlers
├── api/auth/spotify/   # OAuth token exchange & refresh
├── api/spotify/        # Spotify API proxy endpoints
├── page.tsx            # Main app (login → select → analyze)
├── layout.tsx          # Root layout with providers
├── privacy/            # Privacy policy page
components/             # Client UI components
├── ui/                 # shadcn/ui primitives
├── spotify-login.tsx   # Login + consent screen
├── playlist-selector.tsx  # Library browser
├── simple-stats.tsx    # Stats tab
├── cleanup-panel.tsx   # Duplicate cleanup with undo
contexts/               # React context for global state
hooks/                  # Client hooks (auth, progress, etc.)
lib/                    # Spotify API, analysis, utilities
public/                 # Static assets
```

## Deployment

Deploy to Vercel with these environment variables set:

- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `NEXT_PUBLIC_SPOTIFY_REDIRECT_URI` (your production URL, e.g., `https://your-domain.vercel.app`)

## License

Private — not for redistribution.
