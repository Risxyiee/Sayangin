import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { makeSlug, makeToken } from "@/lib/token";

const confessSchema = z.object({
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama crush wajib diisi").max(40),
  message: z
    .string()
    .trim()
    .min(5, "Pesan minimal 5 karakter")
    .max(600, "Pesan maksimal 600 karakter"),
  theme: z.enum(["rose", "sunset", "midnight"]).optional().default("rose"),
});

const THEMES = new Set(["rose", "sunset", "midnight"]);

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 confess per 15 menit per IP
    const rl = rateLimit(req, "confess-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak confess. Coba lagi nanti 😅" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const parsed = confessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const { fromName, toName, message, theme } = parsed.data;

    // moderasi ringan sebelum masuk DB
    for (const field of [fromName, toName, message]) {
      const hit = findProhibited(field);
      if (hit) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }

    let slug = makeSlug();
    // pastikan unik
    for (let i = 0; i < 5; i++) {
      const exists = await db.confession.findUnique({ where: { slug } });
      if (!exists) break;
      slug = makeSlug();
    }

    const senderKey = makeToken(16);
    const confession = await db.confession.create({
      data: {
        slug,
        senderKey,
        fromName: fromName ?? "",
        toName,
        message,
        theme: THEMES.has(theme) ? theme : "rose",
      },
    });

    return NextResponse.json(
      { slug: confession.slug, id: confession.id, senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/confess error:", err);
    return NextResponse.json(
      { error: "Gagal membuat confess. Coba lagi ya." },
      { status: 500 }
    );
  }
}
