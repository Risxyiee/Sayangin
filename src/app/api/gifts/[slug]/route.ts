import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import type { GiftProgress } from "@/lib/gift-data";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// Penerima: GET /api/gifts/<slug>
// - catat mampir pertama (openedAt) + views utk halaman status pengirim
// - ?p=<senderKey> yang cocok = mode pratinjau pengirim (tanpa hitungan)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    // withDbRetry: koneksi zombie Hyperdrive sesekali muncul — ulang di
    // koneksi baru, user tidak melihat errornya.
    const gift = await withDbRetry(() => db.gift.findUnique({ where: { slug } }));

    if (!gift) {
      return NextResponse.json(
        { error: "Kadonya nggak ketemu. Link-nya mungkin salah." },
        { status: 404 }
      );
    }

    const p = req.nextUrl.searchParams.get("p") ?? "";
    const isPreview = p === gift.senderKey;

    // konten dilaporkan >=3x → disembunyikan dari penerima sampai direview.
    // pengirim (pratinjau) tetap boleh melihat kadonya sendiri.
    if (gift.reportCount >= 3 && !isPreview) {
      return NextResponse.json({
        hidden: true,
        toName: gift.toName,
        fromName: gift.fromName,
        type: gift.type,
        theme: gift.theme,
      });
    }

    if (!isPreview) {
      await withDbRetry(() =>
        db.gift.update({
          where: { slug },
          data: {
            views: { increment: 1 },
            openedAt: gift.openedAt ?? new Date(),
          },
        })
      );
    }

    let data: unknown = {};
    try {
      data = JSON.parse(gift.data);
    } catch {
      data = {};
    }
    let progress: GiftProgress = {};
    try {
      progress = JSON.parse(gift.progress) as GiftProgress;
    } catch {
      progress = {};
    }

    return NextResponse.json({
      slug: gift.slug,
      type: gift.type,
      fromName: gift.fromName,
      toName: gift.toName,
      theme: gift.theme,
      data,
      progress,
      views: gift.views + (isPreview ? 0 : 1),
      preview: isPreview,
    });
  } catch (err) {
    console.error("GET /api/gifts/[slug] error:", describeError(err), err);
    reportError(err, { route: "GET /api/gifts/[slug]" });
    return NextResponse.json(
      { error: "Gagal memuat kado." },
      { status: 500 }
    );
  }
}
