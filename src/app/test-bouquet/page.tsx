"use client"

/**
 * /test-bouquet — panggung uji & demo untuk PremiumBouquet (Blooming Edition).
 *
 * Dua kegunaan:
 *  1. Verifikasi visual otomatis: scripts/shot_bouquet.mjs memakai halaman
 *     ini (selektor "Sambut buketnya", pita, "Buka kuncup terakhir",
 *     testid done-flag & btn-accept) untuk memotret seluruh babak lewat
 *     Playwright.
 *  2. Demo manual: siapa pun bisa merasakan alur buket TANPA menghanguskan
 *     kado sungguhan — data di bawah palsu, tidak menyentuh database.
 *
 * Bukan halaman produksi: tidak ada fetch, tidak ada state global, hanya
 * me-render PremiumBouquet dengan data contoh.
 */

import { useState } from "react"
import PremiumBouquet from "@/app/kado/[id]/PremiumBouquet"

const SAMPLE = {
  targetName: "Budi",
  message:
    "Bunga-bunga ini kupilih satu-satu, tapi tetap nggak ada yang seindah senyum kamu waktu itu.\n\nMakanya aku titip lewat sini: semoga hari kamu hari ini sehangat buketnya.\n\nDari orang yang inget tanggal kecil kamu.",
  fomoInitials: "R***I",
  senderName: "Rizri Ananda",
  // tanggal statis (bukan new Date() saat render) — aman dari hydration mismatch
  createdAt: "2026-10-24T08:30:00.000Z",
}

export default function TestBouquetPage() {
  const [reveal, setReveal] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
          Halaman uji internal — data palsu, tidak mengubah database
        </p>

        <PremiumBouquet
          targetName={SAMPLE.targetName}
          message={SAMPLE.message}
          fomoInitials={SAMPLE.fomoInitials}
          senderName={SAMPLE.senderName}
          createdAt={SAMPLE.createdAt}
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
