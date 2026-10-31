import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { describeError } from "@/lib/log-error";

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
    const rl = rateLimit(req, "letter-reply", 15, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak balasan sekaligus. Coba lagi nanti ya 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const parsed = replySchema.safeParse(await req.json());
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

    const set = await withDbRetry(() =>
      db.letterSet.findUnique({
        where: { slug },
        select: { id: true },
      })
    );
    if (!set) {
      return NextResponse.json(
        { error: "Suratnya nggak ketemu." },
        { status: 404 }
      );
    }

    const letter = await withDbRetry(() =>
      db.letter.findFirst({
        where: { id: letterId, setId: set.id },
        select: { id: true, openedAt: true, reply: true },
      })
    );
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

    const updated = await db.letter.update({
      where: { id: letter.id },
      data: { reply: body, repliedAt: new Date() },
      select: { reply: true, repliedAt: true },
    });

    return NextResponse.json({
      ok: true,
      reply: updated.reply,
      repliedAt: updated.repliedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("POST /api/letters/[slug]/reply error:", describeError(err), err);
    return NextResponse.json(
      { error: "Gagal mengirim balasan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
