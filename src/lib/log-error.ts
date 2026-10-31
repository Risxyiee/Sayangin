/**
 * Formatter error untuk log Cloudflare Workers.
 * console.error("...", err) di Workers kadang hanya menampilkan stack tanpa
 * pesan — padahal pesan itulah yang kita butuhkan untuk debug koneksi DB.
 * describeError() menghasilkan string yang PASTI memuat penyebabnya:
 * nama error | pesan | kode (mis. P2021 = tabel tidak ada, ECONNREFUSED, 28P01 = password salah)
 */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const e = err as Error & { code?: string; detail?: string; meta?: unknown };
    const parts = [e.name, e.message];
    if (e.code) parts.push(`code=${e.code}`);
    if (e.detail) parts.push(`detail=${e.detail}`);
    if (e.meta && typeof e.meta === "object") {
      try {
        parts.push(`meta=${JSON.stringify(e.meta)}`);
      } catch {
        /* abaikan */
      }
    }
    return parts.filter((p) => p && p.trim()).join(" | ");
  }
  return String(err);
}
