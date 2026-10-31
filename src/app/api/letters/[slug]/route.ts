import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

// Penerima: GET /api/letters/<slug>
// - catat mampir pertama (openedAt) + views utk halaman status pengirim
// - isi surat HANYA dikirim kalau suratnya sudah terbuka (anti intip via devtools)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const set = await db.letterSet.findUnique({
      where: { slug },
      include: { letters: { orderBy: { order: "asc" } } },
    });

    if (!set) {
      return NextResponse.json(
        { error: "Suratnya nggak ketemu. Link-nya mungkin salah." },
        { status: 404 }
      );
    }

    const now = new Date();
    await db.letterSet.update({
      where: { slug },
      data: {
        views: { increment: 1 },
        openedAt: set.openedAt ?? now,
      },
    });

    const startedAt = set.startedAt;
    const letters = set.letters.map((l) => {
      const unlockAt = startedAt
        ? new Date(startedAt.getTime() + l.unlockDays * DAY_MS)
        : null;
      const unlocked = !!unlockAt && now.getTime() >= unlockAt.getTime();
      return {
        id: l.id,
        order: l.order,
        title: l.title,
        unlockDays: l.unlockDays,
        unlocked,
        // kirim target unlock untuk countdown; null kalau sudah terbuka
        unlockAt: unlocked ? null : unlockAt?.toISOString() ?? null,
        openedAt: l.openedAt?.toISOString() ?? null,
        views: l.views,
        body: unlocked ? l.body : null,
      };
    });

    return NextResponse.json({
      slug: set.slug,
      fromName: set.fromName,
      toName: set.toName,
      theme: set.theme,
      startedAt: startedAt?.toISOString() ?? null,
      views: set.views + 1,
      letters,
    });
  } catch (err) {
    console.error("GET /api/letters/[slug] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat surat." },
      { status: 500 }
    );
  }
}
