"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Copy, Check, Heart, Loader2, X } from "lucide-react";

export type ConfessionData = {
  fromName: string;
  toName: string;
  message: string;
  theme: string;
};

export const CONFESS_THEMES: Record<
  string,
  { name: string; bg: string; accent: string; seal: string }
> = {
  rose: {
    name: "Rose",
    bg: "from-[#2b0a1c] via-[#4a0e2e] to-[#160510]",
    accent: "#ff5f9e",
    seal: "from-rose-500 to-rose-700",
  },
  sunset: {
    name: "Sunset",
    bg: "from-[#3b0f1e] via-[#7c2d12] to-[#1f0806]",
    accent: "#fb923c",
    seal: "from-orange-500 to-rose-600",
  },
  midnight: {
    name: "Midnight",
    bg: "from-[#150620] via-[#3b0764] to-[#0b0313]",
    accent: "#c084fc",
    seal: "from-purple-500 to-fuchsia-700",
  },
};

type Stage =
  | "loading"
  | "error"
  | "hidden"
  | "closed"
  | "typing"
  | "question"
  | "yes"
  | "later";

/* PRNG deterministik berbasis integer (identik di Node & browser — hindari hydration mismatch) */
function rnd(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/* ---------- falling emoji pieces (confetti / hearts) ---------- */
export function FallingPieces({ active, kind }: { active: boolean; kind: "confetti" | "hearts" }) {
  const pieces = useMemo(() => {
    const chars =
      kind === "confetti"
        ? ["❤️", "💗", "✨", "🌹", "🎉", "😘"]
        : ["💗", "🤍", "✨"];
    return Array.from({ length: 34 }, (_, i) => ({
      id: i,
      left: rnd(i, 20) * 96,
      delay: rnd(i, 21) * 1.6,
      duration: 3.2 + rnd(i, 22) * 2.6,
      size: 14 + rnd(i, 23) * 18,
      sway: `${rnd(i, 24) * 120 - 60}px`,
      char: chars[Math.floor(rnd(i, 25) * chars.length)],
    }));
  }, [kind]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-8vh] select-none"
          style={{
            left: `${p.left}%`,
            fontSize: p.size,
            animation: `petal-fall ${p.duration}s linear ${p.delay}s infinite`,
            ["--sway" as string]: p.sway,
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}

/* ---------- envelope visual ---------- */
function Envelope({ open, accent }: { open: boolean; accent: string }) {
  return (
    <div className="perspective-1200 relative h-[150px] w-[230px] sm:h-[170px] sm:w-[260px]">
      {/* amplop belakang */}
      <div className="absolute inset-0 rounded-xl bg-rose-100 shadow-2xl" />
      {/* surat yang keluar */}
      <motion.div
        initial={{ y: 14, scale: 0.94, opacity: 0 }}
        animate={
          open
            ? { y: -84, scale: 1, opacity: 1 }
            : { y: 14, scale: 0.94, opacity: 0 }
        }
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute left-1/2 top-2 h-[120px] w-[86%] -translate-x-1/2 rounded-md bg-white p-3 shadow-lg"
      >
        <div className="font-hand text-lg leading-5 text-rose-900">
          Buat kamu yang spesial 💌
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-4/5 rounded bg-rose-100" />
          <div className="h-1.5 w-3/5 rounded bg-rose-100" />
        </div>
      </motion.div>
      {/* amplop depan */}
      <div
        className="absolute inset-0 z-10 rounded-xl border border-rose-200/60 bg-gradient-to-br from-rose-200 to-rose-300 shadow-xl"
        style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
      />
      {/* segitiga kiri-kanan */}
      <div
        className="absolute inset-0 z-10 rounded-xl bg-rose-300/70"
        style={{ clipPath: "polygon(0 18%, 50% 62%, 0 100%)" }}
      />
      <div
        className="absolute inset-0 z-10 rounded-xl bg-rose-200/70"
        style={{ clipPath: "polygon(100% 18%, 50% 62%, 100% 100%)" }}
      />
      {/* flap */}
      <motion.div
        initial={false}
        animate={{ rotateX: open ? 180 : 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
        style={{ transformOrigin: "top", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
        className="absolute left-0 top-0 z-20 h-[58%] w-full rounded-t-xl bg-gradient-to-b from-rose-300 to-rose-400"
      />
      {/* segel lilin */}
      <motion.div
        animate={open ? { opacity: 0, scale: 0.4 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="absolute left-1/2 top-[46%] z-30 -translate-x-1/2"
      >
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br ${CONFESS_THEMES.rose.seal} shadow-lg`}
          style={{ animation: open ? undefined : "seal-glow 2s ease-in-out infinite" }}
        >
          <Heart className="h-5 w-5 fill-white text-white" />
        </div>
      </motion.div>
      <span className="sr-only">Amplop surat, {open ? "terbuka" : "tertutup"}</span>
      <span aria-hidden className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/50" style={{ color: accent }}>
        {" "}
      </span>
    </div>
  );
}

/* ---------- fullscreen confession experience ---------- */
export default function ConfessionView({
  slug,
  preview,
  previewKey,
  onClose,
}: {
  slug?: string;
  preview?: ConfessionData;
  /** senderKey dari URL (?p=) — mode pratinjau tanpa mengubah statistik */
  previewKey?: string;
  onClose?: () => void;
}) {
  const [data, setData] = useState<ConfessionData | null>(preview ?? null);
  const [stage, setStage] = useState<Stage>(preview ? "closed" : "loading");
  const [isPreview, setIsPreview] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "done">("idle");
  const [typed, setTyped] = useState("");
  const [answered, setAnswered] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // mode pratinjau inline: data sudah diisi via useState awal
    if (preview || !slug) return;
    let alive = true;
    fetch(`/api/confess/${slug}${previewKey ? `?p=${previewKey}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const d = await r.json();
        if (!alive) return;
        if (d.hidden) {
          setStage("hidden");
          return;
        }
        setIsPreview(!!d.preview);
        setData({
          fromName: d.fromName ?? "",
          toName: d.toName,
          message: d.message,
          theme: d.theme ?? "rose",
        });
        setStage("closed");
      })
      .catch(() => alive && setStage("error"));
    return () => {
      alive = false;
    };
  }, [slug, preview, previewKey]);

  // efek mesin ketik
  useEffect(() => {
    if (stage !== "typing" || !data) return;
    let i = 0;
    typeTimer.current = setInterval(() => {
      i += 1;
      setTyped(data.message.slice(0, i));
      if (i >= data.message.length) {
        if (typeTimer.current) clearInterval(typeTimer.current);
        setTimeout(() => setStage("question"), 700);
      }
    }, 38);
    return () => {
      if (typeTimer.current) clearInterval(typeTimer.current);
    };
  }, [stage, data]);

  const theme = CONFESS_THEMES[data?.theme ?? "rose"] ?? CONFESS_THEMES.rose;
  const senderName = data?.fromName?.trim() || "Seseorang yang diam-diam perhatian";

  const respond = async (answer: "yes" | "later") => {
    setAnswered(answer);
    if (slug && !isPreview) {
      try {
        await fetch(`/api/confess/${slug}/respond`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: answer }),
        });
      } catch {
        /* biarkan UI tetap jalan walau gagal simpan */
      }
    }
    setStage(answer === "yes" ? "yes" : "later");
  };

  const sendReport = async () => {
    if (!slug || reportState === "done") return;
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch {
      /* tetap tandai terkirim di UI — server yang hitung */
    }
    setReportState("done");
  };

  const copyReply = async () => {
    try {
      await navigator.clipboard.writeText(
        "Iya, aku juga suka kamu. Kenapa baru ngomong sekarang? 😳💗"
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard bisa diblokir di beberapa browser */
    }
  };

  return (
    <div
      className={`fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-b ${theme.bg}`}
    >
      <FallingPieces active={stage === "closed" || stage === "question"} kind="hearts" />
      <FallingPieces active={stage === "yes"} kind="confetti" />

      {onClose && (
        <button
          onClick={onClose}
          aria-label="Tutup pratinjau"
          className="absolute right-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      {/* banner mode pratinjau (buka lewat ?p=senderKey) */}
      {isPreview && !onClose && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
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

      <div className="relative z-50 mx-auto flex min-h-full w-full max-w-md flex-col items-center justify-center px-5 py-16 text-center">
        {/* ------ LOADING ------ */}
        {stage === "loading" && (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
            <p className="text-sm text-white/70">Membuka suratnya...</p>
          </div>
        )}

        {/* ------ ERROR ------ */}
        {stage === "error" && (
          <div className="rounded-2xl bg-white/10 p-8 text-white backdrop-blur">
            <div className="text-5xl">🥲</div>
            <h2 className="mt-4 text-xl font-bold">Suratnya nggak ketemu</h2>
            <p className="mt-2 text-sm text-white/70">
              Link confess-nya mungkin salah atau sudah dihapus.
            </p>
            <Button
              className="mt-6 rounded-full bg-rose-500 hover:bg-rose-600"
              onClick={() => (window.location.href = "/")}
            >
              Ke Sayang.in
            </Button>
          </div>
        )}

        {/* ------ KONTEN DILAPORKAN ------ */}
        {stage === "hidden" && (
          <div className="rounded-2xl bg-white/10 p-8 text-white backdrop-blur">
            <div className="text-5xl">🕵️</div>
            <h2 className="mt-4 text-xl font-bold">Suratnya lagi ditinjau</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Konten ini dilaporkan beberapa kali dan sedang diperiksa tim
              kami. Maaf ya 🙏
            </p>
          </div>
        )}

        {/* ------ AMPLOP TERTUTUP ------ */}
        {data && stage === "closed" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <p className="font-hand text-3xl text-rose-200">Buat {data.toName},</p>
            <p className="mt-1 text-sm tracking-wide text-white/60">
              seseorang meninggalkan surat untukmu
            </p>
            <div className="mt-10 anim-float">
              <Envelope open={false} accent={theme.accent} />
            </div>
            <Button
              size="lg"
              onClick={() => {
                setTyped("");
                setStage("typing");
              }}
              className="mt-14 rounded-full bg-rose-500 px-8 text-base font-semibold shadow-lg shadow-rose-500/30 transition hover:scale-105 hover:bg-rose-600"
            >
              💌 Buka Suratnya
            </Button>
            <p className="mt-3 text-xs text-white/40">tap amplopnya, jangan takut</p>
          </motion.div>
        )}

        {/* ------ SURAT + MESIN KETIK ------ */}
        {data && (stage === "typing" || stage === "question") && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full"
          >
            <div className="grain relative rounded-2xl bg-[#fffaf5] p-6 text-left shadow-2xl sm:p-8">
              <p className="font-hand text-2xl text-rose-700">
                Hai {data.toName} 🌷
              </p>
              <p className="mt-4 min-h-[120px] whitespace-pre-wrap text-[15px] leading-relaxed text-rose-950/90">
                {typed}
                {stage === "typing" && (
                  <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-rose-500 align-middle" />
                )}
              </p>
              <p className="mt-6 text-right font-hand text-xl text-rose-500">
                — {data.fromName?.trim() || "Seseorang 🤍"}
              </p>
            </div>

            {stage === "question" && !answered && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex flex-col gap-3"
              >
                <p className="text-sm font-medium text-white/80">
                  Jadi... gimana jawabanmu?
                </p>
                <Button
                  size="lg"
                  onClick={() => respond("yes")}
                  className="rounded-full bg-rose-500 text-base font-semibold shadow-lg shadow-rose-500/30 hover:scale-105 hover:bg-rose-600"
                >
                  Iya, aku juga suka kamu 💗
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => respond("later")}
                  className="rounded-full border border-white/20 bg-white/5 text-base text-white/85 hover:bg-white/10"
                >
                  Beri aku waktu dulu 🥲
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* ------ JAWABAN: YES ------ */}
        {data && stage === "yes" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
            className="flex flex-col items-center"
          >
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-rose-500/20 text-6xl anim-heartbeat">
              💗
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-white">
              Selamat, {data.toName}!
            </h2>
            <p className="mt-3 max-w-xs text-white/80">
              Yang mengirim surat ini adalah{" "}
              <span className="font-bold text-rose-300">{senderName}</span>. Dia
              pasti lagi senyum-senyum sendiri nunggu jawaban ini.
            </p>
            <p className="mt-4 text-sm text-white/60">
              Jangan ditunda — chat dia sekarang! 📱
            </p>
            <Button
              onClick={copyReply}
              className="mt-6 rounded-full bg-white px-6 font-semibold text-rose-700 hover:bg-rose-50"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Pesan balasan disalin!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Salin pesan balasan
                </>
              )}
            </Button>
          </motion.div>
        )}

        {/* ------ JAWABAN: LATER ------ */}
        {data && stage === "later" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="text-6xl">🤍</div>
            <h2 className="mt-6 text-2xl font-bold text-white">
              Nggak apa-apa, kok
            </h2>
            <p className="mt-3 max-w-xs text-white/75">
              Perasaanmu dihargai banget. Pengirimnya tetap{" "}
              <span className="font-semibold">anonim</span> — dia cuma butuh
              berani hari ini.
            </p>
            <p className="mt-2 text-sm text-white/50">
              Kalau suatu hari kamu penasaran... link ini tetap ada. 😉
            </p>
          </motion.div>
        )}

        {/* watermark viral */}
        <div className="mt-16 text-xs text-white/40">
          {preview ? (
            <span>Beginilah yang bakal dilihat dia ✨</span>
          ) : (
            <>
              Dibuat <span className="text-rose-300">GRATIS</span> di{" "}
              <span className="font-bold text-white">Sayang.in</span>
              <a
                href="/#confess"
                className="ml-2 underline decoration-rose-400/60 underline-offset-2 hover:text-rose-200"
              >
                mau confess juga →
              </a>
              {!isPreview && slug && (
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
