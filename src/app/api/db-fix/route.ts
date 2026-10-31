import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";

/* SEMENTARA — endpoint perbaikan skema (hapus setelah dipakai).
   GET  ?key=… : bandingkan kolom aktual di Supabase vs skema Prisma → daftar yang hilang
   POST ?key=… : jalankan DDL idempoten (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS) */

const KEY = "dbg-kangenin-2026xq7";

// kolom yang diharapkan skema Prisma (tabel → [nama + definisi DDL Postgres])
const EXPECTED: Record<string, string[]> = {
  Confession: [
    'id TEXT NOT NULL',
    'slug TEXT NOT NULL',
    'senderKey TEXT',
    'fromName TEXT NOT NULL DEFAULT \'\'',
    'toName TEXT NOT NULL',
    'message TEXT NOT NULL',
    'theme TEXT NOT NULL DEFAULT \'rose\'',
    'response TEXT',
    'reply TEXT',
    'repliedAt TIMESTAMP(3)',
    'views INTEGER NOT NULL DEFAULT 0',
    'reportCount INTEGER NOT NULL DEFAULT 0',
    'isPublic BOOLEAN NOT NULL DEFAULT false',
    'unlockAt TIMESTAMP(3)',
    'createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'openedAt TIMESTAMP(3)',
    'respondedAt TIMESTAMP(3)',
  ],
  ReactionCount: [
    'id TEXT NOT NULL',
    'confessionId TEXT NOT NULL',
    'heart INTEGER NOT NULL DEFAULT 0',
    'laugh INTEGER NOT NULL DEFAULT 0',
    'cry INTEGER NOT NULL DEFAULT 0',
    'bloom INTEGER NOT NULL DEFAULT 0',
  ],
  LetterSet: [
    'id TEXT NOT NULL',
    'slug TEXT NOT NULL',
    'senderKey TEXT NOT NULL',
    'fromName TEXT NOT NULL DEFAULT \'\'',
    'toName TEXT NOT NULL',
    'theme TEXT NOT NULL DEFAULT \'rose\'',
    'views INTEGER NOT NULL DEFAULT 0',
    'reportCount INTEGER NOT NULL DEFAULT 0',
    'createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'openedAt TIMESTAMP(3)',
    'startedAt TIMESTAMP(3)',
  ],
  Letter: [
    'id TEXT NOT NULL',
    'setId TEXT NOT NULL',
    '"order" INTEGER NOT NULL',
    'title TEXT NOT NULL',
    'body TEXT NOT NULL',
    'unlockDays INTEGER NOT NULL DEFAULT 0',
    'views INTEGER NOT NULL DEFAULT 0',
    'openedAt TIMESTAMP(3)',
    'reply TEXT',
    'repliedAt TIMESTAMP(3)',
  ],
  Gift: [
    'id TEXT NOT NULL',
    'slug TEXT NOT NULL',
    'senderKey TEXT NOT NULL',
    'type TEXT NOT NULL',
    'fromName TEXT NOT NULL DEFAULT \'\'',
    'toName TEXT NOT NULL',
    'theme TEXT NOT NULL DEFAULT \'rose\'',
    'data TEXT NOT NULL DEFAULT \'{}\'',
    'progress TEXT NOT NULL DEFAULT \'{}\'',
    'views INTEGER NOT NULL DEFAULT 0',
    'reportCount INTEGER NOT NULL DEFAULT 0',
    'createdAt TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP',
    'openedAt TIMESTAMP(3)',
  ],
};

async function actualColumns(): Promise<Record<string, string[]>> {
  const rows = (await db.$queryRawUnsafe(
    `SELECT table_name::text AS table_name, column_name::text AS column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name IN ('Confession','ReactionCount','LetterSet','Letter','Gift')
     ORDER BY table_name, ordinal_position`
  )) as { table_name: string; column_name: string }[];
  const map: Record<string, string[]> = {};
  for (const r of rows) (map[r.table_name] ??= []).push(r.column_name);
  return map;
}

function colName(colDef: string): string {
  const m = colDef.match(/^"?[^"\s]+"?/);
  return m ? m[0].replace(/"/g, "") : colDef;
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const actual = await withDbRetry(actualColumns);
    const report: Record<string, { missing: string[]; total: number }> = {};
    for (const [table, cols] of Object.entries(EXPECTED)) {
      const have = new Set((actual[table] ?? []).map((c) => c.toLowerCase()));
      report[table] = {
        missing: cols.map((c) => colName(c)).filter((c) => !have.has(c.toLowerCase())),
        total: (actual[table] ?? []).length,
      };
    }
    return NextResponse.json({ ok: true, report });
  } catch (err) {
    return NextResponse.json({ ok: false, error: describeError(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== KEY) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const results: { stmt: string; ok: boolean; ms?: number; error?: string }[] = [];
  try {
    const ddl: string[] = [
      `CREATE TABLE IF NOT EXISTS "ReactionCount" (
         "id" TEXT NOT NULL,
         "confessionId" TEXT NOT NULL,
         "heart" INTEGER NOT NULL DEFAULT 0,
         "laugh" INTEGER NOT NULL DEFAULT 0,
         "cry" INTEGER NOT NULL DEFAULT 0,
         "bloom" INTEGER NOT NULL DEFAULT 0,
         CONSTRAINT "ReactionCount_pkey" PRIMARY KEY ("id")
       )`,
      `DO $$ BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReactionCount_confessionId_fkey') THEN
           ALTER TABLE "ReactionCount" ADD CONSTRAINT "ReactionCount_confessionId_fkey"
             FOREIGN KEY ("confessionId") REFERENCES "Confession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
         END IF;
       END $$`,
      `CREATE UNIQUE INDEX IF NOT EXISTS "ReactionCount_confessionId_key" ON "ReactionCount"("confessionId")`,
    ];
    for (const [table, cols] of Object.entries(EXPECTED)) {
      if (table === "ReactionCount") continue; // sudah ditangani CREATE TABLE di atas
      for (const col of cols) {
        const name = colName(col);
        const rest = col.slice(col.indexOf(" ") + 1);
        ddl.push(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${name}" ${rest}`);
      }
    }
    for (const stmt of ddl) {
      const t0 = Date.now();
      try {
        await withDbRetry(() => db.$executeRawUnsafe(stmt));
        results.push({ stmt: stmt.slice(0, 80), ok: true, ms: Date.now() - t0 });
      } catch (e) {
        results.push({ stmt: stmt.slice(0, 80), ok: false, error: describeError(e) });
      }
    }
    const after = await withDbRetry(actualColumns);
    return NextResponse.json({ ok: true, applied: results.length, results, after });
  } catch (err) {
    return NextResponse.json({ ok: false, error: describeError(err), results }, { status: 500 });
  }
}
