import { NextResponse } from "next/server";
import { Client } from "pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * GET /api/db-ping — diagnostik koneksi database di dalam Worker.
 *
 * Latar: semua endpoint yang menyentuh DB menggantung tanpa jawaban
 * (black-hole di jalur Hyperdrive → Supabase). Endpoint ini membedakan
 * penyebabnya dengan timeout eksplisit — jawaban selalu <= ~10 detik:
 *
 *   ok:true            → DB sehat (hapus endpoint ini kalau sudah begini)
 *   error auth/notta   → password/URL origin Hyperdrive salah
 *   timeout/refused    → Supabase tidak bisa dihubungi dari Cloudflare
 *
 * Tidak ada kredensial yang dibocorkan di respons (password disamarkan).
 */
export const dynamic = "force-dynamic";

type Env = { HYPERDRIVE?: { connectionString?: string } };

function hyperdriveUrl(): string | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as { env?: Env };
    return env?.HYPERDRIVE?.connectionString;
  } catch {
    return undefined;
  }
}

function describe(url: string | undefined) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, ""),
      user: u.username,
      hasPassword: u.password.length > 0,
    };
  } catch {
    return { host: "(URL tidak valid)" };
  }
}

async function probe(url: string): Promise<Record<string, unknown>> {
  const t0 = Date.now();
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 8_000,
    query_timeout: 8_000,
    statement_timeout: 8_000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    const r = await client.query("select 1 as ok");
    await client.end().catch(() => {});
    return { ok: true, ms: Date.now() - t0, rows: r.rowCount };
  } catch (err) {
    await client.end().catch(() => {});
    const e = err as { code?: string; message?: string };
    return {
      ok: false,
      ms: Date.now() - t0,
      code: e.code ?? null,
      error: String(e.message ?? err).slice(0, 300),
    };
  }
}

export async function GET() {
  const hd = hyperdriveUrl();
  const direct = process.env.DATABASE_URL?.trim() || undefined;

  const out: Record<string, unknown> = {
    time: new Date().toISOString(),
    hyperdrive: { present: !!hd, target: describe(hd) },
    databaseUrl: { present: !!direct, target: describe(direct) },
  };

  if (hd) out.hyperdrive = { ...out.hyperdrive, ...(await probe(hd)) };

  // Jalur fallback (pg TLS langsung) diketahui bermasalah di runtime Workers —
  // jangan diprobe otomatis; keberadaan & bentuk URL-nya saja sudah cukup.

  return NextResponse.json(out, {
    headers: { "Cache-Control": "no-store" },
  });
}
