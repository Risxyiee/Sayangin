"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";

export type WallReactions = {
  heart: number;
  laugh: number;
  cry: number;
  bloom: number;
};

export type WallItem = {
  id: string;
  from: string;
  to: string;
  theme: string;
  createdAt: string;
  answered: boolean;
  reactions: WallReactions;
};

type ReactionType = keyof WallReactions;

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: "heart", emoji: "❤️", label: "gemes" },
  { type: "laugh", emoji: "😂", label: "ngakak" },
  { type: "cry", emoji: "😭", label: "baper" },
  { type: "bloom", emoji: "🌸", label: "manis" },
];

/* gradien mini per tema — mirror ringan dari CONFESS_THEMES (hindari import berat) */
const THEME_SWATCH: Record<string, string> = {
  rose: "from-[#4a0e2e] to-rose-500",
  sunset: "from-[#7c2d12] to-orange-400",
  midnight: "from-[#3b0764] to-purple-500",
  sakura: "from-[#7e2148] to-pink-400",
  matcha: "from-[#1f4d33] to-emerald-500",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });
}

export default function WallGrid({ items }: { items: WallItem[] }) {
  const [counts, setCounts] = useState<Record<string, WallReactions>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.reactions]))
  );
  const [failed, setFailed] = useState<string | null>(null);

  const react = async (id: string, type: ReactionType) => {
    // optimistic — angka naik dulu, server yang menentukan angka final
    setCounts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [type]: (prev[id]?.[type] ?? 0) + 1 },
    }));
    try {
      const res = await fetch("/api/wall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, type }),
      });
      if (!res.ok) throw new Error("gagal");
      const d = (await res.json()) as { reactions: WallReactions };
      setCounts((prev) => ({ ...prev, [id]: d.reactions }));
      setFailed(null);
    } catch {
      // rollback angka optimistis
      setCounts((prev) => ({
        ...prev,
        [id]: { ...prev[id], [type]: Math.max(0, (prev[id]?.[type] ?? 1) - 1) },
      }));
      setFailed(id);
    }
  };

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
        <p className="font-hand text-2xl text-[#e8b4bb]">
          Dindingnya masih sepi…
        </p>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/60">
          Jadi orang pertama yang berani. Surat kamu bisa tampil di sini —
          isinya tetap rahasia kok.
        </p>
        <Link
          href="/#confess"
          className="mt-6 inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
        >
          Tulis surat pertama
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, idx) => (
          <motion.article
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, delay: Math.min(idx * 0.04, 0.4) }}
            className="flex flex-col rounded-lg border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-colors hover:border-white/25"
          >
            {/* kepala kartu: chip tema + waktu */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`h-2.5 w-10 rounded-full bg-gradient-to-r ${
                  THEME_SWATCH[item.theme] ?? THEME_SWATCH.rose
                }`}
                aria-label={`Tema ${item.theme}`}
              />
              <time
                dateTime={item.createdAt}
                suppressHydrationWarning
                className="text-[11px] text-white/40"
              >
                {relTime(item.createdAt)}
              </time>
            </div>

            {/* dari → ke. ISI SURAT SENGAJA TIDAK DITAMPILKAN — itu intrigunya */}
            <p className="mt-4 font-hand text-xl leading-snug text-white">
              {item.from} <span className="text-white/40">→</span>{" "}
              <span className="text-[#e8b4bb]">{item.to}</span>
            </p>

            <p className="mt-1 text-[11px] uppercase tracking-wider text-white/35">
              {item.answered ? "udah dijawab" : "masih ditutup…"}
            </p>

            {/* reaksi */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-3">
              {REACTIONS.map((r) => (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => react(item.id, r.type)}
                  aria-label={`Reaksi ${r.label}`}
                  className="group flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70 transition hover:border-white/30 hover:bg-white/10 active:scale-95"
                >
                  <span aria-hidden>{r.emoji}</span>
                  <span className="tabular-nums">
                    {counts[item.id]?.[r.type] ?? 0}
                  </span>
                </button>
              ))}
            </div>
            {failed === item.id && (
              <p className="mt-2 text-[11px] text-[#e8b4bb]">
                reaksinya gagal terkirim — coba lagi ya
              </p>
            )}
          </motion.article>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-white/40">
        Isi surat tidak pernah ditampilkan di dinding — cuma nama &amp; tema.
        Cukup buat bikin penasaran. 😉
      </p>
    </>
  );
}
