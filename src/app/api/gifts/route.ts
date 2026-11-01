import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry, isUniqueViolation } from "@/lib/db";
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
  timelineDataSchema,
  GIFT_TYPES,
  type GiftType,
} from "@/lib/gift-data";
import { THEME_KEYS, THEME_INVALID_MESSAGE } from "@/lib/themes";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const createSchema = z.object({
  type: z.enum(GIFT_TYPES),
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama penerima wajib diisi").max(40),
  // sumber tunggal tema: src/lib/themes.ts (UI & API pasti sinkron)
  theme: z.enum(THEME_KEYS).optional().default("rose"),
  data: z.unknown(),
});

const THEMES = new Set<string>(THEME_KEYS);

const DATA_SCHEMA: Record<GiftType, z.ZodTypeAny> = {
  bouquet: bouquetDataSchema,
  photobox: photoboxDataSchema,
  cake: cakeDataSchema,
  coupons: couponsDataSchema,
  playlist: playlistDataSchema,
  timeline: timelineDataSchema,
};

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 kado per 15 menit per IP
    const rl = await rateLimit(req, "gift-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak kado. Coba lagi nanti 😅" },
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
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const isTheme = issue?.path[0] === "theme";
      return NextResponse.json(
        { error: isTheme ? THEME_INVALID_MESSAGE : (issue?.message ?? "Data tidak valid") },
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

    // withDbRetry: kalau kena koneksi zombie Hyperdrive, ulang sekali di
    // koneksi baru — pengguna tidak melihat errornya.
    // TANPA pre-check findUnique(slug) — query pre-check yang NULL ter-cache
    // Hyperdrive sebelum baris dibuat → GET sesaat usai create 404 (insiden
    // null-read 2026-11-01). Uniqueness ditangani catch P2002 di bawah.
    const gift = await withDbRetry(async () => {
      for (let i = 0; i < 5; i++) {
        try {
          return await db.gift.create({
            data: {
              slug: makeSlug(),
              senderKey: makeToken(16),
              type,
              fromName: fromName ?? "",
              toName,
              theme: THEMES.has(theme) ? theme : "rose",
              data: JSON.stringify(data),
            },
            select: { slug: true, id: true, senderKey: true },
          });
        } catch (err) {
          if (isUniqueViolation(err) && i < 4) continue; // slug tabrakan — regenerate
          throw err;
        }
      }
      throw new Error("gagal membuat slug unik setelah 5 percobaan");
    });

    return NextResponse.json(
      { slug: gift.slug, id: gift.id, senderKey: gift.senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/gifts error:", describeError(err), err);
    reportError(err, { route: "POST /api/gifts" });
    return NextResponse.json(
      { error: "Gagal membuat kado. Coba lagi ya." },
      { status: 500 }
    );
  }
}
