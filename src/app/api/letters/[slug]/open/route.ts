import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const openSchema = z.object({ letterId: z.string().min(1) });

// Buka satu surat: validasi terkunci/terbuka di server,
// baru kirim isi suratnya + catat openedAt (sekali) & views.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // body rusak / bukan JSON → 400 rapi (bukan 500 dari outer catch)
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }
    const parsed = openSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const { letterId } = parsed.data;

    const set = await withDbRetry(() =>
      db.letterSet.findUnique({
        where: { slug },
        include: { letters: true },
      })
    );
    if (!set) {
      return NextResponse.json({ error: "Suratnya nggak ketemu." }, { status: 404 });
    }
    if (!set.startedAt) {
      return NextResponse.json(
        { error: "Perjalanan belum dimulai. Tekan tombol mulai dulu ya." },
        { status: 400 }
      );
    }

    const letter = set.letters.find((l) => l.id === letterId);
    if (!letter) {
      return NextResponse.json({ error: "Suratnya nggak ada." }, { status: 404 });
    }

    const DAY_MS = 24 * 60 * 60 * 1000;
    const unlockAt = set.startedAt.getTime() + letter.unlockDays * DAY_MS;
    if (Date.now() < unlockAt) {
      return NextResponse.json(
        { error: "Masih terkunci 💌 Sabar, suratnya buka besok-besok." },
        { status: 403 }
      );
    }

    const now = new Date();
    const updated = await withDbRetry(() =>
      db.letter.update({
        where: { id: letter.id },
        data: {
          views: { increment: 1 },
          openedAt: letter.openedAt ?? now,
        },
      })
    );

    return NextResponse.json({
      title: letter.title,
      body: letter.body,
      openedAt: updated.openedAt?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("POST /api/letters/[slug]/open error:", describeError(err), err);
    reportError(err, { route: "POST /api/letters/[slug]/open" });
    return NextResponse.json({ error: "Gagal membuka surat." }, { status: 500 });
  }
}
