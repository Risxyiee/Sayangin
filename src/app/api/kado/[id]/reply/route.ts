import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, dbNonce } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// ── Aturan mutlak infrastruktur (OpenNext & Supabase) ──────────────────────
// TANPA `export const runtime = "edge"` — OpenNext Cloudflare meng-compile
// SELURUH app menjadi satu Worker di edge (alasan lengkap:
// src/app/api/kado/route.ts). Koneksi DB HANYA lewat Hyperdrive via
// src/lib/db.ts — route ini cukup memakai `db` + `withDbRetry`.

/**
 * Balasan penerima kado — loop dua arah pengirim ⇄ penerima.
 *
 * Disimpan di kolom `progress` (JSON string) model Kado:
 *   { "reply": "isi balasan", "repliedAt": "ISO timestamp" }
 * Tanpa migrasi skema: kolom `progress` memang dirancang untuk status
 * pemakaian oleh penerima (pola sama dengan redeem kupon di Gift.progress).
 *
 * GET  /api/kado/[id]/reply — dipakai dashboard pengirim (polling 12 dtk):
 *      { success, status, reply, repliedAt } — status mentah Kado, balasan,
 *      dan waktunya. Tidak ada isi rahasia kado di sini.
 *
 * POST /api/kado/[id]/reply — penerima menulis balasan.
 *      Syarat: kado ada, dan status BUKAN "pending" — penerima harus sudah
 *      menjawab kado-nya dulu (dilemma) sebelum boleh menulis balasan.
 *      Balasan boleh diperbarui (last write wins) — rate limit menjaga spam.
 *      Teks dimoderasi (findProhibited) seperti semua input bebas.
 *
 * Privasi: balasan tidak memuat identitas penerima — hanya teks. Dashboard
 * pengirim menampilkannya apa adanya.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const replySchema = z.object({
  reply: z
    .string()
    .trim()
    .min(2, "Tulis balasannya dulu ya (min. 2 karakter).")
    .max(500, "Balasannya kepanjangan — maks 500 karakter ya."),
});

/** Bentuk tersimpan di progress — reply + repliedAt + sisa kunci lain. */
type KadoProgress = Record<string, unknown> & {
  reply?: string;
  repliedAt?: string;
};

function parseProgress(raw: string | null | undefined): KadoProgress {
  if (!raw) return {};
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return v as KadoProgress;
    }
  } catch {
    /* bukan JSON valid — perlakukan kosong */
  }
  return {};
}

// ─────────────────────────────────────────────────────────────────────────────
// GET — baca status + balasan untuk dashboard pengirim
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID kado tidak valid" },
        { status: 400 }
      );
    }

    // polling 12 dtk dari dashboard → kuota longgar tapi tetap dibatasi
    const rl = await rateLimit(req, "kado-reply-get", 100, 10 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, error: "Terlalu banyak permintaan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // Anti-cache (read-after-write): balasan baru saja bisa ditulis penerima —
    // nonce memaksa query ke origin, bukan cache Hyperdrive yang basi.
    const nc = dbNonce();
    const rows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ status: string; progress: string }>>(
        `SELECT "status", "progress" FROM "Kado" WHERE "id" = $1 /* nc-${nc} */`,
        id
      )
    );
    const kado = rows[0];
    if (!kado) {
      return NextResponse.json(
        { success: false, error: "Kado nggak ketemu" },
        { status: 404 }
      );
    }

    const progress = parseProgress(kado.progress);
    return NextResponse.json({
      success: true,
      status: kado.status,
      reply: typeof progress.reply === "string" ? progress.reply : null,
      repliedAt: typeof progress.repliedAt === "string" ? progress.repliedAt : null,
    });
  } catch (err) {
    console.error("GET /api/kado/[id]/reply error:", describeError(err), err);
    reportError(err, { route: "GET /api/kado/[id]/reply" });
    return NextResponse.json(
      { success: false, error: "Gagal membaca balasan. Coba lagi ya." },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — simpan / perbarui balasan penerima
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { success: false, error: "ID kado tidak valid" },
        { status: 400 }
      );
    }

    // anti-spam: penerima manusiawi cuma butuh beberapa koreksi — 6 per 10 menit
    const rl = await rateLimit(req, "kado-reply-post", 6, 10 * 60 * 1000);
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
    const parsed = replySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message ?? "Balasan tidak valid" },
        { status: 400 }
      );
    }
    const reply = parsed.data.reply;

    // moderasi ringan — sama seperti semua teks bebas di Kangenin
    if (findProhibited(reply)) {
      return NextResponse.json({ success: false, error: MODERATION_ERROR }, { status: 400 });
    }

    // Baca anti-cache: status & progress terbaru dari origin
    const nc = dbNonce();
    const rows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ status: string; progress: string }>>(
        `SELECT "status", "progress" FROM "Kado" WHERE "id" = $1 /* nc-${nc} */`,
        id
      )
    );
    const kado = rows[0];
    if (!kado) {
      return NextResponse.json(
        { success: false, error: "Kado nggak ketemu" },
        { status: 404 }
      );
    }
    // Penerima harus sudah menjawab kadonya dulu (bukan pending) — balasan
    // adalah lanjutan dari jawabannya, bukan jalur pintas sebelum membuka.
    if (kado.status === "pending") {
      return NextResponse.json(
        { success: false, error: "Jawab kadonya dulu, baru boleh nulis balasan ya." },
        { status: 409 }
      );
    }

    const progress = parseProgress(kado.progress);
    const repliedAt = new Date().toISOString();
    const next: KadoProgress = { ...progress, reply, repliedAt };

    // Last write wins — penerima boleh merapikan balasannya. Tidak ada kunci
    // sekali-jalan di sini (beda dengan status): teksnya bisa dikoreksi.
    await withDbRetry(() =>
      db.kado.update({
        where: { id },
        data: { progress: JSON.stringify(next) },
        select: { id: true },
      })
    );

    return NextResponse.json({ success: true, reply, repliedAt });
  } catch (err) {
    console.error("POST /api/kado/[id]/reply error:", describeError(err), err);
    reportError(err, { route: "POST /api/kado/[id]/reply" });
    return NextResponse.json(
      { success: false, error: "Gagal mengirim balasan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
