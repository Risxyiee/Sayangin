import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { describeError } from "@/lib/log-error";

const DAY_MS = 24 * 60 * 60 * 1000;

// Penerima: GET /api/letters/<slug>
// - catat mampir pertama (openedAt) + views utk halaman status pengirim
// - isi surat HANYA dikirim kalau suratnya sudah terbuka (anti intip via devtools)
// - ?p=<senderKey> yang cocok = mode pratinjau pengirim (tanpa hitungan)
export async function GET(
  req: NextRequest,
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

    const p = req.nextUrl.searchParams.get("p") ?? "";
    const isPreview = p === set.senderKey;

    // konten dilaporkan >=3x → disembunyikan dari penerima sampai direview.
    // pengirim (pratinjau) tetap boleh melihat tulisannya sendiri.
    if (set.reportCount >= 3 && !isPreview) {
      return NextResponse.json({
        hidden: true,
        toName: set.toName,
        fromName: set.fromName,
        theme: set.theme,
        letters: [],
      });
    }

    const now = new Date();
    if (!isPreview) {
      await db.letterSet.update({
        where: { slug },
        data: {
          views: { increment: 1 },
          openedAt: set.openedAt ?? now,
        },
      });
    }

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
        reply: l.reply,
        repliedAt: l.repliedAt?.toISOString() ?? null,
        body: unlocked ? l.body : null,
      };
    });

    return NextResponse.json({
      slug: set.slug,
      fromName: set.fromName,
      toName: set.toName,
      theme: set.theme,
      startedAt: startedAt?.toISOString() ?? null,
      views: set.views + (isPreview ? 0 : 1),
      preview: isPreview,
      letters,
    });
  } catch (err) {
    console.error("GET /api/letters/[slug] error:", describeError(err), err);
    return NextResponse.json(
      { error: "Gagal memuat surat." },
      { status: 500 }
    );
  }
}
