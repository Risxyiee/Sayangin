"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Heart,
  Loader2,
  Lock,
  MailOpen,
  X,
  Sparkles,
  BookOpenCheck,
} from "lucide-react";
import { CONFESS_THEMES, FallingPieces } from "@/components/confess/ConfessionView";

export type LetterCard = {
  id: string;
  order: number;
  title: string;
  unlockDays: number;
  unlocked: boolean;
  unlockAt: string | null;
  openedAt: string | null;
  views: number;
  reply: string | null;
  repliedAt: string | null;
  body: string | null;
};

type LetterSetData = {
  slug: string;
  fromName: string;
  toName: string;
  theme: string;
  startedAt: string | null;
  views: number;
  preview?: boolean;
  letters: LetterCard[];
};

type Stage = "loading" | "error" | "hidden" | "intro" | "grid" | "reading";

/* PRNG deterministik (pola sama dgn ConfessionView — hindari hydration mismatch) */
function rnd(i: number, salt: number): number {
  let h = (i * 374761393 + salt * 668265263) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/* ---------- kartu amplop per surat ---------- */
function EnvelopeCard({
  letter,
  senderAccent,
  onOpen,
  shake,
}: {
  letter: LetterCard;
  senderAccent: boolean;
  onOpen: () => void;
  shake: boolean;
}) {
  const state = !letter.unlocked ? "locked" : letter.openedAt ? "read" : "new";

  const countdown = useMemo(() => {
    if (letter.unlocked || !letter.unlockAt) return null;
    const ms = new Date(letter.unlockAt).getTime() - Date.now();
    if (ms <= 0) return "tinggal bentar lagi…";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days >= 1) return `bisa dibuka ${days} hari lagi`;
    if (hours >= 1) return `bisa dibuka ${hours} jam lagi`;
    return "tinggal bentar lagi…";
  }, [letter.unlockAt, letter.unlocked]);

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      initial={{ opacity: 0, y: 18 }}
      animate={shake ? { x: [0, -7, 7, -5, 5, 0] } : { opacity: 1, y: 0 }}
      transition={shake ? { duration: 0.45 } : { duration: 0.4, delay: letter.order * 0.07 }}
      whileHover={state !== "locked" ? { scale: 1.03 } : undefined}
      whileTap={state !== "locked" ? { scale: 0.97 } : undefined}
      aria-label={
        state === "locked"
          ? `${letter.title} (terkunci)`
          : `Buka surat: ${letter.title}`
      }
      className={`relative flex flex-col items-center rounded-2xl border p-4 text-center transition-colors ${
        state === "locked"
          ? "border-white/10 bg-white/[0.03]"
          : state === "read"
            ? "border-rose-300/20 bg-white/[0.06]"
            : "border-rose-300/50 bg-rose-500/10 shadow-lg shadow-rose-500/10"
      }`}
    >
      {/* badge status */}
      {state === "new" && (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow anim-heartbeat">
          <Sparkles className="h-2.5 w-2.5" /> BARU
        </span>
      )}
      {state === "read" && (
        <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white">
          <BookOpenCheck className="h-3 w-3" />
        </span>
      )}

      {/* amplop mini */}
      <div className="perspective-1200 relative mt-2 h-16 w-24">
        <div
          className={`absolute inset-0 rounded-md shadow ${
            state === "locked" ? "bg-white/10" : "bg-rose-100"
          }`}
        />
        <div
          className={`absolute inset-0 rounded-md ${
            state === "locked"
              ? "bg-white/10"
              : "bg-gradient-to-br from-rose-200 to-rose-300"
          }`}
          style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
        />
        {state !== "read" && (
          <div
            className={`absolute left-0 top-0 h-[58%] w-full rounded-t-md ${
              state === "locked"
                ? "bg-white/15"
                : "bg-gradient-to-b from-rose-300 to-rose-400"
            }`}
            style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
          />
        )}
        {/* segel */}
        <div
          className={`absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ${
            state === "locked"
              ? "bg-white/15"
              : "bg-gradient-to-br from-rose-500 to-rose-700"
          } ${state === "new" ? "anim-wiggle" : ""}`}
        >
          {state === "locked" ? (
            <Lock className="h-3 w-3 text-white/60" />
          ) : (
            <Heart className="h-3 w-3 fill-white text-white" />
          )}
        </div>
      </div>

      <p
        className={`mt-3 min-h-[34px] font-hand text-[15px] leading-5 ${
          state === "locked" ? "text-white/40" : "text-rose-100"
        }`}
      >
        {letter.title}
      </p>
      <p className="mt-1 text-[10.5px] leading-4 text-white/45">
        {state === "locked" ? (
          countdown
        ) : state === "read" ? (
          <>sudah dibaca — tap buka lagi</>
        ) : (
          <>tap buka sekarang</>
        )}
      </p>
      {senderAccent && <span className="sr-only">surat dari pengirim rahasia</span>}
    </motion.button>
  );
}

/* ---------- pengalaman fullscreen surat mingguan ---------- */
export default function LettersView({
  slug,
  previewKey,
}: {
  slug: string;
  /** senderKey dari URL (?p=) — mode pratinjau tanpa mengubah statistik */
  previewKey?: string;
}) {
  const [data, setData] = useState<LetterSetData | null>(null);
  const [stage, setStage] = useState<Stage>("loading");
  const [isPreview, setIsPreview] = useState(false);
  const [reportState, setReportState] = useState<"idle" | "done">("idle");
  const [starting, setStarting] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [reading, setReading] = useState<{ id: string; title: string; body: string; first: boolean } | null>(null);
  const [typed, setTyped] = useState("");
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [replyError, setReplyError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/letters/${slug}${previewKey ? `?p=${previewKey}` : ""}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("not found");
        const d: LetterSetData = await r.json();
        if (!alive) return;
        if (d.hidden) {
          setStage("hidden");
          return;
        }
        setIsPreview(!!d.preview);
        setData(d);
        setStage(d.startedAt ? "grid" : "intro");
      })
      .catch(() => alive && setStage("error"));
    return () => {
      alive = false;
    };
  }, [slug, previewKey]);

  const theme = CONFESS_THEMES[data?.theme ?? "rose"] ?? CONFESS_THEMES.rose;
  const senderName = data?.fromName?.trim() || "Seseorang yang sayang kamu";
  const openedCount = data?.letters.filter((l) => l.openedAt).length ?? 0;
  const allDone = !!data && data.letters.length > 0 && openedCount === data.letters.length;

  // efek mesin ketik saat baca surat pertama kali
  useEffect(() => {
    if (stage !== "reading" || !reading?.first) return;
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setTyped(reading.body.slice(0, i));
      if (i >= reading.body.length) clearInterval(t);
    }, 34);
    return () => clearInterval(t);
  }, [stage, reading]);

  const startJourney = async () => {
    if (!data) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/letters/${slug}/start`, { method: "POST" });
      const d = await res.json();
      if (res.ok) {
        const startMs = new Date(d.startedAt).getTime();
        const DAY_MS = 24 * 60 * 60 * 1000;
        setData({
          ...data,
          startedAt: d.startedAt,
          letters: data.letters.map((l) => ({
            ...l,
            unlocked: l.unlockDays === 0,
            unlockAt:
              l.unlockDays === 0
                ? null
                : new Date(startMs + l.unlockDays * DAY_MS).toISOString(),
          })),
        });
        setStage("grid");
      }
    } catch {
      /* biarkan tombol aktif lagi */
    } finally {
      setStarting(false);
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
      /* tetap tandai terkirim di UI — server yang hitung */
    }
    setReportState("done");
  };

  const openLetter = async (letter: LetterCard) => {
    if (!data) return;
    if (!letter.unlocked) {
      setShakeId(letter.id);
      setTimeout(() => setShakeId(null), 500);
      return;
    }
    setReplyOpen(false);
    setReplyText("");
    setReplyError("");
    if (letter.openedAt && letter.body) {
      // baca ulang: pakai data lokal, jangan naikkan views
      setTyped(letter.body);
      setReading({ id: letter.id, title: letter.title, body: letter.body, first: false });
      setStage("reading");
      return;
    }
    try {
      const res = await fetch(`/api/letters/${slug}/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId: letter.id }),
      });
      if (!res.ok) throw new Error("locked");
      const d = await res.json();
      setData({
        ...data,
        letters: data.letters.map((l) =>
          l.id === letter.id ? { ...l, openedAt: d.openedAt ?? new Date().toISOString(), body: d.body } : l
        ),
      });
      setTyped(d.body);
      setReading({ id: letter.id, title: d.title, body: d.body, first: true });
      setStage("reading");
    } catch {
      setShakeId(letter.id);
      setTimeout(() => setShakeId(null), 500);
    }
  };

  const sendReply = async () => {
    if (!reading || replyText.trim().length < 2) {
      setReplyError("Tulis balasannya dulu ya (min. 2 karakter).");
      return;
    }
    setReplySending(true);
    setReplyError("");
    try {
      const res = await fetch(`/api/letters/${slug}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ letterId: reading.id, body: replyText.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Gagal mengirim balasan");
      setData(
        (prev) =>
          prev && {
            ...prev,
            letters: prev.letters.map((l) =>
              l.id === reading.id
                ? { ...l, reply: d.reply, repliedAt: d.repliedAt }
                : l
            ),
          }
      );
      setReplyOpen(false);
      setReplyText("");
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Gagal mengirim balasan. Coba lagi.");
    } finally {
      setReplySending(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-b ${theme.bg}`}>
      <FallingPieces active={stage !== "error" && stage !== "loading"} kind="hearts" />

      {/* banner mode pratinjau (buka lewat ?p=senderKey) */}
      {isPreview && (
        <div className="fixed bottom-4 left-1/2 z-[110] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-[#3a2410]/90 px-4 py-2.5 text-xs text-amber-100 shadow-xl backdrop-blur">
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
        {/* ------ LOADING ------ */}
        {stage === "loading" && (
          <div className="flex flex-col items-center gap-4 text-white">
            <Loader2 className="h-8 w-8 animate-spin text-rose-300" />
            <p className="text-sm text-white/70">Menyiapkan surat-suratnya...</p>
          </div>
        )}

        {/* ------ ERROR ------ */}
        {stage === "error" && (
          <div className="rounded-2xl bg-white/10 p-8 text-white backdrop-blur">
            <h2 className="mt-4 text-xl font-bold">Suratnya nggak ketemu</h2>
            <p className="mt-2 text-sm text-white/70">
              Link-nya mungkin salah atau sudah dihapus.
            </p>
            <Button
              className="mt-6 rounded-full bg-rose-500 hover:bg-rose-600"
              onClick={() => (window.location.href = "/")}
            >
              Ke Degdegin
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
              kami. Maaf ya.
            </p>
          </div>
        )}

        {/* ------ INTRO: belum dimulai ------ */}
        {data && stage === "intro" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <p className="font-hand text-3xl text-rose-200">
              {data.letters.length} surat buat {data.toName},
            </p>
            <p className="mt-1 text-sm tracking-wide text-white/60">
              dari {senderName}
            </p>

            {/* tumpukan amplop */}
            <div className="relative mt-10 h-44 w-56 anim-float" aria-hidden>
              {data.letters.map((l, i) => (
                <div
                  key={l.id}
                  className="absolute left-1/2 w-32 rounded-lg border border-rose-200/70 bg-gradient-to-br from-rose-100 to-rose-200 shadow-lg"
                  style={{
                    height: 58,
                    bottom: i * 14,
                    transform: `translateX(-50%) rotate(${(rnd(i, 7) * 8 - 4).toFixed(1)}deg)`,
                    zIndex: i,
                    opacity: 0.55 + i * 0.11,
                  }}
                >
                  <div className="flex h-full items-center justify-center">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full ${
                        i === data.letters.length - 1
                          ? "bg-gradient-to-br from-rose-500 to-rose-700"
                          : "bg-white/40"
                      }`}
                    >
                      <Heart
                        className={`h-3 w-3 ${i === data.letters.length - 1 ? "fill-white text-white" : "text-rose-400"}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-left text-sm leading-relaxed text-white/75 backdrop-blur">
              <p className="font-bold text-white">Aturannya sederhana:</p>
              <p className="mt-1.5">
                Satu surat boleh dibuka tiap minggu — pelan-pelan, biar tiap
                kata beneran kerasa.
              </p>
            </div>

            <Button
              size="lg"
              onClick={startJourney}
              disabled={starting}
              className="mt-8 rounded-full bg-rose-500 px-8 text-base font-semibold shadow-lg shadow-rose-500/30 transition hover:scale-105 hover:bg-rose-600"
            >
              {starting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyiapkan...
                </>
              ) : (
                <>Iya, aku siap mulai</>
              )}
            </Button>
            <p className="mt-3 text-xs text-white/40">
              minggu pertama bisa dibuka hari ini juga
            </p>
          </motion.div>
        )}

        {/* ------ GRID: perjalanan berjalan ------ */}
        {data && stage === "grid" && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex w-full flex-col items-center"
          >
            <p className="font-hand text-3xl text-rose-200">
              Buat {data.toName}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {openedCount === 0
                ? `Surat pertama bisa kamu buka sekarang juga.`
                : `${openedCount} dari ${data.letters.length} surat sudah kamu baca.`}
            </p>

            {/* progress bar */}
            <div className="mt-4 h-2 w-full max-w-xs overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-600"
                initial={{ width: 0 }}
                animate={{ width: `${(openedCount / data.letters.length) * 100}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>

            <div className="mt-8 grid w-full grid-cols-2 gap-3">
              {data.letters.map((l) => (
                <EnvelopeCard
                  key={l.id}
                  letter={l}
                  senderAccent={false}
                  onOpen={() => openLetter(l)}
                  shake={shakeId === l.id}
                />
              ))}
              {data.letters.length % 2 === 1 && (
                <div className="hidden sm:block" aria-hidden />
              )}
            </div>

            {allDone && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="mt-8 rounded-2xl border border-rose-300/30 bg-rose-500/10 p-5 text-sm leading-relaxed text-rose-100"
              >
                Semua suratnya sudah kamu baca. Semoga hari-harimu jadi lebih
                hangat. — <span className="font-semibold">{senderName}</span>
              </motion.div>
            )}

            <p className="mt-10 text-xs text-white/40">
              Surat-surat ini dibuat gratis di{" "}
              <a href="/" className="font-bold text-rose-300 underline underline-offset-2">
                Degdegin
              </a>{" "}
              — mau bikin buat orang spesialmu?
            </p>
            {!isPreview && (
              <div className="mt-2 text-[11px] text-white/35">
                {reportState === "done" ? (
                  <span className="text-emerald-300/70">
                    Laporan terkirim — terima kasih.
                  </span>
                ) : (
                  <button
                    onClick={sendReport}
                    className="underline decoration-white/30 underline-offset-2 transition hover:text-white/60"
                  >
                    ada yang salah? lapor konten ini
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ------ READING: satu surat terbuka ------ */}
        <AnimatePresence>
          {stage === "reading" && reading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.45 }}
              className="w-full"
            >
              <div className="grain relative rounded-2xl bg-[#fffaf5] p-6 text-left shadow-2xl sm:p-8">
                <button
                  onClick={() => {
                    setReading(null);
                    setStage("grid");
                  }}
                  aria-label="Kembali ke daftar surat"
                  className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-rose-500 transition hover:bg-rose-200"
                >
                  <X className="h-4 w-4" />
                </button>
                <p className="font-hand text-xl leading-6 text-rose-500">
                  {reading.title}
                </p>
                <p className="mt-1 font-hand text-2xl text-rose-700">
                  Hai {data?.toName},
                </p>
                <p className="mt-4 min-h-[140px] whitespace-pre-wrap text-[15px] leading-relaxed text-rose-950/90">
                  {reading.first ? typed : reading.body}
                  {reading.first && typed.length < reading.body.length && (
                    <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-rose-500 align-middle" />
                  )}
                </p>
                <p className="mt-6 text-right font-hand text-xl text-rose-500">
                  — {senderName}
                </p>

                {/* balasan penerima (loop dua arah) */}
                {(() => {
                  const current = data?.letters.find((l) => l.id === reading.id);
                  if (!current) return null;
                  if (current.reply) {
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-left"
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-500">
                          Balasanmu terkirim
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-emerald-900">
                          {current.reply}
                        </p>
                      </motion.div>
                    );
                  }
                  if (isPreview) {
                    return (
                      <p className="mt-4 text-center text-[11px] text-rose-400">
                        penerima bisa bales tiap surat dari sini
                      </p>
                    );
                  }
                  return (
                    <div className="mt-4">
                      {!replyOpen ? (
                        <button
                          type="button"
                          onClick={() => setReplyOpen(true)}
                          className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-sm font-bold text-rose-600 transition hover:bg-rose-100"
                        >
                          Balas surat ini
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            maxLength={400}
                            rows={3}
                            placeholder="Tulis balasanmu… bakal dibaca pengirimnya di halaman pantauannya."
                            className="resize-none border-rose-200 text-sm focus-visible:ring-rose-400"
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] text-rose-400">{replyText.length}/400</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyOpen(false);
                                  setReplyError("");
                                }}
                                className="rounded-full px-3 py-1.5 text-xs font-semibold text-rose-400 transition hover:bg-rose-50"
                              >
                                batal
                              </button>
                              <button
                                type="button"
                                onClick={sendReply}
                                disabled={replySending}
                                className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-bold text-white shadow transition hover:bg-rose-600 disabled:opacity-60"
                              >
                                {replySending ? "mengirim…" : "kirim balasan →"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {replyError && (
                        <p className="mt-1.5 text-xs text-rose-500">{replyError}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                onClick={() => {
                  setReading(null);
                  setStage("grid");
                }}
                className="mx-auto mt-6 block rounded-full border border-white/20 bg-white/5 px-6 py-2.5 text-sm text-white/80 transition hover:bg-white/10"
              >
                ← kembali ke tumpukan surat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
