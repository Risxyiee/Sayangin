import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// ── Aturan mutlak infrastruktur (OpenNext & Supabase) ──────────────────────
// TANPA `export const runtime = "edge"` — OpenNext Cloudflare meng-compile
// SELURUH app menjadi satu Worker di edge (marker edge memaksa bundler sandbox
// Next.js yang tidak mendukung builtin Node (net/tls) → build gagal; bukti
// lengkap di src/app/api/kado/route.ts).
//
// Edge-compatibilitas kode tetap dijaga: tanpa API Node murni, koneksi DB
// HANYA lewat binding Hyperdrive (direct connection Supabase port 5432) via
// helper bersama src/lib/db.ts — route ini cukup memakai `db` + `withDbRetry`
// dan tidak pernah menyentuh connection string langsung.

/**
 * PATCH /api/kado/[id]/status — simpan keputusan penerima kado.
 *
 * Payload : { status: "opened" | "accepted" | "rejected" }
 * Sukses  : 200 { success: true, status: <status baru> }
 * Gagal   : 400 payload/ID salah · 404 kado tak ada · 409 sudah terkunci ·
 *           429 rate limit · 500 server
 *
 * CRITICAL — transisi sekali jalan:
 *   UPDATE ... WHERE id = ? AND status = 'pending'
 *   Kondisi `status: "pending"` di where clause membuat request susulan
 *   (double submit, replay, manipulasi manual) selalu gagal: begitu kado
 *   berubah dari pending, statusnya TERKUNCI MATI — "rejected" menghanguskan
 *   kado selamanya dan pengirim tetap anonim (nama tak pernah dikirim ke
 *   penerima di kondisi ini).
 *
 * Alur frontend: CinematicUnboxing hanya mengirim "accepted"/"rejected" saat
 * fase dilemma — satu transisi terminal langsung dari pending. Nilai
 * "opened" tetap diterima API untuk kebutuhan opsional (menandai sudah
 * dibuka tanpa keputusan — juga mengunci kado).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const statusSchema = z.object({
  status: z.enum(["opened", "accepted", "rejected"]),
});

/** Deteksi P2025 (baris tak cocok) — antar varian error adapter/engine. */
function isP2025(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) return err.code === "P2025";
  const msg = err instanceof Error ? err.message : String(err);
  return /P2025|Record to update not found|No record was found/i.test(msg);
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> } // Next 15/16: params adalah Promise
) {
  try {
    const { id } = await ctx.params;

    // ID salah format → tidak perlu ganggu database (kolom id bertipe uuid)
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID kado tidak valid" },
        { status: 400 }
      );
    }

    // anti-spam: penerima cuma butuh 1 request sukses — 12 per 10 menit per IP
    // longgar untuk retry manusiawi, ketat untuk replay otomatis
    const rl = await rateLimit(req, "kado-status", 12, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak percobaan. Coba lagi nanti ya 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Format request tidak valid" },
        { status: 400 }
      );
    }

    const parsed = statusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "status harus salah satu dari: opened, accepted, rejected" },
        { status: 400 }
      );
    }
    const { status } = parsed.data;

    // CRITICAL: kondisi status: "pending" di where — pembaruan cuma lolos untuk
    // kado yang belum pernah diubah (transisi sekali jalan, anti-eksploitasi).
    // withDbRetry: koneksi zombie Hyperdrive diulang otomatis di koneksi baru
    // — pengguna tidak melihat errornya.
    try {
      const updated = await withDbRetry(() =>
        db.kado.update({
          where: { id, status: "pending" }, // ← kunci sekali jalan
          data: { status },
          select: { status: true },
        })
      );
      return NextResponse.json({ success: true, status: updated.status });
    } catch (err) {
      // P2025 = tak ada baris yang cocok: kado nggak ada ATAU sudah terkunci.
      // Bedakan keduanya lewat satu findUnique (hanya lewat di jalur error).
      if (isP2025(err)) {
        const existing = await withDbRetry(() =>
          db.kado.findUnique({ where: { id }, select: { status: true } })
        ).catch(() => null);

        if (!existing) {
          return NextResponse.json(
            { success: false, error: "Kado nggak ketemu" },
            { status: 404 }
          );
        }
        return NextResponse.json(
          {
            success: false,
            error: "Kado ini sudah dibuka dan statusnya terkunci — tidak bisa diubah lagi.",
            status: existing.status,
          },
          { status: 409 }
        );
      }
      throw err; // bukan P2025 → lempar ke handler 500 di bawah
    }
  } catch (err) {
    console.error("PATCH /api/kado/[id]/status error:", describeError(err), err);
    reportError(err, { route: "PATCH /api/kado/[id]/status" });
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan jawaban. Coba lagi ya." },
      { status: 500 }
    );
  }
}
