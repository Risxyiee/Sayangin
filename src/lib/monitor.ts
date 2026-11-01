/**
 * Monitoring error produksi (S-05) — self-hosted, tanpa dependensi baru.
 *
 * Dua lapis, sesuai desain:
 *   1. console.error (dilakukan pemanggil) → terlihat di dashboard
 *      Cloudflare Workers → Logs (wrangler.jsonc: observability.enabled).
 *      Lapis ini SATU-SATUNYA yang tetap hidup saat database ikut bermasalah.
 *   2. reportError() menyimpan error terstruktur ke tabel `error_log`
 *      (Supabase) → bisa di-SELECT kapan pun:
 *        select * from error_log order by created_at desc limit 50;
 *      Juga jadi dasar antrean error di halaman admin (S-06 nanti).
 *
 * Aman by design: penyimpanan fire-and-forget, gagal tak pernah menggagalkan
 * request user; tabel belum dibuat / DB tak terjangkau → flag + backoff 60 dtk
 * supaya request tidak menanggung latensi percobaan yang gagal berulang.
 */

import { getPgPool } from "@/lib/db";
import { describeError } from "@/lib/log-error";

let backoffUntil = 0;
let tableMissing = false;

function noteFailure(err: unknown): void {
  const code = (err as { code?: string })?.code;
  if (code === "42P01") {
    tableMissing = true;
    console.warn(
      "[monitor] tabel error_log belum ada di DB — error sementara cuma di log Cloudflare. " +
        "Tempel SQL dari prisma/migrations/20261101000000_error_log/migration.sql di Supabase SQL Editor."
    );
  } else {
    backoffUntil = Date.now() + 60_000;
  }
}

/**
 * Laporkan error ke tabel error_log (dipanggil dari catch block API routes).
 * ctx.route memudahkan penyaringan, mis. "POST /api/confess".
 */
export function reportError(err: unknown, ctx?: Record<string, unknown>): void {
  if (tableMissing || Date.now() < backoffUntil) return;
  try {
    const route = typeof ctx?.route === "string" ? ctx.route : "unknown";
    const message = describeError(err).slice(0, 2000);
    const stack = err instanceof Error ? (err.stack ?? "").slice(0, 4000) : String(err).slice(0, 4000);
    void getPgPool()
      .query("insert into error_log (route, message, stack) values ($1, $2, $3)", [
        route,
        message,
        stack,
      ])
      .then(() => {
        // higiene tabel: sesekali (2%) sapu error lebih tua dari 30 hari
        if (Math.random() < 0.02) {
          void getPgPool()
            .query("delete from error_log where created_at < now() - interval '30 days'")
            .catch(() => {});
        }
      })
      .catch(noteFailure);
  } catch {
    // monitoring tidak boleh punya efek samping yang terlihat user
  }
}
