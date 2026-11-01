import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { buildFomoIdentity } from "@/utils/fomoLogic";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// ── Aturan mutlak infrastruktur (edge runtime & Hyperdrive) ────────────────
// Route ini WAJIB berjalan di Cloudflare Edge, dan memang begitu: produksi
// memakai @opennextjs/cloudflare yang meng-compile SEMUA route (node & edge)
// menjadi satu Worker di edge — termasuk route ini.
//
// CATATAN PENTING: JANGAN menaruh `export const runtime = "edge"` di sini.
// Marker itu memaksa bundler sandbox edge Next.js yang TIDAK mendukung builtin
// Node (net/tls) → `next build` gagal di module pg (terbukti saat build).
// Di Workers pg tetap bisa jalan karena worker memakai flag nodejs_compat.
// Edge-compatibilitas kode tetap dijaga: tanpa API Node murni, koneksi DB
// hanya lewat Hyperdrive (direct connection Supabase 5432) via src/lib/db.ts,
// yang membaca getCloudflareContext() (== getRequestContext()).env.
// HYPERDRIVE_DB.connectionString.

/**
 * POST /api/kado — terima payload Creator Studio, simpan ke tabel Kado.
 *
 * Koneksi DB (aturan mutlak): Hyperdrive → direct connection Supabase 5432.
 * Connection string diambil dari getCloudflareContext()
 *   (== getRequestContext()).env.HYPERDRIVE_DB.connectionString
 * oleh helper bersama src/lib/db.ts — route TIDAK pernah menyentuh
 * connection string langsung, cukup pakai `db` + `withDbRetry`.
 *
 * Identitas FOMO dihitung ulang DI SERVER lewat buildFomoIdentity() — klien
 * tidak pernah berhak menentukan fomoInitials sendiri (anti-spoof), dan
 * isAnonymous: true selalu menang atas senderName apa pun yang dikirim.
 */

const createSchema = z.object({
  targetName: z.string().trim().min(1, "Nama penerima wajib diisi").max(60),
  message: z.string().trim().min(1, "Pesan utama wajib diisi").max(1000),
  // anonim → kirim isAnonymous: true; UI mengirim senderName: null saat
  // anonim — nullish (bukan cuma optional) supaya null valid dan dianggap ""
  senderName: z.string().trim().max(60).nullish().default(""),
  isAnonymous: z.boolean().optional().default(false),
  // kadoType fleksibel (pendekatan JSONB): tipe baru tidak butuh ubah schema —
  // cukup token alfanumerik biar rapi di URL & log
  kadoType: z
    .string()
    .trim()
    .min(1, "Tipe kado wajib dipilih")
    .max(40)
    .regex(/^[a-z0-9_-]+$/i, "kadoType cuma boleh huruf, angka, tanda hubung, dan garis bawah"),
  // konfigurasi interaksi per kadoType (quiz: question/answer, fingerprint: holdMs, ...)
  kadoData: z
    .record(z.string(), z.union([z.string().max(1000), z.number()]))
    .nullable()
    .optional()
    .default(null),
});

/** Kumpulkan semua string di kadoData untuk moderasi (quiz: pertanyaan & jawaban). */
function kadoDataTexts(kadoData: Record<string, string | number> | null): string[] {
  if (!kadoData) return [];
  return Object.values(kadoData).filter((v): v is string => typeof v === "string");
}

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 kado per 15 menit per IP (sejajar fitur gift)
    const rl = await rateLimit(req, "kado-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak kado. Coba lagi nanti 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const { targetName, message, senderName, isAnonymous, kadoType, kadoData } = parsed.data;

    // identitas FOMO selalu dihitung di server (senderName null/"" → anonim)
    const identity = buildFomoIdentity(senderName, isAnonymous);

    // moderasi ringan: nama, pesan, dan semua teks di dalam kadoData
    for (const text of [
      targetName,
      identity.senderName ?? "",
      message,
      ...kadoDataTexts(kadoData),
    ]) {
      if (findProhibited(text)) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }

    // withDbRetry: kalau kena koneksi zombie Hyperdrive, ulang di koneksi baru
    // — pengguna tidak melihat errornya.
    const kado = await withDbRetry(() =>
      db.kado.create({
        data: {
          targetName,
          message,
          senderName: identity.senderName,
          fomoInitials: identity.fomoInitials,
          kadoType,
          // Json? di Prisma butuh sentinel DbNull, bukan null literal
          kadoData: kadoData ?? Prisma.DbNull,
        },
        select: { id: true },
      })
    );

    return NextResponse.json({ success: true, data: { id: kado.id } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/kado error:", describeError(err), err);
    reportError(err, { route: "POST /api/kado" });
    return NextResponse.json({ error: "Gagal membuat kado. Coba lagi ya." }, { status: 500 });
  }
}
