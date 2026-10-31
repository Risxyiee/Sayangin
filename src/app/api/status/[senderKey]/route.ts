import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { describeError } from "@/lib/log-error";

// Halaman status pengirim: GET /api/status/<senderKey>
// Mendukung dua jenis kado: confess & open-when letters.
// Tidak menambah counter buka (aman untuk dicek berkali-kali).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ senderKey: string }> }
) {
  try {
    const { senderKey } = await params;

    const confession = await db.confession.findUnique({
      where: { senderKey },
      select: {
        slug: true,
        fromName: true,
        toName: true,
        theme: true,
        response: true,
        reply: true,
        repliedAt: true,
        views: true,
        reportCount: true,
        createdAt: true,
        openedAt: true,
        respondedAt: true,
      },
    });

    if (confession) {
      const { reportCount, ...c } = confession;
      return NextResponse.json({
        type: "confess",
        hidden: reportCount >= 3,
        ...c,
      });
    }

    const set = await db.letterSet.findUnique({
      where: { senderKey },
      include: { letters: { orderBy: { order: "asc" } } },
    });

    if (set) {
      return NextResponse.json({
        type: "letters",
        hidden: set.reportCount >= 3,
        slug: set.slug,
        fromName: set.fromName,
        toName: set.toName,
        theme: set.theme,
        views: set.views,
        createdAt: set.createdAt,
        openedAt: set.openedAt,
        startedAt: set.startedAt,
        total: set.letters.length,
        letters: set.letters.map((l) => ({
          order: l.order,
          title: l.title,
          unlockDays: l.unlockDays,
          views: l.views,
          openedAt: l.openedAt,
          reply: l.reply,
          repliedAt: l.repliedAt,
        })),
      });
    }

    const gift = await db.gift.findUnique({ where: { senderKey } });

    if (gift) {
      const base = {
        type: "gift" as const,
        giftType: gift.type,
        hidden: gift.reportCount >= 3,
        slug: gift.slug,
        fromName: gift.fromName,
        toName: gift.toName,
        theme: gift.theme,
        views: gift.views,
        createdAt: gift.createdAt,
        openedAt: gift.openedAt,
      };

      // kupon: sertakan daftar + status pemakaian biar pengirim lihat progres
      if (gift.type === "coupons") {
        try {
          const data = JSON.parse(gift.data) as { coupons?: { title: string; desc?: string }[] };
          const progress = JSON.parse(gift.progress) as { redeemed?: Record<string, string> };
          return NextResponse.json({
            ...base,
            coupons: data.coupons ?? [],
            redeemed: progress.redeemed ?? {},
          });
        } catch {
          return NextResponse.json({ ...base, coupons: [], redeemed: {} });
        }
      }

      // playlist: sertakan judul + jumlah lagu buat halaman pantauan
      if (gift.type === "playlist") {
        try {
          const data = JSON.parse(gift.data) as { title?: string; songs?: unknown[] };
          return NextResponse.json({
            ...base,
            plTitle: data.title ?? "",
            plSongs: Array.isArray(data.songs) ? data.songs.length : 0,
          });
        } catch {
          return NextResponse.json({ ...base, plTitle: "", plSongs: 0 });
        }
      }

      return NextResponse.json(base);
    }

    return NextResponse.json(
      { error: "Status tidak ditemukan. Buka lewat link yang kamu simpan ya." },
      { status: 404 }
    );
  } catch (err) {
    console.error("GET /api/status/[senderKey] error:", describeError(err), err);
    return NextResponse.json(
      { error: "Gagal memuat status." },
      { status: 500 }
    );
  }
}
