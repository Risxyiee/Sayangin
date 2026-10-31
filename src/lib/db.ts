import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { getCloudflareContext } from '@opennextjs/cloudflare'

// ── Kenapa Hyperdrive? ────────────────────────────────────────────────────────
// Library pg melakukan upgrade TLS dengan cara yang TIDAK didukung runtime
// Cloudflare Workers (hasil uji: semua varian ssl → "internal error" workerd,
// produksi: "Connection terminated unexpectedly").
// Solusi resmi: binding Hyperdrive. Worker konek plaintext ke proxy lokal
// Hyperdrive (aman, di dalam jaringan Cloudflare), Hyperdrive yang mengurus
// TLS + connection pooling ke Supabase. Node lokal tetap langsung ke DATABASE_URL.

type CloudflareEnv = {
  HYPERDRIVE?: { connectionString?: string }
}

function hyperdriveConnectionString(): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as { env?: CloudflareEnv }
    return env?.HYPERDRIVE?.connectionString
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
// aktifkan SSL otomatis untuk host supabase (hanya relevan di Node lokal).
function isSupabaseHostWithoutSsl(url: string): boolean {
  try {
    const u = new URL(url)
    const supabase = /(^|\.)supabase\.(co|com)$/.test(u.hostname)
    return supabase && !u.searchParams.has('sslmode')
  } catch {
    return false
  }
}

function makeClient(): PrismaClient {
  const hd = hyperdriveConnectionString()
  // statement_timeout di sisi server 8 dtk: query yang nangkring di koneksi
  // mati (zombie) dipotong cepat, client-nya dibuang, pool buka koneksi baru.
  const poolCfg = {
    max: 5,
    connectionTimeoutMillis: 30_000,
    query_timeout: 15_000,
    statement_timeout: 8_000,
    idleTimeoutMillis: 10_000,
  } as const

  if (hd) {
    console.log('[db] memakai binding Hyperdrive (pooling + TLS via Cloudflare)')
    const adapter = new PrismaPg({ connectionString: hd, ...poolCfg })
    return new PrismaClient({ adapter })
  }

  const connectionString = envDatabaseUrl()
  if (!connectionString) {
    console.warn(
      '[db] DATABASE_URL tidak terpasang — query database akan gagal. ' +
        'Set secret DATABASE_URL di Cloudflare, atau .env untuk lokal.'
    )
  }
  const forceSsl = !!connectionString && isSupabaseHostWithoutSsl(connectionString)
  const adapter = new PrismaPg({
    ...(connectionString ? { connectionString } : {}),
    ...poolCfg,
    ...(forceSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
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
