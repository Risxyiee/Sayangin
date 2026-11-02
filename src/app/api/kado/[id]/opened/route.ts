import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// ── Aturan mutlak infrastruktur (OpenNext & Supabase) ──────────────────────
// TANPA `export const runtime = "edge"` — OpenNext Cloudflare meng-compile
// SELURUH app menjadi satu Worker (marker edge memaksa bundler yang tidak
// mendukung builtin Node → build gagal; bukti di src/app/api/kado/route.ts).
// Koneksi DB HANYA lewat binding Hyperdrive via src/lib/db.ts.

/**
 * POST /api/kado/[id]/opened — catat satu kali kado dibuka penerima.
 *
 * Payload : (tanpa body)
 * Sukses  : 200 { success: true, openCount: <jumlah terbaru> }
 * Gagal   : 400 ID salah · 404 kado tak ada · 429 rate limit · 500 server
 *
 * Menyimpan ke kadoData (JSONB), BUKAN kolom baru — mengikuti pola kolom
 * progress fitur balasan (migrasi kolom tidak perlu):
 *   openCount    : number — total kunjungan halaman kado (1 hit per sesi
 *                  browser per kado; guard sessionStorage di sisi client)
 *   lastOpenedAt : string ISO UTC — kunjungan terakhir
 *
 * Statistik ini dibaca dashboard pengirim lewat GET /api/kado/[id]/reply
 * (field openCount & lastOpenedAt) lalu tampil di kartu balasan.
 *
 * Mode pratinjau (?pratinjau=1) TIDAK pernah memanggil endpoint ini —
 * komponen client memutusnya sebelum fetch; endpoint sendiri tidak bisa
 * membedakan (tanpa login, semua anonim) — rate limit + guard sesi
 * menjaga angka tetap jujur.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // Next 15/16: params adalah Promise
) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID kado tidak valid" },
        { status: 400 }
      );
    }

    // guard flood: normal user 1 hit per sesi; 30/menit cukup longgar untuk
    // beberapa tab perangkat tapi menahan skrip
    const rl = await rateLimit(req, "kado-opened", 30, 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // Satu statement atomik: naikkan counter + catat waktu, baca balik.
    // kadoData bisa NULL (kado lama) → COALESCE ke objek kosong dulu.
    // Nilai openCount selalu ditulis endpoint ini (int) → cast ::int aman.
    const openedAt = new Date().toISOString();
    const rows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ open_count: number | null }>>(
        `UPDATE "Kado"
         SET "kadoData" = COALESCE("kadoData", '{}'::jsonb) || jsonb_build_object(
               'openCount', COALESCE(("kadoData"->>'openCount')::int, 0) + 1,
               'lastOpenedAt', $2::text
             )
         WHERE "id" = $1::uuid
         RETURNING ("kadoData"->>'openCount')::int AS open_count`,
        id,
        openedAt
      )
    );

    if (!rows.length) {
      return NextResponse.json(
        { success: false, error: "Kado nggak ketemu" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: true, openCount: rows[0].open_count ?? null },
      { headers: { "Cache-Control": "no-store, max-age=0", "CDN-Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("POST /api/kado/[id]/opened error:", describeError(err), err);
    reportError(err, { route: "POST /api/kado/[id]/opened" });
    return NextResponse.json(
      { success: false, error: "Gagal mencatat statistik. Coba lagi ya." },
      { status: 500 }
    );
  }
}
