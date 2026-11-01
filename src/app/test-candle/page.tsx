"use client"

/**
 * /test-candle — panggung uji & demo untuk PremiumCandleBlow (Wish Keeper
 * Edition). Pola sama dengan /test-bouquet & /test-confess:
 *
 *  1. Verifikasi visual otomatis: scripts/shot_candle.mjs memakai halaman
 *     ini (selektor "Nyalakan lilinnya", gate ritual, "Buka mic & tiup",
 *     testid done-flag & btn-accept) untuk memotret seluruh babak lewat
 *     Playwright.
 *  2. Demo manual: siapa pun bisa merasakan alur lilin TANPA menghanguskan
 *     kado sungguhan — data di bawah palsu, tidak menyentuh database.
 *
 * Bukan halaman produksi: tidak ada fetch, tidak ada state global, hanya
 * me-render PremiumCandleBlow dengan data contoh.
 */

import { useState } from "react"
import PremiumCandleBlow from "@/app/kado/[id]/PremiumCandleBlow"

const SAMPLE = {
  targetName: "Budi",
  message:
    "Lilin kecil ini kusulai satu-satu, sama seperti alasan-alasan aku bersyukur kenalmu.\n\nTiup pelan-pelan — permintaanmu dijamin sampai, sama kayak pesan ini.\n\nDari orang yang selalu banggain kamu diam-diam.",
  fomoInitials: "R***I",
  senderName: "Rizri Ananda",
  // tanggal statis (bukan new Date() saat render) — aman dari hydration mismatch
  createdAt: "2026-10-28T09:00:00.000Z",
  occasion: "ultah",
}

export default function TestCandlePage() {
  const [reveal, setReveal] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
          Halaman uji internal — data palsu, tidak mengubah database
        </p>

        <PremiumCandleBlow
          targetName={SAMPLE.targetName}
          message={SAMPLE.message}
          fomoInitials={SAMPLE.fomoInitials}
          senderName={SAMPLE.senderName}
          createdAt={SAMPLE.createdAt}
          occasion={SAMPLE.occasion}
          revealName={reveal}
          onOpenComplete={() => setDone(true)}
        />

        {/* penanda & kontrol untuk skrip verifikasi otomatis */}
        <div className="mt-6 flex flex-col items-center gap-3 pb-10">
          <span
            data-testid="done-flag"
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-400"
          >
            {done ? "selesai" : "menunggu"}
          </span>
          <button
            type="button"
            data-testid="btn-accept"
            onClick={() => setReveal(SAMPLE.senderName)}
            className="rounded-2xl bg-gradient-to-r from-amber-400 to-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow-[0_0_24px_-6px_rgba(251,191,36,0.5)]"
          >
            [Uji] Simulasikan jawaban diterima
          </button>
        </div>
      </div>
    </main>
  )
}
