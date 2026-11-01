"use client"

/**
 * PremiumBouquet — kado buket bunga: The Blooming Edition.
 *
 * Dari "sekali tarik langsung selesai" menjadi ritual 4 babak — konsisten
 * dengan Heartstring Edition di PremiumConfess. Setiap babak SELALU membuka
 * info baru (tidak ada gerbang kosong):
 *
 *   titipan  (Babak 0)   buket "tiba" dari bawah dengan label menggantung di
 *                        simpul: "Untuk <penerima> — diikat tangan oleh
 *                        R•••i". Penerima menyambut (tap) → unlock audio.
 *   pita     (Babak 1)   pita emas melawan dua tahap: 42px pertama = kertas
 *                        longgar + glow warna mengintip + whisper "wanginya…
 *                        mawar?"; lewat 84px = simpul LEPAS (slip + getar)
 *                        → pita jatuh berputar, kerucut membuka.
 *   mekar    (Babak 2)   tiga gelombang: daun membuka lapisan luar → bunga
 *                        utama satu-per-satu (pop + getar; setelah bunga
 *                        ke-3 topeng bocor R•••i → Ri••i) → kuncup pusat
 *                        menolak mekar sampai DISENTUH (puncak yang layak
 *                        direkam: swell, shimmer, pollen naik, glow penuh).
 *   kartu    (Babak 3)   kartu kraft pinggiran gold-foil DITARIK KELUAR
 *                        dari antara bunga; pesan muncul baris demi baris
 *                        (blur → tajam + chime per baris). Penutup:
 *                        "diikat tangan, <tanggal>". onOpenComplete()
 *                        setelah kartu masuk → parent lanjut fase dilemma.
 *
 * Identitas: topeng dihitung lokal dari senderName (R•••i → Ri••i, sama
 * seperti Heartstring) sehingga bocoran bertahap mungkin tanpa backend.
 * Tanpa senderName, jatuh ke fomoInitials dari parent tanpa bocoran.
 * revealName (jawaban diterima) tetap crossfade glow di tanda tangan.
 *
 * Aturan ritual (sama dengan Heartstring):
 * - Fail-safe: tiap gerbang interaktif punya jalan otomatis — titipan 8 dtk,
 *   pita 12 dtk → tombol "Lanjutkan", kuncup 6 dtk → mekar sendiri.
 * - prefers-reduced-motion: satu tap = seluruh ritual selesai instan.
 * - Keyboard: semua gerbang bisa Enter/Space (sambut, pita, kuncup).
 * - Performa mobile 60FPS: hanya transform/opacity/filter; getar no-op di
 *   browser tanpa vibrate; tanpa Web Audio alur tetap utuh (suara no-op).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion"
import { Volume2, VolumeX } from "lucide-react"
import { useKadoAudio } from "./useKadoAudio"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumBouquetProps {
  /** Nama penerima — tampil di badge header & label titipan. */
  targetName: string
  /** Pesan pengirim — tampil di kartu ucapan, baris demi baris. */
  message: string
  /** Inisial bertopeng dari parent ("R***I") — fallback tanpa senderName. */
  fomoInitials: string | null
  /**
   * Nama asli pengirim — sumber topeng lokal & bocoran bertahap.
   * Parent mengirim ini mulai Blooming Edition (data sudah ada di client,
   * pola sama dengan PremiumConfess — nol perubahan backend).
   */
  senderName?: string | null
  /** Nama asli saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** ISO timestamp — untuk "diikat tangan, <tanggal>" di kartu. */
  createdAt?: string | null
  /** Dipanggil SEKALI setelah kartu ucapan selesai masuk. */
  onOpenComplete: () => void
}

type Babak = "titipan" | "pita" | "mekar" | "kartu"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Tahap 1 pita: kertas mulai longgar + glow warna mengintip (px). */
const RIBBON_STAGE1_PX = 42
/** Simpul lepas (px) — spesifikasi ritual tahap 2. */
const RIBBON_TRIGGER_PX = 84
const RIBBON_DRAG_CONSTRAINTS = { top: 0, bottom: 112 }

/** Ukuran panggung buket (px) — fix biar posisi bunga/pita presisi. */
const STAGE_W = 240
const STAGE_H = 300
/** Titik bibir kerucut (tempat bunga berangkat) dalam koordinat panggung. */
const RIM_X = STAGE_W / 2
const RIM_Y = STAGE_H - 190 // kerucut tinggi 190 menempel di dasar panggung

/** Gerbang otomatis (ms) — jalan pintas fail-safe per babak. */
const IDLE_TITIPAN_MS = 8000
const IDLE_PITA_MS = 12000
const IDLE_KUNCUP_MS = 6000

interface FlowerSpec {
  emoji: string
  /** Posisi akhir relatif bibir kerucut (px). */
  x: number
  y: number
  /** Ukuran font emoji (px). */
  size: number
  /** Rotasi akhir (deg). */
  rot: number
  /** Delay mekar dalam gelombangnya (s). */
  delay: number
}

/** Gelombang 1 — daun & hijauan membuka lapisan luar buket. */
const GREENS: FlowerSpec[] = [
  { emoji: "🌿", x: 50, y: -24, size: 26, rot: 14, delay: 0.0 },
  { emoji: "🌿", x: -36, y: -46, size: 24, rot: 10, delay: 0.09 },
  { emoji: "🌿", x: -66, y: -4, size: 20, rot: -20, delay: 0.17 },
]

/** Gelombang 2 — bunga utama mekar satu-per-satu. */
const BLOOMS: FlowerSpec[] = [
  { emoji: "🌹", x: -54, y: -26, size: 36, rot: -8, delay: 0.0 },
  { emoji: "🌸", x: -22, y: -58, size: 30, rot: 6, delay: 0.14 },
  { emoji: "🌷", x: 16, y: -54, size: 32, rot: -5, delay: 0.28 },
  { emoji: "🌼", x: -64, y: 0, size: 26, rot: -12, delay: 0.42 },
  { emoji: "🤍", x: 58, y: 2, size: 22, rot: 8, delay: 0.52 },
]

/** Gelombang 3 — kuncup pusat: bunga terbesar, menolak mekar sebelum disentuh. */
const BUD: FlowerSpec = { emoji: "🌹", x: 0, y: -70, size: 42, rot: -8, delay: 0 }

/** Pollen naik saat kuncup pamungkas mekar — config tetap (aman hydration). */
const POLLEN = [
  { x: -40, d: 0.0 },
  { x: -14, d: 0.18 },
  { x: 12, d: 0.09 },
  { x: 34, d: 0.26 },
  { x: -28, d: 0.34 },
  { x: 48, d: 0.12 },
  { x: 0, d: 0.4 },
  { x: 22, d: 0.3 },
  { x: -52, d: 0.22 },
  { x: 58, d: 0.36 },
]

/** Kilauan sekali pakai saat gelombang 2 (murah: opacity + scale saja). */
const SPARKLES = [
  { x: -72, y: -40, d: 0.5 },
  { x: 66, y: -52, d: 0.62 },
  { x: 0, y: -108, d: 0.74 },
  { x: -32, y: -14, d: 0.86 },
  { x: 42, y: -8, d: 0.98 },
]

/** Spring mekar — sedikit under-damped biar memantul halus. */
const BLOOM_SPRING = { type: "spring", stiffness: 320, damping: 12, mass: 0.8 } as const

/** Kartu berangkat dari dalam panggung (ditarik keluar dari antara bunga). */
const CARD_DELAY = 0.15

/** Tekstur kertas halus untuk kartu (feTurbulence, opacity rendah). */
const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`

/** Pinggiran gold-foil kartu — gradasi emas klasik. */
const GOLD_FOIL =
  "linear-gradient(135deg,#b8860b,#f6e27a 25%,#fff7d6 45%,#d4af37 65%,#f9e79f 85%,#b8860b)"

// ─────────────────────────────────────────────────────────────────────────────
// Pembantu
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

// ─────────────────────────────────────────────────────────────────────────────
// Sub-komponen kecil
// ─────────────────────────────────────────────────────────────────────────────

/** Satu bunga: kuncup terpadatkan di bibir kerucut → mekar ke posisi akhirnya. */
function Flower({ spec, open, reduceMotion }: { spec: FlowerSpec; open: boolean; reduceMotion: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute left-0 top-0 select-none will-change-transform"
      style={{
        fontSize: spec.size,
        lineHeight: 1,
        marginLeft: -spec.size / 2,
        marginTop: -spec.size / 2,
        filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))",
      }}
      initial={false}
      animate={
        open
          ? { x: spec.x, y: spec.y, scale: 1, rotate: spec.rot, opacity: 1 }
          : { x: spec.x * 0.15, y: 4, scale: 0.42, rotate: 0, opacity: 1 }
      }
      transition={
        reduceMotion ? { duration: 0 } : open ? { ...BLOOM_SPRING, delay: spec.delay } : { duration: 0.3 }
      }
    >
      {spec.emoji}
    </motion.span>
  )
}

/** Kuncup pusat (gelombang 3) — tombol: menolak mekar sampai disentuh. */
function BudFlower({
  open,
  onOpen,
  reduceMotion,
}: {
  open: boolean
  onOpen: () => void
  reduceMotion: boolean
}) {
  return (
    <motion.button
      type="button"
      aria-label="Buka kuncup terakhir"
      onClick={onOpen}
      onKeyDown={(e: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      disabled={open}
      tabIndex={open ? -1 : 0}
      className="absolute left-0 top-0 cursor-pointer select-none bg-transparent will-change-transform"
      style={{
        fontSize: BUD.size,
        lineHeight: 1,
        marginLeft: -BUD.size / 2,
        marginTop: -BUD.size / 2,
        filter: open
          ? "drop-shadow(0 0 16px rgba(251,191,36,0.55))"
          : "drop-shadow(0 6px 10px rgba(0,0,0,0.4))",
      }}
      initial={reduceMotion ? false : { scale: 0.4, rotate: -26, opacity: 0 }}
      animate={
        open
          ? { x: BUD.x, y: BUD.y, scale: 1, rotate: BUD.rot, opacity: 1 }
          : { x: BUD.x * 0.3, y: -18, scale: 0.78, rotate: -22, opacity: 1 }
      }
      transition={
        reduceMotion ? { duration: 0 } : open ? BLOOM_SPRING : { duration: 0.45, delay: 0.1 }
      }
    >
      {/* halo denyut — mata tertarik ke kuncup sebelum disentuh */}
      {!open && !reduceMotion && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute -inset-3 -z-10 rounded-full bg-amber-300/25 blur-md"
          animate={{ opacity: [0.3, 0.65, 0.3], scale: [0.9, 1.18, 0.9] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        />
      )}
      {BUD.emoji}
    </motion.button>
  )
}

/** Kerucut kertas craft glassmorphism — longgar saat tahap 1, membuka saat lepas. */
function ConeWrap({ pullStage, reduceMotion }: { pullStage: number; reduceMotion: boolean }) {
  return (
    <motion.div
      animate={
        reduceMotion
          ? undefined
          : {
              scaleX: pullStage >= 2 ? 1.16 : pullStage >= 1 ? 1.05 : 1,
              scaleY: pullStage >= 2 ? 0.985 : pullStage >= 1 ? 0.995 : 1,
            }
      }
      transition={{ type: "spring", stiffness: 220, damping: 18 }}
      className="absolute inset-x-0 bottom-0 will-change-transform"
      style={{ height: 190 }}
    >
      {/* lapisan luar = "border" kerucut (clip-path polygon: alas di atas, runcing ke bawah) */}
      <div
        className="absolute inset-0 bg-white/15 backdrop-blur-md"
        style={{ clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }}
      />
      {/* lapisan dalam = kertas craft */}
      <div
        className="absolute inset-[1.5px] bg-gradient-to-b from-white/[0.09] via-white/[0.05] to-white/[0.02]"
        style={{ clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)" }}
      />
      {/* lipatan kertas (creases) — garis diagonal halus menuju ujung kerucut */}
      <div className="absolute left-1/4 top-0 h-full w-px origin-top rotate-[17.5deg] bg-gradient-to-b from-white/20 via-white/[0.06] to-transparent" />
      <div className="absolute left-3/4 top-0 h-full w-px origin-top -rotate-[17.5deg] bg-gradient-to-b from-white/20 via-white/[0.06] to-transparent" />
      {/* bayangan lembut di dasar kerucut */}
      <div className="absolute bottom-0 left-1/2 h-16 w-40 -translate-x-1/2 rounded-full bg-black/40 blur-2xl" />
    </motion.div>
  )
}

/** Label titipan menggantung di simpul — personal + topeng pengirim. */
function TagLabel({ targetName, sender, reduceMotion }: { targetName: string; sender: string; reduceMotion: boolean }) {
  return (
    <div className="absolute z-[15]" style={{ top: RIM_Y + 96, left: RIM_X, width: 150, marginLeft: -75 }}>
      <motion.div
        animate={reduceMotion ? undefined : { rotate: [-3.5, -1.2] }}
        transition={{ duration: 2.8, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
        style={{ transformOrigin: "50% 0%" }}
        className="rounded-lg border border-amber-200/30 bg-white/[0.07] px-2.5 py-1.5 text-center shadow-lg shadow-black/30 backdrop-blur-md will-change-transform"
      >
        <p className="truncate text-[11px] font-semibold text-amber-100">Untuk {targetName}</p>
        <p className="mt-0.5 truncate text-[9px] text-zinc-400">
          diikat tangan oleh{" "}
          <span className="font-semibold text-rose-300/80">{sender}</span>
        </p>
      </motion.div>
    </div>
  )
}

/** Pita emas — dua tahap tarik dengan perlawanan; lepas = jatuh berputar. */
function GoldRibbon({
  pullStage,
  onGesture,
  onStage1,
  onUntied,
  reduceMotion,
}: {
  pullStage: number
  onGesture: () => void
  onStage1: () => void
  onUntied: () => void
  reduceMotion: boolean
}) {
  const controls = useAnimationControls()
  const [touched, setTouched] = useState(false)

  function handleDrag(_e: unknown, info: PanInfo) {
    if (pullStage === 0 && info.offset.y >= RIBBON_STAGE1_PX) onStage1()
  }

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > RIBBON_TRIGGER_PX) {
      onUntied() // simpul lepas
    } else {
      // belum lepas → pita "melawan" kembali ke posisi semula
      controls.start({ y: 0, transition: { type: "spring", stiffness: 420, damping: 26 } })
    }
  }

  function handleKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onStage1()
      setTimeout(onUntied, 420) // urutan terskrip: longgar → lepas
    }
  }

  return (
    // pembungkus diposisikan tanpa transform (margins, bukan translate) supaya
    // tidak bentrok dengan animasi bob/drag di dalamnya
    <div
      className="absolute z-20"
      style={{ top: RIM_Y + 58, left: RIM_X, width: 128, marginLeft: -64 }}
    >
      <motion.div
        // ajakan visual: pita berdenyut pelan sampai disentuh pertama kali
        animate={reduceMotion || touched ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        className="will-change-transform"
      >
        <motion.button
          type="button"
          aria-label="Tarik pita ke bawah untuk membuka buket"
          onDragStart={() => {
            setTouched(true)
            onGesture() // audio unlock dari gesture pertama (aturan autoplay)
          }}
          onKeyDown={handleKey}
          drag="y"
          dragConstraints={RIBBON_DRAG_CONSTRAINTS}
          dragElastic={0.2}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.07 }}
          animate={controls}
          initial={{ y: 0 }}
          // The Trigger: pita jatuh BERPUTAR (bukan fade konyol)
          exit={reduceMotion ? undefined : { y: 130, rotate: 150, opacity: 0, transition: { duration: 0.9, ease: "easeIn" } }}
          className="relative flex h-9 w-full cursor-grab touch-none items-center justify-center rounded-full border border-amber-200/60 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 shadow-[0_0_28px_rgba(251,191,36,0.5)] will-change-transform active:cursor-grabbing"
        >
          {/* kilau pita */}
          <span aria-hidden className="pointer-events-none absolute inset-x-4 top-[3px] h-[30%] rounded-full bg-white/50 blur-[2px]" />
          {/* halo pulse — opacity saja, murah di GPU */}
          <span aria-hidden className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-amber-400/25 motion-safe:animate-pulse blur-md" />
          <span className="text-[11px] font-extrabold tracking-[0.22em] text-amber-950">
            {pullStage >= 1 ? "TERUS! ⬇" : "TARIK ⬇"}
          </span>
        </motion.button>
      </motion.div>
    </div>
  )
}

/** Kartu ucapan — DITARIK KELUAR dari antara bunga ke bawah panggung. */
function MessageCard({
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
      // ayunan pelan berulang — digantung dari titik atas kartu
      animate={reduceMotion ? undefined : { rotate: [-1.6, 1.6] }}
      transition={reduceMotion ? undefined : { duration: 3.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      style={{ transformOrigin: "50% 0%" }}
      className="mx-auto w-full max-w-xs will-change-transform"
    >
      <motion.div
        // berangkat DARI DALAM panggung (di atas, menutupi buket) lalu
        // dispring turun ke tempatnya — kesan ditarik keluar dari bunga
        initial={reduceMotion ? false : { y: -(STAGE_H + 30), scale: 0.55, opacity: 0.9 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 190, damping: 20, delay: CARD_DELAY }}
        onAnimationComplete={onEntered}
        className="relative will-change-transform"
      >
        {/* pinggiran gold-foil */}
        <div
          className="rounded-[20px] p-[2px] shadow-[0_24px_70px_-18px_rgba(180,120,40,0.45)]"
          style={{ background: GOLD_FOIL }}
        >
          <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 p-5 backdrop-blur-md">
            {/* tekstur kertas halus */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ backgroundImage: PAPER_TEXTURE }}
            />
            <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
              Kartu dari buket
            </p>

            {/* pesan — baris demi baris: blur → tajam */}
            <div className="relative mt-3 space-y-2.5">
              {lines.map((line, i) => (
                <motion.p
                  key={i}
                  initial={reduceMotion ? false : { opacity: 0, filter: "blur(9px)", y: 6 }}
                  animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                  transition={
                    reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.55, delay: 0.55 + i * 0.42, ease: "easeOut" }
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
                diikat tangan, {tanggal}
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumBouquet({
  targetName,
  message,
  fomoInitials,
  senderName = null,
  revealName = null,
  createdAt = null,
  onOpenComplete,
}: PremiumBouquetProps) {
  const [babak, setBabak] = useState<Babak>("titipan")
  /** 0 = terikat rapat, 1 = kertas longgar (tahap 1), 2 = simpul lepas. */
  const [pullStage, setPullStage] = useState(0)
  /** Gelombang mekar: 0 belum, 1 daun, 2 bunga utama, 3 kuncup pusat. */
  const [wave, setWave] = useState(0)
  const [budOpen, setBudOpen] = useState(false)
  const [leaked, setLeaked] = useState(false)
  const [showWhisper, setShowWhisper] = useState(false)
  const [showLanjut, setShowLanjut] = useState(false)

  const reduceMotion = useReducedMotion() ?? false
  const audio = useKadoAudio()

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

  // ── Babak 0 → 1: penerima menyambut buket (gesture pertama = unlock audio)
  const sambut = useCallback(() => {
    audio.unlock()
    audio.swell()
    buzz(12)
    if (reduceMotion) {
      // saluran instan: seluruh ritual selesai dalam satu tap
      setPullStage(2)
      setWave(3)
      setBudOpen(true)
      setBabak("kartu")
      return
    }
    later(() => setBabak("pita"), 650)
  }, [audio, buzz, reduceMotion, later])

  // ── Babak 1 tahap 1: kertas longgar + glow warna mengintip + whisper aroma
  const stage1 = useCallback(() => {
    if (pullStage >= 1) return
    setPullStage(1)
    audio.slide()
    buzz(15)
    setShowWhisper(true)
    later(() => setShowWhisper(false), 2600)
  }, [pullStage, audio, buzz, later])

  // ── Babak 1 tahap 2: simpul LEPAS → mekar
  const untie = useCallback(() => {
    if (pullStage >= 2) return
    setPullStage(2)
    audio.slip()
    buzz([20, 40, 60])
    setShowLanjut(false)
    if (reduceMotion) {
      setWave(3)
      setBudOpen(true)
      setBabak("kartu")
      return
    }
    later(() => setBabak("mekar"), 550)
  }, [pullStage, audio, buzz, reduceMotion, later, setShowLanjut])

  /** Jalan pintas (tombol Lanjutkan / keyboard): longgar → lepas terskrip. */
  const scriptedPull = useCallback(() => {
    stage1()
    later(untie, 420)
  }, [stage1, untie, later])

  // ── Babak 2: tiga gelombang mekar (sekali jalan per kunjungan)
  const waveRanRef = useRef(false)
  useEffect(() => {
    if (babak !== "mekar" || reduceMotion || waveRanRef.current) return
    waveRanRef.current = true
    later(() => {
      audio.rustle()
      setWave(1)
    }, 120)
    later(() => setWave(2), 950)
    BLOOMS.forEach((f, i) =>
      later(() => {
        audio.pop(i)
        buzz(12)
      }, 950 + f.delay * 1000)
    )
    // bunga ke-3 (tulip, delay 0.28s) selesai → topeng bocor + chime
    later(() => {
      setLeaked(true)
      audio.chime(1)
    }, 950 + 700)
    later(() => setWave(3), 2450)
  }, [babak, reduceMotion, audio, buzz, later])

  // ── Babak 2 puncak: kuncup pamungkas mekar → kartu
  const bukaKuncup = useCallback(() => {
    if (budOpen) return
    setBudOpen(true)
    audio.swell()
    audio.shimmer()
    buzz([15, 30, 15, 30, 60])
    later(() => setBabak("kartu"), 750)
  }, [budOpen, audio, buzz, later])

  // ── Babak 3: chime per baris pesan (bersamaan dengan reveal blur)
  const chimesRanRef = useRef(false)
  useEffect(() => {
    if (babak !== "kartu" || reduceMotion || chimesRanRef.current) return
    chimesRanRef.current = true
    lines.forEach((_, i) => later(() => audio.chime(i), 650 + i * 420))
  }, [babak, reduceMotion, lines, audio, later])

  // Fail-safe reduced-motion: tidak ada animasi yang "selesai" → timer
  useEffect(() => {
    if (babak !== "kartu" || !reduceMotion) return
    later(notifyOpenComplete, 400)
  }, [babak, reduceMotion, later, notifyOpenComplete])

  // Gerbang otomatis 1 — titipan tak disambut 8 dtk → lanjut senyap
  useEffect(() => {
    if (babak !== "titipan") return
    const t = setTimeout(sambut, IDLE_TITIPAN_MS)
    return () => clearTimeout(t)
  }, [babak, sambut])

  // Gerbang otomatis 2 — pita tak ditarik 12 dtk → tawarkan Lanjutkan
  useEffect(() => {
    if (babak !== "pita" || pullStage >= 2) return
    const t = setTimeout(() => setShowLanjut(true), IDLE_PITA_MS)
    return () => clearTimeout(t)
  }, [babak, pullStage])

  // Gerbang otomatis 3 — kuncup tak disentuh 6 dtk → mekar sendiri
  useEffect(() => {
    if (babak !== "mekar" || wave !== 3 || budOpen || reduceMotion) return
    const t = setTimeout(bukaKuncup, IDLE_KUNCUP_MS)
    return () => clearTimeout(t)
  }, [babak, wave, budOpen, reduceMotion, bukaKuncup])

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

      {/* narasi per babak */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          🌸 Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          {babak === "titipan" && "Ada titipan yang datang…"}
          {babak === "pita" && "Tarik pitanya, pelan-pelan 🎀"}
          {babak === "mekar" && "Dia mekar untukmu 🌸"}
          {babak === "kartu" && "Ada pesan di antara bunganya…"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {babak === "titipan" && "Dikirim oleh seseorang yang menyimpan nama baikmu di hatinya."}
          {babak === "pita" &&
            (pullStage >= 1
              ? "Simpulnya mulai kehelaian — tarik terus ke bawah!"
              : "Pita emasnya diikat rapi — tarik pelan-pelan ke bawah.")}
          {babak === "mekar" &&
            (wave < 3
              ? "Satu-per-satu, seperti yang diingat pengirimnya."
              : budOpen
                ? "Terima kasih sudah menyentuhnya 🤍"
                : "Kuncup terakhirnya menolak mekar — sentuh dia.")}
          {babak === "kartu" && "Ditarik keluar pelan-pelan dari antara kelopak."}
        </p>
      </header>

      {/* Panggung buket: glow → bunga (z-0) → kerucut (z-10) → pita (z-20) */}
      <motion.div
        initial={reduceMotion ? false : { y: 90, opacity: 0, scale: 0.92 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 16 }}
        className="relative mt-2 will-change-transform"
        style={{ width: STAGE_W, height: STAGE_H }}
      >
        {/* glow ambien — memanas seiring ritual */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: budOpen ? 1 : wave >= 2 ? 0.55 : 0 }}
          transition={{ duration: 0.9 }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.28), rgba(244,63,94,0.12), transparent)",
          }}
        />

        {/* glow warna mengintip — reward tahap 1 pita */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: pullStage >= 1 && wave === 0 ? 0.7 : 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute"
          style={{
            left: RIM_X - 70,
            top: RIM_Y - 78,
            width: 140,
            height: 84,
            borderRadius: "50%",
            filter: "blur(14px)",
            background:
              "radial-gradient(closest-side, rgba(244,63,94,0.5), rgba(251,191,36,0.3), transparent)",
          }}
        />

        {/* bunga — berangkat terpadatkan di bibir kerucut */}
        <div className="absolute z-0" style={{ left: RIM_X, top: RIM_Y, width: 0, height: 0 }}>
          {GREENS.map((f, i) => (
            <Flower key={`g-${i}`} spec={f} open={wave >= 1} reduceMotion={reduceMotion} />
          ))}
          {BLOOMS.map((f, i) => (
            <Flower key={`b-${i}`} spec={f} open={wave >= 2} reduceMotion={reduceMotion} />
          ))}
          {(wave >= 3 || budOpen) && (
            <BudFlower open={budOpen} onOpen={bukaKuncup} reduceMotion={reduceMotion} />
          )}
        </div>

        <ConeWrap pullStage={pullStage} reduceMotion={reduceMotion} />

        <TagLabel targetName={targetName} sender={senderDisplay} reduceMotion={reduceMotion} />

        {/* whisper aroma — reward tahap 1 */}
        <AnimatePresence>
          {showWhisper && (
            <motion.p
              key="whisper"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="pointer-events-none absolute z-30 whitespace-nowrap text-xs italic text-rose-200/90"
              style={{ left: RIM_X, top: RIM_Y - 104, marginLeft: -60, width: 120, textAlign: "center" }}
            >
              wanginya… mawar? 🌹
            </motion.p>
          )}
        </AnimatePresence>

        {/* The Ribbon — lepas = jatuh berputar */}
        <AnimatePresence>
          {babak === "pita" && pullStage < 2 && (
            <GoldRibbon
              key="ribbon"
              pullStage={pullStage}
              onGesture={audio.unlock}
              onStage1={stage1}
              onUntied={untie}
              reduceMotion={reduceMotion}
            />
          )}
        </AnimatePresence>

        {/* kilauan sekali pakai saat gelombang 2 */}
        {wave >= 2 &&
          !reduceMotion &&
          SPARKLES.map((s, i) => (
            <motion.span
              key={`sp-${i}`}
              aria-hidden
              className="pointer-events-none absolute z-30 select-none text-sm"
              style={{ left: RIM_X + s.x, top: RIM_Y + s.y }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 0.8] }}
              transition={{ delay: s.d, duration: 1.1, times: [0, 0.4, 1], ease: "easeOut" }}
            >
              ✨
            </motion.span>
          ))}

        {/* pollen naik — puncak ritual */}
        {budOpen &&
          !reduceMotion &&
          POLLEN.map((p, i) => (
            <motion.span
              key={`pl-${i}`}
              aria-hidden
              className="pointer-events-none absolute z-30 h-1 w-1 rounded-full bg-amber-200/80 blur-[1px]"
              style={{ left: RIM_X + p.x, top: RIM_Y - 40 }}
              initial={{ opacity: 0, y: 0, scale: 0.6 }}
              animate={{ opacity: [0, 0.9, 0], y: -150 - (i % 4) * 18, scale: [0.6, 1, 0.5] }}
              transition={{ delay: p.d, duration: 2.2, times: [0, 0.25, 1], ease: "easeOut" }}
            />
          ))}
      </motion.div>

      {/* area aksi/hint di bawah panggung — tinggi tetap anti-lompat layout */}
      <div className="mt-3 flex min-h-[64px] w-full flex-col items-center justify-start gap-2">
        <AnimatePresence mode="wait">
          {babak === "titipan" ? (
            <motion.button
              key="sambut"
              type="button"
              onClick={sambut}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-full border border-amber-200/40 bg-gradient-to-r from-amber-300/90 to-amber-500/90 px-6 py-2.5 text-sm font-bold text-amber-950 shadow-[0_0_30px_-6px_rgba(251,191,36,0.6)] transition-transform active:scale-95"
            >
              Sambut buketnya 🤲
            </motion.button>
          ) : babak === "pita" && showLanjut ? (
            <motion.button
              key="lanjut"
              type="button"
              onClick={scriptedPull}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold text-zinc-200 backdrop-blur-md"
            >
              Lanjutkan ⏭
            </motion.button>
          ) : babak === "pita" ? (
            <motion.p
              key="hint-pita"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-zinc-500"
            >
              {pullStage >= 1 ? "dikit lagi… tarik terus ke bawah 🤫" : "psst… tarik pita emasnya ke bawah 🤫"}
            </motion.p>
          ) : babak === "mekar" && wave >= 3 && !budOpen ? (
            <motion.p
              key="hint-kuncup"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: [0.55, 1, 0.55] }}
              transition={reduceMotion ? { duration: 0.3 } : { duration: 1.6, repeat: Infinity }}
              className="text-xs text-rose-200/90"
            >
              👆 sentuh kuncupnya… dia nungguin kamu
            </motion.p>
          ) : (
            <span key="kosong" />
          )}
        </AnimatePresence>
      </div>

      {/* The Card — ditarik keluar dari antara bunga */}
      <AnimatePresence>
        {babak === "kartu" && (
          <motion.div
            key="card"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-6 w-full"
          >
            <MessageCard
              lines={lines}
              senderDisplay={senderDisplay}
              revealName={revealName}
              tanggal={tanggal}
              reduceMotion={reduceMotion}
              onEntered={notifyOpenComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
