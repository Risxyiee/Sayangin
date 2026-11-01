import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const reportSchema = z.object({
  slug: z.string().trim().min(3).max(30),
});

// Penerima menekan "lapor" → naikkan reportCount.
// >=3 laporan: konten otomatis disembunyikan (lihat GET confess/letters)
// sampai direview pemilik situs.
export async function POST(req: NextRequest) {
  try {
    // anti-spam laporan: maks 8 per jam per IP
    const rl = await rateLimit(req, "report", 8, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak laporan. Coba lagi nanti ya." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    // body rusak / bukan JSON → 400 rapi (bukan 500 dari outer catch)
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Format request tidak valid" }, { status: 400 });
    }
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }
    const { slug } = parsed.data;

    const confession = await withDbRetry(() =>
      db.confession.findUnique({
        where: { slug },
        select: { id: true, reportCount: true },
      })
    );
    if (confession) {
      await withDbRetry(() =>
        db.confession.update({
          where: { id: confession.id },
          data: { reportCount: { increment: 1 } },
        })
      );
      return NextResponse.json({ ok: true });
    }

    const set = await withDbRetry(() =>
      db.letterSet.findUnique({
        where: { slug },
        select: { id: true },
      })
    );
    if (set) {
      await withDbRetry(() =>
        db.letterSet.update({
          where: { id: set.id },
          data: { reportCount: { increment: 1 } },
        })
      );
      return NextResponse.json({ ok: true });
    }

    const gift = await withDbRetry(() =>
      db.gift.findUnique({
        where: { slug },
        select: { id: true },
      })
    );
    if (gift) {
      await withDbRetry(() =>
        db.gift.update({
          where: { id: gift.id },
          data: { reportCount: { increment: 1 } },
        })
      );
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Kontennya nggak ketemu." },
      { status: 404 }
    );
  } catch (err) {
    console.error("POST /api/report error:", describeError(err), err);
    reportError(err, { route: "POST /api/report" });
    return NextResponse.json(
      { error: "Gagal mengirim laporan. Coba lagi ya." },
      { status: 500 }
    );
  }
}
