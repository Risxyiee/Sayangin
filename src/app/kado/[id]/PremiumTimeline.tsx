"use client"

/**
 * PremiumTimeline — kado "Timeline Kisah Kalian": The Memory Lane Edition.
 *
 * Halaman yang bisa di-scroll — riwayat kalian dari momen pertama sampai
 * sekarang, muncul satu per satu saat dia menggulir, diiringi musik latar.
 *
 *   gate      (Babak 0 — Sampul)  layar sampul "Kisah Kita — Untuk <nama>".
 *                                 Tap "Mulai Perjalanan" = gesture aman buat
 *                                 audio (musik latar mulai otomatis).
 *   moments   (Babak 1 — Perjalanan) garis waktu vertikal; tiap momen (tanggal
 *                                 + foto polaroid + caption) menyapa saat
 *                                 masuk layar: blur→tajam + chime + getar
 *                                 halus. Sekali lewat, tetap terlihat.
 *   closing   (Babak 2 — Penutup)  pesan utama pengirim terungkap perlahan,
 *                                 tanda tangan masih bertopeng sampai
 *                                 parent mengirim revealName.
 *   ending    (Babak 3 — Kejutan)  tombol "Ada satu hal lagi…" membuka
 *                                 halaman kejutan: pesan rahasia ATAU kode
 *                                 voucher yang bisa disalin. → onOpenComplete
 *
 * Musik latar: synth WebAudio lokal (tanpa berkas, tanpa jaringan) —
 * 3 preset loop halus + opsi sunyi; tombol mute mengapung. AudioContext
 * dibuat dari gesture "Mulai" dan ditutup saat unmount.
 *
 * Fail-safe & aksesibilitas:
 * - Tanpa momen (data lama/rusak) → satu momen dari pesan utama; tidak
 *   pernah ada halaman kosong.
 * - prefers-reduced-motion → reveal instan tanpa blur; musik tetap opsional.
 * - Keyboard: semua tombol biasa; scroll native (tidak memeranggi scroll).
 * - Tanpa Web Audio / getar → no-op, alur utuh.
 *
 * Performa mobile 60FPS: animasi hanya transform/opacity/filter,
 * elemen bergerak diberi will-change, kunang-kunang statis via CSS.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Check, Copy, Gift, Music2, Volume2, VolumeX } from "lucide-react"
import { useKadoAudio } from "./useKadoAudio"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineMomentData {
  date?: string
  caption?: string
  photo?: string
}

export interface PremiumTimelineProps {
  /** Nama penerima — sampul & header perjalanan. */
  targetName: string
  /** Pesan utama pengirim — tampil di kartu penutup sebelum kejutan. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim (tanda tangan) — tetap bertopeng di layar. */
  senderName?: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** Tanggal kado dibuat (ISO) — "sejak <tanggal>" di sampul. */
  createdAt?: string | null
  /** Daftar momen (kadoData.moments) — tanggal + caption + foto opsional. */
  moments?: TimelineMomentData[] | null
  /** Preset musik latar (kadoData.music). */
  music?: string | null
  /** Jenis kejutan penutup: "pesan" | "voucher" (kadoData.endingType). */
  endingType?: string | null
  /** Isi kejutan penutup (kadoData.endingText). */
  endingText?: string | null
  /** Dipanggil SEKALI setelah halaman kejutan terbuka. */
  onOpenComplete: () => void
}

type MusicId = "musicbox" | "lullaby" | "senja" | "none"

// ─────────────────────────────────────────────────────────────────────────────
// Preset musik latar — synth loop halus, tanpa berkas audio
// ─────────────────────────────────────────────────────────────────────────────

const MUSIC: Record<Exclude<MusicId, "none">, {
  label: string
  beatMs: number
  wave: OscillatorType
  gain: number
  lowpass?: number
  notes: number[]
}> = {
  musicbox: {
    label: "Kotak Musik",
    beatMs: 430,
    wave: "triangle",
    gain: 0.045,
    notes: [523.25, 659.25, 783.99, 659.25, 1046.5, 783.99, 659.25, 493.88],
  },
  lullaby: {
    label: "Nina Bobo",
    beatMs: 580,
    wave: "sine",
    gain: 0.055,
    notes: [392.0, 466.16, 587.33, 466.16, 523.25, 440.0, 392.0, 349.23],
  },
  senja: {
    label: "Gitar Senja",
    beatMs: 350,
    wave: "sawtooth",
    gain: 0.03,
    lowpass: 900,
    notes: [220.0, 261.63, 329.63, 246.94, 293.66, 220.0, 196.0, 246.94],
  },
}

function parseMusicId(v: string | null | undefined): MusicId {
  return v === "lullaby" || v === "senja" || v === "none" ? v : "musicbox"
}

function buzz(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern)
    } catch {
      /* diabaikan */
    }
  }
}

/** "2026-04-17T…" → "17 April 2026" (dipanggil pasca-start → aman hydration). */
function formatTanggal(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(d)
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Satu momen — menyapa saat masuk layar (blur → tajam + chime)
// ─────────────────────────────────────────────────────────────────────────────

function MomentItem({
  moment,
  index,
  total,
  reduceMotion,
  onChime,
}: {
  moment: TimelineMomentData
  index: number
  total: number
  reduceMotion: boolean
  onChime: (i: number) => void
}) {
  const playedRef = useRef(false)
  const tilt = index % 2 === 0 ? -1.6 : 1.6

  return (
    <motion.li
      className="relative pl-12 will-change-transform"
      initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 28, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-90px" }}
      transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      onViewportEnter={() => {
        if (playedRef.current) return
        playedRef.current = true
        onChime(index)
      }}
    >
      {/* node garis waktu */}
      <span
        aria-hidden
        className="absolute left-0 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-rose-300/40 bg-rose-500/25 text-[10px] text-rose-100 shadow-[0_0_16px_-4px_rgba(244,63,94,0.7)]"
      >
        {index + 1}
      </span>

      <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3.5 shadow-lg shadow-black/30 backdrop-blur-sm">
        {/* foto polaroid — miring pelan, bergantian arah */}
        {moment.photo && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: reduceMotion ? 0 : 0.55, delay: 0.15, ease: "easeOut" }}
            className="mb-3 will-change-transform"
            style={{ transform: `rotate(${tilt}deg)` }}
          >
            <div className="rounded-[6px] bg-[#f4f1e8] p-2 pb-6 ring-1 ring-black/5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.7)]">
              <img
                src={moment.photo}
                alt={`Kenangan ${index + 1}${moment.date ? ` — ${moment.date}` : ""}`}
                className="aspect-[4/3] w-full rounded-[3px] object-cover"
                draggable={false}
                loading="lazy"
              />
              <p className="mt-1 px-1 text-center font-hand text-sm leading-none text-zinc-500">
                {index + 1}/{total}
              </p>
            </div>
          </motion.div>
        )}

        {moment.date && (
          <span className="inline-block rounded-sm bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-rose-200/90">
            {moment.date}
          </span>
        )}
        <p className="mt-2 text-[15px] leading-relaxed text-zinc-100/90">{moment.caption}</p>
      </div>
    </motion.li>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumTimeline({
  targetName,
  message,
  fomoInitials,
  senderName = null,
  revealName = null,
  createdAt = null,
  moments = null,
  music = null,
  endingType = null,
  endingText = null,
  onOpenComplete,
}: PremiumTimelineProps) {
  const [started, setStarted] = useState(false)
  const [muted, setMuted] = useState(false)
  const [endingOpen, setEndingOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const reduceMotion = useReducedMotion()
  const audio = useKadoAudio()

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // ── data aman: tanpa momen → satu momen dari pesan utama (tidak pernah kosong)
  const cleanMoments = useMemo<TimelineMomentData[]>(() => {
    const list = (moments ?? []).filter(
      (m) => m && typeof m.caption === "string" && m.caption.trim().length > 0
    )
    if (list.length > 0) return list.slice(0, 10)
    return [{ caption: message, date: formatTanggal(createdAt) ?? "" }]
  }, [moments, message, createdAt])

  const musicId = parseMusicId(music)
  const preset = musicId === "none" ? null : MUSIC[musicId]
  const isVoucher = endingType === "voucher"
  const signedAs = senderName?.trim() || fomoInitials || "Seseorang"

  // ── musik latar WebAudio — loop arpeggio dari gesture "Mulai"
  const musicCtxRef = useRef<AudioContext | null>(null)
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const noteIdxRef = useRef(0)

  const stopMusic = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current)
      loopRef.current = null
    }
  }, [])

  const startMusic = useCallback(() => {
    if (!preset) return
    stopMusic()
    try {
      const Ctx =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      if (!musicCtxRef.current) musicCtxRef.current = new Ctx()
      const ctx = musicCtxRef.current
      if (ctx.state === "suspended") void ctx.resume()

      loopRef.current = setInterval(() => {
        if (muted) return
        const freq = preset.notes[noteIdxRef.current % preset.notes.length]
        noteIdxRef.current += 1
        try {
          const now = ctx.currentTime
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = preset.wave
          osc.frequency.value = freq
          gain.gain.setValueAtTime(0.0001, now)
          gain.gain.exponentialRampToValueAtTime(preset.gain, now + 0.02)
          gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.beatMs / 1000 + 0.7)
          let tail: AudioNode = gain
          if (preset.lowpass) {
            const lp = ctx.createBiquadFilter()
            lp.type = "lowpass"
            lp.frequency.value = preset.lowpass
            gain.connect(lp)
            tail = lp
          }
          osc.connect(gain)
          tail.connect(ctx.destination)
          osc.start(now)
          osc.stop(now + preset.beatMs / 1000 + 0.8)
        } catch {
          /* satu note gagal → lanjut note berikutnya */
        }
      }, preset.beatMs)
    } catch {
      /* tanpa Web Audio → alur tetap jalan tanpa musik */
    }
  }, [preset, muted, stopMusic])

  useEffect(
    () => () => {
      stopMusic()
      if (musicCtxRef.current) {
        void musicCtxRef.current.close().catch(() => undefined)
        musicCtxRef.current = null
      }
    },
    [stopMusic]
  )

  /** Mulai perjalanan — gesture pertama: unlock audio hook + nyalakan musik. */
  const handleStart = useCallback(() => {
    setStarted(true)
    audio.unlock()
    buzz(20)
    startMusic()
  }, [audio, startMusic])

  const chime = useCallback(
    (i: number) => {
      audio.chime(i % 5)
      buzz(10)
    },
    [audio]
  )

  /** Buka halaman kejutan penutup. */
  const openEnding = useCallback(() => {
    setEndingOpen(true)
    audio.shimmer()
    buzz([20, 40, 30])
    // kasih waktu animasi kejutan tampil → baru dilemma parent menyusul
    setTimeout(notifyOpenComplete, reduceMotion ? 200 : 1400)
  }, [audio, notifyOpenComplete, reduceMotion])

  const copyVoucher = useCallback(async () => {
    const text = endingText ?? ""
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard diblokir — biarkan tombol dicoba lagi */
    }
  }, [endingText])

  const since = formatTanggal(createdAt)

  return (
    <section className="relative w-full">
      {/* ═══ BABAK 0 — SAMPUL (gate) ═══ */}
      <AnimatePresence>
        {!started && (
          <motion.div
            key="gate"
            exit={reduceMotion ? undefined : { opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-zinc-950 px-6 text-center"
          >
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="flex flex-col items-center"
            >
              <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/30 bg-rose-500/10 px-3.5 py-1.5 text-xs text-rose-200">
                📜 Kado untuk <b className="font-semibold">{targetName}</b>
              </span>
              <h1 className="mt-6 font-hand text-5xl leading-tight text-white">
                Kisah Kita
              </h1>
              {since && (
                <p className="mt-2 text-xs uppercase tracking-[0.28em] text-zinc-500">
                  sejak {since}
                </p>
              )}
              <p className="mt-6 max-w-xs text-sm leading-relaxed text-zinc-400">
                Seseorang merangkai perjalanan kalian — momen demi momen, satu per
                satu muncul saat kamu menggulirnya.
              </p>

              <button
                type="button"
                onClick={handleStart}
                className="mt-9 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-8 py-4 text-sm font-bold text-white shadow-[0_0_36px_-6px_rgba(244,63,94,0.7)] transition-shadow hover:shadow-[0_0_48px_-4px_rgba(244,63,94,0.85)]"
              >
                Mulai Perjalanan ✨
              </button>
              <p className="mt-4 text-xs text-zinc-600">
                {preset ? `🎧 pakai earphone biar makin terasa — musik: ${preset.label}` : "pelan-pelan aja gulirnya 🌙"}
              </p>

              <p className="mt-10 text-[11px] tracking-wide text-zinc-600">
                Dari: <span className="font-semibold text-zinc-500">{fomoInitials ?? "Seseorang"}</span>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ISI — baru dirender setelah mulai (hemat animasi awal) ═══ */}
      {started && (
        <>
          {/* tombol musik mengapung */}
          <button
            type="button"
            onClick={() => {
              setMuted((m) => !m)
              if (!muted) stopMusic()
              else startMusic()
            }}
            aria-label={muted ? "Nyalakan musik" : "Bisukan musik"}
            className="fixed right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/50 text-zinc-300 shadow-xl backdrop-blur transition-colors hover:bg-black/70"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* header perjalanan */}
          <header className="pt-4 text-center">
            <p className="font-hand text-3xl text-rose-200">Kisah Kita</p>
            <p className="mt-1 text-xs uppercase tracking-[0.3em] text-zinc-500">
              {cleanMoments.length} momen · gulir pelan-pelan ↓
            </p>
          </header>

          {/* ═══ BABAK 1 — PERJALANAN (garis waktu vertikal) ═══ */}
          <div className="relative mt-8">
            {/* garis waktu */}
            <span
              aria-hidden
              className="absolute bottom-4 left-[13px] top-2 w-px bg-gradient-to-b from-rose-400/60 via-white/15 to-transparent"
            />
            <ul className="space-y-7">
              {cleanMoments.map((m, i) => (
                <MomentItem
                  key={i}
                  moment={m}
                  index={i}
                  total={cleanMoments.length}
                  reduceMotion={!!reduceMotion}
                  onChime={chime}
                />
              ))}
            </ul>
          </div>

          {/* ═══ BABAK 2 — PENUTUP: pesan utama ═══ */}
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="mt-10 will-change-transform"
          >
            <div className="relative overflow-hidden rounded-3xl border border-amber-200/20 bg-gradient-to-br from-[#2a2118]/90 to-[#1a150e]/90 p-6 shadow-2xl shadow-black/50">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-amber-300/10 blur-3xl"
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-amber-200/70">
                dan cerita ini belum selesai…
              </p>
              <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-amber-50/95">
                {message}
              </p>
              <div className="mt-5 text-right">
                <AnimatePresence mode="wait" initial={false}>
                  {revealName ? (
                    <motion.span
                      key="real"
                      initial={reduceMotion ? false : { opacity: 0, y: 6, filter: "blur(5px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.7, ease: "easeOut" }}
                      className="font-hand text-xl text-rose-300"
                    >
                      — {revealName}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="masked"
                      exit={reduceMotion ? undefined : { opacity: 0, y: -6, filter: "blur(5px)" }}
                      transition={{ duration: 0.45 }}
                      className="font-hand text-xl text-amber-100/80"
                    >
                      — {signedAs}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* ═══ BABAK 3 — KEJUTAN PENUTUP ═══ */}
          <div className="mt-8 pb-6">
            <AnimatePresence mode="wait" initial={false}>
              {!endingOpen ? (
                <motion.div
                  key="ending-cta"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -14 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center"
                >
                  <button
                    type="button"
                    onClick={openEnding}
                    className="group flex items-center gap-2.5 rounded-2xl border border-amber-300/40 bg-amber-400/10 px-6 py-4 text-sm font-bold text-amber-200 shadow-[0_0_30px_-8px_rgba(251,191,36,0.6)] transition-all hover:bg-amber-400/20"
                  >
                    <Gift className="h-4.5 w-4.5 transition-transform group-hover:scale-110" strokeWidth={1.75} />
                    Ada satu hal lagi… 🎁
                  </button>
                  <p className="mt-3 text-xs text-zinc-600">ketuk buat membuka kejutannya</p>
                </motion.div>
              ) : (
                <motion.div
                  key="ending-card"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.92, y: 24 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 160, damping: 16 }}
                  className="will-change-transform"
                >
                  {isVoucher ? (
                    /* ── VOUCHER: tiket emas + tombol salin ── */
                    <div className="relative overflow-hidden rounded-3xl border border-amber-300/40 bg-gradient-to-br from-[#3a2c12] to-[#241a08] p-6 text-center shadow-[0_0_50px_-12px_rgba(251,191,36,0.5)]">
                      <div
                        aria-hidden
                        className="pointer-events-none absolute inset-0 opacity-30"
                        style={{
                          background:
                            "repeating-linear-gradient(115deg, transparent 0 14px, rgba(251,191,36,0.08) 14px 16px)",
                        }}
                      />
                      <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-amber-200/80">
                        kode spesial buatmu
                      </p>
                      <p className="mt-4 select-all break-all font-mono text-lg font-bold leading-snug text-amber-100">
                        {endingText}
                      </p>
                      <button
                        type="button"
                        onClick={copyVoucher}
                        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/15 px-5 py-2.5 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/25"
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Kode tersalin ✓
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Salin kode
                          </>
                        )}
                      </button>
                      <p className="mt-3 text-[11px] leading-relaxed text-amber-200/60">
                        tunjukkan / kirim kode ini ke pengirimnya buat diiiiiklaim 🎟️
                      </p>
                    </div>
                  ) : (
                    /* ── PESAN RAHASIA: lembar tersegel ── */
                    <div className="relative overflow-hidden rounded-3xl border border-rose-300/25 bg-gradient-to-br from-[#2d1a20] to-[#1a0f13] p-6 shadow-[0_0_50px_-12px_rgba(244,63,94,0.45)]">
                      <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-rose-200/80">
                        pesan rahasia
                      </p>
                      <p className="mt-4 whitespace-pre-wrap text-[15px] leading-relaxed text-rose-50/95">
                        {endingText}
                      </p>
                      <p className="mt-4 text-right font-hand text-lg text-rose-200/80">
                        — {signedAs}
                      </p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </section>
  )
}

/** Ekspor kecil buat halaman uji & demo — label preset musik. */
export const TIMELINE_MUSIC_LABEL: Record<MusicId, string> = {
  musicbox: MUSIC.musicbox.label,
  lullaby: MUSIC.lullaby.label,
  senja: MUSIC.senja.label,
  none: "Tanpa Musik",
}
export const TIMELINE_MUSIC_ICON = Music2
