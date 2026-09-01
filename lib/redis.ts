import { Redis } from "@upstash/redis"

/**
 * Upstash Redis client — configured from environment variables.
 *
 * Set these in .env.local (or Vercel project settings):
 *   UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN=your_token_here
 *
 * Get them from: https://console.upstash.com → your database → REST API
 */
export const redis = Redis.fromEnv()
