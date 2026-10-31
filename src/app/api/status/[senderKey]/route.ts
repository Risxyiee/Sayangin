import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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
        views: true,
        createdAt: true,
        openedAt: true,
        respondedAt: true,
      },
    });

    if (confession) {
      return NextResponse.json({
        type: "confess",
        ...confession,
      });
    }

    const set = await db.letterSet.findUnique({
      where: { senderKey },
      include: { letters: { orderBy: { order: "asc" } } },
    });

    if (set) {
      return NextResponse.json({
        type: "letters",
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
        })),
      });
    }

    return NextResponse.json(
      { error: "Status tidak ditemukan. Buka lewat link yang kamu simpan ya." },
      { status: 404 }
    );
  } catch (err) {
    console.error("GET /api/status/[senderKey] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat status." },
      { status: 500 }
    );
  }
}
