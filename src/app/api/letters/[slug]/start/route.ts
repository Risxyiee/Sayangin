import { NextRequest, NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

// Penerima menekan "mulai" → jam mingguan mulai berdetak.
// Sengaja tombol eksplisit (bukan otomatis saat buka link) supaya
// pengirim bisa pratinjau tanpa menggeser jadwal buka suratnya.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const set = await withDbRetry(() =>
      db.letterSet.findUnique({
        where: { slug },
        select: { startedAt: true },
      })
    );
    if (!set) {
      return NextResponse.json({ error: "Suratnya nggak ketemu." }, { status: 404 });
    }

    const startedAt = set.startedAt ?? new Date();
    await withDbRetry(() =>
      db.letterSet.update({
        where: { slug },
        data: { startedAt: set.startedAt ?? startedAt },
      })
    );

    return NextResponse.json({ startedAt: startedAt.toISOString() });
  } catch (err) {
    console.error("POST /api/letters/[slug]/start error:", describeError(err), err);
    reportError(err, { route: "POST /api/letters/[slug]/start" });
    return NextResponse.json({ error: "Gagal memulai." }, { status: 500 });
  }
}
