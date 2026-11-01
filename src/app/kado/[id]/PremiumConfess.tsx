"use client"

/**
 * PremiumConfess — kado "Confess": The Heartstring Edition.
 *
 * Pengakuan yang disegel detak jantung pengirimnya, kini 4 babak dengan
 * reward di tiap babak (tiap langkah SELALU membuka info baru — tidak ada
 * gerbang kosong):
 *
 *   veil      (Babak 0 — Segel)   layar gelap + segel lilin hati berinisial.
 *                                 Tension jujur: "bisa dibuka SEKALI".
 *                                 Tap → unlock audio (gesture-safe) → babak 1.
 *   heartbeat (Babak 1 — Detak)   penerima MENAHAN hati lewat 3 detak
 *                                 sungguhan (850→650→480 ms, makin cepat):
 *                                 tiap detak = suara lub-dub + getar + reward:
 *                                   detak 1 → potongan pertama pesan (blur)
 *                                   detak 2 → topeng nama bocor (R***I → Ri••i)
 *                                   detak 3 → hati RETAK.
 *                                 Lepas di tengah → hati "tenang" (timer beat
 *                                 berhenti), reward yang sudah terbuka TETAP
 *                                 didapat, menahan lagi lanjut dari detak
 *                                 berikutnya.
 *   shatter   (Babak 2 — Retak)   kilatan putih-rose, garis retak menjalar,
 *                                 hati memudar berserakan, kunang-kunang naik,
 *                                 shimmer berkilau → otomatis lanjut.
 *   letter    (Babak 3 — Surat)   lembar pengakuan ber-aksen gold-foil; pesan
 *                                 muncul BARIS DEMI BARIS (blur → tajam, chime
 *                                 halus per baris). Tanda tangan masih
 *                                 bertopeng sampai parent mengirim revealName
 *                                 (jawaban diterima) → crossfade nama asli +
 *                                 strip memento "Resmi jadi kenangan — <tgl>".
 *
 * Identitas & memento: nama asli PENGIRIM sudah berada di payload client
 * (dipakai untuk reveal) — topeng progresif (Ri••i) murni dihitung dari
 * senderName di sisi yang sama, TANPA mengirim field baru ke publik.
 *
 * Fail-safe (tidak ada yang buntu):
 * - Detak lama 12 dtk tanpa selesai → tombol halus "Lanjutkan" melompat ke
 *   babak retak (reward tetap diberikan).
 * - prefers-reduced-motion → tap segel langsung membuka surat (tanpa ritual).
 * - Keyboard: segel = tombol biasa; menahan Space/Enter = menahan hati.
 * - Browser tanpa Web Audio / getar → suara & haptic jadi no-op, alur utuh.
 * - Tanpa mic, tanpa izin, tanpa jaringan tambahan — semua lokal.
 *
 * Performa mobile 60FPS:
 * - Animasi hanya transform/opacity/filter; elemen utama will-change-transform.
 * - Kunang-kunang & pecahan cuma opacity+transform, sekali jalan (tanpa loop).
 * - Mesin detak pakai setTimeout berantai (bukan rAF per-frame) — hemat CPU.
 * - AudioContext dibuat SEKALI dari gesture pertama dan ditutup saat unmount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Heart, Lock, Volume2, VolumeX } from "lucide-react"
import { useKadoAudio } from "./useKadoAudio"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumConfessProps {
  /** Nama penerima — tampil di badge header & kepala lembar pengakuan. */
  targetName: string
  /** Pesan pengirim — inti pengakuannya. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim (untuk topeng progresif & reveal) — tetap bertopeng di layar. */
  senderName?: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** Tanggal kado dibuat (ISO) — ditampilkan sebagai "Tersegel <tanggal>". */
  createdAt?: string | null
  /** Judul di atas kartu — override via kadoData.title. */
  title?: string
  /** Dipanggil SEKALI setelah lembar pengakuan selesai terbuka. */
  onOpenComplete: () => void
}

type ConfessPhase = "veil" | "heartbeat" | "shatter" | "letter"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = "Ada sesuatu yang pengen aku sampaikan…"

/** Durasi tiap detak (ms) — makin lama ditahan, makin cepat berdetak. */
const BEAT_DURATIONS = [850, 650, 480]

/** Diam selebihnya di babak detak → tombol "Lanjutkan" muncul (fail-safe). */
const STALL_MS = 12000

/** Geometri panggung (px) — fix biar posisi presisi & aman di layar 320px. */
const STAGE_W = 280
const STAGE_H = 300

const RING_R = 56
const RING_C = 2 * Math.PI * RING_R

/** Kunang-kunang sekali pakai saat hati pecah — naik & memudar. */
const FIREFLIES = [
  { x: -84, y: -120, d: 0.05 },
  { x: -46, y: -150, d: 0.18 },
  { x: -8, y: -132, d: 0.1 },
  { x: 34, y: -158, d: 0.26 },
  { x: 72, y: -128, d: 0.14 },
  { x: 98, y: -96, d: 0.34 },
  { x: -104, y: -84, d: 0.4 },
  { x: 12, y: -176, d: 0.5 },
]

/** Pecahan hati — terpental saat retak (opacity+transform saja). */
const SHARDS = [
  { x: -70, y: -46, r: -120, d: 0.0 },
  { x: 64, y: -58, r: 140, d: 0.05 },
  { x: -46, y: 44, r: -80, d: 0.1 },
  { x: 52, y: 40, r: 100, d: 0.14 },
  { x: -14, y: -84, r: -160, d: 0.18 },
  { x: 20, y: 78, r: 60, d: 0.22 },
]

/** Garis retak di atas hati (koordinat viewBox 132×132). */
const CRACK_PATHS = [
  { d: "M66 12 L59 46 L73 72 L61 106", delay: 0 },
  { d: "M59 46 L39 58", delay: 0.14 },
  { d: "M73 72 L95 84", delay: 0.2 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Util kecil
// ─────────────────────────────────────────────────────────────────────────────

/** Getar halus — no-op di browser tanpa haptic. */
function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* diabaikan */
    }
  }
}

/** Topeng progresif: "Rizri" → "Ri••i" (2 huruf depan + 1 belakang). */
function leakName(name: string): string | null {
  const chars = [...name.trim()]
  if (chars.length === 0) return null
  if (chars.length <= 3) return `${chars[0]}•${chars[chars.length - 1]}`
  return (
    chars.slice(0, 2).join("") +
    "•".repeat(chars.length - 3) +
    chars[chars.length - 1]
  )
}

/** Potongan pembuka pesan untuk teaser babak detak. */
function firstWords(s: string, n = 6): string {
  const t = s.trim().replace(/\s+/g, " ")
  if (!t) return ""
  const w = t.split(" ")
  return w.slice(0, n).join(" ") + (w.length > n ? "…" : "")
}

/** Format tanggal Indonesia — hanya dirender di fase pasca-interaksi (client). */
function formatTanggal(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumConfess({
  targetName,
  message,
  fomoInitials,
  senderName = null,
  revealName = null,
  createdAt = null,
  title = DEFAULT_TITLE,
  onOpenComplete,
}: PremiumConfessProps) {
  const [phase, setPhase] = useState<ConfessPhase>("veil")
  const [beatIndex, setBeatIndex] = useState(0) // 0..3 — detak ke-berapa yang selesai
  const [holding, setHolding] = useState(false)
  const [stalled, setStalled] = useState(false)

  const reduceMotion = useReducedMotion()
  const audio = useKadoAudio()
  // ref supaya effect tidak ikut re-run saat state mute berubah
  const audioRef = useRef(audio)
  audioRef.current = audio

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // ── mesin detak: setTimeout berantai dari detak berikutnya ───────────────
  const beatTimersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const beatIndexRef = useRef(0)

  const clearBeatTimers = useCallback(() => {
    beatTimersRef.current.forEach(clearTimeout)
    beatTimersRef.current = []
  }, [])

  const fireBeat = useCallback(
    (i: number) => {
      beatIndexRef.current = i + 1
      setBeatIndex(i + 1)
      audioRef.current.beat(0.4 + (i / (BEAT_DURATIONS.length - 1)) * 0.6)
      buzz([28, 62, 34])
      if (i === BEAT_DURATIONS.length - 1) {
        clearBeatTimers()
        setHolding(false)
        audioRef.current.crack()
        buzz([60, 40, 120])
        setPhase("shatter")
      }
    },
    [clearBeatTimers]
  )

  const scheduleBeats = useCallback(
    (from: number) => {
      clearBeatTimers()
      let acc = 0
      for (let i = from; i < BEAT_DURATIONS.length; i++) {
        acc += BEAT_DURATIONS[i]
        const idx = i
        beatTimersRef.current.push(setTimeout(() => fireBeat(idx), acc))
      }
    },
    [clearBeatTimers, fireBeat]
  )

  // bersih-bersih timer saat unmount
  useEffect(() => clearBeatTimers, [clearBeatTimers])

  // ── interaksi tahan (pointer + keyboard) ─────────────────────────────────

  function beginHold() {
    if (phase !== "heartbeat" || holding || beatIndexRef.current >= BEAT_DURATIONS.length) return
    audioRef.current.unlock()
    setStalled(false)
    setHolding(true)
    scheduleBeats(beatIndexRef.current)
  }

  function endHold() {
    if (phase !== "heartbeat" || !holding) return
    setHolding(false)
    clearBeatTimers()
  }

  // ── transisi antar-babak ─────────────────────────────────────────────────

  function openSeal() {
    if (phase !== "veil") return
    audioRef.current.unlock()
    buzz(18)
    if (reduceMotion) {
      // jalur reduced-motion: ritual dilewati, surat langsung terbuka
      setPhase("letter")
      return
    }
    setPhase("heartbeat")
  }

  // shatter → letter (otomatis; shimmer di tengah jalan)
  useEffect(() => {
    if (phase !== "shatter") return
    const t0 = setTimeout(() => audioRef.current.shimmer(), 350)
    const t1 = setTimeout(
      () => setPhase("letter"),
      reduceMotion ? 250 : 1750
    )
    return () => {
      clearTimeout(t0)
      clearTimeout(t1)
    }
  }, [phase, reduceMotion])

  // fail-safe: babak detak mandek 12 dtk → "Lanjutkan"
  useEffect(() => {
    if (phase !== "heartbeat") return
    setStalled(false)
    const t = setTimeout(() => setStalled(true), STALL_MS)
    return () => clearTimeout(t)
  }, [phase])

  function forceContinue() {
    if (phase !== "heartbeat") return
    clearBeatTimers()
    setHolding(false)
    audioRef.current.crack()
    buzz([60, 40, 120])
    setPhase("shatter")
  }

  // chime per baris saat surat terbuka (maks 4 nada)
  const lines = useMemo(() => message.replace(/\n{3,}/g, "\n\n").split("\n"), [message])
  const nonEmptyLines = useMemo(() => lines.filter((l) => l.trim()).length, [lines])
  const LINE_STAGGER = Math.min(0.32, 2.2 / Math.max(1, nonEmptyLines - 1 || 1))

  useEffect(() => {
    if (phase !== "letter") return
    const timers: ReturnType<typeof setTimeout>[] = []
    const n = Math.min(4, nonEmptyLines)
    for (let i = 0; i < n; i++) {
      timers.push(setTimeout(() => audioRef.current.chime(i), 350 + i * LINE_STAGGER * 1000))
    }
    if (reduceMotion) {
      const t = setTimeout(notifyOpenComplete, 400)
      timers.push(t)
    }
    return () => timers.forEach(clearTimeout)
     
  }, [phase])

  // reveal (jawaban diterima) → kilauan + getar lembut
  useEffect(() => {
    if (!revealName) return
    audioRef.current.shimmer()
    buzz([20, 80, 20, 80, 20])
  }, [revealName])

  // ── nilai turunan ────────────────────────────────────────────────────────

  const initialChar = (
    fomoInitials?.trim()?.[0] ?? senderName?.trim()?.[0] ?? "?"
  ).toUpperCase()

  // topeng saat surat: kalau nama bocor di babak detak → pakai versi bocor
  const leaked = senderName ? leakName(senderName) : null
  const maskedNow = leaked ?? fomoInitials ?? "Seseorang"

  const sealedDate =
    createdAt && !Number.isNaN(Date.parse(createdAt))
      ? formatTanggal(new Date(createdAt))
      : null
  const mementoDate = formatTanggal(new Date()) // hanya dirender pasca-interaksi

  const holdingPulse = holding && beatIndex < BEAT_DURATIONS.length

  // ── render ───────────────────────────────────────────────────────────────

  return (
    <section className="relative flex w-full flex-col items-center py-6 text-zinc-100">
      {/* tombol mute — selalu tersedia */}
      <button
        type="button"
        onClick={audio.toggleMuted}
        aria-label={audio.muted ? "Nyalakan suara" : "Bisukan suara"}
        className="absolute right-0 top-0 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-zinc-200"
      >
        {audio.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-3.5 py-1.5 text-xs text-rose-200">
          💜 Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{title}</h1>
        {phase === "veil" && (
          <p className="mt-2 text-sm text-zinc-400">
            Tersegel dengan detak jantung seseorang.
          </p>
        )}
        {phase === "heartbeat" && (
          <p className="mt-2 text-sm text-zinc-400">Dengarkan… dia masih berdetak.</p>
        )}
      </header>

      {/* ── PANGGUNG (babak 0–2) — menutup mulus saat surat naik ────────── */}
      <motion.div
        className="relative mt-4 flex items-center justify-center overflow-hidden will-change-transform"
        initial={false}
        animate={{ height: phase === "letter" ? 0 : STAGE_H }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        style={{ width: STAGE_W }}
      >
        {/* glow ambien — menguat mengikuti detak */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl will-change-transform"
          style={{
            background:
              "radial-gradient(closest-side, rgba(244,63,94,0.35), rgba(168,85,247,0.16), transparent)",
          }}
          initial={false}
          animate={{
            opacity:
              phase === "veil" ? 0.1 : phase === "heartbeat" ? 0.16 + beatIndex * 0.16 : 0.55,
          }}
          transition={{ duration: 0.3 }}
        />

        {/* ═══ BABAK 0 — SEGEL ═══ */}
        <AnimatePresence>
          {phase === "veil" && (
            <motion.div
              key="veil"
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : { opacity: 0, scale: 0.86, filter: "blur(8px)", transition: { duration: 0.5, ease: "easeIn" } }
              }
              className="absolute inset-0 z-10 flex flex-col items-center justify-center will-change-transform"
            >
              <motion.button
                type="button"
                onClick={openSeal}
                aria-label="Buka segel pengakuan"
                whileTap={reduceMotion ? undefined : { scale: 0.95 }}
                className="relative h-[150px] w-[150px] cursor-pointer select-none"
              >
                {/* blob segel lilin */}
                <motion.div
                  animate={reduceMotion ? undefined : { scale: [1, 1.03, 1], rotate: [0, 0.8, 0] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 flex items-center justify-center border border-rose-200/25 shadow-[0_0_54px_rgba(244,63,94,0.42),inset_0_2px_10px_rgba(255,255,255,0.22),inset_0_-8px_16px_rgba(0,0,0,0.5)] will-change-transform"
                  style={{
                    borderRadius: "46% 54% 52% 48% / 52% 46% 54% 48%",
                    background:
                      "linear-gradient(160deg, rgba(244,63,94,0.9), rgba(159,18,57,0.95) 55%, rgba(76,5,25,0.98))",
                  }}
                >
                  {/* cincin dalam */}
                  <span className="pointer-events-none absolute inset-[14px] rounded-full border border-rose-100/20" />
                  {/* kilau segel */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute left-[18%] top-[10%] h-[34%] w-[38%] rounded-full bg-white/25 blur-md"
                  />
                  <span className="relative font-serif text-5xl font-bold text-rose-50 drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                    {initialChar}
                  </span>
                </motion.div>
                {/* tetesan lilin */}
                <span
                  aria-hidden
                  className="absolute -bottom-1.5 left-6 h-5 w-3.5 rounded-b-full rounded-t-sm bg-gradient-to-b from-rose-700 to-rose-900/90"
                />
              </motion.button>

              <p className="mt-6 max-w-[240px] text-center text-sm leading-relaxed text-zinc-300">
                Ada yang menyimpan perasaan untukmu…
              </p>

              {/* tension jujur — mekanik sekali-buka yang sebenarnya */}
              <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] text-zinc-400">
                <Lock className="h-3 w-3" />
                Bisa dibuka SEKALI — setelah itu jadi kenangan
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ BABAK 1 — DETAK ═══ */}
        <AnimatePresence>
          {phase === "heartbeat" && (
            <motion.div
              key="heartbeat"
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : { opacity: 0, scale: 1.08, filter: "blur(6px)", transition: { duration: 0.45, ease: "easeIn" } }
              }
              className="absolute inset-0 z-10 flex flex-col items-center justify-center will-change-transform"
            >
              {/* lambang hati — tahan untuk merasakan 3 detaknya */}
              <button
                type="button"
                aria-label="Tahan hatinya untuk merasakan detak jantung pengirim"
                onPointerDown={beginHold}
                onPointerUp={endHold}
                onPointerLeave={endHold}
                onPointerCancel={endHold}
                onKeyDown={(e) => {
                  if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                    e.preventDefault()
                    beginHold()
                  }
                }}
                onKeyUp={endHold}
                className="relative flex h-[132px] w-[132px] touch-none items-center justify-center select-none"
                style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
              >
                {/* cincin progres detak: 3 segmen */}
                <svg viewBox="0 0 132 132" className="absolute inset-0 h-full w-full -rotate-90">
                  <circle cx="66" cy="66" r={RING_R} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="5" />
                  <circle
                    cx="66"
                    cy="66"
                    r={RING_R}
                    fill="none"
                    stroke="url(#confessGrad)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={RING_C}
                    strokeDashoffset={RING_C * (1 - beatIndex / BEAT_DURATIONS.length)}
                    className="transition-[stroke-dashoffset] duration-300"
                  />
                  <defs>
                    <linearGradient id="confessGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#f43f5e" />
                      <stop offset="100%" stopColor="#a855f7" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* inti hati — pulse di-remount tiap detak biar sinkron dgn audio */}
                <motion.span
                  key={`pulse-${beatIndex}-${holding ? "h" : "i"}`}
                  initial={{ scale: 1 }}
                  animate={
                    reduceMotion
                      ? { scale: 1 }
                      : holdingPulse
                        ? { scale: [1, 1.16, 1] }
                        : { scale: [1, 1.035, 1] }
                  }
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : holdingPulse
                        ? { duration: 0.42, ease: "easeOut" }
                        : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                  }
                  className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-rose-400/25 will-change-transform"
                  style={{
                    background:
                      "radial-gradient(circle at 34% 28%, rgba(244,63,94,0.5), rgba(168,85,247,0.28) 60%, rgba(24,16,22,0.9) 100%)",
                    boxShadow:
                      "0 0 32px rgba(244,63,94,0.35), inset 0 2px 8px rgba(255,255,255,0.18), inset 0 -6px 12px rgba(0,0,0,0.45)",
                  }}
                >
                  <Heart
                    className={`h-10 w-10 transition-colors duration-300 ${
                      beatIndex > 0
                        ? "fill-rose-400 text-rose-300 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                        : "fill-rose-500/70 text-rose-300/80"
                    }`}
                    strokeWidth={1.5}
                  />
                </motion.span>
              </button>

              <p className="mt-4 max-w-[240px] text-center text-xs leading-relaxed text-zinc-500">
                {holdingPulse
                  ? "Tahan terus… jangan dilepas 💓"
                  : beatIndex >= BEAT_DURATIONS.length
                    ? "hatinya retak untukmu…"
                    : "Tempelkan jarimu di hatinya — rasakan detaknya 🤍"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ BABAK 2 — RETAK ═══ */}
        <AnimatePresence>
          {phase === "shatter" && (
            <motion.div
              key="shatter"
              className="absolute inset-0 z-10 flex items-center justify-center"
            >
              {/* kilatan putih-rose */}
              {!reduceMotion && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-30"
                  style={{
                    background:
                      "radial-gradient(circle at center, rgba(255,240,245,0.95), rgba(244,63,94,0.35) 45%, transparent 72%)",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.95, 0] }}
                  transition={{ duration: 0.75, times: [0, 0.25, 1], ease: "easeOut" }}
                />
              )}

              {/* hati yang retak & memudar */}
              <motion.div
                className="relative flex h-[132px] w-[132px] items-center justify-center will-change-transform"
                initial={{ scale: 1, opacity: 1 }}
                animate={
                  reduceMotion
                    ? { opacity: 0 }
                    : {
                        scale: [1, 1.22, 1.04],
                        rotate: [0, -4, 3],
                        opacity: [1, 1, 0],
                        filter: ["blur(0px)", "blur(0px)", "blur(8px)"],
                      }
                }
                transition={{ duration: 0.9, times: [0, 0.3, 1], ease: "easeOut" }}
              >
                <span
                  className="absolute inset-0 flex items-center justify-center rounded-full border border-rose-400/25"
                  style={{
                    background:
                      "radial-gradient(circle at 34% 28%, rgba(244,63,94,0.5), rgba(168,85,247,0.28) 60%, rgba(24,16,22,0.9) 100%)",
                    boxShadow: "0 0 40px rgba(244,63,94,0.5)",
                  }}
                >
                  <Heart className="h-10 w-10 fill-rose-400 text-rose-200 drop-shadow-[0_0_14px_rgba(244,63,94,0.9)]" strokeWidth={1.5} />
                </span>
                {/* garis retak menjalar */}
                <svg viewBox="0 0 132 132" className="absolute inset-0 h-full w-full">
                  {CRACK_PATHS.map((c, i) => (
                    <motion.path
                      key={i}
                      d={c.d}
                      stroke="rgba(255,235,240,0.95)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.4, delay: c.delay, ease: "easeOut" }}
                    />
                  ))}
                </svg>
              </motion.div>

              {/* pecahan hati */}
              {!reduceMotion &&
                SHARDS.map((s, i) => (
                  <motion.span
                    key={`shard-${i}`}
                    aria-hidden
                    className="absolute left-1/2 top-1/2 h-2 w-2 rounded-[2px] bg-rose-400/90 will-change-transform"
                    style={{ boxShadow: "0 0 8px rgba(244,63,94,0.8)" }}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.6, rotate: 0 }}
                    animate={{ opacity: [0, 1, 0], x: s.x, y: s.y, scale: [0.6, 1, 0.4], rotate: s.r }}
                    transition={{ delay: 0.25 + s.d, duration: 1.1, ease: "easeOut" }}
                  />
                ))}

              {/* kunang-kunang naik */}
              {!reduceMotion && (
                <span aria-hidden className="pointer-events-none absolute inset-0 z-20 block">
                  {FIREFLIES.map((p, i) => (
                    <motion.span
                      key={`ff-${i}`}
                      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-amber-200/90 shadow-[0_0_10px_rgba(253,230,138,0.9)]"
                      style={{ marginLeft: p.x, marginTop: 30 }}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                      animate={{ opacity: [0, 0.9, 0], x: p.x * 0.2, y: p.y, scale: [0.5, 1, 0.4] }}
                      transition={{ delay: 0.35 + p.d, duration: 1.9, times: [0, 0.3, 1], ease: "easeOut" }}
                    />
                  ))}
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ── REWARD BABAK DETAK: teaser pesan + topeng bocor ──────────────── */}
      <AnimatePresence>
        {phase === "heartbeat" && beatIndex >= 1 && (
          <motion.div
            key="teaser"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="mt-2 w-full max-w-xs rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center backdrop-blur-md"
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300/60">
              Potongan pengakuan
            </p>
            <p className="font-hand mt-1.5 select-none text-base text-zinc-300 blur-[5px]">
              {firstWords(message, 6)}
            </p>
            {beatIndex >= 2 && (
              <motion.p
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                className="mt-2 text-xs text-zinc-400"
              >
                Dari: <b className="font-semibold text-rose-300/90">{maskedNow}</b>
                {leaked && " — satu huruf lagi… 👀"}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* tombol fail-safe babak detak */}
      <AnimatePresence>
        {phase === "heartbeat" && stalled && (
          <motion.button
            key="stall"
            type="button"
            onClick={forceContinue}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition-colors hover:text-zinc-300"
          >
            Kesusahan? Lanjutkan →
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── BABAK 3 — SURAT ═══════════════════════════════════════════════ */}
      <AnimatePresence>
        {phase === "letter" && (
          <motion.div
            key="letter"
            initial={reduceMotion ? false : { opacity: 0, y: 30, rotateX: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
            className="mt-2 w-full max-w-sm will-change-transform"
          >
            <div
              className="rounded-3xl border border-white/10 p-6 shadow-2xl shadow-black/50 backdrop-blur-md"
              style={{
                background:
                  "linear-gradient(170deg, rgba(52,38,46,0.94), rgba(30,22,28,0.97) 55%, rgba(22,16,20,0.98))",
              }}
            >
              {/* label gold-foil */}
              <p className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-[10px] font-bold uppercase tracking-[0.3em] text-transparent">
                Pengakuan untuk {targetName}
              </p>

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-amber-200/30 to-transparent" />

              {/* pesan — baris demi baris, blur → tajam */}
              <div className="font-hand space-y-2.5 text-xl leading-relaxed text-zinc-100">
                {lines.map((line, i) =>
                  line.trim() ? (
                    <motion.p
                      key={`ln-${i}`}
                      initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(8px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{
                        duration: 0.55,
                        delay: reduceMotion ? 0 : 0.35 + i * LINE_STAGGER,
                        ease: "easeOut",
                      }}
                      onAnimationComplete={
                        i === lines.length - 1 || i >= lastNonEmptyIndex(lines)
                          ? notifyOpenComplete
                          : undefined
                      }
                    >
                      {line}
                    </motion.p>
                  ) : (
                    <div key={`sp-${i}`} className="h-3" aria-hidden />
                  )
                )}
              </div>

              <div className="mt-5 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              {/* tanda tangan — bertopeng → nama asli saat diterima */}
              <div className="mt-4 flex items-center justify-end gap-2 text-sm">
                <span className="text-zinc-500">Dari:</span>
                <AnimatePresence mode="wait" initial={false}>
                  {revealName ? (
                    <motion.span
                      key="real"
                      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="font-semibold text-rose-200 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                    >
                      {revealName}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="masked"
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(6px)" }}
                      transition={{ duration: 0.5 }}
                      className="font-semibold text-rose-300/70 drop-shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                    >
                      {maskedNow}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {sealedDate && (
                <p className="mt-3 text-right text-[11px] italic text-zinc-600">
                  ✳ tersegel {sealedDate}
                </p>
              )}

              {/* memento — resmi jadi kenangan */}
              <AnimatePresence>
                {revealName && (
                  <motion.div
                    key="memento"
                    initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: 0.6, duration: 0.6, ease: "easeOut" }}
                    className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-center"
                  >
                    <p className="text-xs font-semibold text-amber-200">
                      💜 Kado ini resmi jadi kenangan
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-200/70">{mementoDate}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/** Indeks baris tak-kosong terakhir — penanda selesai reveal surat. */
function lastNonEmptyIndex(lines: string[]): number {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trim()) return i
  }
  return 0
}
