import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { describeError } from "@/lib/log-error";
import WallGrid, { type WallItem } from "@/components/wall/WallGrid";

// Dinding Kangenin: feed publik yang bisa diindeks Google — mesin
// discovery + FOMO ("orang lain udah berani, kamu kapan?").
export const metadata: Metadata = {
  title: "Dinding Kangenin — yang barusan berani ngirim",
  description:
    "Confess yang barusan dikirim orang-orang berani. Isi suratnya tetap rahasia — cuma nama & temanya yang kelihatan. Kapan giliranmu?",
  openGraph: {
    title: "Dinding Kangenin — yang barusan berani ngirim",
    description:
      "Isi suratnya rahasia, namanya yang kelihatan. Lihat yang barusan berani — lalu tulis versimu sendiri.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
};

// revalidate tiap 60 detik — dinding terasa hidup tanpa biaya render
export const revalidate = 60;

async function getWallItems(): Promise<{ items: WallItem[]; dbError: boolean }> {
  try {
    const rows = await db.confession.findMany({
      where: { isPublic: true, reportCount: { lt: 3 } },
      orderBy: { createdAt: "desc" },
      take: 48,
      select: {
        id: true,
        fromName: true,
        toName: true,
        theme: true,
        createdAt: true,
        response: true,
        reactions: {
          select: { heart: true, laugh: true, cry: true, bloom: true },
        },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        from: r.fromName.trim() || "Seseorang",
        to: r.toName,
        theme: r.theme,
        createdAt: r.createdAt.toISOString(),
        answered: r.response !== null && r.response !== undefined,
        reactions: r.reactions ?? { heart: 0, laugh: 0, cry: 0, bloom: 0 },
      })),
      dbError: false,
    };
  } catch (err) {
    console.error("GET /dinding error:", describeError(err), err);
    return { items: [], dbError: true };
  }
}

export default async function DindingPage() {
  const { items } = await getWallItems();

  return (
    <div className="flex min-h-screen flex-col bg-[#211d1a]">
      {/* header mini */}
      <header className="border-b border-white/10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="flex items-baseline gap-0.5"
            aria-label="Kangenin - beranda"
          >
            <span className="font-display text-xl font-bold tracking-tight text-white">
              kangen<span className="text-primary">in</span>
            </span>
          </Link>
          <Link
            href="/#confess"
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-neutral-900 transition-colors hover:bg-white/90"
          >
            Tulis surat
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* band pembuka */}
        <section className="relative overflow-hidden py-16 text-center sm:py-20">
          <div
            className="absolute inset-0 opacity-[0.06]"
            aria-hidden
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
            }}
          />
          <div className="relative z-10 mx-auto max-w-2xl px-4">
            <p className="kicker !text-[#d9a0a6]">Dinding Kangenin</p>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-white sm:text-5xl">
              Yang barusan <em className="text-[#e8b4bb]">berani</em> ngirim.
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/60">
              Isi suratnya{" "}
              <b className="text-white">tidak pernah kelihatan</b> — cuma
              nama, tema, dan reaksi orang. Persis bikin penasaran kan? Itu
              gunanya.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/#confess"
                className="w-full rounded-md bg-primary px-7 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-[#b52743] sm:w-auto"
              >
                Tulis versimu sendiri — gratis
              </Link>
              <Link
                href="/#kejutan"
                className="w-full rounded-md border border-white/25 px-7 py-3.5 text-center text-sm font-semibold text-white/90 transition-colors hover:border-white/50 hover:text-white sm:w-auto"
              >
                Lihat kado digital
              </Link>
            </div>
          </div>
        </section>

        {/* grid surat */}
        <section className="pb-24" aria-label="Daftar surat terakhir">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <WallGrid items={items} />
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-white/40 sm:flex-row sm:px-6">
          <span>
            kangen<span className="text-primary">in</span> — bikin dia
            kangen sama kamu
          </span>
          <div className="flex gap-4">
            <Link href="/" className="transition-colors hover:text-white">
              Beranda
            </Link>
            <Link href="/bantuan" className="transition-colors hover:text-white">
              Bantuan
            </Link>
            <Link href="/privasi" className="transition-colors hover:text-white">
              Privasi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
