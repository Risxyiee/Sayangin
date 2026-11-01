import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, dbNonce } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import type { CouponsData, GiftProgress } from "@/lib/gift-data";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const redeemSchema = z.object({
  index: z.number().int().min(0).max(9),
});

// Penerima memakai kupon: POST /api/gifts/<slug>/redeem { index }
// Kupon yang sudah dipakai nggak bisa dipakai lagi (tercatat di Gift.progress).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // anti-spam: maks 30 penukaran per jam per IP
    const rl = await rateLimit(req, "gift-redeem", 30, 60 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Terlalu banyak coba-coba. Coba lagi nanti ya." },
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
    const parsed = redeemSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    // Baca anti-cache (read-after-write): progress kupon baru saja bisa
    // ditulis penerima; cache Hyperdrive bisa menyajikan progress lama →
    // kupon yang sudah terpakai bisa ditukar dua kali. Nonce → ke origin.
    const nc = dbNonce();
    const giftRows = await withDbRetry(() =>
      db.$queryRaw<Array<{ id: string; type: string; data: string; progress: string }>>`
        SELECT "id", "type", "data", "progress" FROM "Gift" WHERE "slug" = ${slug} /* nc-${nc} */`
    );
    const gift = giftRows[0];
    if (!gift) {
      return NextResponse.json(
        { error: "Kadonya nggak ketemu." },
        { status: 404 }
      );
    }
    if (gift.type !== "coupons") {
      return NextResponse.json(
        { error: "Kado ini bukan kupon." },
        { status: 400 }
      );
    }

    let data: CouponsData = { coupons: [] };
    try {
      data = JSON.parse(gift.data) as CouponsData;
    } catch {
      /* dibiarkan kosong */
    }
    let progress: GiftProgress = {};
    try {
      progress = JSON.parse(gift.progress) as GiftProgress;
    } catch {
      progress = {};
    }
    const redeemed = { ...(progress.redeemed ?? {}) };
    const { index } = parsed.data;

    if (index >= data.coupons.length) {
      return NextResponse.json(
        { error: "Kuponnnya nggak ada." },
        { status: 400 }
      );
    }
    if (redeemed[String(index)]) {
      return NextResponse.json(
        { error: "Kupon ini udah pernah dipakai." },
        { status: 400 }
      );
    }

    redeemed[String(index)] = new Date().toISOString();
    const next: GiftProgress = { redeemed };

    await withDbRetry(() =>
      db.gift.update({
        where: { slug },
        data: { progress: JSON.stringify(next) },
      })
    );

    return NextResponse.json({ ok: true, progress: next });
  } catch (err) {
    console.error("POST /api/gifts/[slug]/redeem error:", describeError(err), err);
    reportError(err, { route: "POST /api/gifts/[slug]/redeem" });
    return NextResponse.json(
      { error: "Gagal memakai kupon. Coba lagi ya." },
      { status: 500 }
    );
  }
}
