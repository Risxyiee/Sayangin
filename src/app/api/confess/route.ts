import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { findProhibited, MODERATION_ERROR } from "@/lib/moderation";
import { makeSlug, makeToken } from "@/lib/token";
import { describeError } from "@/lib/log-error";
import { THEME_KEYS, THEME_INVALID_MESSAGE, isThemeSelectable } from "@/lib/themes";

const confessSchema = z.object({
  fromName: z.string().trim().max(40).optional().default(""),
  toName: z.string().trim().min(1, "Nama crush wajib diisi").max(40),
  message: z
    .string()
    .trim()
    .min(5, "Pesan minimal 5 karakter")
    .max(600, "Pesan maksimal 600 karakter"),
  // sumber tunggal tema: src/lib/themes.ts (UI & API pasti sinkron)
  theme: z.enum(THEME_KEYS).optional().default("rose"),
  // opt-in tampil di Dinding Kangenin (cuma nama & tema — isi surat tidak)
  isPublic: z.boolean().optional().default(false),
  // kirim terjadwal: ISO string, wajib masa depan, maks 30 hari ke depan
  unlockAt: z.string().datetime({ offset: true }).optional().nullable(),
});

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
      const issue = parsed.error.issues[0];
      const isTheme = issue?.path[0] === "theme";
      return NextResponse.json(
        { error: isTheme ? THEME_INVALID_MESSAGE : (issue?.message ?? "Data tidak valid") },
        { status: 400 }
      );
    }
    const { fromName, toName, message, theme, isPublic, unlockAt } = parsed.data;

    // tema edisi terbatas yang sudah lewat tidak boleh dipakai walau client
    // lawas masih mengirimnya
    if (!isThemeSelectable(theme)) {
      return NextResponse.json(
        { error: "Tema itu sudah tutup — udah lewat masa edisinya. Pilih tema lain ya." },
        { status: 400 }
      );
    }

    // moderasi ringan sebelum masuk DB
    for (const field of [fromName, toName, message]) {
      const hit = findProhibited(field);
      if (hit) {
        return NextResponse.json({ error: MODERATION_ERROR }, { status: 400 });
      }
    }

    // validasi jadwal buka: masa depan, maksimal 30 hari
    let unlock: Date | null = null;
    if (unlockAt) {
      const d = new Date(unlockAt);
      const now = Date.now();
      if (Number.isNaN(d.getTime()) || d.getTime() < now + 60_000) {
        return NextResponse.json(
          { error: "Jadwal buka harus minimal 1 menit dari sekarang." },
          { status: 400 }
        );
      }
      if (d.getTime() > now + 30 * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "Jadwal buka maksimal 30 hari ke depan ya." },
          { status: 400 }
        );
      }
      unlock = d;
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
        theme,
        isPublic,
        ...(unlock ? { unlockAt: unlock } : {}),
      },
    });

    return NextResponse.json(
      { slug: confession.slug, id: confession.id, senderKey },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/confess error:", describeError(err), err);
    return NextResponse.json(
      { error: "Gagal membuat confess. Coba lagi ya." },
      { status: 500 }
    );
  }
}
