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

const POOLER_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"; // region: Singapore

/**
 * Tulis-ulang URL direct Supabase (host db.<ref>.supabase.co, IPv6-only) menjadi
 * URL session pooler (IPv4). Username 'postgres' wajib jadi 'postgres.<ref>'.
 * HASIL TIDAK BOLEH DILOG/DIKEMBALIKAN — mengandung password.
 */
function toPoolerUrl(direct: string): { url: string; ref: string } | null {
  try {
    const u = new URL(direct);
    if (!u.hostname.endsWith(".supabase.co")) return null;
    const ref = u.hostname.split(".")[0];
    u.hostname = POOLER_HOST;
    if (u.username === "postgres") u.username = `postgres.${ref}`;
    u.port = "5432";
    u.searchParams.delete("sslmode");
    return { url: u.toString(), ref };
  } catch {
    return null;
  }
}

/**
 * Probe koneksi Postgres MURNI lewat node-postgres + TLS (tanpa Hyperdrive).
 * Menguji apakah nodejs_compat terbaru sanggup TLS ke pooler langsung.
 */
async function poolerProbe(cs: string) {
  const pg = (await import("pg")).default;
  const pool = new pg.Pool({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 8_000,
    query_timeout: 8_000,
  });
  try {
    const r = await pool.query("SELECT 1 AS one");
    return r.rows;
  } finally {
    await pool.end().catch(() => {});
  }
}

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
  // hanya jalankan tes pooler (lewati langkah Hyperdrive yang suka hang)
  const only = req.nextUrl.searchParams.get("only");
  // colo = lokasi data center Cloudflare yang melayani request ini —
  // dipakai untuk memetakan apakah kegagalan koneksi mengelompok per lokasi
  const colo = (req as unknown as { cf?: { colo?: string } }).cf?.colo ?? "?";

  // ── info koneksi (tanpa password) ──
  let rawDirectUrl: string | undefined;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext() as unknown as {
      env?: {
        HYPERDRIVE_DB?: { connectionString?: string };
        HYPERDRIVE?: { connectionString?: string };
        DATABASE_URL?: string;
      };
    };
    const hdCs = env?.HYPERDRIVE_DB?.connectionString ?? env?.HYPERDRIVE?.connectionString;
    envInfo.hasHyperdriveBinding = !!hdCs;
    envInfo.hyperdrive = maskConn(hdCs ?? null);
    envInfo.bindingName = env?.HYPERDRIVE_DB ? "HYPERDRIVE_DB" : env?.HYPERDRIVE ? "HYPERDRIVE" : null;
    rawDirectUrl = env?.DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim() || undefined;
    envInfo.hasDatabaseUrlSecret = !!rawDirectUrl;
    envInfo.databaseUrl = maskConn(rawDirectUrl ?? null);
  } catch (e) {
    rawDirectUrl = process.env.DATABASE_URL?.trim() || undefined;
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

  // ── TES UTAMA: Worker → pooler Supabase langsung (TLS, TANPA Hyperdrive) ──
  const pooler = rawDirectUrl ? toPoolerUrl(rawDirectUrl) : null;
  if (pooler) {
    envInfo.poolerRewrite = { ref: pooler.ref, host: POOLER_HOST, ok: true };
    for (let i = 1; i <= 2; i++) {
      await run(`pooler-tls-${i}`, () => poolerProbe(pooler.url));
    }
  } else {
    envInfo.poolerRewrite = { ok: false, reason: "DATABASE_URL bukan host direct supabase.co" };
  }

  // ── langkah diagnosis via Hyperdrive (dilewati kalau ?only=pooler) ──
  if (only !== "pooler") {
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
  }

  return NextResponse.json(
    { colo, env: envInfo, steps, note: "endpoint debug sementara — hapus setelah diagnosis" },
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
