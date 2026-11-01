import { NextResponse } from "next/server";
import { db, withDbRetry } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

export const runtime = "nodejs";

// Penghitung sosial buat FOMO: "X surat rahasia udah terkirim lewat sini".
// Cache in-memory 60 detik — cukup akurat, hemat query, dan aman buat
// isolate Cloudflare Workers (cache per-isolate, reset saat isolate tidur).
let cache: { data: StatsPayload; at: number } | null = null;
const TTL_MS = 60_000;

type StatsPayload = {
  confessions: number;
  letters: number;
  gifts: number;
  kados: number;
  total: number;
  // penanda waktu supaya UI bisa memformat ulang tanpa hydration mismatch
  generatedAt: string;
};

export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json(cache.data, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  }

  try {
    const [confessions, letters, gifts, kados] = await withDbRetry(() =>
      Promise.all([
        db.confession.count(),
        db.letterSet.count(),
        db.gift.count(),
        db.kado.count(),
      ])
    );
    const data: StatsPayload = {
      confessions,
      letters,
      gifts,
      kados,
      total: confessions + letters + gifts + kados,
      generatedAt: new Date().toISOString(),
    };
    cache = { data, at: Date.now() };
    return NextResponse.json(data, {
      headers: { "Cache-Control": "public, max-age=30" },
    });
  } catch (err) {
    console.error("GET /api/stats error:", describeError(err), err);
    reportError(err, { route: "GET /api/stats" });
    // DB gagal → jangan tampilkan angka palsu, biarkan UI pakai fallback
    return NextResponse.json(
      { error: "statistik tidak tersedia" },
      { status: 503 }
    );
  }
}
