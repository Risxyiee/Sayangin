import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { makeSlug, makeToken } from "@/lib/token";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import {
  bouquetDataSchema,
  cakeDataSchema,
  couponsDataSchema,
  giftTexts,
  photoboxDataSchema,
  playlistDataSchema,
  GIFT_TYPES,
  type GiftType,
} from "@/lib/gift-data";
import { describeError } from "@/lib/log-error";

const createSchema = z.object({
  type: z.enum(GIFT_TYPES),
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama penerima wajib diisi").max(40),
  theme: z.enum(["rose", "sunset", "midnight"]).optional().default("rose"),
  data: z.unknown(),
});

const THEMES = new Set(["rose", "sunset", "midnight"]);

const DATA_SCHEMA: Record<GiftType, z.ZodTypeAny> = {
  bouquet: bouquetDataSchema,
  photobox: photoboxDataSchema,
  cake: cakeDataSchema,
  coupons: couponsDataSchema,
  playlist: playlistDataSchema,
};

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 kado per 15 menit per IP
    const rl = rateLimit(req, "gift-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak kado. Coba lagi nanti 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const { type, fromName, toName, theme } = parsed.data;

    // validasi konten sesuai tipe kado
    const dataParsed = DATA_SCHEMA[type as GiftType].safeParse(parsed.data.data);
    if (!dataParsed.success) {
      return NextResponse.json(
        { error: dataParsed.error.issues[0]?.message ?? "Isi kadonya belum lengkap" },
        { status: 400 }
      );
    }
    const data = dataParsed.data;

    // moderasi ringan: nama + semua teks di dalam kado
    for (const text of [fromName, toName, ...giftTexts(type, data)]) {
      if (findProhibited(text)) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }

    let slug = makeSlug();
    for (let i = 0; i < 5; i++) {
      const exists = await db.gift.findUnique({ where: { slug } });
      if (!exists) break;
      slug = makeSlug();
    }

    const gift = await db.gift.create({
      data: {
        slug,
        senderKey: makeToken(16),
        type,
        fromName: fromName ?? "",
        toName,
        theme: THEMES.has(theme) ? theme : "rose",
        data: JSON.stringify(data),
      },
      select: { slug: true, id: true, senderKey: true },
    });

    return NextResponse.json(
      { slug: gift.slug, id: gift.id, senderKey: gift.senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/gifts error:", describeError(err), err);
    return NextResponse.json(
      { error: "Gagal membuat kado. Coba lagi ya." },
      { status: 500 }
    );
  }
}
