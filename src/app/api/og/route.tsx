import { ImageResponse } from "next/og";
import { db } from "@/lib/db";

export const runtime = "nodejs";

// Kartu OG 1200x630 buat link kado yang di-share ke WA/Twitter.
// /api/og            → kartu generik (landing)
// /api/og?k=<slug>   → kartu personal ("Ada surat rahasia buat Sari")
// Catatan: tanpa emoji — satori butuh font emoji khusus, kita gambar hati pakai div.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const k = searchParams.get("k");

  let heading = "Ada yang sayang kamu";
  let sub = "Buka kejutannya sekarang — dari seseorang yang diam-diam perhatian";

  if (k) {
    try {
      const [confession, letterSet] = await Promise.all([
        db.confession.findUnique({ where: { slug: k }, select: { toName: true } }),
        db.letterSet.findUnique({
          where: { slug: k },
          select: { toName: true, _count: { select: { letters: true } } },
        }),
      ]);
      if (confession) {
        heading = `Ada surat rahasia buat ${confession.toName}`;
        sub = "Buka sekarang — siapa tahu dia juga punya perasaan yang sama";
      } else if (letterSet) {
        heading = `${letterSet._count.letters} surat kecil buat ${letterSet.toName}`;
        sub = "Satu surat bisa dibuka tiap minggu — pelan-pelan aja bacanya";
      }
    } catch {
      // gagal query → pakai kartu generik
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #2b0a1c 0%, #4a0e2e 55%, #160510 100%)",
          position: "relative",
        }}
      >
        {/* glow dekoratif */}
        <div
          style={{
            position: "absolute",
            top: -140,
            left: -100,
            width: 500,
            height: 500,
            borderRadius: 9999,
            background: "rgba(244,63,94,0.22)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -160,
            right: -80,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "rgba(236,72,153,0.16)",
          }}
        />

        {/* segel lilin: lingkaran + hati dari 2 lingkaran & kotak miring */}
        <div
          style={{
            display: "flex",
            width: 108,
            height: 108,
            borderRadius: 9999,
            background: "linear-gradient(135deg, #f43f5e, #be123c)",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 20px 60px rgba(244,63,94,0.45)",
          }}
        >
          <div style={{ position: "relative", width: 44, height: 40, display: "flex" }}>
            <div
              style={{
                position: "absolute",
                width: 22,
                height: 22,
                borderRadius: 9999,
                background: "#ffffff",
                left: 0,
                top: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 22,
                height: 22,
                borderRadius: 9999,
                background: "#ffffff",
                right: 0,
                top: 0,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 26,
                height: 26,
                background: "#ffffff",
                transform: "rotate(45deg)",
                left: 9,
                top: 11,
              }}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 42,
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -1,
            maxWidth: 1000,
            textAlign: "center",
            display: "flex",
          }}
        >
          {heading}
        </div>
        <div
          style={{
            marginTop: 18,
            fontSize: 30,
            color: "rgba(255,255,255,0.72)",
            maxWidth: 860,
            textAlign: "center",
            display: "flex",
          }}
        >
          {sub}
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 44,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 9999,
              background: "#f43f5e",
              marginRight: 12,
              display: "flex",
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700, color: "#ffffff", display: "flex" }}>
            sayang
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#f43f5e", display: "flex" }}>
            .in
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
