import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { makeSlug, makeToken } from "@/lib/token";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { describeError } from "@/lib/log-error";

const letterSchema = z.object({
  title: z.string().trim().min(2, "Judul surat minimal 2 karakter").max(80),
  body: z.string().trim().min(5, "Isi surat minimal 5 karakter").max(600),
  unlockDays: z.number().int().min(0).max(84),
});

const createSchema = z.object({
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama penerima wajib diisi").max(40),
  theme: z.enum(["rose", "sunset", "midnight"]).optional().default("rose"),
  letters: z
    .array(letterSchema)
    .min(3, "Minimal 3 surat ya")
    .max(8, "Maksimal 8 surat"),
});

const THEMES = new Set(["rose", "sunset", "midnight"]);

export async function POST(req: NextRequest) {
  try {
    // anti-spam: maks 5 set surat per 15 menit per IP
    const rl = rateLimit(req, "letters-create", 5, 15 * 60 * 1000);
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Sabar ya — kamu udah bikin banyak set surat. Coba lagi nanti 😅" },
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
    const { fromName, toName, theme, letters } = parsed.data;

    // moderasi ringan: nama + semua judul & isi surat
    for (const field of [fromName, toName]) {
      if (findProhibited(field)) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }
    for (let i = 0; i < letters.length; i++) {
      const hit = findProhibited(`${letters[i].title} ${letters[i].body}`);
      if (hit) {
        return NextResponse.json(
          { error: `Surat #${i + 1} ada kata yang nggak boleh dipakai. Tolong ulang pakai bahasa yang baik ya 🙏` },
          { status: 400 }
        );
      }
    }

    let slug = makeSlug();
    for (let i = 0; i < 5; i++) {
      const exists = await db.letterSet.findUnique({ where: { slug } });
      if (!exists) break;
      slug = makeSlug();
    }

    // urutkan berdasarkan jeda unlock biar ordernya konsisten
    const sorted = [...letters].sort((a, b) => a.unlockDays - b.unlockDays);

    const set = await db.letterSet.create({
      data: {
        slug,
        senderKey: makeToken(16),
        fromName: fromName ?? "",
        toName,
        theme: THEMES.has(theme) ? theme : "rose",
        letters: {
          create: sorted.map((l, i) => ({
            order: i,
            title: l.title,
            body: l.body,
            unlockDays: l.unlockDays,
          })),
        },
      },
      select: { slug: true, id: true, senderKey: true },
    });

    return NextResponse.json(
      { slug: set.slug, id: set.id, senderKey: set.senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/letters error:", describeError(err), err);
    return NextResponse.json(
      { error: "Gagal membuat surat. Coba lagi ya." },
      { status: 500 }
    );
  }
}
