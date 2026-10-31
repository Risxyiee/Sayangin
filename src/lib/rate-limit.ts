/**
 * Rate limiter in-memory paling sederhana (fixed window per proses).
 * Cukup buat skala MVP — nanti kalau deploy multi-instance, ganti ke
 * Upstash/Redis dgn API yang sama.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// bersih-bersih entri kadaluarsa biar Map gak bengkak
function sweep() {
  const now = Date.now();
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Cek apakah request lolos batas.
 * @param key    nama aksi, mis. "confess-create"
 * @param limit  maks request per window
 * @param windowMs panjang window (ms)
 */
export function rateLimit(
  req: Request,
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  sweep();
  const id = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const b = buckets.get(id);

  if (!b || b.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  b.count += 1;
  if (b.count > limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)),
    };
  }
  return { ok: true, retryAfterSec: 0 };
}
