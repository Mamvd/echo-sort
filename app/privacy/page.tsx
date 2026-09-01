import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "Privacy Policy — EchoSort",
  description: "How EchoSort handles your Spotify data.",
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to EchoSort
        </Link>

        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-8">Last updated: August 3, 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-foreground">
          <section>
            <h2 className="text-lg font-semibold mb-3">What EchoSort accesses</h2>
            <p className="text-muted-foreground leading-relaxed">
              EchoSort connects to Spotify via OAuth 2.0 and reads your playlists, Liked Songs, and basic
              profile information (user ID and display name) in order to detect duplicate and overlapping
              tracks. Write access (playlist modification) is requested so that you can optionally remove
              duplicates from within the app.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">What is never stored</h2>
            <p className="text-muted-foreground leading-relaxed">
              EchoSort does not write any of your Spotify data — playlists, track names, or listening
              history — to any database, file, or third-party service. All data is fetched into your
              browser&apos;s memory at session start and discarded when you close the tab or log out. Nothing
              persists server-side between sessions.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Access tokens</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your Spotify access token is stored in the browser&apos;s session storage, which is cleared
              automatically when you close the tab. It is never written to localStorage, cookies, or any
              server-side store. The token expires after one hour in line with Spotify&apos;s standard
              token lifetime.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Analytics and third-party trackers</h2>
            <p className="text-muted-foreground leading-relaxed">
              EchoSort does not use any third-party analytics, advertising, or tracking scripts.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">Revoking access</h2>
            <p className="text-muted-foreground leading-relaxed">
              You can disconnect EchoSort from your Spotify account at any time by visiting{" "}
              <a
                href="https://www.spotify.com/account/apps/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:opacity-80"
              >
                spotify.com/account/apps
              </a>{" "}
              and removing EchoSort from the list of connected applications.
            </p>
          </section>


        </div>
      </div>
    </div>
  )
}
