"use client"

/**
 * PremiumConfess — kado "Confess": surat pengakuan yang tersegel oleh
 * detak jantung pengirimnya.
 *
 * State machine 3 fase:
 *   sealed  — kartu pengakuan gelap dengan lambang hati berdenyut di pusat.
 *             Penerima harus MENAHAN lambangnya 1,5 detik — makin lama
 *             ditahan, cincin progres makin penuh, glow makin terang, dan
 *             getar halus meniru detak jantung (haptic, kalau didukung).
 *   opening — hati "pecah" jadi cahaya: lambang memudar, kunang-kunang
 *             naik sekali jalan, lalu lembar pengakuan meluncur terbuka
 *             (opacity + y + rotateX ringan) berisi pesan pengirim yang
 *             masih bertopeng.
 *   opened  — surat terbaca utuh. onOpenComplete() dipanggil SEKALI setelah
 *             lembar selesai muncul — parent lanjut ke fase dilemma.
 *
 * Identitas: lembar menampilkan fomoInitials ("R***I") sampai parent mengirim
 * revealName (jawaban diterima) — lalu nama asli crossfade masuk, selaras
 * dengan mekanik reveal di CinematicUnboxing & komponen premium lain.
 *
 * Performa mobile 60FPS:
 * - Animasi hanya transform/opacity/filter; elemen utama diberi
 *   will-change-transform (kartu, lambang, lembar).
 * - Kunang-kunang cuma opacity+transform, sekali jalan (tanpa loop tak
 *   berujung) dan hanya dirender saat fase opening/opened.
 * - Progres tahan dihitung interval 40ms (bukan rAF per-frame) — hemat CPU.
 * - Semua efek menghormati prefers-reduced-motion (buka instan via ketuk).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Heart } from "lucide-react"

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
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** Judul di atas kartu — override via kadoData.title. */
  title?: string
  /** Dipanggil SEKALI setelah lembar pengakuan selesai terbuka. */
  onOpenComplete: () => void
}

type ConfessPhase = "sealed" | "opening" | "opened"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = "Ada sesuatu yang pengen aku sampaikan…"

const HOLD_MS = 1500 // durasi menahan lambang hati
const TICK_MS = 40 // langkah interval progres (25fps — cukup halus, hemat)

/** Geometri panggung (px) — fix biar lapisan presisi & aman di layar 320px. */
const STAGE_W = 280
const SEAL_H = 190

const RING_R = 56
const RING_C = 2 * Math.PI * RING_R

/** Kunang-kunang sekali pakai saat surat terbuka — naik & memudar. */
const FIREFLIES = [
  { x: -84, y: -120, s: 1.0, d: 0.05 },
  { x: -46, y: -150, s: 0.8, d: 0.18 },
  { x: -8, y: -132, s: 1.2, d: 0.1 },
  { x: 34, y: -158, s: 0.9, d: 0.26 },
  { x: 72, y: -128, s: 1.1, d: 0.14 },
  { x: 98, y: -96, s: 0.7, d: 0.34 },
  { x: -104, y: -84, s: 0.8, d: 0.4 },
  { x: 12, y: -176, s: 0.7, d: 0.5 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumConfess({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  title = DEFAULT_TITLE,
  onOpenComplete,
}: PremiumConfessProps) {
  const [phase, setPhase] = useState<ConfessPhase>("sealed")
  const [progress, setProgress] = useState(0) // 0..1 — seberapa lama hati ditahan

  const reduceMotion = useReducedMotion()

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // Mesin tahan: interval 40ms menaikkan progres; lepas sebelum penuh → decay.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressRef = useRef(0)

  const stopHold = useCallback((reset: boolean) => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    if (reset) {
      progressRef.current = 0
      setProgress(0)
    }
  }, [])

  // bersih-bersih saat unmount
  useEffect(() => {
    return () => stopHold(false)
  }, [stopHold])

  function beginHold() {
    if (phase !== "sealed" || tickRef.current) return
    const started = Date.now() - progressRef.current * HOLD_MS
    tickRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - started) / HOLD_MS)
      progressRef.current = p
      setProgress(p)
      if (p >= 1) {
        stopHold(false)
        // detak jantung terakhir — getar halus, diabaikan browser tanpa haptic
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([40, 60, 40])
        }
        setPhase("opening")
      }
    }, TICK_MS)
  }

  function endHold() {
    if (phase !== "sealed") return
    // lepas terlalu dini → progres mundur perlahan (decay 1 dtk)
    if (progressRef.current < 1) {
      const p0 = progressRef.current
      stopHold(false)
      const decayStart = Date.now()
      const decay = setInterval(() => {
        const t = Math.min(1, (Date.now() - decayStart) / 1000)
        const p = p0 * (1 - t)
        progressRef.current = p
        setProgress(p)
        if (t >= 1) clearInterval(decay)
      }, TICK_MS)
    }
  }

  // opening → opened: tunggu lembar pengakuan benar-benar terbuka
  useEffect(() => {
    if (phase !== "opening") return
    const t = setTimeout(() => setPhase("opened"), reduceMotion ? 200 : 1100)
    return () => clearTimeout(t)
  }, [phase, reduceMotion])

  // jaring pengaman: fase opened tanpa onAnimationComplete (reduced motion)
  useEffect(() => {
    if (phase !== "opened" || !reduceMotion) return
    const t = setTimeout(notifyOpenComplete, 400)
    return () => clearTimeout(t)
  }, [phase, reduceMotion, notifyOpenComplete])

  const holdingPulse = progress > 0 && progress < 1

  return (
    <section className="flex w-full flex-col items-center py-6 text-zinc-100">
      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-3.5 py-1.5 text-xs text-rose-200">
          💜 Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{title}</h1>
        {phase === "sealed" && (
          <p className="mt-2 text-sm text-zinc-400">
            Sebuah pengakuan, tersegel oleh detak jantung pengirimnya.
          </p>
        )}
      </header>

      {/* Panggung */}
      <div className="relative mt-6" style={{ width: STAGE_W, minHeight: SEAL_H }}>
        {/* glow yang menguat mengikuti progres tahan — opacity saja */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl will-change-transform"
          style={{
            background:
              "radial-gradient(closest-side, rgba(244,63,94,0.35), rgba(168,85,247,0.16), transparent)",
          }}
          initial={false}
          animate={{ opacity: phase === "sealed" ? 0.12 + progress * 0.55 : 0.5 }}
          transition={{ duration: 0.2 }}
        />

        {/* KARTU TERSEGEL — memudar & mengecil saat pengakuan terbuka */}
        <AnimatePresence>
          {phase === "sealed" && (
            <motion.div
              key="seal-card"
              className="absolute inset-0 z-10 will-change-transform"
              exit={
                reduceMotion
                  ? { opacity: 0, transition: { duration: 0.15 } }
                  : { opacity: 0, scale: 0.82, filter: "blur(6px)", transition: { duration: 0.6, ease: "easeIn" } }
              }
            >
              <div
                className="flex h-full w-full flex-col items-center justify-center rounded-3xl border border-white/10 p-5 shadow-2xl shadow-black/60"
                style={{
                  background:
                    "linear-gradient(170deg, rgba(48,32,40,0.92), rgba(26,18,24,0.97) 55%, rgba(18,13,17,0.98))",
                }}
              >
                {/* lambang hati + cincin progres — TAHAN untuk membuka */}
                <button
                  type="button"
                  aria-label="Tahan hatinya untuk membuka pengakuan"
                  disabled={phase !== "sealed"}
                  onPointerDown={beginHold}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                  onKeyDown={(e) => {
                    if ((e.key === " " || e.key === "Enter") && phase === "sealed") {
                      e.preventDefault()
                      beginHold()
                    }
                  }}
                  onKeyUp={endHold}
                  className="relative flex h-[132px] w-[132px] touch-none items-center justify-center select-none disabled:cursor-default"
                  style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                >
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
                      strokeDashoffset={RING_C * (1 - progress)}
                    />
                    <defs>
                      <linearGradient id="confessGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <motion.span
                    className="flex h-[88px] w-[88px] items-center justify-center rounded-full border border-rose-400/25"
                    style={{
                      background:
                        "radial-gradient(circle at 34% 28%, rgba(244,63,94,0.5), rgba(168,85,247,0.28) 60%, rgba(24,16,22,0.9) 100%)",
                      boxShadow:
                        "0 0 32px rgba(244,63,94,0.35), inset 0 2px 8px rgba(255,255,255,0.18), inset 0 -6px 12px rgba(0,0,0,0.45)",
                    }}
                    animate={
                      reduceMotion
                        ? undefined
                        : progress >= 1
                          ? { scale: 1.12 }
                          : holdingPulse
                            ? { scale: [1, 1.07, 1] }
                            : { scale: [1, 1.035, 1] }
                    }
                    transition={
                      reduceMotion
                        ? undefined
                        : progress > 0
                          ? { duration: 0.55, repeat: Infinity, ease: "easeInOut" }
                          : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
                    }
                  >
                    <Heart
                      className={`h-10 w-10 transition-colors duration-300 ${
                        progress > 0 ? "fill-rose-400 text-rose-300 drop-shadow-[0_0_12px_rgba(244,63,94,0.8)]" : "fill-rose-500/70 text-rose-300/80"
                      }`}
                      strokeWidth={1.5}
                    />
                  </motion.span>
                </button>

                <p className="mt-4 text-center text-xs text-zinc-500">
                  {progress > 0 && progress < 1
                    ? "Tahan terus… jangan dilepas 💓"
                    : "Tahan hatinya sampai terbuka 🤍"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KUNANG-KUNANG — naik sekali jalan saat surat terbuka (opacity+transform) */}
        {phase !== "sealed" && !reduceMotion && (
          <span aria-hidden className="pointer-events-none absolute inset-0 z-20 block">
            {FIREFLIES.map((p, i) => (
              <motion.span
                key={`ff-${i}`}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-amber-200/90 shadow-[0_0_10px_rgba(253,230,138,0.9)]"
                style={{ marginLeft: p.x, marginTop: 30 }}
                initial={{ opacity: 0, x: 0, y: 0, scale: 0.5 }}
                animate={{ opacity: [0, 0.9, 0], x: p.x * 0.2, y: p.y, scale: [0.5, 1, 0.4] }}
                transition={{ delay: 0.15 + p.d, duration: 1.9, times: [0, 0.3, 1], ease: "easeOut" }}
              />
            ))}
          </span>
        )}

        {/* LEMBAR PENGAKUAN — meluncur terbuka setelah hati pecah */}
        <AnimatePresence>
          {(phase === "opening" || phase === "opened") && (
            <motion.div
              key="letter"
              className="relative z-10 will-change-transform"
              initial={reduceMotion ? false : { opacity: 0, y: 30, rotateX: -10, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() => {
                if (phase === "opened" || phase === "opening") notifyOpenComplete()
              }}
            >
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-6 shadow-2xl shadow-black/50 backdrop-blur-md">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-rose-300/70">
                  Pengakuan untuk {targetName}
                </p>

                <div className="my-4 h-px bg-gradient-to-r from-transparent via-rose-300/25 to-transparent" />

                <p className="font-hand text-xl leading-relaxed whitespace-pre-wrap text-zinc-100">
                  {message}
                </p>

                <div className="mt-5 flex items-center justify-end gap-2 text-sm">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* petunjuk kecil — menghilang saat hati diputus */}
      <AnimatePresence>
        {phase === "sealed" && (
          <motion.p
            key="hint"
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mt-3 text-xs text-zinc-500"
          >
            tahan lambangnya… pengakuannya nggak akan ke mana-mana 🤍
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  )
}
