# AGENT.md

## Project overview

EchoSort is a Next.js App Router application that authenticates with Spotify, lets users select playlists, fetches selected playlist tracks, analyzes duplicates and overlap, and supports cleanup actions.

## Stack and commands

- Next.js 15 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4 with shadcn/ui primitives
- Lucide React icons
- Package manager: pnpm
- Commands:
  - `pnpm dev` — start the development server
  - `pnpm build` — create a production build
  - `pnpm lint` — run linting
  - `pnpm start` — start the production server
- No test script or formatter configuration was found in the repository.

## Repository structure

- `app/` — routes, layouts, global styles, privacy page, and Spotify/auth API route handlers
- `components/` — client UI for login, playlist selection, statistics, cleanup, profile controls, and shadcn primitives
- `contexts/` — React context for playlist data and fetch state
- `hooks/` — client hooks, including Spotify authentication and fetch progress
- `lib/` — Spotify API/data utilities, analysis helpers, and token storage
- `public/` — static assets

## Implementation conventions

- Prefer App Router patterns and mark interactive components with `"use client"`.
- Use the `@/` path alias for internal imports.
- Keep server-side Spotify work in route handlers and client state in hooks/context.
- Define TypeScript interfaces for Spotify and application data shapes.
- Use Tailwind utility classes and existing shadcn components instead of introducing ad hoc styling systems.
- Use Lucide icons for interface icons; provide accessible labels for icon-only controls.
- Preserve the existing Spotify OAuth flow and use the project-provided environment variables for Spotify configuration.
- Validate external API responses, handle expired tokens and rate limits, and surface actionable errors to the UI.
- Avoid logging secrets or tokens. Existing diagnostic logging should remain temporary and be removed after debugging.

## Language and direction

The app currently uses English copy (`lang="en"`) and the Inter font. No translation/i18n system or Persian/RTL support is configured. Do not assume RTL behavior or add localization infrastructure unless requested.

## Known areas to review

- Investigate the requested canvas connecting-lines bug by tracing the relevant rendering/state code before changing layout or drawing logic.
- Review Spotify pagination, token refresh, rate-limit handling, and response validation when modifying data fetching.
- Keep playlist selection intentional: do not fetch every playlist's tracks before the user chooses what to analyze.
- Verify user-visible changes in the browser at desktop and mobile widths when practical.

## File and asset boundaries

- Do not edit generated build output (`.next/`) or installed dependencies (`node_modules/`).
- Treat environment files and secrets as local configuration; never commit credentials or print their contents.
- Keep shadcn primitives compatible with the existing component conventions before modifying them.
- Keep generated or synchronized assets in their existing locations and do not replace user-provided assets without instruction.
- Prefer focused changes over broad rewrites, and preserve unrelated work in the current branch.

## Verification

Before completing a change, run the relevant lint/build checks available in the repository and verify interactive UI changes in the browser. Since no automated test suite is configured, manually exercise affected Spotify, selection, analysis, and cleanup flows when applicable.

## Commit guidance

Use concise commits describing the user-visible or architectural change. Do not commit secrets, build artifacts, dependency directories, or unrelated formatting changes.
