"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Scissors,
  Ticket,
  Wind,
} from "lucide-react";
import { CONFESS_THEMES, FallingPieces } from "@/components/confess/ConfessionView";
import { FLOWERS, type GiftProgress } from "@/lib/gift-data";

type BouquetData = { card: string; flowers: string[] };
type PhotoboxData = { caption: string; note: string; photos: string[] };
type CakeData = { occasion: string; message: string };
type CouponsData = { coupons: { title: string; desc?: string }[] };
type PlaylistSong = { title: string; artist?: string; note?: string; link?: string };
type PlaylistData = { title: string; message: string; songs: PlaylistSong[] };

type GiftPayload = {
  slug: string;
  type: string;
  fromName: string;
  toName: string;
  theme: string;
  data: BouquetData | PhotoboxData | CakeData | CouponsData | PlaylistData;
  progress: GiftProgress;
  views: number;
  preview?: boolean;
};

type Stage = "loading" | "error" | "hidden" | "intro" | "main";

/* PRNG deterministik (pola sama dgn view lain — hindari hydration mismatch) */
function rnd(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/* ============ 1. BUKET BUNGA ============ */
function BouquetMain({ data, senderName }: { data: BouquetData; senderName: string }) {
  const flowers = data.flowers.slice(0, 9);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center"
    >
      <p className="font-hand text-3xl text-rose-100">Buket buat kamu 🌷</p>

      {/* buket: kertas bungkus + bunga naik satu-satu */}
      <div className="relative mt-8 h-72 w-64" aria-hidden>
        {/* bunga */}
        {flowers.map((f, i) => {
          const n = flowers.length;
          const angle = n === 1 ? 0 : (i / (n - 1)) * 130 - 65; // kipas -65..65°
          const rad = (angle * Math.PI) / 180;
          const x = 50 + Math.sin(rad) * 38; // % posisi horizontal
          const lift = Math.cos(rad) * 44; // makin tengah makin tinggi
          const emoji =
            FLOWERS[f as keyof typeof FLOWERS]?.emoji ?? "🌷";
          return (
            <div
              key={`${f}-${i}`}
              className="absolute bottom-24"
              style={{
                left: `${x}%`,
                animation: `gift-stem-rise 0.9s cubic-bezier(0.22,1,0.36,1) ${0.15 + i * 0.18}s both`,
                transform: `translateX(-50%) translateY(-${lift}px)`,
                zIndex: 10 + i,
              }}
            >
              <div
                className="mx-auto mb-[-4px] h-10 w-1 rounded bg-emerald-400/80"
                style={{ transform: `rotate(${angle * 0.25}deg)` }}
              />
              <span className="block text-[42px] leading-none drop-shadow-lg" style={{ transform: `rotate(${angle * 0.4}deg)` }}>
                {emoji}
              </span>
            </div>
          );
        })}
        {/* kertas bungkus */}
        <div
          className="absolute bottom-2 left-1/2 h-36 w-48 -translate-x-1/2 bg-gradient-to-b from-rose-200 to-rose-300 shadow-2xl"
          style={{ clipPath: "polygon(0 14%, 100% 0, 86% 100%, 14% 100%)" }}
        />
        <div
          className="absolute bottom-2 left-1/2 h-36 w-48 -translate-x-1/2 bg-white/40"
          style={{ clipPath: "polygon(0 14%, 50% 0, 50% 100%, 14% 100%)" }}
        />
        {/* pita */}
        <div className="absolute bottom-8 left-1/2 z-20 h-3.5 w-24 -translate-x-1/2 rounded-full bg-rose-500 shadow-lg" />
        <div className="absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
          <div className="relative h-4 w-4 rotate-45 rounded-sm bg-rose-600 shadow" />
        </div>
        {/* kelip */}
        {[
          { l: "8%", t: "12%", d: "1.6s" },
          { l: "88%", t: "20%", d: "2.4s" },
          { l: "70%", t: "4%", d: "3s" },
        ].map((s, i) => (
          <span
            key={i}
            className="absolute text-sm"
            style={{ left: s.l, top: s.t, animation: `sparkle-pop 3.6s ease ${s.d} infinite` }}
          >
            ✨
          </span>
        ))}
      </div>

      {/* kartu ucapan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 + flowers.length * 0.18, duration: 0.5 }}
        className="grain mt-6 w-full rounded-2xl bg-[#fffaf5] p-6 text-left shadow-2xl"
      >
        <p className="whitespace-pre-wrap font-hand text-xl leading-7 text-rose-950">
          {data.card}
        </p>
        <p className="mt-4 text-right font-hand text-lg text-rose-500">— {senderName}</p>
      </motion.div>
    </motion.div>
  );
}

/* ============ 2. KUE TIUP LILIN ============ */
const CAKE_HEADLINE: Record<string, string> = {
  ultah: "Selamat ulang tahun",
  anniversary: "Selamat anniversary",
  graduasi: "Congrats wisudanya",
};

function CakeMain({ data, toName, senderName }: { data: CakeData; toName: string; senderName: string }) {
  const [lit, setLit] = useState(true);
  const headline = CAKE_HEADLINE[data.occasion] ?? CAKE_HEADLINE.ultah;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center"
    >
      <p className="font-hand text-3xl text-rose-100">
        {headline}, {toName}! 🎉
      </p>

      <div className="relative mt-6 flex h-56 w-full flex-col items-center justify-end">
        {/* api / asap */}
        <div className="absolute bottom-44 flex gap-7">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative h-12 w-2.5">
              {lit ? (
                <span
                  className="absolute -top-4 left-1/2 h-5 w-3 -translate-x-1/2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_16px_4px_rgba(251,191,36,0.55)]"
                  style={{ animation: `flame-flicker 0.35s ease-in-out ${i * 0.12}s infinite` }}
                />
              ) : (
                <span
                  className="absolute -top-8 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-gray-300/70 blur-[3px]"
                  style={{ animation: "smoke-rise 1.6s ease-out infinite", animationDelay: `${i * 0.3}s` }}
                />
              )}
              <span className="absolute bottom-0 left-1/2 h-10 w-2 -translate-x-1/2 rounded-sm bg-gradient-to-b from-rose-200 to-rose-300" />
            </div>
          ))}
        </div>
        {/* kue */}
        <div className="w-48">
          <div className="mx-auto h-9 w-48 rounded-t-md bg-gradient-to-b from-pink-300 to-pink-400" />
          <div className="relative mx-auto h-11 w-44 rounded-t-md bg-gradient-to-b from-rose-300 to-rose-400">
            {[8, 30, 62, 84].map((l, i) => (
              <div key={i} className="absolute -top-1 h-3.5 w-3 rounded-b-full bg-rose-200" style={{ left: `${l}%` }} />
            ))}
          </div>
          <div className="mx-auto h-10 w-40 rounded-b-xl bg-gradient-to-b from-rose-400 to-rose-500 shadow-lg" />
          <div className="mx-auto mt-1 h-2 w-44 rounded-full bg-black/30 blur-sm" />
        </div>
      </div>

      {lit ? (
        <>
          <p className="mt-6 text-sm text-white/70">pejamkan mata, bikin permintaan dulu…</p>
          <Button
            size="lg"
            onClick={() => setLit(false)}
            className="mt-4 rounded-full bg-rose-500 px-8 text-base font-semibold shadow-lg shadow-rose-500/30 transition hover:scale-105 hover:bg-rose-600"
          >
            <Wind className="mr-2 h-5 w-5" /> Tiup lilinnya 💨
          </Button>
        </>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-6 w-full"
        >
          <p className="text-center font-hand text-xl text-amber-200">
            yeay! semoga semua permintaannya terkabul ✨
          </p>
          <div className="grain mt-4 w-full rounded-2xl bg-[#fffaf5] p-6 text-left shadow-2xl">
            <p className="whitespace-pre-wrap font-hand text-xl leading-7 text-rose-950">
              {data.message}
            </p>
            <p className="mt-4 text-right font-hand text-lg text-rose-500">— {senderName}</p>
          </div>
        </motion.div>
      )}
      <FallingPieces active={!lit} kind="confetti" />
    </motion.div>
  );
}

/* ============ 3. PHOTOBOX ============ */
function PhotoboxMain({ data, toName, senderName }: { data: PhotoboxData; toName: string; senderName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center"
    >
      <p className="font-hand text-3xl text-rose-100">Buat {toName} 📸</p>

      {/* strip foto gaya photobooth */}
      <motion.div
        initial={{ y: -60, rotate: -6, opacity: 0 }}
        animate={{ y: 0, rotate: -3, opacity: 1 }}
        transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.2 }}
        className="mt-8 w-56 rounded-lg bg-white p-3 pb-14 shadow-2xl"
      >
        <p className="pb-2 text-center text-[10px] font-bold tracking-[0.25em] text-neutral-400">
          SAYANG.IN ✦ {new Date().getFullYear()}
        </p>
        <div className="space-y-2">
          {data.photos.map((src, i) => (
            <motion.img
              key={i}
              src={src}
              alt={`Foto kenangan ${i + 1}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.25, duration: 0.4 }}
              className="aspect-[4/3] w-full rounded-sm object-cover"
              style={{ transform: `rotate(${i % 2 === 0 ? -0.8 : 0.8}deg)` }}
            />
          ))}
        </div>
        <p className="mt-2 text-center font-hand text-lg leading-5 text-neutral-700">
          {data.caption}
        </p>
      </motion.div>

      {data.note && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.4, duration: 0.5 }}
          className="grain mt-6 w-full rounded-2xl bg-[#fffaf5] p-5 text-left shadow-2xl"
        >
          <p className="whitespace-pre-wrap font-hand text-lg leading-7 text-rose-950">
            {data.note}
          </p>
          <p className="mt-3 text-right font-hand text-lg text-rose-500">— {senderName}</p>
        </motion.div>
      )}
      <p className="mt-5 text-xs text-white/50">
        tekan-tahan fotonya buat simpan ke galeri ya 🤳
      </p>
    </motion.div>
  );
}

/* ============ 4. LOVE COUPONS ============ */
function CouponsMain({
  data,
  toName,
  senderName,
  progress,
  onRedeem,
  slug,
}: {
  data: CouponsData;
  toName: string;
  senderName: string;
  progress: GiftProgress;
  onRedeem: (index: number) => Promise<boolean>;
  slug: string;
}) {
  const redeemed = progress.redeemed ?? {};
  const usedCount = Object.keys(redeemed).length;
  const [confirming, setConfirming] = useState<number | null>(null);
  const [busyIdx, setBusyIdx] = useState<number | null>(null);
  const [err, setErr] = useState("");

  const use = async (i: number) => {
    setErr("");
    setBusyIdx(i);
    const ok = await onRedeem(i);
    setBusyIdx(null);
    setConfirming(null);
    if (!ok) setErr("Gagal memakai kupon — coba lagi ya.");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center"
    >
      <p className="font-hand text-3xl text-rose-100">Love Coupons 🎫</p>
      <p className="mt-1 text-sm text-white/60">
        buat {toName} — dari {senderName}
      </p>

      <div className="mt-4 flex items-center gap-2 text-xs text-amber-200">
        <Ticket className="h-3.5 w-3.5" />
        {usedCount} dari {data.coupons.length} kupon sudah dipakai
      </div>

      <div className="mt-5 w-full space-y-3">
        {data.coupons.map((c, i) => {
          const usedAt = redeemed[String(i)];
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className={`relative overflow-hidden rounded-xl border-2 border-dashed bg-white shadow-xl transition ${
                usedAt ? "border-emerald-300 opacity-90" : "border-rose-400"
              }`}
            >
              <div className="flex items-center justify-between bg-rose-500 px-3 py-1.5">
                <span className="text-[9px] font-bold tracking-widest text-white">
                  SAYANG.IN CO.
                </span>
                <span className="text-[9px] font-bold text-white">NO. {String(i + 1).padStart(2, "0")}</span>
              </div>
              <div className="relative px-4 py-4 text-left">
                <p className={`font-hand text-2xl leading-6 ${usedAt ? "text-emerald-600 line-through decoration-emerald-400/60" : "text-rose-700"}`}>
                  {c.title}
                </p>
                {c.desc && <p className="mt-1 text-xs leading-4 text-rose-950/60">{c.desc}</p>}
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-rose-400">
                  {usedAt
                    ? `dipakai ${new Date(usedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
                    : "berlaku kapan pun kamu minta"}
                </p>

                {/* stempel DIPAKAI */}
                {usedAt && (
                  <motion.div
                    initial={{ scale: 2.2, opacity: 0, rotate: -18 }}
                    animate={{ scale: 1, opacity: 1, rotate: -12 }}
                    transition={{ type: "spring", stiffness: 300, damping: 16 }}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border-2 border-emerald-500 px-2 py-0.5 text-xs font-black tracking-widest text-emerald-600"
                  >
                    DIPAKAI
                  </motion.div>
                )}

                {!usedAt && confirming !== i && (
                  <button
                    type="button"
                    onClick={() => setConfirming(i)}
                    className="mt-3 w-full rounded-full bg-rose-500 py-2 text-xs font-bold text-white shadow transition hover:bg-rose-600"
                  >
                    🎫 Pakai kupon ini
                  </button>
                )}
                {!usedAt && confirming === i && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={busyIdx === i}
                      onClick={() => use(i)}
                      className="flex-1 rounded-full bg-emerald-500 py-2 text-xs font-bold text-white shadow transition hover:bg-emerald-600 disabled:opacity-60"
                    >
                      {busyIdx === i ? "memroses…" : "Yakin, pakai!"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirming(null)}
                      className="rounded-full border border-rose-200 px-4 py-2 text-xs font-semibold text-rose-500 transition hover:bg-rose-50"
                    >
                      nanti dulu
                    </button>
                  </div>
                )}

                <span className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#160510]" />
                <span className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[#160510]" />
                <Scissors className="absolute right-3 top-2 h-3 w-3 text-rose-200" aria-hidden />
              </div>
            </motion.div>
          );
        })}
      </div>

      {err && <p className="mt-3 text-xs text-amber-300">{err}</p>}
      <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
        Tunjukin kupon yang udah dicaput ke {senderName === "Seseorang" ? "pengirimnya" : senderName} —
        berlaku sampai kapan pun 💗
      </p>
      <span className="sr-only">kupon cinta {slug}</span>
    </motion.div>
  );
}

/* ============ 5. PLAYLIST KITA ============ */
function ytLink(song: PlaylistSong): string {
  if (song.link) return song.link;
  const q = [song.title, song.artist].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

function PlaylistMain({
  data,
  toName,
  senderName,
}: {
  data: PlaylistData;
  toName: string;
  senderName: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex w-full flex-col items-center"
    >
      <p className="font-hand text-3xl text-rose-100">{data.title} 🎵</p>
      <p className="mt-1 text-sm text-white/60">
        buat {toName} — dari {senderName}
      </p>

      {/* piringan hitam berputar + equalizer */}
      <div className="mt-7 flex items-center justify-center gap-6" aria-hidden>
        <div className="relative h-28 w-28 shrink-0 anim-spin-slow">
          <div
            className="h-full w-full rounded-full bg-neutral-900 shadow-2xl"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle at center, #1c1c1c 0 2px, #2b2b2b 2px 4px)",
            }}
          />
          <div className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-rose-500">
            <span className="text-sm">♥</span>
            <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900" />
          </div>
        </div>
        <div className="flex items-end gap-1 pb-1">
          {[0.9, 0.5, 1.1, 0.7, 1.3, 0.6].map((d, i) => (
            <span
              key={i}
              className="w-1.5 origin-bottom rounded-t bg-rose-400"
              style={{ height: 16 + i * 3, animation: `eq-bounce ${d}s ease-in-out infinite` }}
            />
          ))}
        </div>
      </div>

      {/* daftar lagu — tap buat dengerin */}
      <div className="mt-7 w-full space-y-2.5">
        {data.songs.map((s, i) => {
          const on = active === i;
          return (
            <motion.a
              key={`${s.title}-${i}`}
              href={ytLink(s)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setActive(i)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.07 }}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-left shadow-lg transition ${
                on ? "bg-white ring-2 ring-rose-400" : "bg-white/90 hover:bg-white"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                  on ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-600"
                }`}
              >
                {on ? "♪" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-rose-950">{s.title}</span>
                {s.artist && (
                  <span className="block truncate text-xs text-rose-950/50">{s.artist}</span>
                )}
                {s.note && (
                  <span className="mt-0.5 block font-hand text-[13px] leading-4 text-rose-500">
                    “{s.note}”
                  </span>
                )}
              </span>
              <span className={`shrink-0 text-base ${on ? "text-rose-500" : "text-rose-300"}`}>
                {on ? "🔊" : "▶"}
              </span>
            </motion.a>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-white/50">
        tap lagunya buat dengerin di YouTube/Spotify 🎧
      </p>

      {/* catatan penutup */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="grain mt-5 w-full rounded-2xl bg-[#fffaf5] p-6 text-left shadow-2xl"
      >
        <p className="whitespace-pre-wrap font-hand text-xl leading-7 text-rose-950">
          {data.message}
        </p>
        <p className="mt-4 text-right font-hand text-lg text-rose-500">— {senderName}</p>
      </motion.div>
    </motion.div>
  );
}

/* ---------- wrapper kado (amplop kado) ---------- */
function GiftBox({ emoji }: { emoji: string }) {
  return (
    <div className="relative h-40 w-40" aria-hidden>
      <div className="absolute bottom-0 left-1/2 h-28 w-28 -translate-x-1/2 rounded-xl bg-gradient-to-br from-rose-400 to-rose-600 shadow-2xl" />
      {/* pita vertikal & horizontal */}
      <div className="absolute bottom-0 left-1/2 h-28 w-6 -translate-x-1/2 rounded-xl bg-rose-300/80" />
      <div className="absolute bottom-14 left-1/2 h-6 w-28 -translate-x-1/2 bg-rose-300/80" />
      {/* pita atas */}
      <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-1">
        <div className="h-6 w-7 -rotate-[24deg] rounded-full bg-rose-300" />
        <div className="h-6 w-7 rotate-[24deg] rounded-full bg-rose-300" />
      </div>
      <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-4xl anim-float">{emoji}</span>
    </div>
  );
}

/* ---------- pengalaman fullscreen kado digital ---------- */
export default function GiftView({
  slug,
  previewKey,
}: {
  slug: string;
  previewKey?: string;
}) {
  const [data, setData] = useState<GiftPayload | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [isPreview, setIsPreview] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "done">("idle");

  useEffect(() => {
    let alive = true;
    fetch(`/api/gifts/${slug}${previewKey ? `?p=${previewKey}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const d: GiftPayload = await r.json();
        if (!alive) return;
        if (d.hidden) {
          setStage("hidden");
          return;
        }
        setIsPreview(!!d.preview);
        setData(d);
        setStage("intro");
      })
      .catch(() => alive && setStage("error"));
    return () => {
      alive = false;
    };
  }, [slug, previewKey]);

  const theme = CONFESS_THEMES[data?.theme ?? "rose"] ?? CONFESS_THEMES.rose;
  const senderName = data?.fromName?.trim() || "Seseorang";
  const giftEmoji = useMemo(() => {
    switch (data?.type) {
      case "bouquet": return "💐";
      case "photobox": return "📸";
      case "cake": return "🎂";
      case "coupons": return "🎫";
      case "playlist": return "🎵";
      default: return "🎁";
    }
  }, [data?.type]);

  const redeem = async (index: number): Promise<boolean> => {
    if (!data) return false;
    try {
      const res = await fetch(`/api/gifts/${slug}/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) return false;
      const d = await res.json();
      setData({ ...data, progress: d.progress });
      return true;
    } catch {
      return false;
    }
  };

  const sendReport = async () => {
    if (reportState === "done") return;
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch {
      /* server yang hitung */
    }
    setReportState("done");
  };

  return (
    <div className={`fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-b ${theme.bg}`}>
      <FallingPieces active={stage === "main"} kind="hearts" />

      {/* banner mode pratinjau */}
      {isPreview && (
        <div className="fixed bottom-4 left-1/2 z-[110] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-[#3a2410]/90 px-4 py-2.5 text-xs text-amber-100 shadow-xl backdrop-blur">
            <span aria-hidden>👀</span>
            <span className="flex-1">
              Pratinjau — hitungan &amp; status <b>gak tercatat</b>.
            </span>
            <a
              href={`/?s=${previewKey}`}
              className="shrink-0 font-bold text-amber-300 underline underline-offset-2"
            >
              ke pantauan →
            </a>
          </div>
        </div>
      )}

      <div className="relative z-50 mx-auto flex min-h-full w-full max-w-md flex-col items-center px-4 py-12 text-center">
        {/* LOADING */}
        {stage === "loading" && (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
            <p className="text-sm text-white/70">Menyiapkan kadonya...</p>
          </div>
        )}

        {/* ERROR */}
        {stage === "error" && (
          <div className="rounded-2xl bg-white/10 p-8 text-white backdrop-blur">
            <div className="text-5xl">🥲</div>
            <h2 className="mt-4 text-xl font-bold">Kadonya nggak ketemu</h2>
            <p className="mt-2 text-sm text-white/70">
              Link-nya mungkin salah atau sudah dihapus.
            </p>
            <Button
              className="mt-6 rounded-full bg-rose-500 hover:bg-rose-600"
              onClick={() => (window.location.href = "/")}
            >
              Ke Sayang.in
            </Button>
          </div>
        )}

        {/* KONTEN DILAPORKAN */}
        {stage === "hidden" && (
          <div className="rounded-2xl bg-white/10 p-8 text-white backdrop-blur">
            <div className="text-5xl">🕵️</div>
            <h2 className="mt-4 text-xl font-bold">Kadonya lagi ditinjau</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Konten ini dilaporkan beberapa kali dan sedang diperiksa tim
              kami. Maaf ya 🙏
            </p>
          </div>
        )}

        {/* INTRO: kado masih terbungkus */}
        {data && stage === "intro" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <p className="font-hand text-3xl text-rose-100">Buat {data.toName},</p>
            <p className="mt-1 text-sm tracking-wide text-white/60">
              ada kado spesial dari {senderName}
            </p>
            <div className="mt-10 anim-float">
              <GiftBox emoji={giftEmoji} />
            </div>
            <Button
              size="lg"
              onClick={() => setStage("main")}
              className="mt-12 rounded-full bg-rose-500 px-8 text-base font-semibold shadow-lg shadow-rose-500/30 transition hover:scale-105 hover:bg-rose-600"
            >
              🎁 Buka Kadonya
            </Button>
            <p className="mt-3 text-xs text-white/40">
              siap-siap, ini bukan kado biasa ✨
            </p>
          </motion.div>
        )}

        {/* MAIN: konten kado */}
        <AnimatePresence>
          {data && stage === "main" && (
            <div className="w-full">
              {data.type === "bouquet" && (
                <BouquetMain data={data.data as BouquetData} senderName={senderName} />
              )}
              {data.type === "cake" && (
                <CakeMain data={data.data as CakeData} toName={data.toName} senderName={senderName} />
              )}
              {data.type === "photobox" && (
                <PhotoboxMain data={data.data as PhotoboxData} toName={data.toName} senderName={senderName} />
              )}
              {data.type === "coupons" && (
                <CouponsMain
                  data={data.data as CouponsData}
                  toName={data.toName}
                  senderName={senderName}
                  progress={data.progress}
                  onRedeem={redeem}
                  slug={slug}
                />
              )}
              {data.type === "playlist" && (
                <PlaylistMain
                  data={data.data as PlaylistData}
                  toName={data.toName}
                  senderName={senderName}
                />
              )}

              {/* watermark viral + lapor */}
              <div className="mt-10 text-xs text-white/40">
                <p>
                  Kadonya dibuat <span className="text-rose-300">GRATIS</span> di{" "}
                  <a href="/#kado" className="font-bold text-white">
                    Sayang.in
                  </a>{" "}
                  — <a href="/#kado" className="underline decoration-rose-400/60 underline-offset-2 hover:text-rose-200">mau kasih yang spesial juga →</a>
                </p>
                {!isPreview && (
                  <div className="mt-3">
                    {reportState === "done" ? (
                      <span className="text-emerald-300/70">
                        Laporan terkirim — terima kasih 🙏
                      </span>
                    ) : (
                      <button
                        onClick={sendReport}
                        className="underline decoration-white/30 underline-offset-2 transition hover:text-white/70"
                      >
                        ada yang salah? lapor konten ini
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
