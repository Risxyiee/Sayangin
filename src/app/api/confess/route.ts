import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

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

function makeToken(length = 16): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < length; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

function makeSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = confessSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data tidak valid" },
        { status: 400 }
      );
    }
    const { fromName, toName, message, theme } = parsed.data;

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
