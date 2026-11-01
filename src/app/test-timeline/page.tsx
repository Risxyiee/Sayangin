"use client"

/**
 * /test-timeline — panggung uji & demo untuk PremiumTimeline (Memory Lane
 * Edition). Dua kegunaan:
 *  1. Verifikasi visual otomatis: skrip Playwright memakai selektor
 *     "Mulai Perjalanan", momen, "Ada satu hal lagi…", testid done-flag.
 *  2. Demo manual: siapa pun bisa merasakan alur timeline TANPA
 *     menghanguskan kado sungguhan — data di bawah palsu, tanpa database.
 *
 * Bukan halaman produksi: tidak ada fetch, tidak ada state global.
 */

import { useState } from "react"
import PremiumTimeline from "@/app/kado/[id]/PremiumTimeline"

const SAMPLE = {
  targetName: "Nadia",
  message:
    "Kalau dipikir-pikir, kita udah jalan jauh banget ya — dari chat iseng sampai jadi rumah buat satu sama lain.\n\nMakanya kuserahkan perjalanan ini di sini: biar kalau kamu lupa sejauh mana kita, halaman ini yang ingetin.",
  fomoInitials: "R***I",
  senderName: "Rizri Ananda",
  createdAt: "2026-11-01T08:30:00.000Z",
  moments: [
    { date: "12 FEB 2025", caption: "Chat pertama: 'hujan, boleh minta pullutan?'" },
    { date: "1 MAR 2025", caption: "Nonton pertama — kamu ketiduran 20 menit" },
    { date: "17 APR 2025", caption: "Jadian! (di tengah hujan lagi, kebetulan)" },
    { date: "3 AGU 2025", caption: "LDR dimulai: Bandung–Jakarta, tiap weekend telepon" },
    { date: "HARI INI", caption: "Masih kangen, masih kalian 💜" },
  ],
}

export default function TestTimelinePage() {
  const [reveal, setReveal] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
          Halaman uji internal — data palsu, tidak mengubah database
        </p>

        <PremiumTimeline
          targetName={SAMPLE.targetName}
          message={SAMPLE.message}
          fomoInitials={SAMPLE.fomoInitials}
          senderName={SAMPLE.senderName}
          createdAt={SAMPLE.createdAt}
          moments={SAMPLE.moments}
          music="musicbox"
          endingType="voucher"
          endingText="FREE-PELUK-SEUMUR-HIDUP"
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
            className="rounded-2xl bg-gradient-to-r from-purple-500 to-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow-[0_0_24px_-6px_rgba(168,85,247,0.5)]"
          >
            [Uji] Simulasikan jawaban diterima
          </button>
        </div>
      </div>
    </main>
  )
}
