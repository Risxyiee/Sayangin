import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Driver adapter Postgres (pg) — wajib agar Prisma jalan di Cloudflare Workers
// (OpenNext + nodejs_compat). Juga tetap normal dipakai di Node lokal.
//
// DATABASE_URL yang benar untuk runtime (Cloudflare secret):
//   postgresql://postgres.<REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require
//   (host WAJIB pooler.supabase.com — host db.* itu IPv6-only, tidak terjangkau Workers)

function resolveConnectionString(): string | undefined {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.warn(
      "[db] DATABASE_URL tidak terpasang — query database akan gagal. " +
        "Set secret DATABASE_URL di Cloudflare (Workers > Settings > Variables & Secrets)."
    )
    return undefined
  }
  if (url.includes("[YOUR-PASSWORD]") || url.includes("[PASSWORD]")) {
    console.warn(
      "[db] DATABASE_URL masih memuat placeholder password — ganti dengan password database asli."
    )
  }
  return url
}

// Supabase mewajibkan TLS. Kalau URL lupa membawa ?sslmode=require,
// aktifkan SSL otomatis untuk host supabase agar koneksi tidak ditolak.
function isSupabaseHostWithoutSsl(url: string): boolean {
  try {
    const u = new URL(url)
    const supabase = /(^|\.)supabase\.(co|com)$/.test(u.hostname)
    return supabase && !u.searchParams.has("sslmode")
  } catch {
    return false
  }
}

function makeClient(): PrismaClient {
  const connectionString = resolveConnectionString()
  const forceSsl = !!connectionString && isSupabaseHostWithoutSsl(connectionString)
  if (forceSsl) {
    console.warn("[db] URL supabase tanpa sslmode — SSL diaktifkan otomatis.")
  }
  const adapter = new PrismaPg({
    ...(connectionString ? { connectionString } : {}),
    max: 5, // koneksi tipis — cocok untuk serverless/Workers
    ...(forceSsl ? { ssl: { rejectUnauthorized: false } } : {}),
  })
  return new PrismaClient({
    adapter,
    ...(process.env.NODE_ENV === 'production'
      ? {}
      : { log: ['query'] as const }),
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db = globalForPrisma.prisma ?? makeClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
