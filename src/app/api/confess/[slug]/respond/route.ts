import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

const respondSchema = z.object({
  response: z.enum(["yes", "later"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await req.json();
    const parsed = respondSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Respons tidak valid" },
        { status: 400 }
      );
    }

    const existing = await withDbRetry(() => db.confession.findUnique({ where: { slug } }));
    if (!existing) {
      return NextResponse.json(
        { error: "Confess tidak ditemukan." },
        { status: 404 }
      );
    }

    const updated = await withDbRetry(() =>
      db.confession.update({
        where: { slug },
        data: { response: parsed.data.response, respondedAt: new Date() },
        select: { slug: true, response: true },
      })
    );

    return NextResponse.json(updated);
  } catch (err) {
    console.error("POST /api/confess/[slug]/respond error:", describeError(err), err);
    reportError(err, { route: "POST /api/confess/[slug]/respond" });
    return NextResponse.json(
      { error: "Gagal menyimpan respons." },
      { status: 500 }
    );
  }
}
