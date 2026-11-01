"use client"

/**
 * PremiumCandleBlow — kado "Candle Blow": The Wish Keeper Edition.
 *
 * Dari "buka mic → tiup → selesai" menjadi ritual 4 babak — konsisten dengan
 * Heartstring (Confess) & Blooming (Bouquet). Setiap babak SELALU membuka
 * info baru (tidak ada gerbang kosong):
 *
 *   kedatangan (Babak 0)  ruang gulita; lilin padat & sumbu menunggu. Satu
 *                         tombol: "Nyalakan lilinnya" — gesture pertama =
 *                         unlock audio → strike() korek + sumbu menyala.
 *   ritual     (Babak 1)  api menyala + label "Dari R•••i — satu permintaan,
 *                         satu tiupan." Gerbang emosional: TAHAN tombol
 *                         3 detik sambil membuat permintaan (ring progres).
 *                         Selesai → topeng bocor R•••i → Ri••i + chime.
 *   tiup       (Babak 2)  dua tahap, seperti pita buket: tiupan LEMAH
 *                         (di atas ambang lembut, tak mencapai kuat) → api
 *                         membungkuk + "keras lagi!" + whoosh + getar, api
 *                         kembali tegak. Tiupan KUAT ≥400ms → THE
 *                         EXTINGUISH: stopAudio seketika (privasi), poof +
 *                         getar [20,40,60], asap mengepul.
 *   asap       (Babak 3)  "Make a wish, <nama> ✨" blur-masuk, lalu kartu
 *                         pesan naik: baris demi baris blur → tajam +
 *                         chime per baris. Penutup: "dinyalakan, <tanggal>".
 *                         onOpenComplete() setelah kartu masuk.
 *
 * Mesin mic diwarisi utuh dari versi lama (getUserMedia → AnalyserNode →
 * rAF → MotionValue volume tanpa re-render React per frame), ditambah
 * deteksi tiupan LEMAH vs KUAT (dua band ambang) untuk tahap tease.
 *
 * Fail-safes (aturan ritual — semua gerbang punya jalan keluar):
 * - kedatangan 9 dtk tanpa tap → menyala senyap sendiri.
 * - ritual 16 dtk tanpa ditahan → lanjut sendiri (permintaan dianggap dibuat).
 * - tiup 14 dtk tanpa hasil → tombol "Lanjutkan" (padamkan terskrip).
 * - Mic ditolak / tak support / AudioContext gagal → tap 3x (tap 1-2 tetap
 *   memicu tease "keras lagi!", tap ke-3 memadamkan) — tidak pernah buntu.
 * - Cleanup total saat unmount: rAF dicancel, SEMUA track.stop(),
 *   AudioContext mic ditutup, timer dibersihkan.
 *
 * Aksesibilitas & performa (pola Heartstring/Blooming):
 * - prefers-reduced-motion: tanpa loop flicker; ritual jadi tap biasa;
 *   seluruh transisi instan — interaksi tiup TETAP tersedia.
 * - Keyboard: semua gerbang Enter/Space (menyala, tahan-ring jalan terskrip,
 *   Lanjutkan); fallback tap 3x tetap jalan lewat onTap panggung.
 * - 60FPS: hanya transform/opacity/filter; volume real-time via MotionValue.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type TapInfo,
} from "framer-motion"
import { Volume2, VolumeX } from "lucide-react"
import { useKadoAudio } from "./useKadoAudio"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumCandleBlowProps {
  /** Nama penerima — badge header, "Make a wish, <nama>", kartu pesan. */
  targetName: string
  /** Pesan pengirim — kartu baris-per-baris di Babak 3. */
  message: string
  /** Inisial bertopeng dari parent ("R***I") — fallback tanpa senderName. */
  fomoInitials: string | null
  /** Nama asli saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /**
   * Nama asli pengirim — sumber topeng lokal & bocoran bertahap
   * (pola sama dengan Heartstring/Blooming — nol perubahan backend).
   */
  senderName?: string | null
  /** ISO timestamp — untuk "dinyalakan, <tanggal>" di kartu. */
  createdAt?: string | null
  /** kadoData.occasion — mengubah narasi ritual (default "ultah"). */
  occasion?: string | null
  /** Dipanggil SEKALI setelah kartu pesan selesai masuk. */
  onOpenComplete: () => void
}

type Babak = "kedatangan" | "ritual" | "tiup" | "asap"
type MicState = "idle" | "requesting" | "granted" | "denied" | "unsupported"
type Occasion = "ultah" | "anniversary" | "graduasi"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Ambang tiupan KUAT (rata-rata spektrum 0..1) — ruangan senyap ~0.05-0.2. */
const BLOW_THRESHOLD = 0.3
/** Ambang tiupan LEMAH — di atas ini api sudah membungkuk & dihitung hembusan. */
const BLOW_SOFT_THRESHOLD = 0.12
/** Tiupan kuat harus stabil selama ini (ms) — mencegah mati karena decak. */
const BLOW_SUSTAIN_MS = 400
/** Hembusan lebih pendek dari ini dianggap decak, bukan tiupan lemah (ms). */
const BLOW_MIN_WEAK_MS = 220
/** Durasi menahan tombol permintaan (ms). */
const HOLD_WISH_MS = 3000

/** Gerbang otomatis (ms) — jalan pintas fail-safe per babak. */
const IDLE_KEDATANGAN_MS = 9000
const IDLE_RITUAL_MS = 16000
const IDLE_TIUP_MS = 14000

/** Reset hitungan tap fallback setelah jeda sejauh ini (ms). */
const TAP_WINDOW_MS = 2200

/** Geometri api & lilin (px). */
const FLAME_W = 34
const FLAME_H = 58
const BODY_W = 78
const BODY_H = 148

/** Copy narasi per momen (ultah default) — kadoData.occasion. */
const OCCASION_COPY: Record<Occasion, { wishPrompt: string; wishDone: string; label: string }> = {
  ultah: {
    wishPrompt: "Pejamkan mata, buat permintaan ulang tahunmu dulu 🤍",
    wishDone: "Permintaanmu sudah dititipkan ke apinya.",
    label: "lilin ulang tahun",
  },
  anniversary: {
    wishPrompt: "Pejamkan mata, buat satu permintaan untuk kalian berdua 🤍",
    wishDone: "Permintaan kalian sudah dititipkan ke apinya.",
    label: "lilin anniversary",
  },
  graduasi: {
    wishPrompt: "Pejamkan mata, buat permintaan buat jalanmu ke depan 🤍",
    wishDone: "Permintaanmu sudah dititipkan ke apinya.",
    label: "lilin wisuda",
  },
}

/** Tease tiupan lemah — eskalasi per hembusan gagal. */
const TEASES = ["Shhh… api-nya goyang 🌬️", "Keras lagi! 💨", "Hembus lebih kuat… sedikit lagi!", "Gabung aja napasmu, terus tiup! 💨"]

// ─────────────────────────────────────────────────────────────────────────────
// Pembantu (pola Heartstring/Blooming — konsisten antar komponen premium)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Topeng nama lokal — level 0: "R•••i"; level 1 (bocor): "Ri••i".
 * Sama dengan gaya bocoran Heartstring: satu huruf tambahan dari depan.
 */
function maskName(name: string | null | undefined, level: 0 | 1): string {
  const n = (name ?? "").trim()
  if (n.length <= 2) return n || "Seseorang"
  if (level === 0) {
    const mid = Math.max(1, Math.min(3, n.length - 2))
    return `${n[0]}${"•".repeat(mid)}${n[n.length - 1]}`
  }
  const mid = Math.max(1, Math.min(3, n.length - 3))
  return `${n.slice(0, 2)}${"•".repeat(mid)}${n[n.length - 1]}`
}

/** Tanggal Indonesia — "1 November 2026"; "" bila tak valid. */
function tanggalIndo(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

/**
 * Pesan → baris tampil: pecah \n; baris > 70 karakter dipecah di batas
 * kalimat (.,!?,;) supaya reveal per baris terasa natural.
 */
function splitIntoLines(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const line of raw) {
    if (line.length <= 70) {
      out.push(line)
      continue
    }
    const parts = line.split(/(?<=[.,!?;])\s+/)
    let buf = ""
    for (const p of parts) {
      const cand = buf ? `${buf} ${p}` : p
      if (cand.length > 70 && buf) {
        out.push(buf)
        buf = p
      } else {
        buf = cand
      }
    }
    if (buf) out.push(buf)
  }
  return out.length ? out : [text]
}

/** Tekstur kertas halus untuk kartu (feTurbulence, opacity rendah). */
const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`

// ─────────────────────────────────────────────────────────────────────────────
// Sub-komponen kecil
// ─────────────────────────────────────────────────────────────────────────────

/** Asap tipis mengepul dari sumbu setelah api padam (sekali jalan). */
function SmokeWisp({ delay, reduceMotion }: { delay: number; reduceMotion: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="absolute bottom-[8px] left-1/2 h-[46px] w-[5px] rounded-full"
      style={{
        marginLeft: -2.5,
        background: "linear-gradient(180deg, transparent, rgba(203,213,225,0.55), transparent)",
        filter: "blur(3px)",
      }}
      initial={reduceMotion ? { opacity: 0.2, y: -20 } : { opacity: 0, y: 0, x: 0, scale: 0.7 }}
      animate={
        reduceMotion
          ? { opacity: 0.12, y: -30 }
          : { opacity: [0, 0.5, 0], y: -68, x: [0, 7, -5, 9, 4], scale: [0.7, 1.1, 1.35] }
      }
      transition={reduceMotion ? { duration: 0.5, delay } : { duration: 2.9, delay, ease: "easeOut" }}
    />
  )
}

/**
 * Api lilin 4 lapis (oranye → inti kuning-putih → dasar biru).
 * Empat div bersarang agar transform tidak saling mengalahkan:
 *   luar     — nyala/padam (scale 0↔1, origin bawah)
 *   flicker  — flicker loop organik (rotasi asimetris + scale + opacity)
 *   bend     — bengkok horizontal reaksi tiupan (MotionValue rotate)
 *   squash   — squash vertikal reaksi tiupan (MotionValue scaleY)
 */
function Flame({
  lit,
  blown,
  reduceMotion,
  blowSquash,
  blowBend,
}: {
  lit: boolean
  blown: boolean
  reduceMotion: boolean
  blowSquash: MotionValue<number>
  blowBend: MotionValue<number>
}) {
  const burning = lit && !blown
  return (
    <motion.div
      className="relative will-change-transform"
      style={{ width: FLAME_W, height: FLAME_H, transformOrigin: "50% 100%" }}
      initial={false}
      animate={burning ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
      transition={
        blown
          ? { duration: reduceMotion ? 0 : 0.55, ease: "easeIn" } // menyusut saat ditiup
          : { duration: reduceMotion ? 0 : 0.9, ease: "easeOut" } // menyala
      }
    >
      <motion.div
        className="relative h-full w-full will-change-transform"
        style={{ transformOrigin: "50% 100%" }}
        animate={
          burning && !reduceMotion
            ? {
                rotate: [-2.4, 1.8, -1.1, 3, -2.4], // rotasi asimetris → organik
                scaleY: [1, 1.08, 0.93, 1.12, 0.98, 1],
                scaleX: [1, 0.94, 1.05, 0.9, 1.02, 1],
                opacity: [0.93, 1, 0.86, 1, 0.9, 0.93],
              }
            : { rotate: 0, scaleY: 1, scaleX: 1, opacity: 1 }
        }
        transition={
          burning && !reduceMotion
            ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.2 }
        }
      >
        {/* bengkok horizontal — angin menghantam dari samping */}
        <motion.div
          className="relative h-full w-full will-change-transform"
          style={{ rotate: blowBend, transformOrigin: "50% 95%" }}
        >
          {/* squash vertikal — api membungkuk saat angin menghantam */}
          <motion.div
            className="relative h-full w-full will-change-transform"
            style={{ scaleY: blowSquash, transformOrigin: "50% 100%" }}
          >
            {/* lapisan api luar (oranye) */}
            <span
              className="absolute inset-0"
              style={{
                borderRadius: "50% 50% 50% 50% / 62% 62% 38% 38%",
                background:
                  "linear-gradient(180deg, #ffe08a 0%, #ffb03a 38%, #ff6b1f 72%, #e0440e 100%)",
                filter: "blur(1.6px)",
              }}
            />
            {/* inti panas (kuning-putih) */}
            <span
              className="absolute bottom-[5px] left-1/2 h-[27px] w-[14px] -translate-x-1/2"
              style={{
                borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%",
                background: "linear-gradient(180deg, #fffdf2 0%, #ffeeb0 55%, #ffc45e 100%)",
                filter: "blur(0.5px)",
              }}
            />
            {/* dasar biru khas api lilin */}
            <span
              className="absolute bottom-0 left-1/2 h-[11px] w-[17px] -translate-x-1/2 rounded-full bg-blue-400/45"
              style={{ filter: "blur(3.5px)" }}
            />
          </motion.div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

/**
 * Korek api sekali pakai — meluncir miring ke sumbu saat Babak 0 → 1,
 * kilat kecil di kepalanya, lalu menjauh memudar (kesan "menyalakan").
 */
function MatchStick({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute z-30"
      style={{ left: "50%", top: 22, transformOrigin: "100% 50%" }}
      initial={reduceMotion ? { opacity: 0 } : { x: -86, y: 34, rotate: -24, opacity: 0 }}
      animate={
        reduceMotion
          ? { opacity: [0, 1, 0] }
          : { x: [-86, -6, 2, 30], y: [34, 2, 0, 26], rotate: [-24, 12, 16, 30], opacity: [0, 1, 1, 0] }
      }
      transition={reduceMotion ? { duration: 0.4 } : { duration: 1.15, times: [0, 0.45, 0.62, 1], ease: "easeInOut" }}
    >
      {/* kepala korek + kilat */}
      <span className="absolute -top-[3px] left-0 h-[7px] w-[7px] rounded-full bg-[#3b2417]" />
      <motion.span
        className="absolute -top-[7px] -left-[3px] h-[15px] w-[15px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(255,236,170,0.95), rgba(255,170,60,0.5), transparent)" }}
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: [0, 1, 0.85, 0], scale: [0.4, 1.5, 1.1, 0.6] }}
        transition={{ duration: 0.75, delay: 0.42, times: [0, 0.25, 0.7, 1] }}
      />
      {/* batang korek */}
      <span className="absolute top-[3px] left-[3px] h-[3px] w-[52px] origin-left rotate-[16deg] rounded-full bg-gradient-to-r from-[#caa06b] to-[#8a6642]" />
    </motion.div>
  )
}

/**
 * Gerbang ritual — tombol TAHAN 3 detik dengan ring progres melingkar.
 * Pointer: tahan sungguhan. Keyboard: Enter/Space memulai hold terskrip
 * (ring jalan sendiri 3 dtk — tidak perlu menahan tombol fisik).
 */
function WishGate({
  onComplete,
  reduceMotion,
}: {
  onComplete: () => void
  reduceMotion: boolean
}) {
  const progress = useMotionValue(0)
  const runningRef = useRef<ReturnType<typeof animate> | null>(null)
  const doneRef = useRef(false)

  const start = useCallback(() => {
    if (doneRef.current || runningRef.current) return
    runningRef.current = animate(progress, 1, {
      duration: reduceMotion ? 0.4 : HOLD_WISH_MS / 1000,
      ease: "linear",
      onComplete: () => {
        doneRef.current = true
        runningRef.current = null
        onComplete()
      },
    })
  }, [progress, reduceMotion, onComplete])

  const cancel = useCallback(() => {
    if (doneRef.current) return
    runningRef.current?.stop()
    runningRef.current = null
    animate(progress, 0, { duration: 0.3, ease: "easeOut" })
  }, [progress])

  // bersih-bersih saat unmount
  useEffect(() => () => runningRef.current?.stop(), [])

  return (
    <motion.button
      type="button"
      aria-label="Tahan 3 detik — aku sudah membuat permintaan"
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          start() // hold terskrip — ring jalan sendiri sampai penuh
        }
      }}
      className="relative mx-auto flex h-16 w-16 cursor-pointer touch-none select-none items-center justify-center rounded-full border border-amber-200/40 bg-white/[0.07] backdrop-blur-md transition-transform active:scale-95"
    >
      {/* ring progres */}
      <svg aria-hidden className="pointer-events-none absolute -inset-[3px] -rotate-90" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="30" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="3" />
        <motion.circle
          cx="32"
          cy="32"
          r="30"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="3"
          strokeLinecap="round"
          style={{ pathLength: progress }}
        />
      </svg>
      <span className="text-xl" aria-hidden>
        🤍
      </span>
    </motion.button>
  )
}

/** Kartu pesan Babak 3 — naik dari bawah, baris blur → tajam (chime dari parent). */
function WishCard({
  lines,
  senderDisplay,
  revealName,
  tanggal,
  reduceMotion,
  onEntered,
}: {
  lines: string[]
  senderDisplay: string
  revealName: string | null
  tanggal: string
  reduceMotion: boolean
  onEntered: () => void
}) {
  return (
    <motion.div
      // berangkat dari bawah panggung — naik seperti hangatnya asap
      initial={reduceMotion ? false : { y: 70, opacity: 0, scale: 0.94 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 20, delay: 0.2 }}
      onAnimationComplete={onEntered}
      className="mx-auto w-full max-w-xs will-change-transform"
    >
      {/* pinggiran hangat amber (bukan gold-foil — beda dari buket) */}
      <div
        className="rounded-[20px] p-[2px] shadow-[0_24px_70px_-18px_rgba(251,146,60,0.4)]"
        style={{ background: "linear-gradient(135deg,#92400e,#fbbf24 30%,#fde68a 50%,#b45309 75%,#f59e0b)" }}
      >
        <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 p-5 backdrop-blur-md">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: PAPER_TEXTURE }} />
          <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Pesan yang menyertai apinya
          </p>

          {/* pesan — baris demi baris: blur → tajam */}
          <div className="relative mt-3 space-y-2.5">
            {lines.map((line, i) => (
              <motion.p
                key={i}
                initial={reduceMotion ? false : { opacity: 0, filter: "blur(9px)", y: 6 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.55, delay: 0.5 + i * 0.42, ease: "easeOut" }
                }
                className="font-hand whitespace-pre-wrap text-lg leading-relaxed text-zinc-100"
              >
                {line}
              </motion.p>
            ))}
          </div>

          <div className="relative mt-4 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />

          <div className="relative mt-3 flex items-center justify-end gap-2 text-sm">
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
                  {senderDisplay}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {tanggal && (
            <p className="relative mt-2 text-right text-[10px] italic text-zinc-500">
              dinyalakan, {tanggal}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumCandleBlow({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  senderName = null,
  createdAt = null,
  occasion = null,
  onOpenComplete,
}: PremiumCandleBlowProps) {
  const [babak, setBabak] = useState<Babak>("kedatangan")
  const [micState, setMicState] = useState<MicState>("idle")
  const [tapCount, setTapCount] = useState(0)
  /** Hembusan lemah terhitung — mengeskalasi copy tease. */
  const [weakCount, setWeakCount] = useState(0)
  const [showTease, setShowTease] = useState(false)
  const [showLanjut, setShowLanjut] = useState(false)
  /** Korek sedang meluncir (Babak 0 → 1) — sekali jalan. */
  const [matchShown, setMatchShown] = useState(false)
  /** Topeng sudah bocor satu level (setelah permintaan dibuat). */
  const [leaked, setLeaked] = useState(false)

  const reduceMotion = useReducedMotion() ?? false
  const audio = useKadoAudio()

  const occasionKey: Occasion =
    occasion === "anniversary" || occasion === "graduasi" ? occasion : "ultah"
  const copy = OCCASION_COPY[occasionKey]

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // semua timer ritual terpusat — dibersihkan saat unmount
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
  }, [])
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  /** Getar koreografi — no-op di browser tanpa vibrate / reduced-motion. */
  const buzz = useCallback(
    (p: number | number[]) => {
      if (reduceMotion) return
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p)
    },
    [reduceMotion]
  )

  const tanggal = useMemo(() => tanggalIndo(createdAt), [createdAt])
  const lines = useMemo(() => splitIntoLines(message), [message])

  const senderMasked = senderName ? maskName(senderName, 0) : (fomoInitials ?? "Seseorang")
  const senderLeak = senderName ? maskName(senderName, 1) : (fomoInitials ?? "Seseorang")
  const senderDisplay = leaked && senderName ? senderLeak : senderMasked

  const lit = babak === "ritual" || babak === "tiup"
  const blown = babak === "asap"

  // ── Refs audio mic (semua bisa dibersihkan dari mana pun)
  const streamRef = useRef<MediaStream | null>(null)
  const micCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const aliveRef = useRef(false)
  /** Kapan volume mulai di atas ambang KUAT — untuk sustain 400ms. */
  const loudSinceRef = useRef<number | null>(null)
  /** Kapan volume mulai di atas ambang LEMAH — untuk hitungan hembusan. */
  const softSinceRef = useRef<number | null>(null)
  /** Hembusan berjalan pernah menyentuh ambang KUAT? (jangan dihitung lemah) */
  const hitStrongRef = useRef(false)
  const mountedRef = useRef(true)

  const tapCountRef = useRef(0)
  const lastTapRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blownRef = useRef(false)

  // ── Volume real-time — MotionValue (tanpa re-render React per frame)
  const volumeMV = useMotionValue(0)

  // ── Binding visual turunan volume (semua via useTransform, nol re-render)
  /** Api membungkuk vertikal saat angin menghantam. */
  const blowSquash = useTransform(volumeMV, [0.12, 0.55], [1, 0.68], { clamp: true })
  /** Api membengkok horizontal — arah angin (dari kanan). */
  const blowBend = useTransform(volumeMV, [0.12, 0.55], [0, -13], { clamp: true })
  /** Glow membesar mengikuti suara/tiupan. */
  const glowScale = useTransform(volumeMV, [0, 0.7], [1, 1.3], { clamp: true })
  /** Bar "angin" terisi real-time. */
  const windScale = useTransform(volumeMV, [0, 1], [0.03, 1], { clamp: true })
  /** Bar berubah warna: lembut → ambang kuat → melampaui. */
  const windColor = useTransform(
    volumeMV,
    [0.2, BLOW_THRESHOLD, 0.48],
    ["#fbbf24", "#fb923c", "#fb7185"]
  )

  // ───────────────────────────────────────────────────────────────────────────
  // KRUSIAL — matikan seluruh audio mic: rAF, SEMUA track, AudioContext.
  // Dipanggil seketika saat padam & saat unmount; indikator mic di HP target
  // harus hilang sesegera mungkin. (SFX useKadoAudio terpisah — tetap hidup.)
  // ───────────────────────────────────────────────────────────────────────────
  const stopMicAudio = useCallback(() => {
    aliveRef.current = false
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null
    loudSinceRef.current = null
    softSinceRef.current = null
    hitStrongRef.current = false
    volumeMV.set(0)
    if (micCtxRef.current) {
      const ctx = micCtxRef.current
      micCtxRef.current = null
      if (ctx.state !== "closed") ctx.close().catch(() => {})
    }
  }, [volumeMV])

  // ── The Extinguish — lilin padam (puncak ritual)
  const blowOut = useCallback(() => {
    if (blownRef.current) return
    blownRef.current = true
    stopMicAudio() // SEKETIKA — sebelum animasi apa pun
    setBabak("asap")
    audio.poof()
    buzz([20, 40, 60])
    setShowLanjut(false)
  }, [stopMicAudio, audio, buzz])

  // ── Tiupan lemah — tease: api bengkok, "keras lagi!", tak padam
  const weakBlow = useCallback(() => {
    if (blownRef.current) return
    setWeakCount((w) => {
      const next = w + 1
      setShowTease(true)
      later(() => setShowTease(false), 1700)
      return next
    })
    audio.whoosh(0.35)
    buzz(10)
  }, [audio, buzz, later])

  // rAF loop membaca blowOut/weakBlow lewat ref — bebas stale closure.
  const blowRef = useRef(blowOut)
  const weakRef = useRef(weakBlow)
  useEffect(() => {
    blowRef.current = blowOut
  }, [blowOut])
  useEffect(() => {
    weakRef.current = weakBlow
  }, [weakBlow])

  // ── Loop analisis audio (requestAnimationFrame) — dua band ambang
  const startLoop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    // Uint8Array dibuat di sini (bukan ref) — selalu match fftSize saat ini
    const data = new Uint8Array(analyser.frequencyBinCount)

    const loop = () => {
      if (!aliveRef.current) return
      const a = analyserRef.current
      if (!a) return
      a.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length / 255 // volume rata-rata 0..1
      volumeMV.set(avg)

      const now = performance.now()

      // band KUAT: sustain ≥ 400ms → padam
      if (avg > BLOW_THRESHOLD) {
        if (loudSinceRef.current == null) loudSinceRef.current = now
        hitStrongRef.current = true
        if (now - loudSinceRef.current >= BLOW_SUSTAIN_MS) {
          blowRef.current() // stopMicAudio di dalamnya menghentikan loop
          return
        }
      } else {
        loudSinceRef.current = null
      }

      // band LEMAH: naik di atas ambang lembut lalu turun tanpa pernah kuat
      // → satu hembusan gagal → tease (jangan hitung decak < 220ms)
      if (avg > BLOW_SOFT_THRESHOLD) {
        if (softSinceRef.current == null) softSinceRef.current = now
      } else if (softSinceRef.current != null) {
        const dur = now - softSinceRef.current
        softSinceRef.current = null
        if (!hitStrongRef.current && dur >= BLOW_MIN_WEAK_MS) weakRef.current()
        hitStrongRef.current = false // reset flag hembusan
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    aliveRef.current = true
    rafRef.current = requestAnimationFrame(loop)
  }, [volumeMV])

  // ── Cleanup unmount — semua harus bersih sempurna
  useEffect(() => {
    return () => {
      mountedRef.current = false
      aliveRef.current = false
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      if (micCtxRef.current && micCtxRef.current.state !== "closed") {
        micCtxRef.current.close().catch(() => {})
      }
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // ── Babak 0 → 1: menyalakan lilin (gesture pertama = unlock audio)
  const nyala = useCallback(() => {
    audio.unlock()
    audio.strike()
    buzz(12)
    setMatchShown(true)
    if (reduceMotion) {
      setBabak("ritual")
      later(() => setMatchShown(false), 500)
      return
    }
    later(() => setBabak("ritual"), 420) // korek meluncir dulu, api menyala
    later(() => setMatchShown(false), 1300)
  }, [audio, buzz, reduceMotion, later])

  // ── Babak 1 → 2: permintaan selesai → topeng bocor + chime → tiup
  const wishMade = useCallback(() => {
    setLeaked(true)
    audio.chime(2)
    buzz(15)
    later(() => setBabak("tiup"), reduceMotion ? 250 : 900)
  }, [audio, buzz, later, reduceMotion])

  // ── Mode fallback — mic gagal/ditolak/tak support; lilin tetap menyala
  function enterFallback(state: "denied" | "unsupported") {
    stopMicAudio()
    setMicState(state)
  }

  // ── Tombol Mic — getUserMedia HARUS dari gesture klik
  async function startMic() {
    if (babak !== "tiup" || micState === "requesting" || blownRef.current) return

    // Browser tak support → langsung fallback tap, tanpa buang waktu
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      enterFallback("unsupported")
      return
    }

    setMicState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      // Guard: sudah unmount / sudah padam sebelum izin kembali
      if (!mountedRef.current || blownRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        return
      }

      const AudioCtx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop())
        enterFallback("unsupported")
        return
      }

      // streamRef diisi SEBELUM AudioContext — kalau pembuatan ctx throw,
      // stopMicAudio() di enterFallback tetap bisa mematikan track-nya
      streamRef.current = stream

      const ctx = new AudioCtx()
      micCtxRef.current = ctx
      if (ctx.state === "suspended") await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.55
      source.connect(analyser)
      analyserRef.current = analyser

      setMicState("granted")
      startLoop()
    } catch {
      // izin ditolak / hardware error → fallback tap
      enterFallback("denied")
    }
  }

  // ── Fallback tap (jalan di SEMUA kondisi tiup — jaring pengaman)
  //    Tap 1-2 = tease "keras lagi!", tap ke-3 = padam. Tidak pernah buntu.
  function handleTap(_e: MouseEvent | TouchEvent | PointerEvent, _info: TapInfo) {
    if (babak !== "tiup" || blownRef.current) return
    const now = performance.now()
    if (now - lastTapRef.current > TAP_WINDOW_MS) tapCountRef.current = 0
    lastTapRef.current = now
    const next = tapCountRef.current + 1
    tapCountRef.current = next
    setTapCount(next)
    if (next >= 3) {
      tapCountRef.current = 0
      setTapCount(0)
      blowOut()
    } else {
      weakBlow()
    }
  }

  // ── Jalan pintas Lanjutkan (fail-safe Babak 2): padamkan terskrip
  const lanjutkan = useCallback(() => {
    if (blownRef.current) return
    stopMicAudio()
    blowOut()
  }, [blowOut, stopMicAudio])

  // Gerbang otomatis 1 — kedatangan tak disambut 9 dtk → menyala senyap
  useEffect(() => {
    if (babak !== "kedatangan") return
    const t = setTimeout(nyala, IDLE_KEDATANGAN_MS)
    return () => clearTimeout(t)
  }, [babak, nyala])

  // Gerbang otomatis 2 — ritual tak ditahan 16 dtk → lanjut sendiri
  useEffect(() => {
    if (babak !== "ritual") return
    const t = setTimeout(wishMade, IDLE_RITUAL_MS)
    return () => clearTimeout(t)
  }, [babak, wishMade])

  // Gerbang otomatis 3 — tiup tak menghasilkan 14 dtk → tawarkan Lanjutkan
  useEffect(() => {
    if (babak !== "tiup" || blownRef.current) return
    const t = setTimeout(() => setShowLanjut(true), IDLE_TIUP_MS)
    return () => clearTimeout(t)
  }, [babak])

  // ── Babak 3: chime per baris pesan (bersamaan dengan reveal blur)
  const chimesRanRef = useRef(false)
  useEffect(() => {
    if (babak !== "asap" || reduceMotion || chimesRanRef.current) return
    chimesRanRef.current = true
    lines.forEach((_, i) => later(() => audio.chime(i), 900 + i * 420))
  }, [babak, reduceMotion, lines, audio, later])

  // Fail-safe reduced-motion: tidak ada animasi yang "selesai" → timer
  useEffect(() => {
    if (babak !== "asap" || !reduceMotion) return
    later(notifyOpenComplete, 400)
  }, [babak, reduceMotion, later, notifyOpenComplete])

  const teaseText = TEASES[Math.min(weakCount - 1, TEASES.length - 1)] ?? TEASES[0]

  return (
    <motion.section
      onTap={babak === "tiup" ? handleTap : undefined}
      className="relative -mx-4 -mt-8 flex w-full flex-col items-center overflow-hidden bg-black pb-12 pt-10 text-zinc-100"
    >
      {/* vignette ruangan — sedikit cahaya hangat mengambang di kegelapan */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 44% at 50% 46%, rgba(251,146,60,0.07), transparent 70%)",
        }}
      />

      {/* tombol mute — selalu tersedia */}
      <button
        type="button"
        onClick={audio.toggleMuted}
        aria-label={audio.muted ? "Nyalakan suara" : "Bisukan suara"}
        className="absolute right-4 top-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-zinc-200"
      >
        {audio.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Header narasi per babak */}
      <header className="relative text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          🕯️ Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          {babak === "kedatangan" && "Ada yang menitipkan api untukmu 🕯️"}
          {babak === "ritual" && "Nyala sudah apinya 🔥"}
          {babak === "tiup" && "Sekarang, tiup dia 🌬️"}
          {babak === "asap" && "Make a wish ✨"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {babak === "kedatangan" && `Sebuah ${copy.label} — harus dinyalakan olehmu, lalu dipadamkan olehmu.`}
          {babak === "ritual" && copy.wishPrompt}
          {babak === "tiup" &&
            (micState === "granted"
              ? "Tiup ke arah layarmu — api-nya dengerin napasmu…"
              : micState === "requesting"
                ? "Membuka mic sebentar…"
                : "Mic menyala sebentar — cuma buat dengar tiupanmu, lalu langsung dimatikan.")}
          {babak === "asap" && "Asapnya bawa permintaanmu naik — pesan ini menyertainya."}
        </p>
      </header>

      {/* Ruangan gelap — panggung lilin */}
      <div className="relative mt-4 flex h-[330px] w-full items-end justify-center">
        {/* Glow oranye/kuning menyebar di sekeliling api — reaksi volume */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute z-0"
          style={{ left: "50%", bottom: 210, width: 320, height: 320, x: "-50%", y: "50%" }}
          initial={false}
          animate={lit && !blown ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.9 }}
        >
          <motion.div
            className="h-full w-full rounded-full will-change-transform"
            style={{
              scale: glowScale,
              background:
                "radial-gradient(closest-side, rgba(251,146,60,0.42), rgba(244,63,94,0.14) 55%, transparent 75%)",
              filter: "blur(28px)",
            }}
          />
        </motion.div>

        {/* Perakitan lilin */}
        <div className="relative z-10 flex flex-col items-center">
          {/* wrapper api + asap + korek */}
          <div className="relative flex w-[40px] items-end justify-center" style={{ height: FLAME_H + 10 }}>
            <Flame lit={lit} blown={blown} reduceMotion={reduceMotion} blowSquash={blowSquash} blowBend={blowBend} />
            {blown && (
              <>
                <SmokeWisp delay={0.15} reduceMotion={reduceMotion} />
                <SmokeWisp delay={0.8} reduceMotion={reduceMotion} />
                <SmokeWisp delay={1.5} reduceMotion={reduceMotion} />
              </>
            )}
            {matchShown && <MatchStick reduceMotion={reduceMotion} />}

            {/* whisper tease — reward tiupan lemah (pola whisper aroma buket) */}
            <AnimatePresence>
              {showTease && babak === "tiup" && (
                <motion.p
                  key="tease"
                  initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: -6 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="pointer-events-none absolute -top-9 z-30 whitespace-nowrap text-xs font-medium italic text-amber-200/95"
                >
                  {teaseText}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* bara singkat di sumbu setelah padam — memudar perlahan */}
          {blown && (
            <motion.span
              aria-hidden
              className="absolute z-20 h-[6px] w-[6px] rounded-full"
              style={{
                bottom: 172, // sumbu 9 + badan 148 + piringan 13 + jeda 2
                left: "50%",
                marginLeft: -3,
                background: "#ff7a1f",
                filter: "blur(1px)",
              }}
              initial={{ opacity: 0.9 }}
              animate={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0.3 } : { duration: 2.2, delay: 0.4, ease: "easeOut" }}
            />
          )}

          {/* sumbu */}
          <div className="z-10 h-[9px] w-[2.5px] rounded-t-full bg-zinc-800" />

          {/* badan lilin ivory yang elegan */}
          <div
            className="relative z-10 overflow-hidden rounded-t-[12px] rounded-b-[7px]"
            style={{
              width: BODY_W,
              height: BODY_H,
              background:
                "linear-gradient(90deg, #efe2c6 0%, #fbf3de 20%, #e6d5b2 55%, #f6ecd4 82%, #ddcaa4 100%)",
              boxShadow:
                "inset 0 -16px 26px rgba(122,92,44,0.16), inset 0 2px 3px rgba(255,255,255,0.6), 0 22px 46px -14px rgba(0,0,0,0.9)",
            }}
          >
            {/* kilau lilin */}
            <span className="absolute inset-y-0 left-[20%] w-[11px] bg-white/40 blur-[4px]" />
            {/* rim wax mencair */}
            <span className="absolute inset-x-0 top-0 h-[11px] rounded-b-[7px] bg-[#fdf6e4]" />
            <span className="absolute left-[12px] top-[8px] h-[16px] w-[7px] rounded-b-full bg-[#fdf6e4]" />
            <span className="absolute right-[18px] top-[6px] h-[24px] w-[6px] rounded-b-full bg-[#f3e8cb]" />
            {/* band emas + label */}
            <span className="absolute inset-x-0 bottom-[30px] h-[3px] bg-gradient-to-r from-amber-700/60 via-amber-300/90 to-amber-700/60" />
            <p className="absolute inset-x-0 bottom-[12px] text-center text-[6.5px] font-bold tracking-[0.34em] text-amber-900/45">
              KANGENIN·CANDLE
            </p>
          </div>

          {/* piringan emas gelap */}
          <div className="z-10 -mt-px h-[13px] w-[106px] rounded-[50%] bg-gradient-to-b from-[#4a4038] via-[#2a241f] to-[#121014] shadow-[0_12px_26px_rgba(0,0,0,0.85)]" />
          {/* bayangan lantai */}
          <div className="mt-[2px] h-[7px] w-[150px] rounded-[50%] bg-black/80 blur-[3px]" />
        </div>
      </div>

      {/* label titipan — muncul saat api menyala (di luar panggung, anti-geeser) */}
      <AnimatePresence>
        {lit && !blown && (
          <motion.div
            key="label"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.5, delay: 0.9 }}
            className="w-fit rounded-lg border border-amber-200/25 bg-white/[0.06] px-3 py-1.5 text-center shadow-lg shadow-black/30 backdrop-blur-md"
          >
            <p className="text-[11px] font-semibold text-amber-100">
              Untuk {targetName} — {copy.label}
            </p>
            <p className="mt-0.5 text-[9px] text-zinc-400">
              dinyalakan oleh <span className="font-semibold text-rose-300/80">{senderDisplay}</span> · satu permintaan, satu tiupan
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kontrol, instruksi & gerbang — tinggi tetap anti-lompat layout */}
      <div className="relative mt-3 flex min-h-[150px] w-full flex-col items-center justify-start text-center">
        <AnimatePresence mode="wait" initial={false}>
          {babak === "kedatangan" && (
            <motion.div
              key="kedatangan"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center"
            >
              <button
                type="button"
                onClick={nyala}
                onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    nyala()
                  }
                }}
                className="flex items-center gap-2 rounded-full border border-amber-200/40 bg-gradient-to-r from-amber-300/90 to-amber-500/90 px-6 py-2.5 text-sm font-bold text-amber-950 shadow-[0_0_30px_-6px_rgba(251,191,36,0.6)] transition-transform active:scale-95"
              >
                🔥 Nyalakan lilinnya
              </button>
              <p className="mt-3 text-xs text-zinc-600">Koreknya sudah disiapkan — tinggal kamu gesek 🤫</p>
            </motion.div>
          )}

          {babak === "ritual" && (
            <motion.div
              key="ritual"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="flex flex-col items-center"
            >
              <WishGate onComplete={wishMade} reduceMotion={reduceMotion} />
              <p className="mt-2 text-xs text-zinc-500">tahan sampai ring-nya penuh — sambil buat permintaan</p>
            </motion.div>
          )}

          {babak === "tiup" && !showLanjut && (
            <motion.div
              key="tiup"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              {micState !== "granted" ? (
                <button
                  type="button"
                  onClick={startMic}
                  disabled={micState === "requesting"}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  {micState === "requesting" ? "Membuka mic…" : "🌬️ Buka mic & tiup"}
                </button>
              ) : (
                <>
                  <motion.p
                    animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.45, 1] }}
                    transition={reduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    className="text-sm font-medium text-zinc-300"
                  >
                    Tiup ke arah layarmu… 🌬️
                  </motion.p>
                  {/* bar volume tiupan + penanda ambang */}
                  <div className="relative mx-auto mt-4 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full w-full origin-left rounded-full will-change-transform"
                      style={{ scaleX: windScale, backgroundColor: windColor }}
                    />
                    <span
                      aria-hidden
                      className="absolute inset-y-0 w-px bg-white/40"
                      style={{ left: `${BLOW_THRESHOLD * 100}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] tracking-widest text-zinc-600">TIUPAN</p>
                </>
              )}
              <p className="mt-2 text-[11px] text-zinc-600">
                {micState === "granted"
                  ? "atau tap layar 3x kalau mic-mu bermasalah"
                  : "mic-nya gagal? tap layar 3x juga bisa"}
              </p>
              {micState === "denied" || micState === "unsupported" ? (
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  {[1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full transition-colors duration-150 ${
                        tapCount >= i ? "bg-amber-300" : "bg-white/15"
                      }`}
                    />
                  ))}
                </div>
              ) : null}
            </motion.div>
          )}

          {babak === "tiup" && showLanjut && (
            <motion.button
              key="lanjut"
              type="button"
              onClick={lanjutkan}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold text-zinc-200 backdrop-blur-md"
            >
              Lanjutkan ⏭
            </motion.button>
          )}
        </AnimatePresence>

        {/* Babak 3 — "Make a wish, <nama>" lalu kartu pesan */}
        {babak === "asap" && (
          <div className="w-full">
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.65, ease: "easeOut" }}
              className="font-hand text-[27px] leading-tight text-amber-100/95"
              style={{ textShadow: "0 0 20px rgba(251,191,36,0.4)" }}
            >
              Make a wish, {targetName}…
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 1.3 }}
              className="mt-5 w-full"
            >
              <WishCard
                lines={lines}
                senderDisplay={senderDisplay}
                revealName={revealName}
                tanggal={tanggal}
                reduceMotion={reduceMotion}
                onEntered={notifyOpenComplete}
              />
            </motion.div>
          </div>
        )}
      </div>
    </motion.section>
  )
}
