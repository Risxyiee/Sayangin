import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

const reportSchema = z.object({
  slug: z.string().trim().min(3).max(30),
});

// Penerima menekan "lapor" → naikkan reportCount.
// >=3 laporan: konten otomatis disembunyikan (lihat GET confess/letters)
// sampai direview pemilik situs.
export async function POST(req: NextRequest) {
  try {
    // anti-spam laporan: maks 8 per jam per IP
    const rl = rateLimit(req, "report", 8, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak laporan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const parsed = reportSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const { slug } = parsed.data;

    const confession = await db.confession.findUnique({
      where: { slug },
      select: { id: true, reportCount: true },
    });
    if (confession) {
      await db.confession.update({
        where: { id: confession.id },
        data: { reportCount: { increment: 1 } },
      });
      return NextResponse.json({ ok: true });
    }

    const set = await db.letterSet.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (set) {
      await db.letterSet.update({
        where: { id: set.id },
        data: { reportCount: { increment: 1 } },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Kontennya nggak ketemu." },
      { status: 404 }
    );
  } catch (err) {
    console.error("POST /api/report error:", err);
    return NextResponse.json(
      { error: "Gagal mengirim laporan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
