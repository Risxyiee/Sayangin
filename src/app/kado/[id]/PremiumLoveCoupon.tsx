"use client"

/**
 * PremiumLoveCoupon — kado "Love Coupon": tiket emas holografik yang harus
 * DISOBEK untuk diklaim (The Golden Ticket).
 *
 * State machine 3 fase:
 *   utah/intact — tiket melayang pelan (bob y); garis putus-putus bergerigi
 *                 (SVG zigzag + dash) menandai batas robekan; sheen/shimmer
 *                 emas menyapu lintas tiket (CSS infinite, hormati
 *                 prefers-reduced-motion via media query).
 *   menarik     — potongan kanan ("Tarik untuk Klaim") di-drag (drag="x",
 *                 dragConstraints={{ left: 0 }} → hanya ke kanan).
 *                 useMotionValue x diikat useTransform ke efek visual:
 *                 gap gelap menganga di perforasi, tepi gerigi makin jelas
 *                 "retak", garis putus-putus memudar, tiket utama bergetar
 *                 halus (strain jitter proporsional jarak tarikan).
 *   sobek       — x > 100px (real-time via x.on("change"), tak tunggu lepas):
 *                 sobekan terpental jatuh (x:200, y:300, rotate:45, fade),
 *                 tiket flash + glow emas, konfeti mini di area tiket,
 *                 stamp "✔ DIKLAIM" menghantam dengan spring, lalu
 *                 onOpenComplete() dipanggil tepat 1 detik setelah robek.
 *
 * Detail teknis:
 * - x = useMotionValue(0) → dipakai drag & semua useTransform binding.
 * - Tepi gerigi digambar dengan SVG zigzag sederhana (polygon + dashed stroke).
 * - Tear dari gesture handler & keyboard (Enter/Space) — aksesibel.
 * - Konten: judul kupon (kadoData.title, default "1x Bebas Ngambek"),
 *   pesan sebagai catatan kecil (scrollable), identitas bertopeng →
 *   crossfade ke nama asli saat reveal (selaras komponen premium lain).
 * - Performa mobile 60FPS: hanya transform/opacity/filter, will-change-transform,
 *   update visual lewat MotionValue (tanpa re-render React per frame).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion"
import confetti from "canvas-confetti"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumLoveCouponProps {
  /** Nama penerima — badge header & baris "untuk" di tiket. */
  targetName: string
  /** Pesan pengirim — catatan kecil di badan tiket. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** Judul kupon (kadoData.title) — default "1x Bebas Ngambek". */
  title?: string
  /** Dipanggil SEKALI, tepat 1 detik setelah tiket berhasil dirobek. */
  onOpenComplete: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Ambang sobek (px, spesifikasi): tarikan x > 100 → tiket robek. */
const TEAR_THRESHOLD_PX = 100
/** Titik akhir animasi sobekan terpental (spesifikasi). */
const STUB_FLY = { x: 200, y: 300, rotate: 45 }

/** Geometri tiket (px) — memanjang horizontal, muat di layar HP. */
const TICKET_W = 340
const TICKET_H = 178
const STUB_W = 84

/** Warna tinta & kertas tiket. */
const INK = "text-amber-950"
const TEETH_FILL = "#8a6414"

// ─────────────────────────────────────────────────────────────────────────────
// Util & sub-komponen kecil
// ─────────────────────────────────────────────────────────────────────────────

function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
}

/** Konfeti mini khusus area tiket — hormati reduced-motion. */
function fireMiniConfetti(reduceMotion: boolean) {
  if (reduceMotion || typeof window === "undefined") return
  confetti({
    particleCount: 80,
    spread: 75,
    startVelocity: 26,
    scalar: 0.72,
    ticks: 130,
    origin: { y: 0.55 },
    colors: ["#fbbf24", "#f59e0b", "#fff7e0", "#fb7185", "#ffffff"],
    disableForReducedMotion: true,
    zIndex: 60,
  })
}

/** Nomor seri deterministik dari konten tiket — aman SSR (tanpa Math.random). */
function useSerialNumber(seed: string): string {
  return useMemo(() => {
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    return `KN-${(h % 900000) + 100000}`
  }, [seed])
}

/** Shimmer CSS infinite — mati otomatis saat prefers-reduced-motion. */
function ShimmerStyle() {
  return (
    <style>{`
      @keyframes kangenin-shimmer {
        0% { transform: translateX(-160%) skewX(-18deg); }
        100% { transform: translateX(320%) skewX(-18deg); }
      }
      .coupon-shimmer {
        animation: kangenin-shimmer 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .coupon-shimmer { animation: none; }
      }
    `}</style>
  )
}

/**
 * Tepi gerigi SVG — polygon zigzag vertikal (penyobekan kertas).
 * `flip` membalik arah gigi (dipakai di sisi kanan badan tiket).
 */
function TearTeeth({ height, opacity = 1, flip = false }: { height: number; opacity?: number; flip?: boolean }) {
  const step = 12
  const teeth = Math.ceil(height / step)
  const pts: string[] = []
  for (let i = 0; i <= teeth; i++) {
    const y = i * step
    const xOuter = i % 2 === 0 ? 8 : 0
    pts.push(`${xOuter},${y}`)
    pts.push(`${i % 2 === 0 ? 0 : 8},${y + step / 2}`)
  }
  const polygon = flip ? [...pts].reverse().join(" ") : pts.join(" ")
  const posStyle: CSSProperties = flip ? { left: 0 } : { right: 0 }
  return (
    <svg
      aria-hidden
      width="8"
      height={height}
      viewBox={`0 0 8 ${height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0"
      style={{ opacity, ...posStyle }}
    >
      <polygon points={polygon} fill={TEETH_FILL} />
      <polyline
        points={pts.filter((_, i) => i % 2 === 0).join(" ")}
        fill="none"
        stroke="rgba(255,240,190,0.35)"
        strokeWidth="1"
      />
    </svg>
  )
}

/** Garis putus-putus bergerigi di perforasi — memudar saat tarikan makin jauh. */
function PerforationLine({ opacity }: { opacity: number }) {
  return (
    <svg
      aria-hidden
      width="4"
      height={TICKET_H - 16}
      viewBox={`0 0 4 ${TICKET_H - 16}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-2 z-30"
      style={{ right: STUB_W - 2, opacity }}
    >
      <path
        d={`M2,0 ${Array.from({ length: Math.ceil((TICKET_H - 16) / 10) })
          .map((_, i) => `${i % 2 === 0 ? "L1.4" : "L2"},${(i + 1) * 10}`)
          .join(" ")}`}
        fill="none"
        stroke="rgba(60,40,5,0.65)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumLoveCoupon({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  title = "1x Bebas Ngambek",
  onOpenComplete,
}: PremiumLoveCouponProps) {
  const [torn, setTorn] = useState(false)
  const reduceMotion = useReducedMotion()

  // Real-time posisi tarikan sobekan — inti seluruh efek visual.
  const x = useMotionValue(0)
  const controls = useAnimationControls()

  const tornRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // onOpenComplete dijamin cuma sekali — 1 detik setelah robek (spesifikasi).
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const serial = useSerialNumber(`${targetName}|${message}|${title}`)

  // ── Binding visual useTransform (semua turunan x, tanpa re-render)
  /** Tiket utama bergetar halus — makin jauh ditarik, makin tertekan. */
  const strainRotate = useTransform(x, (v) =>
    v <= 4 || tornRef.current ? 0 : Math.sin(v * 0.5) * (v / TEAR_THRESHOLD_PX) * 1.3
  )
  /** Tepi gerigi badan makin jelas "retak" seiring tarikan. */
  const teethOpacity = useTransform(x, [0, 90], [0.4, 1])
  /** Garis putus-putus perforasi memudar saat kertas mulai terpisah. */
  const perforationOpacity = useTransform(x, [0, 70], [0.9, 0])
  /** Sobekan sedikit miring mengikuti tarikan. */
  const stubRotate = useTransform(x, [0, TEAR_THRESHOLD_PX], [0, 4])

  // ── The Tear — pelepasan tiket
  const tear = useCallback(() => {
    if (tornRef.current) return
    tornRef.current = true
    setTorn(true)
    buzz(35)
    fireMiniConfetti(!!reduceMotion)

    // Sobekan terpental jatuh keluar (x:200, y:300, rotate:45) lalu memudar.
    controls.start({
      x: STUB_FLY.x,
      y: STUB_FLY.y,
      rotate: STUB_FLY.rotate,
      opacity: 0,
      transition: reduceMotion
        ? { duration: 0 }
        : {
            duration: 0.75,
            ease: "easeIn",
            opacity: { duration: 0.75, times: [0, 0.55, 1] },
          },
    })

    // onOpenComplete 1 detik setelah tiket berhasil dirobek (spesifikasi).
    timerRef.current = setTimeout(notifyOpenComplete, 1000)
  }, [controls, reduceMotion, notifyOpenComplete])

  // Sobek real-time: begitu x melampaui ambang — tak menunggu jari dilepas.
  useEffect(() => {
    const unsub = x.on("change", (v) => {
      if (!tornRef.current && v > TEAR_THRESHOLD_PX) tear()
    })
    return unsub
  }, [x, tear])

  // ── Drag handlers
  function handleDragEnd(_e: unknown, _info: PanInfo) {
    if (tornRef.current) return
    if (x.get() > TEAR_THRESHOLD_PX) {
      tear()
    } else {
      // belum lewat ambang → sobekan "melawan" kembali seperti kertas elastis
      animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
    }
  }

  // Keyboard fallback — sobek bukan cuma jalan drag
  function handleStubKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      tear()
    }
  }

  return (
    <section className="flex w-full flex-col items-center py-6 text-zinc-100">
      <ShimmerStyle />

      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          🎟️ Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Ada tiket emas untukmu 🎫
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Kupon spesial yang cuma bisa diklaim satu kali.
        </p>
      </header>

      {/* Panggung tiket — clip horizontal (sobekan keluar samping), bebas vertikal */}
      <div className="relative mt-8 overflow-x-clip overflow-y-visible will-change-transform" style={{ width: TICKET_W }}>
        {/* glow emas saat diklaim — opacity saja */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: torn ? 1 : 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute -inset-8 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.30), rgba(244,63,94,0.12), transparent)",
          }}
        />

        {/* Fase 1 — tiket utuh melayang pelan (berhenti saat sudah dirobek) */}
        <motion.div
          animate={!torn && !reduceMotion ? { y: [0, -6, 0] } : { y: 0 }}
          transition={!torn && !reduceMotion ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" } : undefined}
          className="relative will-change-transform"
          style={{ width: TICKET_W, height: TICKET_H }}
        >
          {/* latar gelap di balik tiket — terlihat saat sobekan menganga */}
          <div aria-hidden className="absolute inset-y-0 right-0 rounded-r-2xl bg-zinc-950" style={{ width: STUB_W }} />

          {/* BADAN TIKET (porsi besar, kiri) */}
          <motion.div
            style={{ rotate: strainRotate, transformOrigin: "0% 50%" }}
            className="absolute inset-y-0 left-0 z-10 overflow-hidden rounded-l-2xl rounded-r-md shadow-[0_26px_60px_-16px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/40 will-change-transform"
          >
            {/* kertas emas */}
            <div
              className={`absolute inset-0 ${INK}`}
              style={{
                background:
                  "linear-gradient(135deg, #f6d787 0%, #e3b34f 28%, #c98f2a 52%, #e8c06a 78%, #f9e6a8 100%)",
              }}
            />
            {/* lapisan holografik */}
            <div
              aria-hidden
              className="absolute inset-0 mix-blend-soft-light"
              style={{
                background:
                  "linear-gradient(115deg, rgba(255,64,129,0.35), rgba(56,189,248,0.4) 30%, rgba(250,204,21,0.45) 52%, rgba(168,85,247,0.35) 78%, rgba(255,255,255,0.3))",
              }}
            />
            {/* sheen/shimmer menyapu (CSS infinite) */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="coupon-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
            </div>

            {/* isi badan tiket */}
            <div className="relative flex h-full flex-col p-4" style={{ paddingRight: 16 }}>
              <div className="flex items-center justify-between">
                <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-amber-900/80">
                  Kangenin·Love Coupon
                </p>
                <p className="text-[8px] font-semibold tabular-nums tracking-[0.18em] text-amber-900/60">
                  No. {serial}
                </p>
              </div>

              <p className="font-hand mt-1.5 truncate text-2xl font-bold leading-tight text-amber-950">
                {title}
              </p>

              {/* catatan kecil — pesan pengirim (scrollable kalau panjang) */}
              <p className="mt-1 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap text-[11px] leading-snug text-amber-950/75 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {message}
              </p>

              <div className="mt-1.5 flex items-center justify-between border-t border-amber-900/15 pt-1.5 text-[10px]">
                <span className="font-semibold text-amber-950/85">
                  untuk: {targetName}
                </span>
                <span className="flex items-center gap-1 text-amber-950/70">
                  dari:
                  <AnimatePresence mode="wait" initial={false}>
                    {revealName ? (
                      <motion.span
                        key="real"
                        initial={reduceMotion ? false : { opacity: 0, y: 5, filter: "blur(4px)" }}
                        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="font-bold text-rose-900"
                      >
                        {revealName}
                      </motion.span>
                    ) : (
                      <motion.span
                        key="masked"
                        exit={reduceMotion ? undefined : { opacity: 0, y: -5, filter: "blur(4px)" }}
                        transition={{ duration: 0.45 }}
                        className="font-bold text-amber-950/80"
                      >
                        {fomoInitials ?? "Seseorang"}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
              </div>
            </div>

            {/* tepi gerigi badan — makin jelas "retak" saat ditarik */}
            <motion.div aria-hidden className="absolute inset-y-0 right-0 z-10" style={{ opacity: teethOpacity }}>
              <TearTeeth height={TICKET_H} opacity={1} />
            </motion.div>

            {/* flash saat diklaim */}
            {torn && !reduceMotion && (
              <motion.div
                key="flash"
                aria-hidden
                className="pointer-events-none absolute inset-0 z-30 bg-white"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.85, 0] }}
                transition={{ delay: 0.05, duration: 0.55, times: [0, 0.2, 1], ease: "easeOut" }}
              />
            )}

            {/* stamp DIKLAIM — menghantam dengan spring setelah sobek */}
            <AnimatePresence>
              {torn && (
                <motion.div
                  key="stamp"
                  initial={reduceMotion ? false : { scale: 2.4, opacity: 0, rotate: -20, x: "-50%", y: "-50%" }}
                  animate={{ scale: 1, opacity: 0.94, rotate: -10, x: "-50%", y: "-50%" }}
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 17, delay: 0.15 }}
                  className="absolute left-1/2 top-1/2 z-30 rounded-lg border-[3px] border-rose-700/90 bg-white/25 px-4 py-1.5 font-black uppercase tracking-[0.24em] text-rose-800 shadow-lg backdrop-blur-[1px]"
                  style={{ fontSize: 15 }}
                >
                  ✔ Diklaim
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Perforasi — garis putus-putus bergerigi di batas robekan */}
          <motion.div className="absolute inset-0 z-30" style={{ opacity: perforationOpacity, pointerEvents: "none" }}>
            <PerforationLine opacity={1} />
          </motion.div>

          {/* SOBEKAN (potongan kecil, kanan) — di-drag ke kanan untuk klaim */}
          <motion.button
            type="button"
            aria-label="Tarik potongan kanan untuk mengklaim kupon"
            disabled={torn}
            drag={torn ? false : "x"}
            dragConstraints={{ left: 0 }}
            dragMomentum={false}
            dragElastic={0.08}
            onDragEnd={handleDragEnd}
            onKeyDown={handleStubKey}
            animate={controls}
            style={{ x, rotate: stubRotate, width: STUB_W }}
            className="absolute inset-y-0 right-0 z-20 flex touch-none select-none items-center justify-center rounded-r-2xl shadow-[0_26px_60px_-16px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/40 will-change-transform disabled:cursor-default active:cursor-grabbing"
          >
            <div
              className={`absolute inset-0 rounded-r-2xl ${INK}`}
              style={{
                background: "linear-gradient(150deg, #e8bd55, #c8922e 45%, #b37f1f)",
              }}
            />
            <div
              aria-hidden
              className="absolute inset-0 rounded-r-2xl mix-blend-soft-light"
              style={{
                background:
                  "linear-gradient(200deg, rgba(56,189,248,0.4), rgba(250,204,21,0.45) 45%, rgba(255,64,129,0.35))",
              }}
            />
            {/* shimmer di sobekan — sedikit telat biar bergantian dengan badan */}
            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-r-2xl">
              <div className="coupon-shimmer absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animationDelay: "1.6s" }} />
            </div>
            {/* bayangan sisi tempel */}
            <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 rounded-l-sm bg-gradient-to-r from-black/25 to-transparent" />

            {/* konten sobekan */}
            <div className={`relative flex flex-col items-center gap-2 px-2 text-center ${INK}`}>
              <span aria-hidden className="text-base">✂️</span>
              <span className="text-[11px] font-black uppercase leading-relaxed tracking-[0.14em]">
                Tarik<br />untuk<br />Klaim
              </span>
              <motion.span
                aria-hidden
                animate={torn || reduceMotion ? undefined : { x: [0, 5, 0] }}
                transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                className="text-sm font-bold"
              >
                ➜
              </motion.span>
            </div>
          </motion.button>
        </motion.div>
      </div>

      {/* petunjuk kecil — hilang setelah tiket dirobek */}
      <AnimatePresence>
        {!torn && (
          <motion.p
            key="hint"
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mt-6 text-xs text-zinc-500"
          >
            psst… tarik sobekannya ke kanan sampai lepas 🤫
          </motion.p>
        )}
      </AnimatePresence>

      {/* status tiket */}
      <AnimatePresence>
        {torn && (
          <motion.p
            key="status"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="mt-6 text-xs font-medium text-amber-200/90"
          >
            🎟️ Kupon resmi diklaim — berlaku selamanya, nggak bisa ditukar.
          </motion.p>
        )}
      </AnimatePresence>
    </section>
  )
}
