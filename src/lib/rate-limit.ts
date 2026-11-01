/**
 * Rate limiter DURABLE (S-04) — fixed-window counter di Postgres.
 *
 * Sebelumnya: Map in-memory per-proses → gugur tiap restart/redeploy isolate
 * Cloudflare, bisa di-bypass spam. Sekarang: hitungan disimpan di tabel
 * `rate_limit` (Supabase) dengan SATU statement atomic insert-on-conflict —
 * row-lock Postgres menjamin dua isolate tidak bisa balapan menaikkan
 * counter, dan restart/redeploy tidak lagi me-reset hitungan.
 *
 * Aturan arsitektur tetap dipatuhi: koneksi lewat pool pg bersama
 * (src/lib/db.ts) → Hyperdrive → direct connection Supabase 5432. Karena
 * limiter dipanggil SEBELUM query utama dalam request yang sama, client pool
 * yang barusan dibuka langsung di-reuse oleh query Prisma berikutnya — tanpa
 * biaya koneksi ekstra.
 *
 * Fallback fail-open: kalau DB tak terjangkau atau tabel belum dibuat,
 * kembali ke limiter in-memory per-isolate (dengan backoff 60 dtk supaya
 * request tidak dibebani percobaan koneksi yang gagal terus-menerus).
 * Request user TIDAK PERNAH gagal gara-gara rate limiter.
 */

import { getPgPool } from "@/lib/db";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// ── Fallback in-memory (juga dipakai saat DB bermasalah / tabel belum ada) ──

function sweep() {
  const now = Date.now();
  if (buckets.size < 500) return;
  for (const [key, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(key);
  }
}

function memLimit(
  id: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSec: number } {
  sweep();
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

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

// ── Counter durable di Postgres ─────────────────────────────────────────────
// SATU statement atomic: insert baris baru, atau (kalau key sudah ada)
// reset counter bila window sudah lewat, selain itu increment. RETURNING
// mengembalikan nilai TERBARU plus sisa detik sampai window berganti —
// jadi tidak butuh query kedua.
const UPSERT_SQL = `
  insert into rate_limit (key, count, window_start, updated_at)
  values ($1, 1, now(), now())
  on conflict (key) do update set
    count        = case when rate_limit.window_start <= now() - make_interval(secs => $2::double precision)
                        then 1 else rate_limit.count + 1 end,
    window_start = case when rate_limit.window_start <= now() - make_interval(secs => $2::double precision)
                        then now() else rate_limit.window_start end,
    updated_at   = now()
  returning count,
            ceil(greatest(0, extract(epoch from (rate_limit.window_start + make_interval(secs => $2::double precision) - now()))))::int as retry_after
`;

// backoff: berhenti mencoba DB 60 dtk setelah kegagalan koneksi (bukan
// tabel-missing) supaya request tidak menanggung latensi percobaan gagal
let pgBackoffUntil = 0;
// tabel belum dibuat → jangan coba DB lagi di isolate ini (perlu SQL manual)
let tableMissing = false;

// ── Anggaran waktu limiter (pelajaran insiden 2026-11-01, wallTime 24,5 dtk) ──
// Fail-open lama baru terjadi SETELAH query limiter menggantung 6 dtk
// (query_timeout) — di episode gangguan origin itu menambah 6 dtk hening di
// depan query utama. Sekarang: kalau limiter tak selesai dalam 2,5 dtk,
// langsung pindah ke limiter memori; query DB yang tertinggal tetap ditunggu
// handler-nya (set backoff saat benar-benar gagal) tanpa menggantung request.
const LIMITER_BUDGET_MS = 2_500;

/**
 * Cek apakah request lolos batas (dipanggil dengan `await`).
 * @param key       nama aksi, mis. "confess-create"
 * @param limit     maks request per window
 * @param windowMs  panjang window (ms)
 */
export async function rateLimit(
  req: Request,
  key: string,
  limit: number,
  windowMs: number
): Promise<{ ok: boolean; retryAfterSec: number }> {
  const id = `${key}:${clientIp(req)}`;
  const windowSecs = Math.max(1, Math.round(windowMs / 1000));

  if (tableMissing || Date.now() < pgBackoffUntil) {
    return memLimit(id, limit, windowMs);
  }

  try {
    const q = getPgPool().query(UPSERT_SQL, [id, windowSecs]);
    // anti unhandled-rejection kalau query kalah race dan gagal belakangan;
    // penanganan backoff asli tetap lewat catch di bawah (race yang reject).
    q.catch(() => {});
    let limiterTimer: ReturnType<typeof setTimeout> | undefined;
    const res = await Promise.race([
      q,
      new Promise<never>((_, reject) => {
        limiterTimer = setTimeout(
          () => reject(new Error("rate-limit budget habis (2,5 dtk)")),
          LIMITER_BUDGET_MS
        );
      }),
    ]).finally(() => {
      if (limiterTimer) clearTimeout(limiterTimer);
    });
    const row = res.rows[0] as { count: number; retry_after: number } | undefined;
    const count = Number(row?.count ?? 1);

    // higiene tabel: saat window baru mulai, sesekali (5%) sapu entri basi
    // (aksi-IP yang tak aktif > 1 hari). Kegagalan sapu diabaikan.
    if (count === 1 && Math.random() < 0.05) {
      void getPgPool()
        .query("delete from rate_limit where window_start < now() - interval '1 day'")
        .catch(() => {});
    }

    if (count > limit) {
      return { ok: false, retryAfterSec: Math.max(1, Number(row?.retry_after ?? windowSecs)) };
    }
    return { ok: true, retryAfterSec: 0 };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // relation does not exist — tabel rate_limit belum dibuat di Supabase
      tableMissing = true;
      console.warn(
        "[rate-limit] tabel rate_limit belum ada di DB — sementara pakai memori. " +
          "Tempel SQL dari prisma/migrations/20261101000000_rate_limit/migration.sql di Supabase SQL Editor."
      );
    } else {
      pgBackoffUntil = Date.now() + 60_000;
      console.warn(
        "[rate-limit] DB tidak terjangkau — fallback memori 60 dtk:",
        err instanceof Error ? err.message : err
      );
    }
    return memLimit(id, limit, windowMs);
  }
}
