"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Loader2, Lock, Share2, X } from "lucide-react";
import { CONFESS_THEMES, type ConfessionTheme } from "@/lib/themes";

// re-export: pemakai lama tetap import dari sini — definisi tunggal ada di lib
export { CONFESS_THEMES };
export type { ConfessionTheme };

export type ConfessionData = {
  fromName: string;
  toName: string;
  message: string;
  theme: string;
};

type Stage =
  | "loading"
  | "error"
  | "hidden"
  | "locked"
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

/* ---------- falling pieces (partikel CSS — hati & titik, tanpa emoji) ---------- */
export function FallingPieces({ active, kind }: { active: boolean; kind: "confetti" | "hearts" }) {
  const pieces = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => ({
      id: i,
      left: rnd(i, 20) * 96,
      delay: rnd(i, 21) * 1.6,
      duration: 3.2 + rnd(i, 22) * 2.6,
      size: 8 + rnd(i, 23) * 12,
      sway: `${rnd(i, 24) * 120 - 60}px`,
      isHeart: kind === "hearts" ? true : rnd(i, 26) > 0.5,
      tone: kind === "confetti" ? rnd(i, 27) : rnd(i, 25),
    }));
  }, [kind]);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden" aria-hidden>
      {pieces.map((p) =>
        p.isHeart ? (
          <span
            key={p.id}
            className="absolute top-[-8vh]"
            style={{
              left: `${p.left}%`,
              width: p.size,
              height: p.size,
              opacity: 0.5 + p.tone * 0.4,
              animation: `petal-fall ${p.duration}s linear ${p.delay}s infinite`,
              ["--sway" as string]: p.sway,
            }}
          >
            <span
              className="heart-shape block"
              style={{
                background:
                  kind === "confetti"
                    ? p.tone > 0.66
                      ? "#e8b4bb"
                      : p.tone > 0.33
                        ? "#9d1c34"
                        : "#fdf6f0"
                    : "#c96b7d",
              }}
            />
          </span>
        ) : (
          <span
            key={p.id}
            className="absolute top-[-8vh] rounded-full"
            style={{
              left: `${p.left}%`,
              width: p.size * 0.4,
              height: p.size * 0.4,
              background: p.tone > 0.5 ? "#d9a441" : "#fdf6f0",
              opacity: 0.6,
              animation: `petal-fall ${p.duration}s linear ${p.delay}s infinite`,
              ["--sway" as string]: p.sway,
            }}
          />
        )
      )}
    </div>
  );
}

/* ---------- envelope visual ---------- */
function Envelope({ open, accent }: { open: boolean; accent: string }) {
  return (
    <div className="perspective-1200 relative h-[150px] w-[230px] sm:h-[170px] sm:w-[260px]">
      {/* amplop belakang */}
      <div className="absolute inset-0 rounded-md bg-[#f6efe4] shadow-2xl" />
      {/* surat yang keluar */}
      <motion.div
        initial={{ y: 14, scale: 0.94, opacity: 0 }}
        animate={
          open
            ? { y: -84, scale: 1, opacity: 1 }
            : { y: 14, scale: 0.94, opacity: 0 }
        }
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="absolute left-1/2 top-2 h-[120px] w-[86%] -translate-x-1/2 rounded-sm bg-white p-3 shadow-lg"
      >
        <div className="font-hand text-lg leading-5 text-neutral-800">
          Buat kamu yang spesial
        </div>
        <div className="mt-2 space-y-1.5">
          <div className="h-1.5 w-4/5 rounded-sm bg-neutral-200" />
          <div className="h-1.5 w-3/5 rounded-sm bg-neutral-200" />
        </div>
      </motion.div>
      {/* amplop depan */}
      <div
        className="absolute inset-0 z-10 rounded-md bg-[#efe5d4] shadow-lg"
        style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
      />
      {/* segitiga kiri-kanan */}
      <div
        className="absolute inset-0 z-10 rounded-md bg-[#e9dcc6]/80"
        style={{ clipPath: "polygon(0 18%, 50% 62%, 0 100%)" }}
      />
      <div
        className="absolute inset-0 z-10 rounded-md bg-[#eee2cf]/80"
        style={{ clipPath: "polygon(100% 18%, 50% 62%, 100% 100%)" }}
      />
      {/* flap */}
      <motion.div
        initial={false}
        animate={{ rotateX: open ? 180 : 0 }}
        transition={{ duration: 0.65, ease: "easeInOut" }}
        style={{ transformOrigin: "top", clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
        className="absolute left-0 top-0 z-20 h-[58%] w-full rounded-t-md bg-[#e5d7bf]"
      />
      {/* segel lilin */}
      <motion.div
        animate={open ? { opacity: 0, scale: 0.4 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="absolute left-1/2 top-[46%] z-30 -translate-x-1/2"
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-full bg-[#9d1c34] shadow-lg"
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
  // balasan tertulis penerima (loop dua arah)
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");
  const [sentReply, setSentReply] = useState<string | null>(null);
  // kirim terjadwal: waktu buka surat (ISO) saat stage "locked"
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [shareState, setShareState] = useState<"idle" | "copied" | "sent">("idle");
  const typeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ritual buka: ketuk & tahan amplop — progres bertahap ala ritual kompetitor,
     tapi tetap pakai identitas amplop + segel lilin. Fallback: dobel-klik / tombol. */
  const [holdProgress, setHoldProgress] = useState(0);
  const [releasedEarly, setReleasedEarly] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = () => {
    if (holdTimer.current) {
      clearInterval(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const openNow = () => {
    stopHold();
    setHoldProgress(0);
    setTyped("");
    setStage("typing");
  };

  const startHold = () => {
    if (stage !== "closed") return;
    setReleasedEarly(false);
    stopHold();
    holdTimer.current = setInterval(() => {
      setHoldProgress((p) => Math.min(100, p + 2)); // ~2,5 detik sampai terbuka
    }, 50);
  };

  const cancelHold = () => {
    if (stage !== "closed") return;
    stopHold();
    setHoldProgress((p) => {
      if (p >= 100) return p; // efek samping ditangani effect di bawah
      if (p > 12) setReleasedEarly(true);
      return 0;
    });
  };

  // terbuka otomatis saat tahan penuh
  useEffect(() => {
    if (stage === "closed" && holdProgress >= 100) openNow();
  }, [holdProgress, stage]);

  // bersihkan timer ritual saat pindah stage / unmount
  useEffect(() => stopHold, [stopHold]);

  const ritualCopy = releasedEarly
    ? "eh, lepas? tahan terus sampai terbuka ya 🙈"
    : holdProgress === 0
      ? "ketuk & tahan amplopnya, jangan takut"
      : holdProgress < 35
        ? "amplopnya bergetar heboh…"
        : holdProgress < 70
          ? "segel lilinnya meleleh pelan-pelan…"
          : "hampir… tarik napas dulu 🥹";

  const load = useCallback(() => {
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
        if (d.locked) {
          setLockedUntil(d.unlockAt);
          setStage("locked");
          return;
        }
        setIsPreview(!!d.preview);
        setData({
          fromName: d.fromName ?? "",
          toName: d.toName,
          message: d.message,
          theme: d.theme ?? "rose",
        });
        setSentReply(d.reply ?? null);
        if (d.response) {
          // sudah pernah jawab → langsung ke layar jawaban, jangan tanya ulang
          setAnswered(d.response);
          setStage(d.response === "yes" ? "yes" : "later");
        } else {
          setStage("closed");
        }
      })
      .catch(() => alive && setStage("error"));
    return () => {
      alive = false;
    };
  }, [slug, preview, previewKey]);

  useEffect(() => load(), [load]);

  // saat countdown selesai → ambil ulang isi surat otomatis
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (stage !== "locked" || !lockedUntil) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage, lockedUntil]);
  const remainMs = lockedUntil ? new Date(lockedUntil).getTime() - nowTick : 0;
  const unlockedJustNow = stage === "locked" && lockedUntil && remainMs <= 0;
  useEffect(() => {
    if (!unlockedJustNow) return;
    const t = setTimeout(() => load(), 800); // kasih jeda dramatis sedetik
    return () => clearTimeout(t);
  }, [unlockedJustNow, load]);

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
    if (slug && !isPreview && !preview) {
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

  const changeAnswer = () => {
    // kembali ke pilihan (mis. "later" → "yes") — surat tampil utuh
    setTyped(data?.message ?? "");
    setAnswered(null);
    setReplyOpen(false);
    setReplyError("");
    setStage("question");
  };

  const sendReply = async () => {
    if (!slug || isPreview || preview) return;
    if (replyText.trim().length < 2) {
      setReplyError("Tulis balasannya dulu ya (min. 2 karakter).");
      return;
    }
    setReplySending(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/confess/${slug}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: replyText.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Gagal mengirim balasan. Coba lagi.");
      setSentReply(d.reply ?? null);
      setReplyOpen(false);
      setReplyText("");
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Gagal mengirim balasan. Coba lagi.");
    } finally {
      setReplySending(false);
    }
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

  // momen paling viral: penerima baru aja jawab IYA — share sekarang gampang
  const shareHappy = async () => {
    const text = "Aku baru dikirimin surat rahasia… dan aku jawab IYA 💘";
    const url = window.location.origin;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Kangenin", text, url });
        setShareState("sent");
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setShareState("copied");
    } catch {
      /* user batal share — diabaikan */
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
            <span className="flex-1">
              Pratinjau — hitungan &amp; status <b>tidak tercatat</b>.
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
          <div className="rounded-lg bg-white/10 p-8 text-white backdrop-blur">
            <h2 className="font-display text-xl font-bold">Suratnya tidak ketemu</h2>
            <p className="mt-2 text-sm text-white/70">
              Link confess-nya mungkin salah atau sudah dihapus.
            </p>
            <Button
              className="mt-6 rounded-md bg-primary hover:bg-[#b52743]"
              onClick={() => (window.location.href = "/")}
            >
              Ke Kangenin
            </Button>
          </div>
        )}

        {/* ------ KONTEN DILAPORKAN ------ */}
        {stage === "hidden" && (
          <div className="rounded-lg bg-white/10 p-8 text-white backdrop-blur">
            <h2 className="font-display text-xl font-bold">Suratnya sedang ditinjau</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/70">
              Konten ini dilaporkan beberapa kali dan sedang diperiksa tim
              kami. Maaf ya.
            </p>
          </div>
        )}

        {/* ------ TERKUNCI — KIRIM TERJADWAL (countdown kejutan) ------ */}
        {stage === "locked" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/20 bg-white/5 backdrop-blur">
              <Lock className="h-8 w-8 text-white/70" strokeWidth={1.5} />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold text-white">
              Belum waktunya 🤫
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/75">
              Seseorang sudah menulis sesuatu untukmu — suratnya baru bisa
              dibuka tepat pada waktunya.
            </p>

            {/* countdown hidup: hari : jam : menit : detik */}
            <div
              className="mt-7 flex items-start gap-2 text-white"
              role="timer"
              aria-live="off"
            >
              {[
                { v: Math.floor(Math.max(remainMs, 0) / 86_400_000), k: "hari" },
                { v: Math.floor(Math.max(remainMs, 0) / 3_600_000) % 24, k: "jam" },
                { v: Math.floor(Math.max(remainMs, 0) / 60_000) % 60, k: "menit" },
                { v: Math.floor(Math.max(remainMs, 0) / 1000) % 60, k: "detik" },
              ].map((u, i) => (
                <div key={u.k} className="flex items-start gap-2">
                  <div className="flex min-w-[3.4rem] flex-col items-center rounded-lg border border-white/15 bg-white/5 px-2 py-2.5 backdrop-blur">
                    <span className="font-display text-2xl font-bold tabular-nums leading-none">
                      {String(u.v).padStart(2, "0")}
                    </span>
                    <span className="mt-1.5 text-[10px] uppercase tracking-wider text-white/50">
                      {u.k}
                    </span>
                  </div>
                  {i < 3 && (
                    <span className="pt-2 font-display text-xl text-white/30" aria-hidden>
                      :
                    </span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-6 text-xs text-white/50">
              Balik lagi ya — suratnya menungumu di link ini juga 💌
            </p>
            <a
              href="/"
              className="mt-4 text-xs font-semibold text-[#e8b4bb] underline decoration-white/30 underline-offset-2 transition hover:text-white"
            >
              pengen bikin yang kayak gini juga → gratis
            </a>
          </motion.div>
        )}

        {/* ------ AMPLOP TERTUTUP — ritual ketuk & tahan ------ */}
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
            <div
              role="button"
              tabIndex={0}
              aria-label="Ketuk dan tahan amplopnya untuk membuka surat"
              onPointerDown={startHold}
              onPointerUp={cancelHold}
              onPointerLeave={cancelHold}
              onPointerCancel={cancelHold}
              onDoubleClick={openNow}
              onKeyDown={(e) => {
                if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                  e.preventDefault();
                  startHold();
                }
              }}
              onKeyUp={(e) => {
                if (e.key === " " || e.key === "Enter") cancelHold();
              }}
              className="mt-10 cursor-pointer touch-none select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              style={{
                transform: `scale(${1 + (holdProgress / 100) * 0.07})`,
                transition: "transform 0.15s ease-out",
              }}
            >
              <div className={holdProgress > 0 ? "anim-wobble" : "anim-float"}>
                <Envelope open={false} accent={theme.accent} />
              </div>
            </div>
            <div
              className="mt-8 h-1.5 w-44 overflow-hidden rounded-full bg-white/10"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-[width] duration-100"
                style={{ width: `${holdProgress}%` }}
              />
            </div>
            <p className="mt-3 h-5 text-xs text-white/50" aria-live="polite">
              {ritualCopy}
            </p>
            <button
              onClick={openNow}
              className="mt-1 text-[11px] text-white/25 underline underline-offset-2 transition-colors hover:text-white/60"
            >
              buka langsung tanpa ritual
            </button>
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
            <div className="grain relative rounded-lg bg-[#fffaf5] p-6 text-left shadow-2xl sm:p-8">
              <p className="font-hand text-2xl text-[#9d1c34]">
                Hai {data.toName},
              </p>
              <p className="mt-4 min-h-[120px] whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-800">
                {typed}
                {stage === "typing" && (
                  <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-primary align-middle" />
                )}
              </p>
              <p className="mt-6 text-right font-hand text-xl text-neutral-600">
                — {data.fromName?.trim() || "Seseorang"}
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
                  className="rounded-md bg-primary text-base font-semibold text-white transition-colors hover:bg-[#b52743]"
                >
                  Iya, aku juga suka kamu
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  onClick={() => respond("later")}
                  className="rounded-md border border-white/20 bg-white/5 text-base text-white/85 hover:bg-white/10"
                >
                  Beri aku waktu dulu
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
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 anim-heartbeat">
              <div className="relative h-12 w-12">
                <div className="heart-shape" />
              </div>
            </div>
            <h2 className="mt-6 font-display text-3xl font-bold text-white">
              Selamat, {data.toName}!
            </h2>
            <p className="mt-3 max-w-xs text-white/80">
              Yang mengirim surat ini adalah{" "}
              <span className="font-bold text-[#e8b4bb]">{senderName}</span>. Dia
              pasti lagi senyum-senyum sendiri nunggu jawaban ini.
            </p>
            <p className="mt-4 text-sm text-white/60">
              Jangan ditunda — chat dia sekarang.
            </p>
            {!preview && !isPreview && (
              <button
                onClick={shareHappy}
                className="mt-6 flex items-center gap-2 rounded-md border border-white/20 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/10"
              >
                <Share2 className="h-4 w-4" />
                {shareState === "copied"
                  ? "Teks tersalin — tempel di story-mu!"
                  : "Bagikan kabar bahagia"}
              </button>
            )}
          </motion.div>
        )}

        {/* ------ JAWABAN: LATER ------ */}
        {data && stage === "later" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/15">
              <Heart className="h-8 w-8 text-white/50" strokeWidth={1.5} />
            </div>
            <h2 className="mt-6 font-display text-2xl font-bold text-white">
              Nggak apa-apa, kok
            </h2>
            <p className="mt-3 max-w-xs text-white/75">
              Perasaanmu dihargai banget. Pengirimnya tetap{" "}
              <span className="font-semibold">anonim</span> — dia cuma butuh
              berani hari ini.
            </p>
            <p className="mt-2 text-sm text-white/50">
              Kalau suatu hari kamu penasaran... link ini tetap ada.
            </p>
            {answered === "later" && (
              <button
                onClick={changeAnswer}
                className="mt-5 text-xs text-white/50 underline decoration-white/30 underline-offset-2 transition hover:text-white/80"
              >
                ubah jawabanku
              </button>
            )}
          </motion.div>
        )}

        {/* ------ BALASAN TERTULIS PENERIMA (loop dua arah) ------ */}
        {data && (stage === "yes" || stage === "later") && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="mt-8 w-full max-w-sm"
          >
            {sentReply ? (
              <div className="rounded-lg border border-white/20 bg-white/5 p-4 text-left backdrop-blur">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">
                  Balasanmu terkirim
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/90">
                  {sentReply}
                </p>
              </div>
            ) : isPreview || preview ? (
              <p className="text-center text-xs text-white/50">
                penerima bisa nulis balasan buatmu dari sini
              </p>
            ) : (
              <div>
                {!replyOpen ? (
                  <button
                    onClick={() => setReplyOpen(true)}
                    className="w-full rounded-md border border-white/20 bg-white/5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10"
                  >
                    Tulis balasan buat dia
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-4 text-left backdrop-blur">
                    <p className="text-sm font-semibold text-white/90">
                      Balas suratnya — bakal dibaca di halaman pantauan pengirimnya.
                    </p>
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      maxLength={400}
                      rows={3}
                      placeholder="Tulis balasanmu di sini…"
                      className="resize-none border-white/20 bg-white/10 text-sm text-white placeholder:text-white/40 focus-visible:ring-rose-400"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {(stage === "yes"
                        ? [
                            "Iya, aku juga suka kamu. Kenapa baru ngomong sekarang?",
                            "Seneng banget baca suratnya. Aku kira cuma aku.",
                          ]
                        : [
                            "Aku butuh waktu buat mikirnya, tapi makasih udah berani bilang.",
                            "Baca suratnya bikin senyum-senyum sendiri. Pelan-pelan ya.",
                          ]
                      ).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setReplyText(t)}
                          className="rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-left text-[11px] text-white/70 transition hover:bg-white/10 hover:text-white"
                        >
                          {t.length > 34 ? `${t.slice(0, 34)}…` : t}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-white/40">{replyText.length}/400</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyOpen(false);
                            setReplyError("");
                          }}
                          className="rounded-full px-3 py-1.5 text-xs font-semibold text-white/50 transition hover:bg-white/10"
                        >
                          batal
                        </button>
                        <button
                          type="button"
                          onClick={sendReply}
                          disabled={replySending}
                          className="rounded-md bg-primary px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#b52743] disabled:opacity-60"
                        >
                          {replySending ? "mengirim…" : "kirim balasan →"}
                        </button>
                      </div>
                    </div>
                    {replyError && (
                    <p className="text-xs text-[#e8b4bb]">{replyError}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* watermark viral */}
        <div className="mt-16 text-xs text-white/40">
          {preview ? (
            <span>Beginilah yang bakal dilihat dia.</span>
          ) : (
            <>
              Dibuat <span className="font-bold text-[#e8b4bb]">gratis</span> di{" "}
              <span className="font-bold text-white">Kangenin</span>
              <a
                href="/#confess"
                className="ml-2 underline decoration-white/30 underline-offset-2 hover:text-white/80"
              >
                mau confess juga →
              </a>
              {!isPreview && slug && (
                <div className="mt-3">
                  {reportState === "done" ? (
                    <span className="text-white/50">
                      Laporan terkirim — terima kasih.
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
