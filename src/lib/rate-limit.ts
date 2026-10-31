/* ============ Rate limit sederhana in-memory ============
 * Sliding window per kunci (IP + endpoint). Cukup utk skala MVP;
 * kalau nanti deploy multi-instance, pindah ke Upstash/Redis. */

type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

function cleanup() {
  const now = Date.now();
  for (const [key, b] of buckets) {
    // buang bucket yang semua hit-nya sudah kedaluwarsa (12 jam max window)
    if (b.hits.length === 0 || now - b.hits[b.hits.length - 1] > 12 * 3600_000) {
      buckets.delete(key);
    }
  }
}

export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "local";
}

/** true = masih boleh lewat; false = kena limit */
export function checkRate(
  req: Request,
  scope: string,
  max: number,
  windowMs: number
): boolean {
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  const now = Date.now();

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= max) {
    // lazy cleanup biar Map nggak bengkak
    if (buckets.size > 5_000) cleanup();
    return false;
  }
  bucket.hits.push(now);
  if (buckets.size > 5_000) cleanup();
  return true;
}

export const RATE_MSG =
  "Eits, sabar ya 😅 Terlalu banyak permintaan dari perangkatmu. Coba lagi beberapa saat lagi.";
