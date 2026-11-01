"use client"

/**
 * CinematicUnboxing — pengalaman membuka kado (client component).
 *
 * ALUR PREMIUM SAJA (alur lama gateway/sidik-jari/kartu-gosok/kuis/typewriter
 * sudah DIHAPUS — hard refactor). Satu if-chain memilih pengalaman premium
 * sesuai kadoType, lalu logika Dilemma (Fase 3) menyusul di bawahnya:
 *
 *   1. The Experience — komponen premium masing-masing tipe:
 *        bouquet  → PremiumBouquet      (buket tarik pita yang mekar)
 *        openwhen → PremiumOpenWhen     (amplop segel lilin)
 *        photobox → PremiumPhotobox     (polaroid dicuci goyangan/usap)
 *        coupon   → PremiumLoveCoupon   (tiket emas disobek)
 *        candle   → PremiumCandleBlow   (lilin ditiup lewat mic)
 *        confess  → PremiumConfess      (Heartstring Edition — segel, 3 detak,
 *                                        retak, surat baris-per-baris + audio)
 *        playlist → PremiumPlaylist     (turntable retro — kado lama)
 *      Tipe lama/tak dikenal (fingerprint/tap/scratch/quiz, dst.) jatuh ke
 *      PremiumConfess — tidak ada jalur mati, tidak ada render versi lama.
 *      Setiap komponen memanggil onOpenComplete() saat interaksinya selesai
 *      → fase 3.
 *   2. The Dilemma  (Fase 3) — dua tombol jawaban → PATCH /api/kado/[id]/status
 *      (transisi sekali jalan — gagal = tak lanjut fase 4).
 *   3. The Reveal   (Fase 4) — diterima → confetti + reveal nama asli di
 *      komponen premium (revealName); ditolak → overlay "Rahasia tetap
 *      terjaga."
 *
 * Performa mobile: animasi utama hanya transform/opacity/filter, elemen yang
 * bergerak diberi will-change-transform, dan semua efek menghormati
 * prefers-reduced-motion.
 */

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import confetti from "canvas-confetti"
import PremiumBouquet from "./PremiumBouquet"
import PremiumOpenWhen from "./PremiumOpenWhen"
import PremiumPhotobox from "./PremiumPhotobox"
import PremiumLoveCoupon from "./PremiumLoveCoupon"
import PremiumCandleBlow from "./PremiumCandleBlow"
import PremiumConfess from "./PremiumConfess"
import PremiumPlaylist from "./PremiumPlaylist"
import { EyeOff, Loader2 } from "lucide-react"

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
  /** Dibuat kapan (ISO) — dipakai Confess untuk "tersegel <tanggal>". */
  createdAt?: string | null
}

type Phase = 1 | 3 | 4
type Outcome = "accepted" | "rejected"

function dataStr(data: Record<string, string | number> | null, key: string): string | null {
  const v = data?.[key]
  return typeof v === "string" && v.trim() ? v : null
}

/** Preset confetti rose-gold senada momen kenangan; hormati reduced-motion. */
function fireConfetti(reduceMotion: boolean) {
  const base = {
    disableForReducedMotion: reduceMotion,
    colors: ["#f43f5e", "#fb7185", "#fbbf24", "#fde68a", "#ffffff"],
  }
  confetti({ ...base, particleCount: 90, spread: 75, origin: { y: 0.6 } })
  confetti({ ...base, particleCount: 45, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
  confetti({ ...base, particleCount: 45, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function CinematicUnboxing({ kado }: { kado: KadoForUnboxing }) {
  // Fase: 1 = pengalaman premium berjalan, 3 = dilemma, 4 = reveal.
  const [phase, setPhase] = useState<Phase>(1)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [submitting, setSubmitting] = useState<Outcome | null>(null)
  const [submitFailed, setSubmitFailed] = useState(false)

  const reduceMotion = useReducedMotion()

  /**
   * Fase 3 — kirim keputusan ke PATCH /api/kado/[id]/status.
   *
   * Server mengunci transisi (UPDATE ... WHERE status = 'pending'): sekali
   * diterima, kado tak bisa diubah request susulan — rejected menghanguskan
   * kado selamanya dan pengirim tetap anonim.
   *
   * `submitting` menjaga UI dari klik ganda (tombol disabled + guard di awal),
   * dan fase 4 (Reveal) hanya dimasuki kalau API sukses. Kalau gagal, catat
   * submitFailed → pesan error tampil di kartu dilemma & tombol tetap aktif
   * supaya user bisa mencoba lagi.
   */
  async function handleChoice(choice: Outcome) {
    if (phase !== 3 || submitting) return
    setSubmitting(choice)
    setSubmitFailed(false)

    try {
      const res = await fetch(`/api/kado/${kado.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: choice }),
      })
      if (!res.ok) throw new Error(`PATCH status gagal: HTTP ${res.status}`)

      const json = (await res.json()) as { success?: boolean; status?: string }
      if (!json.success || json.status !== choice) {
        throw new Error("Respons API tidak sesuai")
      }

      setOutcome(choice)
      setPhase(4)

      if (choice === "accepted") {
        fireConfetti(reduceMotion ?? false)
        // getar halus — diabaikan browser yang tak mendukung
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          navigator.vibrate([30, 60, 30])
        }
      }
    } catch {
      // gagal → TIDAK lanjut fase 4; keputusan tidak tersimpan, biarkan tombol
      // aktif agar user bisa mencoba lagi
      setSubmitFailed(true)
    } finally {
      setSubmitting(null)
    }
  }

  const rejected = phase === 4 && outcome === "rejected"
  const accepted = phase === 4 && outcome === "accepted"

  // ── PREMIUM ONLY — HANYA BLOK INI (render kado versi lama sudah dihapus) ──
  // If-chain tunggal pemilih pengalaman premium; dikembalikan sebagai isi
  // utama return komponen SEBELUM logika UI Dilemma di bawahnya. Setiap
  // komponen premium tetap terpasang sampai reveal supaya revealName
  // (nama asli saat jawaban diterima) bisa tampil di dalamnya.
  function renderExperience() {
    const reveal = accepted ? kado.senderName ?? "Seseorang" : null
    if (kado.kadoType === "bouquet")
      return (
        <PremiumBouquet
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          revealName={reveal}
          onOpenComplete={() => setPhase(3)}
        />
      )
    if (kado.kadoType === "openwhen")
      return (
        <PremiumOpenWhen
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          revealName={reveal}
          title={dataStr(kado.kadoData, "title") ?? undefined}
          prompt={dataStr(kado.kadoData, "prompt") ?? undefined}
          onOpenComplete={() => setPhase(3)}
        />
      )
    if (kado.kadoType === "photobox")
      return (
        <PremiumPhotobox
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          revealName={reveal}
          imageUrl={dataStr(kado.kadoData, "imageUrl")}
          onOpenComplete={() => setPhase(3)}
        />
      )
    if (kado.kadoType === "coupon")
      return (
        <PremiumLoveCoupon
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          revealName={reveal}
          title={dataStr(kado.kadoData, "title") ?? undefined}
          onOpenComplete={() => setPhase(3)}
        />
      )
    if (kado.kadoType === "candle")
      return (
        <PremiumCandleBlow
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          revealName={reveal}
          onOpenComplete={() => setPhase(3)}
        />
      )
    if (kado.kadoType === "confess")
      return (
        <PremiumConfess
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          senderName={kado.senderName}
          createdAt={kado.createdAt}
          revealName={reveal}
          onOpenComplete={() => setPhase(3)}
        />
      )
    // kompatibilitas kado lama (sebelum hard refactor) — tetap pengalaman premium
    if (kado.kadoType === "playlist")
      return (
        <PremiumPlaylist
          targetName={kado.targetName}
          message={kado.message}
          fomoInitials={kado.fomoInitials}
          revealName={reveal}
          spotifyId={dataStr(kado.kadoData, "spotifyId")}
          onOpenComplete={() => setPhase(3)}
        />
      )
    // kado tipe lama (fingerprint/tap/scratch/quiz) atau tak dikenal →
    // pengalaman pengakuan premium; tidak ada UI lama yang tersisa
    return (
      <PremiumConfess
        targetName={kado.targetName}
        message={kado.message}
        fomoInitials={kado.fomoInitials}
        senderName={kado.senderName}
        createdAt={kado.createdAt}
        revealName={reveal}
        onOpenComplete={() => setPhase(3)}
      />
    )
  }

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        {/* Pengalaman premium sesuai kadoType — return utama, sebelum Dilemma */}
        {renderExperience()}

        {/* Fase 3 — The Dilemma: kartu terpisah di bawah pengalaman premium
            (isi pesan sudah tampil di komponennya, surat standar tak perlu) */}
        {phase >= 3 && (
          <motion.div
            key="dilemma"
            initial={reduceMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="mt-5 will-change-transform"
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-md">
              {phase === 3 && (
                <p className="mb-4 text-center text-sm leading-relaxed text-zinc-300">
                  {kado.kadoType === "bouquet"
                    ? "Bunganya udah mekar… sekarang giliran lo. 🌷"
                    : kado.kadoType === "photobox"
                      ? "Fotonya udah kecuci… sekarang giliran lo. 📸"
                      : kado.kadoType === "coupon"
                        ? "Kuponnya udah diklaim… sekarang giliran lo. 🎟"
                        : kado.kadoType === "candle"
                          ? "Lilinnya udah padam… sekarang giliran lo. 🕯️"
                          : kado.kadoType === "confess"
                            ? "Pengakuannya udah terbaca… sekarang giliran lo. 💜"
                            : kado.kadoType === "playlist"
                              ? "Lagunya udah diputar… sekarang giliran lo. 🎵"
                              : "Suratnya udah kebaca… sekarang giliran lo. ✉️"}
                </p>
              )}
              {accepted && (
                <p className="text-center text-xs text-rose-200/80">
                  💜 Kado ini resmi jadi kenangan — strip kenangannya ada di surat di atas.
                </p>
              )}
              {/* tombol keputusan hanya hidup di fase 3 — setelah keputusan
                  tersimpan (fase 4) tombol mati tidak boleh masih tampil */}
              {phase === 3 && (
                <DilemmaButtons submitting={submitting} onChoice={handleChoice} failed={submitFailed} />
              )}
            </div>
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
// Fase 3 — tombol dilemma
// ─────────────────────────────────────────────────────────────────────────────

function DilemmaButtons({
  submitting,
  onChoice,
  failed = false,
}: {
  submitting: Outcome | null
  onChoice: (choice: Outcome) => void
  failed?: boolean
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {failed && (
        <p role="alert" className="text-center text-xs leading-relaxed text-rose-300/90">
          Gagal mengirim jawaban — cek koneksi lalu coba lagi ya 🙏
        </p>
      )}
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
