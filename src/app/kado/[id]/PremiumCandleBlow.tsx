"use client"

/**
 * PremiumCandleBlow — kado "Candle Blow": lilin elegan di ruangan gelap
 * gulita yang harus DITIUP lewat mic (Web Audio API) untuk dipadamkan.
 *
 * State machine 3 fase:
 *   dark      — ruangan gelap, lilin belum menyala. Browser memblokir
 *               audio/mic tanpa gesture → wajib lewat tombol glassmorphism
 *               "Nyalakan Lilin (Buka Mic)". Instruksi redup di bawahnya:
 *               "Izinkan mic, lalu tiup ke arah layarmu…".
 *   listening — getUserMedia({ audio: true }) → AudioContext → AnalyserNode;
 *               requestAnimationFrame membaca data frekuensi tiap frame dan
 *               menghitung volume rata-rata (0..1). Volume diikat ke
 *               MotionValue → glow membesar & bar "angin" terisi real-time
 *               TANPA re-render React. Api flicker organik (rotasi asimetris,
 *               scale, opacity loop) dan membungkuk saat angin menghantam.
 *               Volume di atas threshold selama ≥400ms (mencegah mati karena
 *               click/decak lidah) → The Extinguish.
 *   blown     — SANGAT KRUSIAL: requestAnimationFrame dihentikan & SEMUA
 *               audio track.stop() seketika (indikator mic di HP target
 *               langsung hilang), AudioContext ditutup. Api menyusut ke
 *               scale 0, glow menghilang, bara memudar, asap tipis mengepul,
 *               teks estetik "Make a wish..." muncul — 2 detik kemudian
 *               onOpenComplete() dipanggil (parent → fase dilemma).
 *
 * Fail-safes:
 * - Mic ditolak / browser tak support / AudioContext gagal → mode fallback:
 *   "Gagal akses mic? Tap layar 3x untuk mematikan." (onTap Framer Motion,
 *   3 tap dalam 2,2 dtk, indikator titik).
 * - Tap 3x TETAP aktif saat mic hidup — jaring pengaman kalau hardware mic
 *   bermasalah, user tak pernah buntu.
 * - Cleanup total saat unmount: rAF di-cancel, semua track.stop(),
 *   AudioContext ditutup, timer dibersihkan.
 *
 * Performa mobile 60FPS:
 * - Volume real-time lewat useMotionValue (nol re-render React per frame);
 *   animasi hanya transform/opacity/filter + will-change-transform.
 * - Semua efek menghormati prefers-reduced-motion.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type TapInfo,
} from "framer-motion"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumCandleBlowProps {
  /** Nama penerima — badge header & baris "untuk" di kartu pesan. */
  targetName: string
  /** Pesan pengirim — tampil sebagai kartu catatan setelah "Make a wish...". */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** Dipanggil SEKALI, tepat 2 detik setelah lilin berhasil dipadamkan. */
  onOpenComplete: () => void
}

type CandlePhase = "dark" | "listening" | "blown"
type MicState = "idle" | "requesting" | "granted" | "denied" | "unsupported"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Ambang volume tiupan (rata-rata spektrum 0..1) — ruangan senyap ~0.05-0.2. */
const BLOW_THRESHOLD = 0.3
/** Tiupan harus stabil selama ini (ms) — mencegah mati karena click/decak. */
const BLOW_SUSTAIN_MS = 400
/** Jeda sebelum onOpenComplete setelah padam (spesifikasi: 2 detik). */
const WISH_WAIT_MS = 2000
/** Reset hitungan tap fallback setelah jeda sejauh ini (ms). */
const TAP_WINDOW_MS = 2200

/** Geometri api & lilin (px). */
const FLAME_W = 34
const FLAME_H = 58
const BODY_W = 78
const BODY_H = 148

// ─────────────────────────────────────────────────────────────────────────────
// Util & sub-komponen kecil
// ─────────────────────────────────────────────────────────────────────────────

function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
}

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
 * Api lilin 3 lapis (oranye → inti kuning-putih → dasar biru).
 * Tiga div bersarang agar transform tidak saling mengalahkan:
 *   luar  — nyala/padam (scale 0↔1, origin bawah)
 *   tengah— flicker loop organik (rotasi asimetris + scale + opacity)
 *   dalam — squash reaksi tiupan (diikat MotionValue volume real-time)
 */
function Flame({
  lit,
  blown,
  reduceMotion,
  blowSquash,
}: {
  lit: boolean
  blown: boolean
  reduceMotion: boolean
  blowSquash: MotionValue<number>
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
        {/* squash reaksi tiupan — api membungkuk saat angin menghantam */}
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
  onOpenComplete,
}: PremiumCandleBlowProps) {
  const [phase, setPhase] = useState<CandlePhase>("dark")
  const [micState, setMicState] = useState<MicState>("idle")
  const [tapCount, setTapCount] = useState(0)

  const reduceMotion = useReducedMotion()

  // ── Refs audio (semua bisa dibersihkan dari mana pun)
  const streamRef = useRef<MediaStream | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const aliveRef = useRef(false) // penanda loop boleh jalan
  const loudSinceRef = useRef<number | null>(null) // mulai kapan volume tinggi
  const mountedRef = useRef(true)

  const tapCountRef = useRef(0)
  const lastTapRef = useRef(0)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blownRef = useRef(false)

  // ── Volume real-time — MotionValue (tanpa re-render React per frame)
  const volumeMV = useMotionValue(0)

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  const lit = phase === "listening"
  const blown = phase === "blown"
  const micGranted = micState === "granted"

  // ── Binding visual turunan volume (semua via useTransform, nol re-render)
  /** Api membungkuk saat angin menghantam. */
  const blowSquash = useTransform(volumeMV, [0.12, 0.55], [1, 0.68], { clamp: true })
  /** Glow membesar mengikuti suara/tiupan. */
  const glowScale = useTransform(volumeMV, [0, 0.7], [1, 1.3], { clamp: true })
  /** Bar "angin" terisi real-time. */
  const windScale = useTransform(volumeMV, [0, 1], [0.03, 1], { clamp: true })
  /** Bar berubah warna saat melewati ambang tiupan. */
  const windColor = useTransform(
    volumeMV,
    [0.2, BLOW_THRESHOLD, 0.48],
    ["#fbbf24", "#fb923c", "#fb7185"]
  )

  // ───────────────────────────────────────────────────────────────────────────
  // KRUSIAL — matikan seluruh audio: rAF, SEMUA track, AudioContext.
  // Dipanggil seketika saat padam & saat unmount; indikator mic di HP target
  // harus hilang sesegera mungkin.
  // ───────────────────────────────────────────────────────────────────────────
  const stopAudio = useCallback(() => {
    aliveRef.current = false
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    analyserRef.current = null
    loudSinceRef.current = null
    volumeMV.set(0)
    if (ctxRef.current) {
      const ctx = ctxRef.current
      ctxRef.current = null
      if (ctx.state !== "closed") ctx.close().catch(() => {})
    }
  }, [volumeMV])

  // ── The Extinguish — lilin padam
  const blowOut = useCallback(() => {
    if (blownRef.current) return
    blownRef.current = true
    stopAudio() // SEKETIKA — sebelum animasi apa pun
    setPhase("blown")
    buzz(45)
    // Spesifikasi: tunggu 2 detik setelah padam → onOpenComplete()
    timerRef.current = setTimeout(notifyOpenComplete, reduceMotion ? 600 : WISH_WAIT_MS)
  }, [stopAudio, notifyOpenComplete, reduceMotion])

  // rAF loop membaca blowOut lewat ref — bebas stale closure.
  // Sinkronisasi lewat effect (bukan saat render) — aturan react-hooks/refs.
  const blowRef = useRef(blowOut)
  useEffect(() => {
    blowRef.current = blowOut
  }, [blowOut])

  // ── Loop analisis audio (requestAnimationFrame)
  const startLoop = useCallback(() => {
    const analyser = analyserRef.current
    if (!analyser) return
    // Uint8Array dibuat di sini (bukan ref) — selalu match fftSize saat ini
    const data = new Uint8Array(analyser.frequencyBinCount)

    const loop = () => {
      if (!aliveRef.current) return // dimatikan → berhenti total
      const a = analyserRef.current
      if (!a) return
      a.getByteFrequencyData(data)
      let sum = 0
      for (let i = 0; i < data.length; i++) sum += data[i]
      const avg = sum / data.length / 255 // volume rata-rata 0..1
      volumeMV.set(avg)

      const now = performance.now()
      if (avg > BLOW_THRESHOLD) {
        if (loudSinceRef.current == null) {
          loudSinceRef.current = now
        } else if (now - loudSinceRef.current >= BLOW_SUSTAIN_MS) {
          blowRef.current() // stopAudio di dalamnya menghentikan loop
          return
        }
      } else {
        loudSinceRef.current = null
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
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close().catch(() => {})
      }
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // ── Mode fallback — mic gagal/ditolak/tak support; lilin tetap menyala
  function enterFallback(state: "denied" | "unsupported") {
    stopAudio()
    setMicState(state)
    setPhase("listening")
  }

  // ── Tombol Start — getUserMedia HARUS dari gesture klik
  async function start() {
    if (phase !== "dark" || micState === "requesting" || blownRef.current) return

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
      // stopAudio() di enterFallback tetap bisa mematikan track-nya
      streamRef.current = stream

      const ctx = new AudioCtx()
      ctxRef.current = ctx
      if (ctx.state === "suspended") await ctx.resume()

      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.55
      source.connect(analyser)
      analyserRef.current = analyser

      setMicState("granted")
      setPhase("listening")
      startLoop()
    } catch {
      // izin ditolak / hardware error → fallback tap
      enterFallback("denied")
    }
  }

  // ── Fallback tap 3x (jalan di SEMUA kondisi listening — jaring pengaman)
  function handleTap(_e: MouseEvent | TouchEvent | PointerEvent, _info: TapInfo) {
    if (phase !== "listening" || blownRef.current) return
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
    }
  }

  return (
    <motion.section
      onTap={phase === "listening" ? handleTap : undefined}
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

      {/* Header */}
      <header className="relative text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          🕯️ Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Sebuah lilin untukmu 🕯️
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Nyalakan, tiup, lalu buat sebuah harapan.
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
          {/* wrapper api + asap */}
          <div className="relative flex w-[40px] items-end justify-center" style={{ height: FLAME_H + 10 }}>
            <Flame lit={lit} blown={blown} reduceMotion={!!reduceMotion} blowSquash={blowSquash} />
            {blown && (
              <>
                <SmokeWisp delay={0.15} reduceMotion={!!reduceMotion} />
                <SmokeWisp delay={0.8} reduceMotion={!!reduceMotion} />
              </>
            )}
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

      {/* Kontrol, instruksi & momen pasca-padam */}
      <div className="relative mt-3 w-full text-center">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "dark" && (
            <motion.div
              key="dark"
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <button
                type="button"
                onClick={start}
                disabled={micState === "requesting"}
                className="mx-auto flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-white/15 disabled:opacity-50"
              >
                {micState === "requesting" ? "Membuka mic…" : "🔥 Nyalakan Lilin (Buka Mic)"}
              </button>
              <p className="mt-3 text-xs text-zinc-600">
                Izinkan mic, lalu tiup ke arah layarmu…
              </p>
            </motion.div>
          )}

          {phase === "listening" && micGranted && (
            <motion.div
              key="listen"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <motion.p
                animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.45, 1] }}
                transition={
                  reduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                }
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
              <p className="mt-2 text-[11px] text-zinc-600">
                atau tap layar 3x kalau mic-mu bermasalah
              </p>
            </motion.div>
          )}

          {phase === "listening" && !micGranted && (
            <motion.div
              key="fallback"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
            >
              <motion.p
                animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.45, 1] }}
                transition={
                  reduceMotion ? undefined : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                }
                className="text-sm font-medium text-zinc-300"
              >
                Gagal akses mic? Tap layar 3x untuk mematikan.
              </motion.p>
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pasca-padam — "Make a wish..." + pesan pengirim */}
        {phase === "blown" && (
          <div className="w-full">
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: 12, filter: "blur(6px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.9, delay: 0.65, ease: "easeOut" }}
              className="font-hand text-[27px] leading-tight text-amber-100/95"
              style={{ textShadow: "0 0 20px rgba(251,191,36,0.4)" }}
            >
              Make a wish...
            </motion.p>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.15, ease: "easeOut" }}
              className="mx-auto mt-4 max-w-[320px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left"
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
                        initial={
                          reduceMotion ? false : { opacity: 0, y: 5, filter: "blur(4px)" }
                        }
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
          </div>
        )}
      </div>
    </motion.section>
  )
}
