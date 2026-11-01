"use client"

/**
 * CinematicUnboxing — pengalaman membuka kado dalam 4 fase (client component).
 *
 *   Fase 1 — The Gateway    : tantangan kunci buka sesuai kadoType
 *                             (fingerprint / tap / scratch / quiz / misteri;
 *                              bouquet → PremiumBouquet, buket tarik pita)
 *   Fase 2 — The Immersion  : surat meluncur naik, isi pesan efek typewriter,
 *                             identitas pengirim cuma inisial bertopeng
 *   Fase 3 — The Dilemma    : dua tombol jawaban → (simulasi) PATCH status
 *   Fase 4 — The Reveal     : diterima → confetti + reveal nama asli;
 *                             ditolak → surat kabur, "Rahasia tetap terjaga."
 *
 * Performa mobile: animasi utama hanya transform/opacity/filter, elemen yang
 * bergerak diberi will-change-transform, dan semua efek menghormati
 * prefers-reduced-motion.
 */

import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion"
import confetti from "canvas-confetti"
import PremiumBouquet from "./PremiumBouquet"
import {
  BrainCircuit,
  EyeOff,
  Fingerprint,
  Gift,
  Heart,
  Loader2,
  MousePointerClick,
  ScanLine,
  type LucideIcon,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe & util kecil
// ─────────────────────────────────────────────────────────────────────────────

/** Bentuk kado yang dilempar Server Component ke sini (tanpa field teknis). */
export interface KadoForUnboxing {
  id: string
  targetName: string
  message: string
  senderName: string | null
  fomoInitials: string | null
  kadoType: string
  kadoData: Record<string, string | number> | null
}

type Phase = 1 | 2 | 3 | 4
type Outcome = "accepted" | "rejected"

function dataNum(data: Record<string, string | number> | null, key: string, fallback: number): number {
  const v = data?.[key]
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback
}

function dataStr(data: Record<string, string | number> | null, key: string): string | null {
  const v = data?.[key]
  return typeof v === "string" && v.trim() ? v : null
}

/** Preset confetti senada palet Kangenin; hormati reduced-motion. */
function fireConfetti(reduceMotion: boolean) {
  const base = {
    disableForReducedMotion: reduceMotion,
    colors: ["#f43f5e", "#a855f7", "#fbbf24", "#34d399", "#ffffff"],
  }
  confetti({ ...base, particleCount: 90, spread: 75, origin: { y: 0.6 } })
  confetti({ ...base, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
  confetti({ ...base, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama — state machine 4 fase
// ─────────────────────────────────────────────────────────────────────────────

export default function CinematicUnboxing({ kado }: { kado: KadoForUnboxing }) {
  const [phase, setPhase] = useState<Phase>(1)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [submitting, setSubmitting] = useState<Outcome | null>(null)

  // Typewriter — huruf satu per satu via timeout iteratif (tanpa lib, tanpa lag)
  const [typedCount, setTypedCount] = useState(0)
  const message = kado.message
  const typing = phase === 2 && typedCount < message.length

  const reduceMotion = useReducedMotion()

  // Mesin ketik: satu setTimeout per huruf (effect chain), berhenti di akhir.
  useEffect(() => {
    if (phase !== 2) return
    if (reduceMotion) {
      setTypedCount(message.length)
      return
    }
    if (typedCount >= message.length) return
    const t = setTimeout(
      () => setTypedCount((c) => c + 1),
      message[typedCount] === "\n" ? 200 : 26
    )
    return () => clearTimeout(t)
  }, [phase, typedCount, message, reduceMotion])

  // Selesai mengetik → jeda sejenak → fase 3 (dilemma muncul)
  useEffect(() => {
    if (phase !== 2 || typedCount < message.length) return
    const t = setTimeout(() => setPhase(3), 700)
    return () => clearTimeout(t)
  }, [phase, typedCount, message.length])

  function skipTyping() {
    setTypedCount(message.length)
  }

  /**
   * Fase 3 — kirim keputusan.
   *
   * SIMULASI untuk sekarang (API PATCH /api/kado/[id]/status dibuat di fase
   * berikutnya): jeda 700 ms biar terasa "mengirim", lalu langsung fase 4.
   * Titik integrasi tinggal mengganti setTimeout dengan fetch PATCH yang
   * membawa { status: choice }.
   */
  async function handleChoice(choice: Outcome) {
    if (phase !== 3 || submitting) return
    setSubmitting(choice)

    await new Promise((r) => setTimeout(r, 700)) // ← ganti dengan PATCH nanti

    setOutcome(choice)
    setPhase(4)
    setSubmitting(null)

    if (choice === "accepted") {
      fireConfetti(reduceMotion ?? false)
      // getar halus — diabaikan browser yang tak mendukung
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate([30, 60, 30])
      }
    }
  }

  const rejected = phase === 4 && outcome === "rejected"
  const accepted = phase === 4 && outcome === "accepted"
  // kadoType bouquet: alur gateway+immersion digantikan PremiumBouquet (buket
  // tetap terpasang sampai reveal) — dilema tampil di kartu terpisah di bawahnya
  const isBouquet = kado.kadoType === "bouquet"

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        {/* Buket premium — terpasang sejak fase 1 sampai reveal; begitu kartu
            ucapan selesai turun (onOpenComplete) → langsung fase 3 (dilemma),
            karena isi pesan sudah tampil di kartu buket. */}
        {isBouquet && (
          <PremiumBouquet
            targetName={kado.targetName}
            message={kado.message}
            fomoInitials={kado.fomoInitials}
            revealName={accepted ? kado.senderName ?? "Seseorang" : null}
            onOpenComplete={() => setPhase(3)}
          />
        )}

        <AnimatePresence mode="wait">
          {!isBouquet && phase === 1 && (
            <motion.div
              key="gateway"
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="will-change-transform"
            >
              <GatewayHeader targetName={kado.targetName} kadoType={kado.kadoType} kadoData={kado.kadoData} />
              <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/40 backdrop-blur-md">
                <Challenge kado={kado} onSuccess={() => setPhase(2)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fase 3 untuk buket — dilemma tampil di kartu terpisah di bawah buket
            (isi pesan sudah ada di kartu ucapan buket, surat tak perlu lagi) */}
        {isBouquet && phase >= 3 && (
          <motion.div
            key="bouquet-dilemma"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-5 will-change-transform"
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
              {phase === 3 && (
                <p className="mb-4 text-center text-sm leading-relaxed text-zinc-300">
                  Bunganya udah mekar… sekarang giliran lo. 🌷
                </p>
              )}
              {accepted && (
                <p className="mb-3 text-center text-xs text-rose-200/80">
                  💜 Kado ini resmi jadi kenangan.
                </p>
              )}
              <DilemmaButtons submitting={submitting} onChoice={handleChoice} />
            </div>
          </motion.div>
        )}

        {!isBouquet && phase >= 2 && (
          <motion.div
            key="letter"
            initial={reduceMotion ? false : { opacity: 0, y: 50 }}
            animate={
              rejected && !reduceMotion
                ? { opacity: 0, y: 0, scale: 0.98, filter: "blur(10px) grayscale(1)" }
                : { opacity: 1, y: 0, scale: 1, filter: "blur(0px) grayscale(0)" }
            }
            transition={
              rejected
                ? { duration: 0.9, ease: "easeInOut" }
                : { duration: 0.55, ease: "easeOut" }
            }
            className="will-change-transform"
          >
            {/* Surat — glassmorphism */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-6 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-7">
              <p className="text-[10px] font-semibold tracking-widest text-zinc-500 uppercase">
                Kepada
              </p>
              <p className="mt-0.5 text-lg font-bold text-white">{kado.targetName}</p>

              <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

              {/* Isi pesan — typewriter */}
              <p className="font-hand min-h-[9rem] text-xl leading-relaxed whitespace-pre-wrap text-zinc-100">
                {message.slice(0, typedCount)}
                {typing && (
                  <span className="ml-1 inline-block h-[1.1em] w-[2px] translate-y-[0.15em] animate-pulse rounded bg-rose-300 align-middle" />
                )}
              </p>

              {/* Dari: inisial bertopeng → reveal nama asli saat diterima */}
              <div className="mt-5 flex items-center justify-end gap-2 text-sm">
                <span className="text-zinc-500">Dari:</span>
                <AnimatePresence mode="wait" initial={false}>
                  {accepted ? (
                    <motion.span
                      key="real-name"
                      initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
                      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="font-semibold text-rose-200 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                    >
                      {kado.senderName ?? "Seseorang"}
                    </motion.span>
                  ) : (
                    <motion.span
                      key="masked"
                      exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(6px)" }}
                      transition={{ duration: 0.5 }}
                      className="font-semibold text-rose-300/70 drop-shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                    >
                      {kado.fomoInitials ?? "Seseorang"}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {accepted && (
                <motion.p
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                  className="mt-4 text-center text-xs text-rose-200/80"
                >
                  💜 Kado ini resmi jadi kenangan.
                </motion.p>
              )}

              {/* Fase 3 — The Ultimate Dilemma */}
              <AnimatePresence>
                {phase === 3 && (
                  <motion.div
                    key="dilemma"
                    initial={reduceMotion ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mt-6 will-change-transform"
                  >
                    <DilemmaButtons submitting={submitting} onChoice={handleChoice} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Lewati efek ketik */}
            {typing && (
              <button
                onClick={skipTyping}
                className="mx-auto mt-4 block rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Lewati ⏭
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Fase 4 rejected — layar gelap, rahasia tetap terjaga */}
      <AnimatePresence>
        {rejected && (
          <motion.div
            key="secret"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reduceMotion ? 0 : 0.9, duration: 0.6 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/95 px-6 text-center backdrop-blur-sm"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800/60">
              <EyeOff className="h-6 w-6 text-zinc-400" strokeWidth={1.75} />
            </div>
            <p className="mt-5 text-lg font-semibold text-zinc-200">Rahasia tetap terjaga.</p>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
              Dia nggak akan pernah tahu. Suratnya jadi kenangan yang sunyi.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 3 — tombol dilemma (dipakai surat standar & kartu buket)
// ─────────────────────────────────────────────────────────────────────────────

function DilemmaButtons({
  submitting,
  onChoice,
}: {
  submitting: Outcome | null
  onChoice: (choice: Outcome) => void
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <button
        onClick={() => onChoice("accepted")}
        disabled={submitting !== null}
        className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3.5 text-sm font-bold text-white shadow-[0_0_28px_-6px_rgba(244,63,94,0.6)] transition-shadow hover:shadow-[0_0_36px_-4px_rgba(244,63,94,0.75)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting === "accepted" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim…
          </>
        ) : (
          "Aku juga suka ✨"
        )}
      </button>
      <button
        onClick={() => onChoice("rejected")}
        disabled={submitting !== null}
        className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting === "rejected" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Mengirim…
          </>
        ) : (
          "Maaf, kita temenan aja"
        )}
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Fase 1 — header + pemilih tantangan
// ─────────────────────────────────────────────────────────────────────────────

const GATEWAY_HINT: Record<string, { icon: LucideIcon; hint: string }> = {
  fingerprint: { icon: Fingerprint, hint: "Tahan ikonnya sampai ring di sekelilingnya penuh." },
  tap: { icon: MousePointerClick, hint: "Ketuk tombolnya berkali-kali sampai hitungannya habis." },
  scratch: { icon: ScanLine, hint: "Tarik kartunya ke atas, pelan-pelan." },
  quiz: { icon: BrainCircuit, hint: "Hanya dia yang tahu jawabannya." },
}

function GatewayHeader({
  targetName,
  kadoType,
  kadoData,
}: {
  targetName: string
  kadoType: string
  kadoData: Record<string, string | number> | null
}) {
  const meta = GATEWAY_HINT[kadoType]
  const hint = meta?.hint ?? "Kado ini terkunci — buka untuk melihat isinya."

  return (
    <header className="text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-3.5 py-1.5 text-xs text-rose-200">
        <Gift className="h-3.5 w-3.5" />
        Kado untuk <b className="font-semibold">{targetName}</b>
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">Buka dengan kunci rahasia 🔐</h1>
      <p className="mt-2 text-sm text-zinc-400">{hint}</p>
    </header>
  )
}

/** Pilih tantangan berdasar kadoType — tipe tak dikenal → tombol misteri. */
function Challenge({ kado, onSuccess }: { kado: KadoForUnboxing; onSuccess: () => void }) {
  switch (kado.kadoType) {
    case "fingerprint":
      return (
        <FingerprintChallenge
          holdMs={dataNum(kado.kadoData, "holdMs", 3000)}
          onSuccess={onSuccess}
        />
      )
    case "tap":
      return <TapChallenge taps={dataNum(kado.kadoData, "taps", 20)} onSuccess={onSuccess} />
    case "scratch":
      return (
        <ScratchChallenge
          coverText={dataStr(kado.kadoData, "coverText") ?? "Tarik ke atas untuk membuka ✨"}
          onSuccess={onSuccess}
        />
      )
    case "quiz": {
      const question = dataStr(kado.kadoData, "question")
      const answer = dataStr(kado.kadoData, "answer")
      if (!question || !answer) return <MysteryChallenge onSuccess={onSuccess} />
      return <QuizChallenge question={question} answer={answer} onSuccess={onSuccess} />
    }
    default:
      return <MysteryChallenge onSuccess={onSuccess} />
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tantangan: fingerprint (tahan 3 detik)
// ─────────────────────────────────────────────────────────────────────────────

const RING_R = 44
const RING_C = 2 * Math.PI * RING_R

function FingerprintChallenge({ holdMs, onSuccess }: { holdMs: number; onSuccess: () => void }) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const firedRef = useRef(false)
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function beginHold() {
    if (firedRef.current || progressTimer.current || successTimer.current) return
    setHolding(true)
    const started = Date.now()
    progressTimer.current = setInterval(() => {
      setProgress(Math.min(1, (Date.now() - started) / holdMs))
    }, 40)
    successTimer.current = setTimeout(() => {
      firedRef.current = true
      cleanup()
      setHolding(false)
      setProgress(1)
      onSuccess()
    }, holdMs)
  }

  function endHold() {
    if (firedRef.current) return
    cleanup()
    setHolding(false)
    setProgress(0)
  }

  function cleanup() {
    if (progressTimer.current) clearInterval(progressTimer.current)
    if (successTimer.current) clearTimeout(successTimer.current)
    progressTimer.current = null
    successTimer.current = null
  }

  return (
    <div className="flex flex-col items-center">
      <div
        role="button"
        tabIndex={0}
        aria-label="Tahan untuk membuka kado"
        onPointerDown={beginHold}
        onPointerUp={endHold}
        onPointerLeave={endHold}
        onPointerCancel={endHold}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") beginHold()
        }}
        onKeyUp={endHold}
        // cegah scroll/context-menu saat menahan di mobile
        className="relative h-40 w-40 touch-none select-none"
        style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
      >
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
          <circle cx="50" cy="50" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
          <circle
            cx="50"
            cy="50"
            r={RING_R}
            fill="none"
            stroke="url(#fpGrad)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - progress)}
          />
          <defs>
            <linearGradient id="fpGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#a855f7" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Fingerprint
            className={`h-14 w-14 transition-colors duration-300 ${
              holding ? "text-rose-300 drop-shadow-[0_0_14px_rgba(244,63,94,0.6)]" : "text-zinc-500"
            }`}
            strokeWidth={1.5}
          />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-400">
        {holding ? "Tahan terus…" : `Tahan ${Math.max(1, Math.round(holdMs / 1000))} detik`}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tantangan: tap X kali
// ─────────────────────────────────────────────────────────────────────────────

function TapChallenge({ taps, onSuccess }: { taps: number; onSuccess: () => void }) {
  const [count, setCount] = useState(0)
  const reduceMotion = useReducedMotion()
  const done = count >= taps

  function tap() {
    if (done) return
    const n = count + 1
    setCount(n)
    if (n >= taps) onSuccess()
  }

  const remaining = Math.max(0, taps - count)

  return (
    <div className="flex flex-col items-center">
      <motion.button
        onClick={tap}
        whileTap={reduceMotion ? undefined : { scale: 0.92 }}
        className="flex h-40 w-40 touch-none items-center justify-center rounded-full border border-rose-400/40 bg-gradient-to-br from-rose-500/25 to-purple-500/25 text-rose-100 shadow-[0_0_36px_-10px_rgba(244,63,94,0.7)] will-change-transform"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={count}
            initial={{ scale: 1.5, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.15 }}
            className="text-3xl font-black tabular-nums"
          >
            {done ? "✓" : remaining}
          </motion.span>
        </AnimatePresence>
      </motion.button>

      {/* progress linear */}
      <div className="mt-5 h-1.5 w-56 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-500 to-purple-500 transition-[width] duration-100"
          style={{ width: `${Math.min(100, (count / taps) * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-zinc-400">
        {done ? "Terbuka!" : `Ketuk ${remaining} kali lagi`}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tantangan: scratch — simulasi swipe/drag ke atas (Framer Motion drag="y")
// ─────────────────────────────────────────────────────────────────────────────

function ScratchChallenge({ coverText, onSuccess }: { coverText: string; onSuccess: () => void }) {
  const [reveal, setReveal] = useState(0) // 0..1 — seberapa banyak kartu terangkat
  const reduceMotion = useReducedMotion()

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-52 w-full max-w-xs overflow-hidden rounded-2xl border border-white/10">
        {/* Lapisan bawah — kejutan di balik kartu */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-rose-500/25 via-purple-500/20 to-transparent">
          <Heart className="h-8 w-8 text-rose-300" strokeWidth={1.5} />
          <p className="mt-3 px-6 text-center font-hand text-lg text-rose-100">
            Ada pesan yang nunggu kamu di balik kartu ini…
          </p>
        </div>

        {/* Lapisan atas — cover yang di-drag ke atas */}
        <motion.div
          drag="y"
          dragConstraints={{ top: -200, bottom: 0 }}
          dragElastic={{ top: 0.15, bottom: 0 }}
          dragSnapToOrigin
          onDrag={(_, info) => {
            const p = Math.min(1, Math.max(0, -info.offset.y / 180))
            setReveal(p)
          }}
          onDragEnd={(_, info) => {
            setReveal(0)
            if (info.offset.y < -150) onSuccess()
          }}
          style={{ opacity: 1 - reveal * 0.85 }}
          className="absolute inset-0 z-10 flex cursor-grab touch-none flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 active:cursor-grabbing will-change-transform"
        >
          <ScanLine className="h-8 w-8 text-zinc-500" strokeWidth={1.5} />
          <p className="mt-3 px-6 text-center text-sm text-zinc-400">{coverText}</p>
          <p className="mt-4 text-xs text-zinc-600">⬆ tarik ke atas</p>
        </motion.div>
      </div>

      <p className="mt-4 text-sm text-zinc-400">
        {reduceMotion ? "Buka kartunya." : "Gosok pelan-pelan…"}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tantangan: kuis (case-insensitive)
// ─────────────────────────────────────────────────────────────────────────────

function QuizChallenge({
  question,
  answer,
  onSuccess,
}: {
  question: string
  answer: string
  onSuccess: () => void
}) {
  const [value, setValue] = useState("")
  const [wrong, setWrong] = useState(false)
  // shake imperatif — TANPA remount form, jadi keyboard mobile tidak tertutup
  const shake = useAnimationControls()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (value.trim().toLowerCase() === answer.trim().toLowerCase()) {
      onSuccess()
      return
    }
    setWrong(true)
    await shake.start({ x: [0, -10, 10, -6, 6, 0], transition: { duration: 0.35 } })
  }

  return (
    <motion.form onSubmit={submit} animate={shake} className="flex flex-col gap-4">
      <p className="text-center font-hand text-xl leading-snug text-zinc-100">“{question}”</p>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Jawabanmu…"
        maxLength={60}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-colors duration-200 focus:border-rose-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-rose-500/20"
      />
      {wrong && (
        <p role="alert" className="text-center text-xs text-rose-300">
          Belum tepat 🙈 coba lagi…
        </p>
      )}
      <button
        type="submit"
        className="rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)]"
      >
        Kunci Jawabannya
      </button>
    </motion.form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tantangan: tipe misteri (kadoType baru / data tak lengkap)
// ─────────────────────────────────────────────────────────────────────────────

function MysteryChallenge({ onSuccess }: { onSuccess: () => void }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
        <Gift className="h-9 w-9 text-zinc-400" strokeWidth={1.5} />
      </div>
      <p className="mt-4 text-sm text-zinc-400">Kado ini terkunci dengan kunci misterius…</p>
      <button
        onClick={onSuccess}
        className="mt-5 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)]"
      >
        Buka Kadonya
      </button>
    </div>
  )
}
