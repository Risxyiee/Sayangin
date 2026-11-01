import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, dbNonce } from "@/lib/db";
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

    // Baca anti-cache (read-after-write): start bisa saja BARU SAJA menulis
    // startedAt; cache Hyperdrive bisa menyajikan baris pra-update (insiden
    // 2026-11-01: open 400 "belum dimulai" walau start sukses — cache
    // memegang startedAt=null sampai TTL ±60 dtk). Nonce → selalu ke origin.
    const nc = dbNonce();
    // PENTING: pakai $queryRawUnsafe, BUKAN $queryRaw tagged-template —
    // interpolasi ${} di dalam komentar komentar-tagged-template tetap
    // diparameter-kan Prisma ($2 di dalam komentar → bind 2 parameter utk
    // statement 1 parameter → error kilat). Nonce dirangkai di JS; nilainya
    // hanya [a-z0-9-] hasil server, slug tetap lewat parameter $1.
    const setRows = await withDbRetry(() =>
      db.$queryRawUnsafe<Array<{ id: string; startedAt: Date | null }>>(
        `SELECT "id", "startedAt" FROM "LetterSet" WHERE "slug" = $1 /* nc-${nc} */`,
        slug
      )
    );
    const set = setRows[0];
    if (!set) {
      return NextResponse.json({ error: "Suratnya nggak ketemu." }, { status: 404 });
    }
    if (!set.startedAt) {
      return NextResponse.json(
        { error: "Perjalanan belum dimulai. Tekan tombol mulai dulu ya." },
        { status: 400 }
      );
    }

    const letterRows = await withDbRetry(() =>
      db.$queryRawUnsafe<
        Array<{ id: string; title: string; body: string; unlockDays: number; openedAt: Date | null }>
      >(
        `SELECT "id", "title", "body", "unlockDays", "openedAt" FROM "Letter" WHERE "setId" = $1 /* nc-${nc} */`,
        set.id
      )
    );
    const letter = letterRows.find((l) => l.id === letterId);
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
