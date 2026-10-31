import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// Halaman status pengirim: GET /api/status/<senderKey>
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

    if (!confession) {
      return NextResponse.json(
        { error: "Status tidak ditemukan. Buka lewat link yang kamu simpan ya." },
        { status: 404 }
      );
    }

    return NextResponse.json(confession);
  } catch (err) {
    console.error("GET /api/status/[senderKey] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat status." },
      { status: 500 }
    );
  }
}
