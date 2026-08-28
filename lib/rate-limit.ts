/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * NOTE: This is process-local. It's fine for a single-instance MVP, but
 * once deployed with multiple serverless instances, swap this for a shared
 * store (Redis/Upstash) keyed the same way.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    buckets.set(key, bucket);
    return { allowed: false, remaining: 0 };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);
  return { allowed: true, remaining: limit - bucket.timestamps.length };
}

// e.g. checkRateLimit(`call:${userId}`, { limit: 10, windowMs: 60_000 })
export const CALL_RATE_LIMIT = { limit: 10, windowMs: 60_000 };
