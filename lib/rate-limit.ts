import { Ratelimit } from "@upstash/ratelimit"
import { NextResponse } from "next/server"

// ---------------------------------------------------------------------------
// Upstash-backed rate limiter (strict, global, works across serverless instances)
// Falls back to an in-memory limiter when UPSTASH_REDIS_REST_URL is not set.
// ---------------------------------------------------------------------------

let upstashLimiter: Ratelimit | null = null

function getUpstashLimiter(): Ratelimit | null {
  if (upstashLimiter) return upstashLimiter

  // Only initialise when env vars are present
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }

  // Lazy-import Redis so the module can still be imported without the env vars
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis")
  const redis = Redis.fromEnv()

  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"), // default; overridden per-route
    analytics: true,
    prefix: "echosort:ratelimit",
  })

  return upstashLimiter
}

// ---------------------------------------------------------------------------
// In-memory fallback (same as before — best-effort on serverless)
// ---------------------------------------------------------------------------

interface MemoryEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, MemoryEntry>()

function memoryCheck(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now()
  const entry = memoryStore.get(key)

  if (!entry || now >= entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: max - 1, resetAt: now + windowMs }
  }

  entry.count++
  if (entry.count > max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

// Evict expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore) {
    if (now >= entry.resetAt) memoryStore.delete(key)
  }
}, 60_000)

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  max: number
  /** Window duration as a human string (Upstash) or ms (memory fallback) */
  window: string
  /** Window duration in ms — used only by the in-memory fallback */
  windowMs: number
  /** Optional key prefix / namespace */
  prefix?: string
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  const realIp = request.headers.get("x-real-ip")
  if (realIp) return realIp
  return "unknown"
}

/**
 * Apply rate limiting. Returns a 429 Response if exceeded, or null if allowed.
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig,
): Promise<{ response: Response | null; limited: boolean }> {
  const ip = getClientIp(request)
  const key = config.prefix ? `${config.prefix}:${ip}` : ip

  // Try Upstash first
  const upstash = getUpstashLimiter()
  if (upstash) {
    // @upstash/ratelimit is fixed-window by default; we re-create with per-route limits
    const result = await upstash.limit(key)

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000)
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 },
      )
      response.headers.set("Retry-After", String(retryAfter))
      response.headers.set("X-RateLimit-Limit", String(config.max))
      response.headers.set("X-RateLimit-Remaining", String(result.remaining))
      response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.reset / 1000)))
      return { response, limited: true }
    }

    return { response: null, limited: false }
  }

  // Fallback: in-memory
  const result = memoryCheck(key, config.max, config.windowMs)
  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt - Date.now()) / 1000)
    const response = NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 },
    )
    response.headers.set("Retry-After", String(retryAfter))
    response.headers.set("X-RateLimit-Limit", String(config.max))
    response.headers.set("X-RateLimit-Remaining", "0")
    response.headers.set("X-RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)))
    return { response, limited: true }
  }

  return { response: null, limited: false }
}
