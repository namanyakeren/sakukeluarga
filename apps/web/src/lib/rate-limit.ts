/**
 * Rate limiter in-memory sederhana untuk login.
 *
 * Aplikasi ini dijalankan sebagai satu instance di homeserver, jadi map di
 * memori cukup. Kalau nanti dijalankan dengan beberapa replika, gunakan
 * penyimpanan bersama (mis. Redis) atau rate limit di reverse proxy.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_BUCKETS = 5_000;

let nextCleanupAt = 0;

function cleanup(now: number): void {
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  // Jaring pengaman kalau ada banyak identifier acak dalam satu menit.
  if (buckets.size > MAX_BUCKETS) {
    const overflow = buckets.size - MAX_BUCKETS;
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      removed += 1;
      if (removed >= overflow) break;
    }
  }
}

export interface RateLimitStatus {
  blocked: boolean;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitStatus {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    if (bucket) buckets.delete(key);
    return { blocked: false, retryAfterMs: 0 };
  }

  if (bucket.count >= limit) {
    return { blocked: true, retryAfterMs: bucket.resetAt - now };
  }

  return { blocked: false, retryAfterMs: 0 };
}

export function recordRateLimitFailure(key: string, windowMs: number): void {
  const now = Date.now();
  cleanup(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  bucket.count += 1;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
