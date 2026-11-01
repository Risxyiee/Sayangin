"use client"

/**
 * PremiumBouquet — kado buket bunga: tarik pita emas untuk membuka.
 *
 * Alur interaksi:
 *   1. The Wrapper — kerucut kertas craft bergaya glassmorphism menutupi buket.
 *   2. The Ribbon  — pita kapsul emas ber-glow yang bisa ditarik ke bawah
 *                    (drag="y" + dragConstraints + dragElastic 0.2 → ada
 *                    perlawanan fisik seperti pita kain sungguhan).
 *   3. The Trigger — onDragEnd: offset.y > 60 → pita lepas (isUntied = true).
 *   4. The Bloom   — pita drop + fade, kerucut melebar sedikit, kuncup yang
 *                    tadinya mengintip di bibir kerucut mekar berurutan
 *                    (stagger + spring physics memantul halus).
 *   5. The Card    — kartu ucapan turun dari atas, berayun pelan (rotasi
 *                    berulang), berisi pesan pengirim yang masih bertopeng.
 *                    onOpenComplete() dipanggil tepat setelah kartu selesai
 *                    masuk — parent melanjutkan alur (fase dilemma).
 *
 * Identitas: kartu menampilkan fomoInitials ("R***I") sampai parent mengirim
 * revealName (jawaban diterima) — lalu nama asli crossfade masuk dengan glow,
 * selaras dengan mekanik reveal di CinematicUnboxing.
 *
 * Performa mobile 60FPS:
 * - Animasi hanya transform/opacity/filter (compositing GPU, tanpa layout).
 * - Elemen yang bergerak diberi will-change-transform.
 * - dragMomentum={false} + touch-none supaya drag presisi & tidak scroll layar.
 * - Semua efek menghormati prefers-reduced-motion (instant / tanpa loop).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useAnimationControls,
  useReducedMotion,
  type PanInfo,
} from "framer-motion"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumBouquetProps {
  /** Nama penerima — tampil di badge header. */
  targetName: string
  /** Pesan pengirim — tampil di kartu ucapan setelah buket mekar. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /**
   * Nama asli pengirim saat jawaban diterima — null = masih bertopeng.
   * Parent mengisi ini saat reveal (fase 4 accepted).
   */
  revealName?: string | null
  /** Dipanggil SEKALI setelah kartu ucapan selesai turun & masuk. */
  onOpenComplete: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Batas tarik pita (px, spesifikasi): offset.y > 60 dianggap terlepas. */
const RIBBON_TRIGGER_PX = 60
/** Jangkauan drag: bebas ke bawah 96px, terkunci ke atas (elastic 0.2). */
const RIBBON_DRAG_CONSTRAINTS = { top: 0, bottom: 96 }

/** Ukuran panggung buket (px) — fix biar posisi bunga/pita presisi. */
const STAGE_W = 240
const STAGE_H = 300
/** Titik bibir kerucut (tempat bunga berangkat) dalam koordinat panggung. */
const RIM_X = STAGE_W / 2
const RIM_Y = STAGE_H - 190 // kerucut tinggi 190 menempel di dasar panggung

interface FlowerSpec {
  emoji: string
  /** Posisi akhir relatif bibir kerucut (px). */
  x: number
  y: number
  /** Ukuran font emoji (px). */
  size: number
  /** Rotasi akhir (deg) biar cluster terlihat natural. */
  rot: number
  /** Delay mekar (s) — menentukan urutan stagger. */
  delay: number
}

/**
 * Susunan buket — kuncup kelihatan mengintip saat terbungkus (posisi awal
 * dipadatkan ke bibir kerucut), lalu menyebar ke posisi akhir saat mekar.
 */
const FLOWERS: FlowerSpec[] = [
  { emoji: "🌹", x: -54, y: -26, size: 36, rot: -8, delay: 0.0 },
  { emoji: "🌸", x: -22, y: -58, size: 30, rot: 6, delay: 0.07 },
  { emoji: "🌷", x: 16, y: -54, size: 32, rot: -5, delay: 0.14 },
  { emoji: "🌿", x: 50, y: -24, size: 26, rot: 14, delay: 0.2 },
  { emoji: "🌼", x: -64, y: 0, size: 26, rot: -12, delay: 0.26 },
  { emoji: "🌿", x: -36, y: -44, size: 24, rot: 10, delay: 0.31 },
  { emoji: "🤍", x: 58, y: 2, size: 22, rot: 8, delay: 0.36 },
  { emoji: "✨", x: -2, y: -84, size: 22, rot: 0, delay: 0.42 },
]

/** Kilauan sekali pakai yang muncul saat buket mekar (murah: opacity saja). */
const SPARKLES = [
  { x: -72, y: -40, d: 0.5 },
  { x: 66, y: -52, d: 0.62 },
  { x: 0, y: -108, d: 0.74 },
  { x: -32, y: -14, d: 0.86 },
  { x: 42, y: -8, d: 0.98 },
]

/** Kartu ucapan turun SETELAH gelombang mekar hampir selesai. */
const CARD_DELAY = 0.85

/** Spring mekar — sedikit under-damped biar memantul halus. */
const BLOOM_SPRING = { type: "spring", stiffness: 320, damping: 12, mass: 0.8 } as const

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

/** Kerucut kertas craft glassmorphism — melebar sedikit saat pita lepas. */
function ConeWrap({ isUntied, reduceMotion }: { isUntied: boolean; reduceMotion: boolean }) {
  return (
    <motion.div
      // The Bloom: bungkus kertas "sedikit melebar"
      animate={reduceMotion ? undefined : { scaleX: isUntied ? 1.1 : 1, scaleY: isUntied ? 0.99 : 1 }}
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

/** Pita emas — kapsul gradasi amber yang di-drag ke bawah untuk membuka. */
function GoldRibbon({ onUntied, reduceMotion }: { onUntied: () => void; reduceMotion: boolean }) {
  const controls = useAnimationControls()
  const [touched, setTouched] = useState(false)

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.y > RIBBON_TRIGGER_PX) {
      onUntied() // The Trigger — pita lepas
    } else {
      // belum lepas → pita "melawan" kembali ke posisi semula
      controls.start({ y: 0, transition: { type: "spring", stiffness: 420, damping: 26 } })
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
          // keyboard fallback — drag bukan satu-satunya jalan
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              onUntied()
            }
          }}
          drag="y"
          dragConstraints={RIBBON_DRAG_CONSTRAINTS}
          dragElastic={0.2}
          dragMomentum={false}
          onDragStart={() => setTouched(true)}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.07 }}
          animate={controls}
          initial={{ y: 0 }}
          className="relative flex h-9 w-full cursor-grab touch-none items-center justify-center rounded-full border border-amber-200/60 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 shadow-[0_0_28px_rgba(251,191,36,0.5)] will-change-transform active:cursor-grabbing"
        >
          {/* kilau pita */}
          <span aria-hidden className="pointer-events-none absolute inset-x-4 top-[3px] h-[30%] rounded-full bg-white/50 blur-[2px]" />
          {/* halo pulse — opacity saja, murah di GPU */}
          <span aria-hidden className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-amber-400/25 motion-safe:animate-pulse blur-md" />
          <span className="text-[11px] font-extrabold tracking-[0.22em] text-amber-950">TARIK ⬇</span>
        </motion.button>
      </motion.div>
    </div>
  )
}

/** Kartu ucapan — turun dari atas, berayun pelan, berisi pesan pengirim. */
function MessageCard({
  message,
  fomoInitials,
  revealName,
  reduceMotion,
  onEntered,
}: {
  message: string
  fomoInitials: string | null
  revealName: string | null
  reduceMotion: boolean
  onEntered: () => void
}) {
  return (
    <motion.div
      // ayunan pelan berulang — digantung dari titik atas kartu
      animate={reduceMotion ? undefined : { rotate: [-2.2, 2.2] }}
      transition={reduceMotion ? undefined : { duration: 3.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }}
      style={{ transformOrigin: "50% 0%" }}
      className="mx-auto w-full max-w-xs will-change-transform"
    >
      <motion.div
        initial={reduceMotion ? false : { y: -72, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 200, damping: 17, delay: CARD_DELAY }}
        onAnimationComplete={onEntered}
        className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-5 shadow-2xl shadow-black/40 backdrop-blur-md"
      >
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Kartu dari buket
        </p>
        <p className="font-hand mt-3 whitespace-pre-wrap text-lg leading-relaxed text-zinc-100">
          {message}
        </p>

        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
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
                {fomoInitials ?? "Seseorang"}
              </motion.span>
            )}
          </AnimatePresence>
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
  revealName = null,
  onOpenComplete,
}: PremiumBouquetProps) {
  const [isUntied, setIsUntied] = useState(false)
  const reduceMotion = useReducedMotion()

  // onOpenComplete dijamin cuma sekali — dari onAnimationComplete kartu
  // (reduced-motion: fallback timer karena tidak ada animasi yang "selesai")
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  useEffect(() => {
    if (!isUntied || !reduceMotion) return
    const t = setTimeout(notifyOpenComplete, 350)
    return () => clearTimeout(t)
  }, [isUntied, reduceMotion, notifyOpenComplete])

  function untie() {
    setIsUntied((prev) => {
      if (prev) return prev
      // getar halus saat pita lepas — diabaikan browser yang tak mendukung
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(25)
      return true
    })
  }

  return (
    <section className="flex w-full flex-col items-center py-6 text-zinc-100">
      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          🌸 Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Tarik pitanya, buka buketnya 🎀
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Pita emasnya dikunci rapi — tarik pelan-pelan ke bawah.
        </p>
      </header>

      {/* Panggung buket: glow → bunga (z-0) → kerucut (z-10) → pita (z-20) */}
      <div className="relative mt-2" style={{ width: STAGE_W, height: STAGE_H }}>
        {/* glow ambien — menyala saat mekar (opacity saja) */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: isUntied ? 1 : 0 }}
          transition={{ duration: 0.9, delay: 0.15 }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.28), rgba(244,63,94,0.12), transparent)",
          }}
        />

        {/* The Bloom — cluster bunga berangkat dari bibir kerucut */}
        <div className="absolute z-0" style={{ left: RIM_X, top: RIM_Y, width: 0, height: 0 }}>
          {FLOWERS.map((f) => (
            <Flower key={`${f.emoji}-${f.x}-${f.y}`} spec={f} open={isUntied} reduceMotion={!!reduceMotion} />
          ))}
        </div>

        <ConeWrap isUntied={isUntied} reduceMotion={!!reduceMotion} />

        {/* The Ribbon — hilang (drop + fade) begitu lepas */}
        <AnimatePresence>
          {!isUntied && <GoldRibbon key="ribbon" onUntied={untie} reduceMotion={!!reduceMotion} />}
        </AnimatePresence>

        {/* kilauan sekali pakai saat mekar */}
        {isUntied && !reduceMotion && (
          <>
            {SPARKLES.map((s, i) => (
              <motion.span
                key={i}
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
          </>
        )}
      </div>

      {/* petunjuk kecil — menghilang saat pita lepas */}
      <AnimatePresence>
        {!isUntied && (
          <motion.p
            key="hint"
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mt-1 text-xs text-zinc-500"
          >
            psst… tarik pita emasnya ke bawah 🤫
          </motion.p>
        )}
      </AnimatePresence>

      {/* The Card — hanya muncul setelah buket mekar */}
      <AnimatePresence>
        {isUntied && (
          <motion.div
            key="card"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-8 w-full"
          >
            <MessageCard
              message={message}
              fomoInitials={fomoInitials}
              revealName={revealName}
              reduceMotion={!!reduceMotion}
              onEntered={notifyOpenComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
