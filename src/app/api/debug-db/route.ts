import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { makeSlug, makeToken } from "@/lib/token";

/**
 * ⚠️ ENDPOINT DEBUG SEMENTARA — hapus setelah diagnosis selesai.
 * Guard: harus kirim ?key=DEBUG_KEY yang cocok, kalau tidak → 404 biasa.
 * Tidak pernah mengembalikan password; kredensial disensor.
 */

// ganti/acak saat pakai; sengaja tidak masuk env biar sederhana & sementara
const DEBUG_KEY = "dbg-kangenin-2026xq7";

function maskConn(cs: string | undefined | null) {
  if (!cs) return null;
  try {
    const u = new URL(cs);
    return {
      user: u.username,
      hasPassword: !!u.password,
      host: u.hostname,
      port: u.port,
      database: u.pathname.replace(/^\//, ""),
      sslmode: u.searchParams.get("sslmode"),
    };
  } catch {
    return { unparsable: true, length: cs.length };
  }
}

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== DEBUG_KEY) {
    return new NextResponse("Not Found", { status: 404 });
  }

  type Step = { step: string; ok: boolean; ms: number; result?: unknown; error?: string };
  const steps: Step[] = [];
  const envInfo: Record<string, unknown> = {};

  // ── info koneksi (tanpa password) ──
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext() as unknown as {
      env?: { HYPERDRIVE?: { connectionString?: string }; DATABASE_URL?: string };
    };
    envInfo.hasHyperdriveBinding = !!env?.HYPERDRIVE;
    envInfo.hyperdrive = maskConn(env?.HYPERDRIVE?.connectionString);
    envInfo.hasDatabaseUrlSecret = !!env?.DATABASE_URL;
    envInfo.databaseUrl = maskConn(env?.DATABASE_URL ?? null);
  } catch (e) {
    envInfo.contextError = describeError(e);
  }

  async function run(step: string, fn: () => Promise<unknown>) {
    const t0 = Date.now();
    try {
      const result = await fn();
      steps.push({ step, ok: true, ms: Date.now() - t0, result });
      return result;
    } catch (e) {
      steps.push({ step, ok: false, ms: Date.now() - t0, error: describeError(e) });
      return undefined;
    }
  }

  // ── langkah diagnosis, berurutan ──
  await run("raw-select-1", () => db.$queryRaw`SELECT 1 AS one`);

  await run("whoami", () =>
    db.$queryRaw`SELECT current_user::text AS user, current_database()::text AS db`
  );

  // Buktikan (atau bantah) kehabisan slot koneksi di origin:
  // max_connections=60 di Supabase free — kalau total mendekati max, semua
  // koneksi baru akan hang sampai timeout. Ini persis gejala yang terlihat.
  await run("pg-activity", () =>
    db.$queryRaw`
      SELECT
        (SELECT setting::text FROM pg_settings WHERE name = 'max_connections') AS max_conn,
        (SELECT setting::text FROM pg_settings WHERE name = 'supabase_pooler_client_max_connections') AS pooler_client_max,
        count(*)::text AS total,
        count(*) FILTER (WHERE state = 'active')::text AS active,
        count(*) FILTER (WHERE state = 'idle')::text AS idle,
        count(*) FILTER (WHERE state = 'idle in transaction')::text AS idle_in_txn,
        count(*) FILTER (WHERE wait_event IS NOT NULL)::text AS waiting
      FROM pg_stat_activity`
  );

  await run("count-confession", () => db.confession.count());

  const slug = makeSlug();
  const senderKey = makeToken(16);

  // simulasi persis alur POST /api/confess
  await run("findUnique-slug", () => db.confession.findUnique({ where: { slug } }));

  const created = (await run("create-confession", () =>
    db.confession.create({
      data: {
        slug,
        senderKey,
        fromName: "__debug__",
        toName: "Debug Target",
        message: "Baris uji koneksi tulis — akan dihapus otomatis.",
        theme: "rose",
        isPublic: false,
      },
      select: { id: true, slug: true },
    })
  )) as { id: string; slug: string } | undefined;

  if (created?.id) {
    await run("delete-confession", () =>
      db.confession.delete({ where: { id: created.id } })
    );
  }

  return NextResponse.json(
    { env: envInfo, steps, note: "endpoint debug sementara — hapus setelah diagnosis" },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * POST ?key=... — terapkan DDL migrasi yang belum jalan di produksi.
 * DDL idempoten (aman diulang): ADD COLUMN IF NOT EXISTS + CREATE TABLE IF NOT EXISTS.
 * Hapus endpoint ini bersama route-nya setelah skema sinkron.
 */
const MIGRATION_DDL: string[] = [
  `ALTER TABLE "Confession" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Confession" ADD COLUMN IF NOT EXISTS "unlockAt" TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS "ReactionCount" (
      "id" TEXT NOT NULL,
      "confessionId" TEXT NOT NULL,
      "heart" INTEGER NOT NULL DEFAULT 0,
      "laugh" INTEGER NOT NULL DEFAULT 0,
      "cry" INTEGER NOT NULL DEFAULT 0,
      "bloom" INTEGER NOT NULL DEFAULT 0,
      CONSTRAINT "ReactionCount_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "ReactionCount_confessionId_key" ON "ReactionCount"("confessionId")`,
  `DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReactionCount_confessionId_fkey') THEN
        ALTER TABLE "ReactionCount" ADD CONSTRAINT "ReactionCount_confessionId_fkey"
          FOREIGN KEY ("confessionId") REFERENCES "Confession"("id")
          ON DELETE CASCADE ON UPDATE CASCADE;
      END IF;
   END $$`,
];

export async function POST(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (key !== DEBUG_KEY) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const results: { ddl: string; ok: boolean; ms: number; error?: string }[] = [];
  for (const ddl of MIGRATION_DDL) {
    const t0 = Date.now();
    try {
      await db.$executeRawUnsafe(ddl);
      results.push({ ddl: ddl.slice(0, 60), ok: true, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ ddl: ddl.slice(0, 60), ok: false, ms: Date.now() - t0, error: describeError(e) });
    }
  }
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "no-store" } }
  );
}
