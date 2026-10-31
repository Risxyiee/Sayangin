import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const confession = await db.confession.findUnique({
      where: { slug },
      select: {
        slug: true,
        senderKey: true,
        fromName: true,
        toName: true,
        message: true,
        theme: true,
        response: true,
        reply: true,
        views: true,
        reportCount: true,
        createdAt: true,
        openedAt: true,
      },
    });

    if (!confession) {
      return NextResponse.json(
        { error: "Confess tidak ditemukan. Link-nya mungkin salah." },
        { status: 404 }
      );
    }

    // mode pratinjau pengirim: ?p=<senderKey> yang cocok →
    // konten tampil TANPA menambah hitungan / menyalakan "udah dibuka"
    const p = req.nextUrl.searchParams.get("p") ?? "";
    const isPreview = !!confession.senderKey && p === confession.senderKey;

    // konten dilaporkan >=3x → disembunyikan dari penerima sampai direview.
    // pengirim (pratinjau) tetap boleh melihat tulisannya sendiri.
    if (confession.reportCount >= 3 && !isPreview) {
      return NextResponse.json({
        hidden: true,
        toName: confession.toName,
        theme: confession.theme,
      });
    }

    if (!isPreview) {
      // catat aktivitas buka (untuk halaman status pengirim)
      await db.confession.update({
        where: { slug },
        data: {
          views: { increment: 1 },
          openedAt: confession.openedAt ?? new Date(),
        },
      });
    }

    const { senderKey: _sk, reportCount: _rc, views: _v, openedAt: _o, ...safe } =
      confession;
    return NextResponse.json({ ...safe, preview: isPreview });
  } catch (err) {
    console.error("GET /api/confess/[slug] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat confess." },
      { status: 500 }
    );
  }
}
