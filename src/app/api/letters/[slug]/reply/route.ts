import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, dbNonce } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const replySchema = z.object({
  letterId: z.string().trim().min(5).max(40),
  body: z
    .string()
    .trim()
    .min(2, "Balasan minimal 2 karakter")
    .max(400, "Balasan maksimal 400 karakter"),
});

// Penerima membalas satu surat: POST /api/letters/<slug>/reply
// Syarat: suratnya sudah pernah dibuka (openedAt terisi). Satu surat = satu balasan.
// Balasan tampil di halaman status pengirim — ini loop emosionalnya.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // anti-spam: maks 15 balasan per jam per IP
    const rl = await rateLimit(req, "letter-reply", 15, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak balasan sekaligus. Coba lagi nanti ya 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // body request rusak / bukan JSON → 400 rapi (bukan 500 dari outer catch)
    let reqBody: unknown;
    try {
      reqBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }
    const parsed = replySchema.safeParse(reqBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const { letterId, body } = parsed.data;

    // moderasi ringan
    if (findProhibited(body)) {
      return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
    }

    // Baca anti-cache (read-after-write): open bisa saja BARU SAJA menulis
    // openedAt; cache Hyperdrive bisa menyajikan baris pra-update → user
    // yang sudah buka surat tetap kena 403 "buka dulu" (insiden 2026-11-01).
    const nc = dbNonce();
    const setRows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT "id" FROM "LetterSet" WHERE "slug" = $1 /* nc-${nc} */`,
        slug
      )
    );
    const set = setRows[0];
    if (!set) {
      return NextResponse.json(
        { error: "Suratnya nggak ketemu." },
        { status: 404 }
      );
    }

    const letterRows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ id: string; openedAt: Date | null; reply: string | null }>>(
        `SELECT "id", "openedAt", "reply" FROM "Letter" WHERE "id" = $1 AND "setId" = $2 /* nc-${nc} */`,
        letterId,
        set.id
      )
    );
    const letter = letterRows[0];
    if (!letter) {
      return NextResponse.json(
        { error: "Suratnya nggak ketemu." },
        { status: 404 }
      );
    }
    if (!letter.openedAt) {
      // surat belum dibuka → jangan biarkan balas buta
      return NextResponse.json(
        { error: "Buka suratnya dulu sebelum bales ya 😉" },
        { status: 403 }
      );
    }
    if (letter.reply) {
      return NextResponse.json(
        { error: "Surat ini udah pernah kamu bales." },
        { status: 400 }
      );
    }

    const updated = await withDbRetry(() =>
      db.letter.update({
        where: { id: letter.id },
        data: { reply: body, repliedAt: new Date() },
        select: { reply: true, repliedAt: true },
      })
    );

    return NextResponse.json({
      ok: true,
      reply: updated.reply,
      repliedAt: updated.repliedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("POST /api/letters/[slug]/reply error:", describeError(err), err);
    reportError(err, { route: "POST /api/letters/[slug]/reply" });
    return NextResponse.json(
      { error: "Gagal mengirim balasan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
