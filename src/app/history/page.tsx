"use client"

/**
 * Riwayat Kado (Ghost Dashboard) — halaman /history
 *
 * Tanpa login: daftar kado yang pernah dibuat DI PERANGKAT INI, dibaca dari
 * localStorage (kunci "kangenin_history", ditulis saat POST /api/kado sukses).
 *
 * Aturan hydration: snapshot localStorage dibaca lewat useSyncExternalStore —
 * render awal server & client sama-sama memakai snapshot server (string
 * kosong) sehingga TIDAK ada hydration mismatch; begitu terpasang, React
 * otomatis re-render dengan snapshot asli perangkat. Bonus: event "storage"
 * membuat daftar ikut ter-update kalau tab lain menyimpan riwayat baru.
 */

import { useMemo, useSyncExternalStore } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Camera,
  Clock,
  Flame,
  Flower2,
  Gift,
  Heart,
  LayoutDashboard,
  Sparkles,
  Stamp,
  Ticket,
  type LucideIcon,
} from "lucide-react"
import { KADO_HISTORY_KEY, parseKadoHistory, type KadoHistoryEntry } from "@/lib/kado-history"

/** Ikon + label tampilan per kadoType — sejalan dengan pilihan Creator Studio. */
const TYPE_META: Record<string, { label: string; icon: LucideIcon }> = {
  bouquet: { label: "Buket Bunga", icon: Flower2 },
  openwhen: { label: "Open When", icon: Stamp },
  photobox: { label: "Photobox", icon: Camera },
  coupon: { label: "Love Coupon", icon: Ticket },
  candle: { label: "Candle Blow", icon: Flame },
  confess: { label: "Confess", icon: Heart },
}

function typeMeta(type: string): { label: string; icon: LucideIcon } {
  return TYPE_META[type] ?? { label: "Kado Kejutan", icon: Gift }
}

/** "2026-11-01" → "1 November 2026" (locale Indonesia; dipanggil pasca-mount). */
function formatTanggal(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d)
}

/** Langganan perubahan storage — event "storage" fire di tab lain yang terbuka. */
function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

/** Snapshot klien: string mentah localStorage (stabil selama tak berubah). */
function getSnapshot(): string {
  try {
    return window.localStorage.getItem(KADO_HISTORY_KEY) ?? ""
  } catch {
    return "" // storage diblokir (mis. mode privat ketat) → anggap kosong
  }
}

/** Snapshot server: selalu kosong — jaminan render awal identik (no hydration error). */
function getServerSnapshot(): string {
  return ""
}

export default function HistoryPage() {
  // External store pattern — pola resmi React untuk localStorage (lihat doc header).
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const entries = useMemo(() => parseKadoHistory(raw), [raw])

  return (
    <main className="min-h-dvh bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.14),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(244,63,94,0.10),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="mx-auto w-full max-w-md">
        {/* Header */}
        <header className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Beranda
          </Link>
          <span
            className="inline-flex items-center gap-1.5 text-xs font-medium tracking-widest text-zinc-500 uppercase"
            aria-hidden="true"
          >
            <Clock className="h-3.5 w-3.5" />
            Perangkat ini
          </span>
        </header>

        <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">Kado Saya</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Riwayat kado yang pernah kamu buat di perangkat ini — tanpa akun, tanpa password.
        </p>

        {entries.length === 0 ? (
          /* Empty state — glassmorphism estetik */
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 shadow-[0_0_24px_-6px_rgba(244,63,94,0.6)]">
              <Sparkles className="h-7 w-7 text-rose-300" strokeWidth={1.5} />
            </div>
            <p className="mt-4 text-base font-semibold text-white">
              Belum ada kado yang dibuat di perangkat ini.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Setiap kado yang kamu rangkai lewat Creator Studio akan tercatat otomatis di sini —
              biar link-nya gampang dicari lagi walau tab-nya tertutup.
            </p>
            <Link
              href="/create"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)]"
            >
              <Gift className="h-4 w-4" />
              Bikin kado pertama
            </Link>
          </div>
        ) : (
          <>
            {/* Daftar kartu kado — terbaru dulu */}
            <ul className="space-y-3">
              {entries.map((e) => {
                const meta = typeMeta(e.type)
                const Icon = meta.icon
                return (
                  <li key={e.id}>
                    <article className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/30 backdrop-blur-md transition-colors duration-200 hover:border-white/25 hover:bg-white/[0.08]">
                      {/* Ikon tipe kado */}
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-500/15">
                        <Icon className="h-5 w-5 text-rose-300" strokeWidth={1.75} />
                      </div>

                      {/* Judul + tanggal + tipe */}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white" title={e.title}>
                          {e.title}
                        </p>
                        <p className="mt-0.5 text-xs text-zinc-500">
                          {meta.label} · {formatTanggal(e.date)}
                        </p>
                      </div>

                      {/* Aksi utama: dashboard share */}
                      <Link
                        href={`/kado/${e.id}/share`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-purple-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_0_20px_-6px_rgba(244,63,94,0.6)] transition-shadow hover:shadow-[0_0_28px_-4px_rgba(244,63,94,0.75)]"
                        aria-label={`Buka Dashboard Share untuk ${e.title}`}
                      >
                        <LayoutDashboard className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Buka Dashboard Share</span>
                        <span className="sm:hidden">Dashboard</span>
                      </Link>
                    </article>
                  </li>
                )
              })}
            </ul>

            <p className="mt-6 text-center text-xs leading-relaxed text-zinc-600">
              Riwayat tersimpan hanya di browser perangkat ini (localStorage) — bukan di server.
              Hapus data situs di browser untuk membersihkannya.
            </p>
          </>
        )}

        <p className="mt-6 text-center text-xs text-zinc-600">
          Dibuat dengan 💜 di Kangenin — kado kecil, rindu besar.
        </p>
      </div>
    </main>
  )
}
