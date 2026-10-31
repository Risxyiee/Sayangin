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
    db.$queryRaw`SELECT current_user AS user, current_database() AS db`
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
