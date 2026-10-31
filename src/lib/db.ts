import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

// Driver adapter Postgres (pg) — wajib agar Prisma jalan di Cloudflare Workers
// (OpenNext + nodejs_compat). Juga tetap normal dipakai di Node lokal.
// Connection string diambil dari DATABASE_URL:
//  - runtime (Workers/lokal): pooler Supabase port 6543 (transaction mode)
//  - migrate: direct connection port 5432
function makeClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 5, // koneksi tipis — cocok untuk serverless/Workers
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
