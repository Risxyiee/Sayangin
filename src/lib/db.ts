import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { Pool } from 'pg'
import type { Pool as PgPool } from 'pg'

// ── Arsitektur database (aturan mutlak project Kangenin) ─────────────────────
//
// 1. WAJIB lewat binding Hyperdrive. Library pg melakukan upgrade TLS dengan
//    cara yang TIDAK didukung runtime Cloudflare Workers — koneksi langsung ke
//    Supabase dari Worker selalu gagal. Worker konek plaintext ke proxy lokal
//    Hyperdrive (di dalam jaringan Cloudflare), Hyperdrive yang mengurus
//    TLS + connection pooling global ke origin.
// 2. Origin Hyperdrive = DIRECT CONNECTION Supabase port 5432
//    (db.<ref>.supabase.co). DILARANG memakai pooler Supabase (port 6543 /
//    5432 pooler host) — Hyperdrive sudah bertindak sebagai pooler global;
//    double-pooling (Hyperdrive + Supavisor) menyebabkan koneksi zombie dan
//    query menggantung belasan detik.
// 3. Kode TIDAK membaca process.env.DATABASE_URL di produksi — hanya sebagai
//    fallback dev lokal. Urutan resolusi koneksi:
//      env.HYPERDRIVE_DB.connectionString  →  env.HYPERDRIVE.connectionString
//      →  process.env.DATABASE_URL (lokal / fallback dev)
// 4. Prisma Driver Adapter (@prisma/adapter-pg) dipakai agar Prisma jalan
//    mulus di Edge Runtime Cloudflare.
// 5. Higiene koneksi: pg.Pool me-release otomatis client-nya setelah setiap
//    query selesai (per-query release), ditambah batas ketat di bawah supaya
//    koneksi bermasalah cepat dibuang dan tidak menggantung sampai Worker
//    timeout: statement_timeout (server), query_timeout (client), maxUses
//    (daur ulang koneksi), dan handler 'error' untuk koneksi idle yang mati.

type CloudflareEnv = {
  /** Binding Hyperdrive utama (aturan arsitektur: direct connection 5432). */
  HYPERDRIVE_DB?: { connectionString?: string }
  /** Binding lama — dipertahankan sementara sebagai fallback migrasi. */
  HYPERDRIVE?: { connectionString?: string }
}

function hyperdriveConnectionString(): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as { env?: CloudflareEnv }
    const cs = env?.HYPERDRIVE_DB?.connectionString ?? env?.HYPERDRIVE?.connectionString
    if (cs) {
      const which = env?.HYPERDRIVE_DB ? 'HYPERDRIVE_DB' : 'HYPERDRIVE'
      console.log(`[db] memakai binding Hyperdrive (${which}) — pooling + TLS via Cloudflare`)
    }
    return cs
  } catch {
    return undefined // bukan runtime Cloudflare (mis. next dev lokal)
  }
}

function envDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) return undefined
  if (url.includes('[YOUR-PASSWORD]') || url.includes('[PASSWORD]')) {
    console.warn(
      '[db] DATABASE_URL masih memuat placeholder password — ganti dengan password database asli.'
    )
  }
  return url
}

// Supabase mewajibkan TLS. Kalau URL lupa membawa ?sslmode=require,
// aktifkan SSL otomatis untuk host supabase (hanya relevan di Node lokal,
// karena di Workers jalannya selalu via Hyperdrive).
function isSupabaseHostWithoutSsl(url: string): boolean {
  try {
    const u = new URL(url)
    const supabase = /(^|\.)supabase\.(co|com)$/.test(u.hostname)
    return supabase && !u.searchParams.has('sslmode')
  } catch {
    return false
  }
}

function makePool(connectionString: string | undefined): PgPool {
  const pool = new Pool({
    ...(connectionString ? { connectionString } : {}),
    // ── batas higiene koneksi (lihat komentar arsitektur di atas) ──
    max: 5, // per isolate; pooling global dilakukan Hyperdrive
    connectionTimeoutMillis: 8_000, // gagal cepat, jangan biarkan user nunggu lama
    query_timeout: 4_000, // client-side: koneksi mati diam dipotong 4 dtk (respons sah < 2 dtk)
    statement_timeout: 8_000, // server-side: potong query nangkring
    idleTimeoutMillis: 2_000, // koneksi nganggur cepat dibuang — data live: koneksi reuse yg idling beberapa detik jadi zombie, koneksi segar 100% sehat; biaya koneksi ulang cuma ±0,3-0,7 dtk
    maxUses: 250, // daur ulang koneksi sebelum menua/jadi zombie
    // catatan: keepAlive TIDAK dipakai — di runtime Workers socket yang menempel
    // (keepalive) berisiko menggleding limit koneksi simultan per isolate dan
    // membuat isolate crash instan. Hidigiene cukup lewat idleTimeout + maxUses.
    ...(connectionString && isSupabaseHostWithoutSsl(connectionString)
      ? { ssl: { rejectUnauthorized: false } }
      : {}),
  })
  // Koneksi idle yang mati mendadak (mis. Supabase restart) memicu event
  // 'error' pada pool. Tanpa handler ini isolate bisa crash unhandled.
  pool.on('error', (err) => {
    console.error('[db] pool error (koneksi idle mati, akan dibuka lagi):', err.message)
  })
  return pool
}

function makeClient(): PrismaClient {
  const hd = hyperdriveConnectionString()
  const adapter = hd
    ? new PrismaPg(makePool(hd))
    : new PrismaPg(makePool(envDatabaseUrl()))

  if (!hd && !envDatabaseUrl()) {
    console.warn(
      '[db] Tidak ada binding Hyperdrive maupun DATABASE_URL — query database akan gagal. ' +
        'Set binding HYPERDRIVE_DB di wrangler.jsonc, atau .env untuk lokal.'
    )
  }

  return new PrismaClient({
    adapter,
    ...(process.env.NODE_ENV === 'production' ? {} : { log: ['query'] as const }),
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? makeClient()

// Warm-up: buka koneksi pertama di background begitu isolate nyala, jadi
// query request pengguna nanti tinggal memakai koneksi yang sudah siap.
// Kegagalan diabaikan — query request berikutnya akan mencoba lagi sendiri.
if (!globalForPrisma.prisma) {
  void db.$queryRaw`SELECT 1`.catch(() => {})
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// ── Perisai anti-zombie ──────────────────────────────────────────────────────
// Hyperdrive sesekali menyerahkan koneksi "mati diam" (query terkirim, jawaban
// tak kunjung datang) walau origin-nya direct & config baru. Timeout 4 dtk
// memotongnya, lalu helper ini mengulang di koneksi baru — maksimal 3 percobaan
// dengan jeda kecil ber-jitter. Peluang ketiga attempt semuanya kena zombie
// sangat kecil (± 0.4³ ≈ 6% → dengan jeda, jauh di bawah itu), dan kesalahan
// validasi/bisnis TIDAK pernah diulang.
const RETRYABLE = /query read timeout|connection terminated|timeout exceeded|ECONNRESET|socket hang up/i

export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      // jeda 80–200 ms — beri kesempatan pool membuka koneksi yang benar-benar baru
      await new Promise((r) => setTimeout(r, 80 + Math.random() * 120))
    }
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!RETRYABLE.test(msg)) throw err
      console.warn(`[db] koneksi macet (attempt ${attempt + 1}/3), ulang:`, msg)
    }
  }
  throw lastErr
}
