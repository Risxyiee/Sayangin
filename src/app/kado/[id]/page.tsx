import type { Metadata } from "next"
import Link from "next/link"
import { db, withDbRetry } from "@/lib/db"
import { describeError } from "@/lib/log-error"
import { Heart, PackageOpen, ServerCrash } from "lucide-react"
import ReloadButton from "./share/ReloadButton"
import CinematicUnboxing, { type KadoForUnboxing } from "./CinematicUnboxing"

/**
 * Halaman pembukaan kado — URL rahasia yang diterima target.
 *
 * Server Component: ambil kado dari Supabase (Prisma via Hyperdrive —
 * aturan mutlak: koneksi HANYA lewat src/lib/db.ts, direct connection 5432).
 * Seluruh sinematiknya ada di CinematicUnboxing (client, state machine 4 fase).
 *
 * Runtime: TANPA `export const runtime = "edge"` — OpenNext Cloudflare
 * meng-compile seluruh app menjadi satu Worker edge (bukti & penjelasan:
 * src/app/api/kado/route.ts).
 *
 * Privasi: link kado bersifat personal — jangan diindeks mesin pencari.
 */
export const metadata: Metadata = {
  title: "Sebuah kado untukmu 💜 — Kangenin",
  robots: { index: false, follow: false },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Normalisasi kadoData Json (Prisma) → bentuk aman untuk client. */
function toKadoData(v: unknown): Record<string, string | number> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null
  const out: Record<string, string | number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" || typeof val === "number") out[k] = val
  }
  return Object.keys(out).length > 0 ? out : null
}

// ─────────────────────────────────────────────────────────────────────────────
// UI fallback
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-950 bg-[radial-gradient(ellipse_at_top,rgba(244,63,94,0.10),transparent_55%)] px-4 py-8 text-zinc-100">
      <div className="w-full max-w-md">{children}</div>
    </main>
  )
}

function NotFoundCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800/60">
        <PackageOpen className="h-6 w-6 text-zinc-400" strokeWidth={1.75} />
      </div>
      <p className="mt-4 text-5xl font-black tracking-tight text-zinc-700">404</p>
      <h1 className="mt-2 text-lg font-bold text-white">Kado nggak ketemu</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Linknya mungkin salah ketik, kadonya sudah dihapus, atau memang belum pernah ada.
      </p>
      <Link
        href="/create"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)]"
      >
        Bikin Kado Baru
      </Link>
    </div>
  )
}

function AlreadyOpenedCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15">
        <Heart className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-white">
        Kado ini sudah dibuka dan menjadi kenangan.
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Setiap kado cuma bisa dibuka sekali — biarkan kenangannya tetap di tempatnya 💜
      </p>
      <Link
        href="/create"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
      >
        Bikin kado untuk orang lain
      </Link>
    </div>
  )
}

function ErrorCard() {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl shadow-black/40 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15">
        <ServerCrash className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
      </div>
      <h1 className="mt-4 text-lg font-bold text-white">Servernya lagi ngambek</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        Kadonya mungkin masih aman — coba muat ulang halaman ini.
      </p>
      <ReloadButton />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman
// ─────────────────────────────────────────────────────────────────────────────

interface OpenPageProps {
  // Next 15+: params adalah Promise — selalu di-await
  params: Promise<{ id: string }>
}

export default async function OpenKadoPage({ params }: OpenPageProps) {
  const { id } = await params

  // UUID salah format → tidak perlu ganggu database (kolom id bertipe uuid).
  if (!UUID_RE.test(id)) {
    return (
      <Shell>
        <NotFoundCard />
      </Shell>
    )
  }

  let kado: (KadoForUnboxing & { status: string }) | null = null
  let dbFailed = false

  try {
    // withDbRetry: koneksi zombie Hyperdrive diulang otomatis di koneksi baru
    const row = await withDbRetry(() =>
      db.kado.findUnique({
        where: { id },
        select: {
          id: true,
          targetName: true,
          message: true,
          senderName: true,
          fomoInitials: true,
          kadoType: true,
          kadoData: true,
          createdAt: true,
          status: true,
        },
      })
    )
    if (row) {
      kado = {
        id: row.id,
        targetName: row.targetName,
        message: row.message,
        senderName: row.senderName,
        fomoInitials: row.fomoInitials,
        kadoType: row.kadoType,
        kadoData: toKadoData(row.kadoData),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
        status: row.status,
      }
    }
  } catch (err) {
    dbFailed = true
    console.error("GET /kado/[id] error:", describeError(err), err)
  }

  if (dbFailed) {
    return (
      <Shell>
        <ErrorCard />
      </Shell>
    )
  }
  if (!kado) {
    return (
      <Shell>
        <NotFoundCard />
      </Shell>
    )
  }

  // Kado cuma bisa dibuka sekali — sudah terbuka/terjawab → kenangan.
  if (kado.status !== "pending") {
    return (
      <Shell>
        <AlreadyOpenedCard />
      </Shell>
    )
  }

  return (
    <CinematicUnboxing
      kado={{
        id: kado.id,
        targetName: kado.targetName,
        message: kado.message,
        senderName: kado.senderName,
        fomoInitials: kado.fomoInitials,
        kadoType: kado.kadoType,
        kadoData: toKadoData(kado.kadoData),
      }}
    />
  )
}
