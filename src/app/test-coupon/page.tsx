"use client"

/**
 * /test-coupon — panggung uji & demo untuk PremiumLoveCoupon (Golden Booklet
 * Edition). Pola sama dengan /test-bouquet & /test-candle:
 *
 *  1. Verifikasi visual otomatis: scripts/shot_coupon.mjs memakai halaman
 *     ini (selektor "Buka bukletnya", "Tarik pita segel", sobekan,
 *     testid done-flag, btn-accept, btn-reset) untuk memotret seluruh
 *     babak lewat Playwright.
 *  2. Demo manual: alur buklet kupon lengkap TANPA database — data di
 *     bawah palsu. Status sobek tersimpan di localStorage dengan kunci
 *     demo khusus; tombol [Uji] Reset menghapusnya supaya demo bisa
 *     diulang dari awal.
 *
 * Bukan halaman produksi: tidak ada fetch, tidak ada state global.
 */

import { useState } from "react"
import PremiumLoveCoupon from "@/app/kado/[id]/PremiumLoveCoupon"

const SAMPLE = {
  targetName: "Budi",
  message:
    "Buklet ini isinya janji-janji kecil yang aku tepati satu-satu.\n\nSobek pelan-pelan — tiap tiketnya nyata, bukan gimmick.\n\nDari orang yang utangnya banyak, tapi setia.",
  fomoInitials: "R***I",
  senderName: "Rizri Ananda",
  // tanggal statis (bukan new Date() saat render) — aman dari hydration mismatch
  createdAt: "2026-10-30T14:00:00.000Z",
  kadoId: "test-coupon-demo",
  coupons: [
    { title: "1x Bebas Ngambek", desc: "Berlaku kapan pun, tanpa syarat." },
    { title: "1x Pelukan Gratis", desc: "Tukarkan saat sedang butuh." },
    { title: "1x Jajan Dibayarin", desc: "Sekali jajan, aku yang traktir." },
    { title: "1x Nemenin Nonton", desc: "Film pilihanmu, aku siap." },
    { title: "1x Masak Buatmu", desc: "Menu bebas, anak kos level dewa." },
    { title: "1x Minta Apa Aja", desc: "Selama nggak melawan hukum 😉" },
  ],
}

const RESET_KEY = "kangenin:kupon:test-coupon-demo"

export default function TestCouponPage() {
  const [reveal, setReveal] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [session, setSession] = useState(0) // ganti kunci → buklet mulai utuh

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.12),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.12),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-600">
          Halaman uji internal — data palsu, tidak mengubah database
        </p>

        <PremiumLoveCoupon
          key={session}
          targetName={SAMPLE.targetName}
          message={SAMPLE.message}
          fomoInitials={SAMPLE.fomoInitials}
          senderName={SAMPLE.senderName}
          createdAt={SAMPLE.createdAt}
          kadoId={SAMPLE.kadoId}
          coupons={SAMPLE.coupons}
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
          <button
            type="button"
            data-testid="btn-reset"
            onClick={() => {
              try {
                localStorage.removeItem(RESET_KEY)
              } catch {
                /* abaikan */
              }
              setReveal(null)
              setDone(false)
              setSession((s) => s + 1) // remount → deck utuh lagi
            }}
            className="rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-xs font-medium text-zinc-300"
          >
            [Uji] Reset demo (hapus status sobek)
          </button>
        </div>
      </div>
    </main>
  )
}
