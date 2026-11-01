import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const replySchema = z.object({
  reply: z
    .string()
    .trim()
    .min(2, "Balasan minimal 2 karakter")
    .max(400, "Balasan maksimal 400 karakter"),
});

// Penerima menulis balasan sungguhan untuk si pengirim:
// POST /api/confess/<slug>/reply { reply }
// Syarat: dia sudah memilih jawaban (yes/later) — biar konteksnya jelas.
// Satu confess = satu balasan. Balasan tampil di halaman pantauan pengirim.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // anti-spam: maks 15 balasan per jam per IP
    const rl = await rateLimit(req, "confess-reply", 15, 60 * 60 * 1000);
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
    const { reply } = parsed.data;

    // moderasi ringan
    if (findProhibited(reply)) {
      return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
    }

    const confession = await db.confession.findUnique({
      where: { slug },
      select: { id: true, response: true, reply: true },
    });
    if (!confession) {
      return NextResponse.json(
        { error: "Suratnya nggak ketemu." },
        { status: 404 }
      );
    }
    if (!confession.response) {
      // belum jawab pilihannya → jangan biarkan balas buta
      return NextResponse.json(
        { error: "Jawab dulu pilihannya sebelum nulis balasan ya 😉" },
        { status: 403 }
      );
    }
    if (confession.reply) {
      return NextResponse.json(
        { error: "Kamu udah nulis balasan untuk surat ini." },
        { status: 400 }
      );
    }

    const updated = await db.confession.update({
      where: { slug },
      data: { reply, repliedAt: new Date() },
      select: { reply: true, repliedAt: true },
    });

    return NextResponse.json({
      ok: true,
      reply: updated.reply,
      repliedAt: updated.repliedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("POST /api/confess/[slug]/reply error:", describeError(err), err);
    reportError(err, { route: "POST /api/confess/[slug]/reply" });
    return NextResponse.json(
      { error: "Gagal mengirim balasan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
