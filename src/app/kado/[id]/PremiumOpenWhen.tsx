"use client"

/**
 * PremiumOpenWhen — kado "Open When": amplop vintage bersigel lilin.
 *
 * State machine 4 fase:
 *   locked    — amplop tertutup, segel lilin utuh; judul "Buka saat kamu
 *               kangen" di atasnya. Ketuk amplop → fase 2.
 *   prompting — JANGAN langsung dibuka: modal glassmorphism slide-up dari
 *               bawah berisi prompt psikologis + input teks. Jawaban sengaja
 *               TIDAK disimpan (momen ritus pribadi — privasi total).
 *   melting   — modal hilang; segel lilin meleleh (scale 0 + opacity 0) dengan
 *               kilatan bara dan partikel asap ringan.
 *   opened    — tutup amplop terlipat ke atas (rotateX), lembaran surat
 *               perkamenen meluncur keluar dari dalam amplop, berisi pesan
 *               pengirim yang masih bertopeng. onOpenComplete() dipanggil
 *               setelah surat selesai masuk — parent lanjut ke fase dilemma.
 *
 * Identitas: surat menampilkan fomoInitials ("R***I") sampai parent mengirim
 * revealName (jawaban diterima) — lalu nama asli crossfade masuk, selaras
 * dengan mekanik reveal di CinematicUnboxing & PremiumBouquet.
 *
 * Performa mobile 60FPS:
 * - Animasi hanya transform/opacity/filter; elemen utama diberi
 *   will-change-transform (amplop, tutup, segel, surat).
 * - Partikel asap/bara cuma opacity+transform, sekali jalan (tanpa loop).
 * - Semua efek menghormati prefers-reduced-motion (instant / tanpa drift).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumOpenWhenProps {
  /** Nama penerima — tampil di badge header & kepala surat. */
  targetName: string
  /** Pesan pengirim — tampil di lembar surat setelah segel pecah. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** Judul di atas amplop — override via kadoData.title. */
  title?: string
  /** Prompt psikologis di modal — override via kadoData.prompt. */
  prompt?: string
  /** Dipanggil SEKALI setelah surat selesai meluncur keluar. */
  onOpenComplete: () => void
}

type SealPhase = "locked" | "prompting" | "melting" | "opened"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = "Buka saat kamu kangen 💌"
const DEFAULT_PROMPT =
  "Sebutin 1 hal yang paling kamu kangenin dari pengirim sebelum segel ini terbuka…"

/** Geometri panggung (px) — fix biar lapisan amplop presisi. */
const STAGE_W = 280
const ENVELOPE_H = 190
const FLAP_H = 105
const HEADROOM = 190 // ruang di atas amplop: jalur surat meluncur keluar
const STAGE_H = HEADROOM + ENVELOPE_H + 20

const LETTER_RISE_DELAY = 1.15 // tunggu tutup selesai terlipat dulu

/** Partikel asap saat segel meleleh — sekali jalan, murah (opacity+transform). */
const SMOKE = [
  { x: -10, y: -46, s: 1.5, d: 0.1 },
  { x: 8, y: -56, s: 1.9, d: 0.22 },
  { x: -2, y: -66, s: 2.3, d: 0.34 },
  { x: 14, y: -44, s: 1.4, d: 0.44 },
  { x: -16, y: -58, s: 1.8, d: 0.52 },
]
/** Bara kecil — percikan hangat sesaat sebelum padam. */
const EMBERS = [
  { x: -6, y: -30, d: 0.14 },
  { x: 6, y: -38, d: 0.3 },
  { x: 0, y: -24, d: 0.46 },
]

// ─────────────────────────────────────────────────────────────────────────────
// Sub-komponen kecil
// ─────────────────────────────────────────────────────────────────────────────

/** Segel lilin merah-emas dengan inisial penerima di tengahnya. */
function WaxSeal({ initial }: { initial: string }) {
  return (
    <motion.span
      key="seal"
      // Fase 3 — The Melting Seal: scale 0 + opacity 0 + sedikit berputar.
      // exit dibawa oleh elemen terakhir yang ter-render (AnimatePresence
      // membekukan props saat unmount) — jadi cukup hardcode di sini.
      exit={{ scale: 0, opacity: 0, rotate: 14, transition: { duration: 0.75, ease: "easeIn" } }}
      className="absolute z-40 will-change-transform"
      // dekorasi murni — TIDAK boleh menutupi tombol ketuk amplop di bawahnya
      style={{ left: STAGE_W / 2, top: HEADROOM + FLAP_H, marginLeft: -30, marginTop: -30, pointerEvents: "none" }}
    >
      {/* halo bara — pulse pelan selama segel utuh */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-full bg-rose-600/30 motion-safe:animate-pulse blur-lg"
      />
      {/* tetesan lilin tak rata biar terlihat seperti lilin sungguhan */}
      <span aria-hidden className="absolute -left-2 top-4 h-4 w-4 rounded-full bg-rose-800/90 blur-[1px]" />
      <span aria-hidden className="absolute -right-1.5 top-7 h-3 w-3 rounded-full bg-rose-900/90 blur-[1px]" />
      <span
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, #e0564f, #a41f1f 58%, #6f1212 100%)",
          boxShadow:
            "0 0 24px rgba(220,80,80,0.45), inset 0 2px 6px rgba(255,255,255,0.25), inset 0 -4px 8px rgba(0,0,0,0.45)",
        }}
      />
      {/* cincin emas + inisial tercetak (emboss) */}
      <span
        aria-hidden
        className="absolute inset-[5px] rounded-full border-2 border-amber-300/50"
        style={{ boxShadow: "inset 0 1px 4px rgba(0,0,0,0.4)" }}
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-xl font-bold text-amber-100/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
          {initial}
        </span>
      </span>
    </motion.span>
  )
}

/** Partikel asap + bara sekali pakai saat segel meleleh. */
function MeltParticles() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-30 block">
      {SMOKE.map((p, i) => (
        <motion.span
          key={`smoke-${i}`}
          className="absolute rounded-full bg-zinc-400/40 blur-[4px]"
          style={{ left: STAGE_W / 2 + p.x, top: HEADROOM + FLAP_H, width: 10 * p.s, height: 10 * p.s }}
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={{ opacity: [0, 0.45, 0], y: p.y, scale: [0.6, 1.1, 1.7] }}
          transition={{ delay: p.d, duration: 1.25, times: [0, 0.35, 1], ease: "easeOut" }}
        />
      ))}
      {EMBERS.map((p, i) => (
        <motion.span
          key={`ember-${i}`}
          className="absolute h-1.5 w-1.5 rounded-full bg-amber-400/90 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
          style={{ left: STAGE_W / 2 + p.x, top: HEADROOM + FLAP_H }}
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: [0, 1, 0], y: p.y, scale: [1, 0.9, 0.4] }}
          transition={{ delay: p.d, duration: 0.9, times: [0, 0.3, 1], ease: "easeOut" }}
        />
      ))}
    </span>
  )
}

/** Modal glassmorphism slide-up — prompt psikologis sebelum segel pecah. */
function PromptModal({
  prompt,
  value,
  onChange,
  onSubmit,
  onCancel,
  reduceMotion,
}: {
  prompt: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onCancel: () => void
  reduceMotion: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  // fokus setelah animasi slide-up selesai — tanpa lompatan scroll
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(t)
  }, [])

  const ready = value.trim().length > 0

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-zinc-950/70 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      onClick={onCancel} // ketuk luar modal = batal
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Prompt sebelum membuka segel"
        onClick={(e) => e.stopPropagation()}
        initial={reduceMotion ? false : { y: 90, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={reduceMotion ? undefined : { y: 70, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className="mx-auto w-full max-w-md px-4 pb-8 will-change-transform"
      >
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-6 shadow-2xl shadow-black/50 backdrop-blur-md">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/70">
            Segel lilin tersegel 🔒
          </p>
          <p className="font-hand mt-3 text-center text-lg leading-relaxed text-zinc-100">
            {prompt}
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-zinc-500">
            Jawabannya cuma buat kamu sendiri — nggak dikirim ke siapa pun.
            Sudah cukup jujur? Segelnya langsung dilelehkan.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (ready) onSubmit()
            }}
            className="mt-5"
          >
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              maxLength={140}
              enterKeyHint="send"
              aria-label="Jawaban prompt"
              placeholder="Tulis di sini… sejujur-jujurnya ✍️"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 outline-none transition-colors duration-200 focus:border-amber-300/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-amber-400/20"
            />
            <div className="mt-4 flex flex-col gap-2.5">
              <button
                type="submit"
                disabled={!ready}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-600 to-amber-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_28px_-6px_rgba(244,63,94,0.55)] transition-shadow hover:shadow-[0_0_36px_-4px_rgba(251,191,36,0.6)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Pecah Segelnya 🔥
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
              >
                Nanti aja 🕯
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumOpenWhen({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  title = DEFAULT_TITLE,
  prompt = DEFAULT_PROMPT,
  onOpenComplete,
}: PremiumOpenWhenProps) {
  const [phase, setPhase] = useState<SealPhase>("locked")
  const [answer, setAnswer] = useState("")
  // tutup amplop setelah terlipat pindah ke lapisan paling belakang, supaya
  // surat yang meluncur keluar tampak di depannya
  const [flapBehind, setFlapBehind] = useState(false)

  const reduceMotion = useReducedMotion()

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // reduced motion: tak ada animasi yang "selesai" → fallback timer
  useEffect(() => {
    if (phase !== "opened" || !reduceMotion) return
    const t = setTimeout(notifyOpenComplete, 400)
    return () => clearTimeout(t)
  }, [phase, reduceMotion, notifyOpenComplete])

  // melting → opened: tunggu segel benar-benar lenyap + asap menyebar
  useEffect(() => {
    if (phase !== "melting") return
    const t = setTimeout(() => setPhase("opened"), reduceMotion ? 350 : 1250)
    return () => clearTimeout(t)
  }, [phase, reduceMotion])

  // jaring pengaman z-index tutup amplop (selain onAnimationComplete flap)
  useEffect(() => {
    if (phase !== "opened") return
    const t = setTimeout(() => setFlapBehind(true), reduceMotion ? 50 : 1100)
    return () => clearTimeout(t)
  }, [phase, reduceMotion])

  const sealInitial = (targetName.trim()[0] ?? "K").toUpperCase()

  return (
    <section className="flex w-full flex-col items-center py-6 text-zinc-100">
      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-3.5 py-1.5 text-xs text-rose-200">
          ✉️ Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">{title}</h1>
      </header>

      {/* Panggung: kepala ruang untuk surat + amplop di bawah */}
      <div className="relative mt-6" style={{ width: STAGE_W, height: STAGE_H }}>
        {/* glow hangat saat segel pecah — sekali jalan (opacity saja) */}
        <AnimatePresence>
          {(phase === "melting" || phase === "opened") && (
            <motion.span
              key="flash"
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[58%] h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgba(244,63,94,0.22), rgba(251,191,36,0.10), transparent)",
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === "melting" ? [0, 0.9, 0.5] : 0.45 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0.2 : 1.4 }}
            />
          )}
        </AnimatePresence>

        {/*
          Amplop — dibungkus motion agar bisa "berdenyut" mengundang saat
          terkunci. position tanpa transform (margin) supaya bob tidak bentrok
          dengan lapisan dalamnya.
        */}
        <motion.div
          className="absolute inset-x-0 bottom-5"
          style={{ height: ENVELOPE_H }}
          animate={
            phase === "locked" && !reduceMotion ? { y: [0, -5, 0] } : { y: 0 }
          }
          transition={phase === "locked" && !reduceMotion ? { duration: 3.4, repeat: Infinity, ease: "easeInOut" } : undefined}
        >
          <motion.button
            type="button"
            aria-label="Buka amplop — ketuk untuk memulai"
            disabled={phase !== "locked"}
            onClick={() => phase === "locked" && setPhase("prompting")}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && phase === "locked") {
                e.preventDefault()
                setPhase("prompting")
              }
            }}
            className="absolute inset-0 z-10 cursor-pointer disabled:cursor-default"
          >
            {/* panel belakang amplop — kertas vintage gelap */}
            <span
              aria-hidden
              className="absolute inset-0 z-0 rounded-md border border-amber-100/10 shadow-2xl shadow-black/60"
              style={{
                background:
                  "linear-gradient(165deg, rgba(58,45,40,0.85), rgba(30,24,21,0.95) 55%, rgba(22,17,15,0.98))",
              }}
            />
          </motion.button>

          {/* SURAT — tidak lagi dirender di dalam amplop. Dulu disimpen di
              balik saku depan dengan translateY(216px) — tapi tanpa clipping,
              jadi justru MENYEMBUL DI BAWAH amplop sebelum dibuka (pesan
              rahasia kebaca & menutupi instruksi). Sekarang surat baru muncul
              SETELAH segel pecah, sebagai kartu di bawah panggung — lihat
              blok "SURAT TERBUKA" di luar container amplop ini. */}

          {/* SAKU DEPAN — lipatan V klasik.
              pointer-events-none WAJIB: tanpa itu lapisan ini menutupi tombol
              ketuk amplop → amplop mustahil dibuka (bug "gatau gimana bukanya"). */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20"
            style={{
              clipPath: "polygon(0% 0%, 50% 42%, 100% 0%, 100% 100%, 0% 100%)",
              background:
                "linear-gradient(170deg, rgba(70,55,48,0.9), rgba(40,32,28,0.96) 45%, rgba(28,22,19,0.98))",
            }}
          >
            {/* garis lipatan saku */}
            <span className="absolute left-0 top-[42%] h-px w-1/2 origin-top-left rotate-[33deg] bg-gradient-to-r from-amber-100/15 to-transparent" />
            <span className="absolute right-0 top-[42%] h-px w-1/2 origin-top-right -rotate-[33deg] bg-gradient-to-l from-amber-100/15 to-transparent" />
            {/* tekstur kertas halus */}
            <span
              className="absolute inset-0 opacity-60"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.018) 0 2px, transparent 2px 7px)",
              }}
            />
            {/* bayangan tepi bawah */}
            <span className="absolute bottom-0 left-1/2 h-14 w-4/5 -translate-x-1/2 rounded-full bg-black/40 blur-2xl" />
          </span>

          {/* TUTUP AMPLOP — terlipat ke atas (rotateX) saat fase opened.
              pointer-events-none: lapisan dekoratif, klik tetap ke tombol. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-30 will-change-transform"
            style={{
              height: FLAP_H,
              transformOrigin: "top center",
              transformStyle: "preserve-3d",
              zIndex: flapBehind ? 0 : 30,
            }}
            initial={false}
            animate={{ rotateX: phase === "opened" ? -180 : 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { delay: 0.15, duration: 0.9, ease: "easeInOut" }
            }
            onAnimationComplete={() => {
              if (phase === "opened") setFlapBehind(true)
            }}
          >
            <span
              className="absolute inset-0"
              style={{
                clipPath: "polygon(0% 0%, 100% 0%, 50% 100%)",
                background:
                  "linear-gradient(185deg, rgba(74,58,50,0.95), rgba(42,33,29,0.98) 70%, rgba(34,26,23,0.98))",
                boxShadow: "inset 0 -6px 12px rgba(0,0,0,0.35)",
              }}
            />
            {/* tepi bawah tutup */}
            <span className="absolute bottom-0 left-1/2 h-px w-2/3 -translate-x-1/2 bg-amber-100/10" />
          </motion.span>

          {/* SEGEL LILIN — pecah (meleleh) saat fase melting */}
          <AnimatePresence>
            {(phase === "locked" || phase === "prompting") && <WaxSeal initial={sealInitial} />}
          </AnimatePresence>

          {/* asap & bara saat segel meleleh */}
          {(phase === "melting" || phase === "opened") && !reduceMotion && <MeltParticles />}
        </motion.div>
      </div>

      {/* SURAT TERBUKA — lembaran perkamen meluncur naik dari amplop setelah
          segel pecah. Dirender dalam alur dokumen (bukan lapisan amplop):
          selalu terbaca penuh, bisa digulir, tidak tertutup lapisan mana pun. */}
      <AnimatePresence>
        {phase === "opened" && (
          <motion.div
            key="letter"
            initial={reduceMotion ? false : { opacity: 0, y: 44 }}
            animate={{ opacity: 1, y: 0 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : { delay: LETTER_RISE_DELAY, duration: 0.7, ease: [0.22, 1, 0.36, 1] }
            }
            onAnimationComplete={() => notifyOpenComplete()}
            className="mt-4 w-full will-change-transform"
          >
            <div
              className="max-h-[340px] overflow-y-auto overscroll-contain rounded-md border border-amber-900/15 p-5 shadow-2xl shadow-black/50"
              style={{
                background: "linear-gradient(175deg, #f3e9d2, #e9dbba 70%, #e2d2ac)",
              }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#8a7a5e]">
                Untuk {targetName}
              </p>
              <p className="font-hand mt-3 whitespace-pre-wrap text-lg leading-relaxed text-[#3f3428]">
                {message}
              </p>

              <div className="mt-4 h-px bg-[#3f3428]/15" />

              <div className="mt-3 flex items-center justify-end gap-2 text-sm">
                <span className="text-[#8a7a5e]">Dari:</span>
                <AnimatePresence mode="wait" initial={false}>
                  {revealName ? (
                    <motion.span
                      key="real"
                      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="font-semibold text-rose-700 drop-shadow-[0_0_10px_rgba(190,24,93,0.35)]"
                    >
                      {revealName}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="masked"
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(6px)" }}
                      transition={{ duration: 0.5 }}
                      className="font-semibold text-[#a3452f]/90"
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

      {/* petunjuk cara buka — jelas & bertahap, menghilang saat segel diputus */}
      <AnimatePresence>
        {phase === "locked" && (
          <motion.div
            key="hint"
            exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.3 }}
            className="mt-3 flex flex-col items-center gap-1.5 text-center"
          >
            <p className="motion-safe:animate-pulse rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-1.5 text-sm font-semibold text-amber-100">
              👆 Ketuk amplopnya buat mulai
            </p>
            <p className="text-[11px] leading-relaxed text-zinc-500">
              Cara bukanya: ketuk amplop → jawab pertanyaannya → segel lilinnya
              meleleh, suratnya keluar ✉️
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fase 2 — The Prompt (modal slide-up dari bawah) */}
      <AnimatePresence>
        {phase === "prompting" && (
          <PromptModal
            prompt={prompt}
            value={answer}
            onChange={setAnswer}
            onSubmit={() => setPhase("melting")}
            onCancel={() => setPhase("locked")}
            reduceMotion={!!reduceMotion}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
