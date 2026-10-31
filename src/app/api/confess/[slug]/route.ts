import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const confession = await db.confession.findUnique({
      where: { slug },
      select: {
        slug: true,
        fromName: true,
        toName: true,
        message: true,
        theme: true,
        response: true,
        createdAt: true,
      },
    });

    if (!confession) {
      return NextResponse.json(
        { error: "Confess tidak ditemukan. Link-nya mungkin salah." },
        { status: 404 }
      );
    }

    // catat aktivitas buka (untuk halaman status pengirim)
    const now = new Date();
    const tracked = await db.confession.update({
      where: { slug },
      data: {
        views: { increment: 1 },
        openedAt: confession.openedAt ?? now,
      },
      select: {
        slug: true,
        fromName: true,
        toName: true,
        message: true,
        theme: true,
        response: true,
        createdAt: true,
      },
    });

    return NextResponse.json(tracked);
  } catch (err) {
    console.error("GET /api/confess/[slug] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat confess." },
      { status: 500 }
    );
  }
}
