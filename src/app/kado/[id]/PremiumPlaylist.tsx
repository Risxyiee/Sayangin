"use client"

/**
 * PremiumPlaylist — kado "Playlist": turntable retro (The Retro Turntable)
 * yang jarumnya harus DIGESER ke piringan untuk memutar lagu via Spotify
 * Embed resmi.
 *
 * State machine 2 fase:
 *   idle    — vinyl diam (detail alur melingkar SVG), tonearm metalik
 *             berdiri di luar piringan. Teks kedip:
 *             "Geser jarum ke piringan untuk memutar lagu...".
 *   dropped — jarum "snap" jatuh ke piringan: vinyl berputar (rotate 360,
 *             infinite, linear — 33⅓ RPM), partikel not balok (🎵🎶✨)
 *             melayang naik, dan iframe Spotify Embed resmi muncul
 *             (fade in + slide up). Tunggu 3 detik (waktu menekan play
 *             di widget bila tak autoplay) → onOpenComplete() — komponen
 *             TETAP terpasang & bisa diputar selama surat/dilema dibaca.
 *
 * Interaksi jarum (spesifikasi):
 * - drag="x" pada tonearm; translasi X dikonversi jadi ROTASI lengan lewat
 *   useTransform (makin jauh digeser ke kiri, makin miring ke piringan).
 * - Snap real-time: begitu x <= -38px (tak menunggu jari dilepas) → drop.
 * - Belum sampai ambang → lengan "melawan" kembali seperti spring.
 * - Keyboard: Enter/Space pada lengan juga men-drop jarum (aksesibel).
 *
 * Performa & fail-safe:
 * - Animasi hanya transform/opacity; will-change-transform; semua efek
 *   menghormati prefers-reduced-motion (vinyl tak berputar, partikel mati).
 * - spotifyId fallback ke track default kalau kadoData.spotifyId kosong.
 * - Timer dibersihkan saat unmount; onOpenComplete dijamin sekali.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion"
import { SPOTIFY_DEFAULT_TRACK_ID } from "@/utils/spotify"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumPlaylistProps {
  /** Nama penerima — badge header & baris "untuk" di kartu pesan. */
  targetName: string
  /** Pesan pengirim — kartu catatan di bawah pemutar Spotify. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** ID track Spotify (kadoData.spotifyId) — null → track default. */
  spotifyId?: string | null
  /** Dipanggil SEKALI, 3 detik setelah iframe Spotify muncul. */
  onOpenComplete: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Kecepatan piringan — 33⅓ RPM ≈ 1.8 detik per putaran. */
const SPIN_SECONDS = 1.8
/** Jarak geser jarum penuh (px) — dipetakan ke rotasi lengan. */
const ARM_TRAVEL = 44
/** Ambang snap: begitu digeser sampai sini, jarum langsung jatuh. */
const ARM_SNAP_AT = -38
/** Rotasi lengan penuh (deg) saat jarum di piringan. */
const ARM_DROP_ROTATE = 58
/** Jeda sebelum onOpenComplete setelah iframe muncul (spesifikasi: 3 dtk). */
const REVEAL_WAIT_MS = 3000

/** Partikel not balok yang melayang saat vinyl berputar. */
const NOTE_PARTICLES = ["🎵", "🎶", "✨", "🎵", "✨", "🎶"]

// ─────────────────────────────────────────────────────────────────────────────
// Util kecil
// ─────────────────────────────────────────────────────────────────────────────

function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumPlaylist({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  spotifyId = null,
  onOpenComplete,
}: PremiumPlaylistProps) {
  const [dropped, setDropped] = useState(false)
  const reduceMotion = useReducedMotion()
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "") // id SVG unik anti-clash

  const trackId = spotifyId && spotifyId.length === 22 ? spotifyId : SPOTIFY_DEFAULT_TRACK_ID

  // Jarum: x = sensor jarak geser; rotasi lengan dikonversi darinya (spesifikasi)
  const armX = useMotionValue(0)
  const armRotate = useTransform(armX, [-ARM_TRAVEL, 0], [ARM_DROP_ROTATE, 0], { clamp: true })

  const droppedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // onOpenComplete dijamin cuma sekali
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

  // ── Fase 3 — jarum jatuh ke piringan
  const dropArm = useCallback(() => {
    if (droppedRef.current) return
    droppedRef.current = true
    setDropped(true)
    buzz(35)
    // snap: lengan meluncur ke posisi drop (spring pendek)
    animate(armX, -ARM_TRAVEL, { type: "spring", stiffness: 300, damping: 24 })
    // Spesifikasi fase 4: tunggu 3 detik (waktu klik play) → onOpenComplete
    timerRef.current = setTimeout(notifyOpenComplete, reduceMotion ? 1500 : REVEAL_WAIT_MS)
  }, [armX, reduceMotion, notifyOpenComplete])

  // Snap real-time: jarum jatuh begitu ambang terlewati, tak menunggu lepas
  useEffect(() => {
    const unsub = armX.on("change", (v) => {
      if (!droppedRef.current && v <= ARM_SNAP_AT) dropArm()
    })
    return unsub
  }, [armX, dropArm])

  function handleDragEnd() {
    if (droppedRef.current) return
    if (armX.get() <= ARM_SNAP_AT) {
      dropArm()
    } else {
      // belum sampai → lengan "melawan" kembali seperti mekanisme sungguhan
      animate(armX, 0, { type: "spring", stiffness: 420, damping: 32 })
    }
  }

  // Keyboard fallback — Enter/Space men-drop jarum (aksesibilitas)
  function handleArmKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      dropArm()
    }
  }

  const spinning = dropped && !reduceMotion

  return (
    <section className="flex w-full flex-col items-center bg-zinc-950 py-6 text-zinc-100">
      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3.5 py-1.5 text-xs text-emerald-200">
          🎧 Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Ada lagu untukmu 🎵
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Putar di turntable retro ini — dengarkan sampai habis ya.
        </p>
      </header>

      {/* Panggung — The Retro Turntable (top-down) */}
      <div className="relative mt-7">
        {/* glow lembut ruangan */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: dropped ? 1 : 0.35 }}
          transition={{ duration: 0.9 }}
          style={{
            background:
              "radial-gradient(closest-side, rgba(225,29,72,0.16), rgba(139,92,246,0.08), transparent)",
          }}
        />

        {/* DECK (plinth) */}
        <div
          className="relative h-[292px] w-[340px] rounded-[26px] border border-white/10 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.9)]"
          style={{ background: "linear-gradient(155deg, #1b1b20 0%, #101013 55%, #0a0a0c 100%)" }}
        >
          {/* tekstur plinth halus */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-[26px] opacity-40"
            style={{
              background:
                "repeating-linear-gradient(115deg, transparent 0 14px, rgba(255,255,255,0.016) 14px 15px)",
            }}
          />
          {/* sekrup sudut */}
          {(
            [
              [10, 10],
              [323, 10],
              [10, 275],
              [323, 275],
            ] as const
          ).map(([l, t]) => (
            <span
              key={`${l}-${t}`}
              aria-hidden
              className="absolute h-[7px] w-[7px] rounded-full bg-white/10 ring-1 ring-white/15"
              style={{ left: l, top: t }}
            />
          ))}
          {/* label deck */}
          <p className="absolute bottom-[9px] right-[16px] text-[8px] font-bold tracking-[0.3em] text-zinc-600">
            KANGENIN·RT-33
          </p>
          {/* sakelar kecepatan dekoratif */}
          <span aria-hidden className="absolute bottom-[11px] left-[22px] h-[3px] w-[26px] rounded-full bg-white/10" />

          {/* platter ring di bawah vinyl */}
          <span
            aria-hidden
            className="absolute rounded-full bg-[#08080a] ring-1 ring-white/10"
            style={{ left: 14, top: 48, width: 220, height: 220, boxShadow: "inset 0 2px 10px rgba(0,0,0,0.9)" }}
          />

          {/* VINYL — berputar saat jarum jatuh */}
          <motion.div
            className="absolute will-change-transform"
            style={{ left: 18, top: 52, width: 212, height: 212 }}
            initial={false}
            animate={spinning ? { rotate: 360 } : { rotate: 0 }}
            transition={
              spinning
                ? { duration: SPIN_SECONDS, repeat: Infinity, ease: "linear" }
                : { duration: 0.4 }
            }
          >
            <svg viewBox="0 0 212 212" className="h-full w-full" role="img" aria-label="Piringan hitam">
              <defs>
                <radialGradient id={`disc-${uid}`} cx="50%" cy="42%" r="65%">
                  <stop offset="0%" stopColor="#26262c" />
                  <stop offset="55%" stopColor="#111114" />
                  <stop offset="100%" stopColor="#060607" />
                </radialGradient>
                <radialGradient id={`label-${uid}`} cx="38%" cy="32%" r="80%">
                  <stop offset="0%" stopColor="#fb7185" />
                  <stop offset="55%" stopColor="#e11d48" />
                  <stop offset="100%" stopColor="#9f1239" />
                </radialGradient>
                <path
                  id={`arc-${uid}`}
                  d="M 106,106 m -29,0 a 29,29 0 1,1 58,0 a 29,29 0 1,1 -58,0"
                  fill="none"
                />
              </defs>

              {/* piringan */}
              <circle cx="106" cy="106" r="104" fill={`url(#disc-${uid})`} stroke="rgba(255,255,255,0.09)" strokeWidth="1" />

              {/* alur melingkar (grooves) */}
              {Array.from({ length: 12 }).map((_, i) => (
                <circle
                  key={`g${i}`}
                  cx="106"
                  cy="106"
                  r={47 + i * 4.9}
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth={i % 3 === 0 ? 1.05 : 0.55}
                />
              ))}
              {/* pemisah track */}
              {[50, 68, 86].map((r) => (
                <circle
                  key={`s${r}`}
                  cx="106"
                  cy="106"
                  r={r}
                  fill="none"
                  stroke="rgba(255,255,255,0.11)"
                  strokeWidth="1.4"
                />
              ))}
              {/* highlight busur — kilau alur */}
              <path
                d="M 106 10 A 96 96 0 0 1 195 78"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="14"
                fill="none"
                strokeLinecap="round"
              />

              {/* label tengah */}
              <circle cx="106" cy="106" r="40" fill={`url(#label-${uid})`} />
              <circle cx="106" cy="106" r="40" fill="none" stroke="rgba(253,230,138,0.5)" strokeWidth="1.2" />
              <text fontSize="7.2" letterSpacing="2.2" fill="rgba(255,241,214,0.85)" fontWeight="700">
                <textPath href={`#arc-${uid}`} startOffset="2%">
                  KANGENIN · SIDE A · 33⅓ RPM
                </textPath>
              </text>

              {/* lubang spindle */}
              <circle cx="106" cy="106" r="4" fill="#0a0a0b" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            </svg>
          </motion.div>

          {/* kilau statis di atas vinyl (cahaya tak ikut berputar) */}
          <span
            aria-hidden
            className="pointer-events-none absolute rounded-full"
            style={{
              left: 18,
              top: 52,
              width: 212,
              height: 212,
              background:
                "conic-gradient(from 205deg at 50% 50%, transparent 0deg, rgba(255,255,255,0.08) 16deg, transparent 34deg, transparent 178deg, rgba(255,255,255,0.05) 196deg, transparent 216deg)",
            }}
          />

          {/* spindle statis */}
          <span
            aria-hidden
            className="absolute left-[121px] top-[155px] z-10 h-[7px] w-[7px] rounded-full bg-zinc-300 shadow ring-1 ring-zinc-500"
          />

          {/* partikel not balok — melayang saat berputar */}
          {dropped && !reduceMotion && (
            <>
              {NOTE_PARTICLES.map((n, i) => (
                <motion.span
                  key={`n${i}`}
                  aria-hidden
                  className="pointer-events-none absolute z-20 text-lg"
                  style={{ left: 52 + (i % 3) * 58, top: 44 }}
                  initial={{ opacity: 0, y: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: -78,
                    x: [0, i % 2 ? 10 : -9, 4],
                    rotate: [0, i % 2 ? 14 : -12],
                  }}
                  transition={{
                    duration: 2.6,
                    delay: 0.35 + i * 0.45,
                    repeat: Infinity,
                    repeatDelay: 0.9,
                    ease: "easeOut",
                  }}
                >
                  {n}
                </motion.span>
              ))}
            </>
          )}

          {/* base cup tonearm (pivot statis) */}
          <span
            aria-hidden
            className="absolute z-10 rounded-full ring-1 ring-white/20"
            style={{
              right: 8,
              top: 24,
              width: 30,
              height: 30,
              background: "radial-gradient(circle at 35% 30%, #3f3f46, #18181b 65%, #0c0c0e)",
              boxShadow: "0 6px 14px rgba(0,0,0,0.7), inset 0 1px 2px rgba(255,255,255,0.18)",
            }}
          />

          {/* TONEARM — digeser ke kiri untuk memutar (drag x → rotasi) */}
          <motion.div
            role="button"
            tabIndex={0}
            aria-label="Geser jarum ke piringan untuk memutar lagu"
            onKeyDown={handleArmKey}
            drag={dropped ? false : "x"}
            dragConstraints={{ left: -ARM_TRAVEL, right: 0 }}
            dragMomentum={false}
            dragElastic={0.06}
            onDragEnd={handleDragEnd}
            className="absolute z-20 cursor-grab touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60 active:cursor-grabbing"
            style={{
              right: 22,
              top: 30,
              width: 16,
              height: 150,
              x: armX,
              rotate: armRotate,
              transformOrigin: "50% 10px",
            }}
          >
            {/* counterweight — menutupi pivot & memberi kesan lengan sungguhan */}
            <span
              aria-hidden
              className="absolute left-1/2 h-[24px] w-[12px] -translate-x-1/2 rounded-[4px] ring-1 ring-white/20"
              style={{
                top: -22,
                background: "linear-gradient(90deg, #52525b, #a1a1aa 45%, #3f3f46)",
                boxShadow: "0 3px 8px rgba(0,0,0,0.6)",
              }}
            />
            {/* batang lengan metalik */}
            <span
              aria-hidden
              className="absolute bottom-[8px] left-1/2 top-[2px] w-[7px] -translate-x-1/2 rounded-full"
              style={{
                background: "linear-gradient(90deg, #52525b, #d4d4d8 40%, #71717a 70%, #3f3f46)",
                boxShadow: "0 4px 10px rgba(0,0,0,0.55)",
              }}
            />
            {/* headshell + jarum */}
            <span
              aria-hidden
              className="absolute bottom-[-2px] left-1/2 h-[26px] w-[17px] -translate-x-1/2 rounded-[5px] ring-1 ring-white/25"
              style={{
                background: "linear-gradient(160deg, #3f3f46, #18181b 70%)",
                boxShadow: "0 6px 14px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.2)",
              }}
            >
              <span className="absolute bottom-[2px] left-[3px] h-[8px] w-[2px] rounded-full bg-zinc-200" />
              <span className="absolute bottom-[-3px] left-[3px] h-[5px] w-[2px] rounded-full bg-rose-300/90" />
            </span>
          </motion.div>
        </div>
      </div>

      {/* Instruksi / status */}
      <div className="mt-4 w-full text-center">
        <AnimatePresence mode="wait" initial={false}>
          {!dropped ? (
            <motion.p
              key="hint"
              exit={
                reduceMotion
                  ? undefined
                  : { opacity: 0, y: -6, transition: { duration: 0.25, ease: "easeOut" } }
              }
              animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.35, 1] }}
              transition={
                reduceMotion ? undefined : { duration: 1.6, repeat: Infinity, ease: "easeInOut" }
              }
              className="text-xs text-zinc-500"
            >
              Geser jarum ke piringan untuk memutar lagu...
            </motion.p>
          ) : (
            <motion.p
              key="status"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.5 }}
              className="text-xs font-medium text-emerald-200/90"
            >
              🎵 Now spinning — tekan play di widget kalau belum jalan.
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Spotify Embed resmi — muncul fade in + slide up setelah jarum jatuh */}
      <AnimatePresence>
        {dropped && (
          <motion.div
            key="player"
            initial={reduceMotion ? false : { opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4, ease: "easeOut" }}
            className="mt-5 w-full"
          >
            <iframe
              src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator&theme=0`}
              width="100%"
              height="152"
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title={`Lagu untuk ${targetName} di Spotify`}
              className="rounded-xl border border-white/10 bg-zinc-900"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kartu pesan pengirim — tampil setelah pemutar */}
      <AnimatePresence>
        {dropped && (
          <motion.div
            key="note"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.05, ease: "easeOut" }}
            className="mt-4 w-full max-w-[340px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
          >
            <p className="max-h-24 overflow-y-auto overscroll-contain whitespace-pre-wrap text-[12px] leading-relaxed text-zinc-300">
              {message}
            </p>
            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-[10.5px] text-zinc-500">
              <span>
                untuk: <b className="font-semibold text-zinc-300">{targetName}</b>
              </span>
              <span className="flex items-center gap-1">
                dari:
                <AnimatePresence mode="wait" initial={false}>
                  {revealName ? (
                    <motion.span
                      key="real"
                      initial={reduceMotion ? false : { opacity: 0, y: 5, filter: "blur(4px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="font-bold text-rose-300"
                    >
                      {revealName}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="masked"
                      exit={reduceMotion ? undefined : { opacity: 0, y: -5, filter: "blur(4px)" }}
                      transition={{ duration: 0.45 }}
                      className="font-bold text-zinc-400"
                    >
                      {fomoInitials ?? "Seseorang"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
