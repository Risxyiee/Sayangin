"use client"

/**
 * PremiumLoveCoupon — kado "Love Coupon": The Golden Booklet Edition.
 *
 * Dari "satu tiket, sobek sekali, selesai 3 detik" menjadi buklet emas 4
 * babak — konsisten dengan Heartstring (Confess), Blooming (Bouquet) & Wish
 * Keeper (Candle). Setiap babak SELALU membuka info baru:
 *
 *   sampul  (Babak 0)   buklet emas "tiba" dari bawah dengan label emboss:
 *                       "Untuk <penerima> — N tiket, diikat tangan oleh
 *                       R•••i". Penerima menyambut (tap) → unlock audio.
 *   segel   (Babak 1)   pita segel melawan dua tahap (cermin pita buket):
 *                       45px = band longgar + rustle; lewat 92px = SEGEL
 *                       LEPAS (slip + getar [20,40,60]) → sampul membuka,
 *                       deck kupon menyebar, topeng bocor R•••i → Ri••i.
 *   sobek   (Babak 2)   inti ritual — kupon disobek SATU-SATU: tarik
 *                       sobekan ke kanan (resist elastis, strain jitter),
 *                       lewat ambang → RIP (slip + rustle + stamp + getar
 *                       [15,25]) → sobekan melayang jatuh, stempel
 *                       "✔ DIKLAIM <tanggal>" menghantam, tiket berikutnya
 *                       spring masuk + pop. Tiket TERAKHIR: gold-foil
 *                       penuh, tarikan lebih berat (124px), penghargaan
 *                       lebih besar (getar [15,30,15,30,60] + konfeti).
 *   penutup (Babak 3)   kartu emas naik: pesan baris demi baris blur →
 *                       tajam + chime, "berlaku selamanya — nggak bisa
 *                       ditukar", "diikat tangan, <tanggal>".
 *                       onOpenComplete() setelah kartu masuk.
 *
 * STATUS SOBEK TERSIMPAN (nol database): tiap sobek dicatat di localStorage
 * per kadoId (`kangenin:kupon:<id>`). Dibuka ulang → kupon yang sudah
 * diklaim tetap terpakai (buklet beneran), deck lanjut ke tiket berikutnya;
 * kalau semua sudah diklaim → langsung Babak 3. Tanpa kadoId → hanya
 * sesi itu (aman untuk demo).
 *
 * Deck: kadoData.coupons (3-6, dari Creator Studio, JSON string di-parse
 * parent) — tanpa itu jatuh ke deck bawaan 5 klasic dengan kadoData.title
 * sebagai tiket pertama (kompatibel kado lama).
 *
 * Aturan ritual (sama dengan edisi lain):
 * - Fail-safe: sampul 8 dtk → masuk sendiri; segel 12 dtk → tombol
 *   "Lanjutkan"; sobek 20 dtk → tombol "Klaim sekarang". Tidak pernah buntu.
 * - prefers-reduced-motion: satu tap = sampul terbuka + deck siap; semua
 *   animasi instan (interaksi sobek tetap per tap).
 * - Keyboard: semua gerbang Enter/Space (sambut, segel, sobekan).
 * - 60FPS: hanya transform/opacity/filter; tarikan real-time via
 *   MotionValue tanpa re-render React per frame.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react"
import {
  AnimatePresence,
  animate,
  motion,
  useAnimationControls,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from "framer-motion"
import confetti from "canvas-confetti"
import { Volume2, VolumeX } from "lucide-react"
import { useKadoAudio } from "./useKadoAudio"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumLoveCouponProps {
  /** Nama penerima — badge header, label sampul, kartu penutup. */
  targetName: string
  /** Pesan pengirim — kartu penutup Babak 3, baris demi baris. */
  message: string
  /** Inisial bertopeng dari parent ("R***I") — fallback tanpa senderName. */
  fomoInitials: string | null
  /** Nama asli saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /**
   * Nama asli pengirim — sumber topeng lokal & bocoran bertahap
   * (pola sama dengan edisi lain — nol perubahan backend).
   */
  senderName?: string | null
  /** ISO timestamp — "diikat tangan, <tanggal>" & stempel diklaim. */
  createdAt?: string | null
  /** Deck kupon dari Creator Studio (3-6) — tanpa ini → deck bawaan. */
  coupons?: { title: string; desc: string }[]
  /** ID kado — kunci localStorage status sobek (nol database). */
  kadoId?: string
  /** Judul kupon lama (kadoData.title) — jadi tiket pertama deck bawaan. */
  title?: string
  /** Dipanggil SEKALI setelah kartu penutup selesai masuk. */
  onOpenComplete: () => void
}

type Babak = "sampul" | "segel" | "sobek" | "penutup"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Tahap 1 segel: band mulai longgar (px). */
const SEAL_STAGE1_PX = 45
/** Segel lepas (px) — spesifikasi ritual tahap 2. */
const SEAL_TRIGGER_PX = 92
const SEAL_DRAG_CONSTRAINTS = { left: 0, right: 112 }

/** Ambang sobek (px): tarikan x melewati ini → tiket robek. */
const TEAR_THRESHOLD_PX = 96
/** Tiket terakhir lebih berat — bikin momen pamungkas terasa beda (px). */
const LAST_TEAR_THRESHOLD_PX = 124
/** Titik akhir animasi sobekan terpental. */
const STUB_FLY = { x: 210, y: 320, rotate: 48 }

/** Geometri tiket (px) — memanjang horizontal, muat di layar HP. */
const TICKET_W = 340
const TICKET_H = 178
const STUB_W = 84

/** Gerbang otomatis (ms) — jalan pintas fail-safe per babak. */
const IDLE_SAMPUL_MS = 8000
const IDLE_SEGEL_MS = 12000
const IDLE_SOBEK_MS = 20000

/** Jeda stamp terlihat sebelum tiket berikutnya masuk (ms). */
const NEXT_DELAY_MS = 1000

const COUPON_MAX = 6

/** Warna tinta & kertas tiket. */
const INK = "text-amber-950"
const TEETH_FILL = "#8a6414"

/** Deck bawaan — dipakai bila Creator Studio tidak mengirim kadoData.coupons. */
const DEFAULT_DECK: { title: string; desc: string }[] = [
  { title: "1x Bebas Ngambek", desc: "Berlaku kapan pun, tanpa syarat." },
  { title: "1x Pelukan Gratis", desc: "Tukarkan saat sedang butuh." },
  { title: "1x Jajan Dibayarin", desc: "Sekali jajan, aku yang traktir." },
  { title: "1x Nemenin Nonton", desc: "Film pilihanmu, aku siap." },
  { title: "1x Minta Apa Aja", desc: "Selama nggak melawan hukum 😉" },
]

/** Pinggiran gold-foil — sama dengan kartu buket (keluarga visual emas). */
const GOLD_FOIL =
  "linear-gradient(135deg,#b8860b,#f6e27a 25%,#fff7d6 45%,#d4af37 65%,#f9e79f 85%,#b8860b)"

/** Tekstur kertas halus (feTurbulence, opacity rendah). */
const PAPER_TEXTURE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E")`

// ─────────────────────────────────────────────────────────────────────────────
// Pembantu (pola edisi lain — konsisten antar komponen premium)
// ─────────────────────────────────────────────────────────────────────────────

/** Topeng nama lokal — level 0: "R•••i"; level 1 (bocor): "Ri••i". */
function maskName(name: string | null | undefined, level: 0 | 1): string {
  const n = (name ?? "").trim()
  if (n.length <= 2) return n || "Seseorang"
  if (level === 0) {
    const mid = Math.max(1, Math.min(3, n.length - 2))
    return `${n[0]}${"•".repeat(mid)}${n[n.length - 1]}`
  }
  const mid = Math.max(1, Math.min(3, n.length - 3))
  return `${n.slice(0, 2)}${"•".repeat(mid)}${n[n.length - 1]}`
}

/** Tanggal Indonesia — "1 November 2026"; "" bila tak valid. */
function tanggalIndo(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
}

/** Tanggal stempel pendek — "1 Nov 2026" dari timestamp klaim. */
function tanggalStempel(ts: number): string {
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
}

/**
 * Pesan → baris tampil: pecah \n; baris > 70 karakter dipecah di batas
 * kalimat (.,!?,;) supaya reveal per baris terasa natural.
 */
function splitIntoLines(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const out: string[] = []
  for (const line of raw) {
    if (line.length <= 70) {
      out.push(line)
      continue
    }
    const parts = line.split(/(?<=[.,!?;])\s+/)
    let buf = ""
    for (const p of parts) {
      const cand = buf ? `${buf} ${p}` : p
      if (cand.length > 70 && buf) {
        out.push(buf)
        buf = p
      } else {
        buf = cand
      }
    }
    if (buf) out.push(buf)
  }
  return out.length ? out : [text]
}

/** Konfeti mini khusus area tiket — hormati reduced-motion. */
function fireMiniConfetti(reduceMotion: boolean) {
  if (reduceMotion || typeof window === "undefined") return
  confetti({
    particleCount: 80,
    spread: 75,
    startVelocity: 26,
    scalar: 0.72,
    ticks: 130,
    origin: { y: 0.55 },
    colors: ["#fbbf24", "#f59e0b", "#fff7e0", "#fb7185", "#ffffff"],
    disableForReducedMotion: true,
    zIndex: 60,
  })
}

/** Konfeti pamungkas tiket terakhir — lebih meriah. */
function fireFinalConfetti(reduceMotion: boolean) {
  if (reduceMotion || typeof window === "undefined") return
  const base = {
    disableForReducedMotion: true,
    colors: ["#fbbf24", "#f59e0b", "#fff7e0", "#fb7185", "#ffffff"],
    zIndex: 60,
  }
  confetti({ ...base, particleCount: 110, spread: 85, startVelocity: 30, scalar: 0.8, ticks: 160, origin: { y: 0.5 } })
  confetti({ ...base, particleCount: 50, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
  confetti({ ...base, particleCount: 50, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
}

/** Nomor seri deterministik dari konten tiket — aman SSR (tanpa Math.random). */
function serialFor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return `KN-${(h % 900000) + 100000}`
}

/** Shimmer CSS infinite — mati otomatis saat prefers-reduced-motion. */
function ShimmerStyle() {
  return (
    <style>{`
      @keyframes kangenin-shimmer {
        0% { transform: translateX(-160%) skewX(-18deg); }
        100% { transform: translateX(320%) skewX(-18deg); }
      }
      .coupon-shimmer {
        animation: kangenin-shimmer 3.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      @media (prefers-reduced-motion: reduce) {
        .coupon-shimmer { animation: none; }
      }
    `}</style>
  )
}

/**
 * Tepi gerigi SVG — polygon zigzag vertikal (penyobekan kertas).
 * `flip` membalik arah gigi (dipakai di sisi kanan badan tiket).
 */
function TearTeeth({ height, opacity = 1, flip = false }: { height: number; opacity?: number; flip?: boolean }) {
  const step = 12
  const teeth = Math.ceil(height / step)
  const pts: string[] = []
  for (let i = 0; i <= teeth; i++) {
    const y = i * step
    const xOuter = i % 2 === 0 ? 8 : 0
    pts.push(`${xOuter},${y}`)
    pts.push(`${i % 2 === 0 ? 0 : 8},${y + step / 2}`)
  }
  const polygon = flip ? [...pts].reverse().join(" ") : pts.join(" ")
  const posStyle: CSSProperties = flip ? { left: 0 } : { right: 0 }
  return (
    <svg
      aria-hidden
      width="8"
      height={height}
      viewBox={`0 0 8 ${height}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-0"
      style={{ opacity, ...posStyle }}
    >
      <polygon points={polygon} fill={TEETH_FILL} />
      <polyline
        points={pts.filter((_, i) => i % 2 === 0).join(" ")}
        fill="none"
        stroke="rgba(255,240,190,0.35)"
        strokeWidth="1"
      />
    </svg>
  )
}

/** Garis putus-putus bergerigi di perforasi — memudar saat tarikan makin jauh. */
function PerforationLine({ opacity }: { opacity: number }) {
  return (
    <svg
      aria-hidden
      width="4"
      height={TICKET_H - 16}
      viewBox={`0 0 4 ${TICKET_H - 16}`}
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-y-2 z-30"
      style={{ right: STUB_W - 2, opacity }}
    >
      <path
        d={`M2,0 ${Array.from({ length: Math.ceil((TICKET_H - 16) / 10) })
          .map((_, i) => `${i % 2 === 0 ? "L1.4" : "L2"},${(i + 1) * 10}`)
          .join(" ")}`}
        fill="none"
        stroke="rgba(60,40,5,0.65)"
        strokeWidth="1.6"
        strokeDasharray="5 4"
      />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-komponen: sampul & segel
// ─────────────────────────────────────────────────────────────────────────────

/** Sampul buklet emas — label emboss + judul; dirender di Babak 0 & 1. */
function BookletCover({
  targetName,
  sender,
  total,
  sealStage,
  reduceMotion,
}: {
  targetName: string
  sender: string
  total: number
  sealStage: number
  reduceMotion: boolean
}) {
  return (
    <motion.div
      exit={reduceMotion ? undefined : { y: -44, rotate: -9, opacity: 0, transition: { duration: 0.55, ease: "easeIn" } }}
      className="relative will-change-transform"
      style={{ width: TICKET_W, height: TICKET_H }}
    >
      <div
        className="absolute inset-0 rounded-[22px] p-[3px] shadow-[0_30px_70px_-18px_rgba(180,120,40,0.55)]"
        style={{ background: GOLD_FOIL }}
      >
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[19px] border border-white/10 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: PAPER_TEXTURE }} />
          <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-amber-500/80">
            Kangenin · Love Coupons
          </p>
          <p className="mt-2 text-4xl" aria-hidden>
            🎫
          </p>
          <p className="font-hand mt-2 text-xl text-amber-100">Untuk {targetName}</p>
          <p className="mt-1 text-[10px] text-zinc-400">
            {total} tiket — diikat tangan oleh{" "}
            <span className="font-semibold text-rose-300/80">{sender}</span>
          </p>
          <p className="mt-1.5 text-[9px] italic text-zinc-500">
            mata uang resmi antara kamu & dia
          </p>
          {/* band segel horizontal — longgar saat tahap 1 */}
          <motion.div
            aria-hidden
            animate={sealStage >= 1 && !reduceMotion ? { scaleX: 1.04, opacity: 0.75 } : { scaleX: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="absolute inset-x-0 top-1/2 h-[26px] -translate-y-1/2"
          >
            <div className="h-full w-full bg-gradient-to-r from-amber-500/25 via-amber-300/40 to-amber-500/25 blur-[1px]" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}

/**
 * Pita segel — dua tahap tarik ke kanan dengan perlawanan (cermin GoldRibbon
 * buket); lepas = band terlempar berputar. Keyboard: stage1 → trigger
 * terskrip.
 */
function SealBand({
  sealStage,
  onGesture,
  onStage1,
  onUntied,
  reduceMotion,
}: {
  sealStage: number
  onGesture: () => void
  onStage1: () => void
  onUntied: () => void
  reduceMotion: boolean
}) {
  const controls = useAnimationControls()
  const [touched, setTouched] = useState(false)

  function handleDrag(_e: unknown, info: PanInfo) {
    if (sealStage === 0 && info.offset.x >= SEAL_STAGE1_PX) onStage1()
  }

  function handleDragEnd(_e: unknown, info: PanInfo) {
    if (info.offset.x > SEAL_TRIGGER_PX) {
      onUntied() // segel lepas
    } else {
      // belum lepas → band "melawan" kembali seperti karet elastis
      controls.start({ x: 0, transition: { type: "spring", stiffness: 420, damping: 26 } })
    }
  }

  function handleKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      onStage1()
      setTimeout(onUntied, 420) // urutan terskrip: longgar → lepas
    }
  }

  return (
    <div className="absolute z-20" style={{ top: "50%", left: TICKET_W / 2, width: 128, marginLeft: -64, marginTop: -18 }}>
      <motion.div
        // ajakan visual: band berdenyut pelan sampai disentuh pertama kali
        animate={reduceMotion || touched ? undefined : { x: [0, 7, 0] }}
        transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
        className="will-change-transform"
      >
        <motion.button
          type="button"
          aria-label="Tarik pita segel ke kanan untuk membuka buklet"
          onDragStart={() => {
            setTouched(true)
            onGesture() // audio unlock dari gesture pertama (aturan autoplay)
          }}
          onKeyDown={handleKey}
          drag="x"
          dragConstraints={SEAL_DRAG_CONSTRAINTS}
          dragElastic={0.2}
          dragMomentum={false}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.06 }}
          animate={controls}
          initial={{ x: 0 }}
          // The Trigger: band terlempar BERPUTAR ke kanan
          exit={reduceMotion ? undefined : { x: 150, rotate: 140, opacity: 0, transition: { duration: 0.85, ease: "easeIn" } }}
          className="relative flex h-9 w-full cursor-grab touch-none items-center justify-center rounded-full border border-amber-200/60 bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 shadow-[0_0_28px_rgba(251,191,36,0.5)] will-change-transform active:cursor-grabbing"
        >
          <span aria-hidden className="pointer-events-none absolute inset-x-4 top-[3px] h-[30%] rounded-full bg-white/50 blur-[2px]" />
          <span aria-hidden className="pointer-events-none absolute -inset-2 -z-10 rounded-full bg-amber-400/25 motion-safe:animate-pulse blur-md" />
          <span className="text-[11px] font-extrabold tracking-[0.22em] text-amber-950">
            {sealStage >= 1 ? "TERUS! ➜" : "TARIK ➜"}
          </span>
        </motion.button>
      </motion.div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumLoveCoupon({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  senderName = null,
  createdAt = null,
  coupons = undefined,
  kadoId = undefined,
  title = undefined,
  onOpenComplete,
}: PremiumLoveCouponProps) {
  const [babak, setBabak] = useState<Babak>("sampul")
  /** 0 = terikat rapat, 1 = band longgar (tahap 1), 2 = segel lepas. */
  const [sealStage, setSealStage] = useState(0)
  /** Indeks tiket yang baru disobek (stempel + sobekan terbang) — null = aktif. */
  const [tornIdx, setTornIdx] = useState<number | null>(null)
  /** Status klaim per indeks deck → timestamp (localStorage, nol database). */
  const [tornMap, setTornMap] = useState<Record<number, number>>({})
  const [leaked, setLeaked] = useState(false)
  const [showLanjut, setShowLanjut] = useState(false)

  const reduceMotion = useReducedMotion() ?? false
  const audio = useKadoAudio()

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // semua timer ritual terpusat — dibersihkan saat unmount
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = useCallback((fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms)
    timersRef.current.push(t)
  }, [])
  useEffect(() => () => timersRef.current.forEach(clearTimeout), [])

  /** Getar koreografi — no-op di browser tanpa vibrate / reduced-motion. */
  const buzz = useCallback(
    (p: number | number[]) => {
      if (reduceMotion) return
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p)
    },
    [reduceMotion]
  )

  const tanggal = useMemo(() => tanggalIndo(createdAt), [createdAt])
  const lines = useMemo(() => splitIntoLines(message), [message])

  const senderMasked = senderName ? maskName(senderName, 0) : (fomoInitials ?? "Seseorang")
  const senderLeak = senderName ? maskName(senderName, 1) : (fomoInitials ?? "Seseorang")
  const senderDisplay = leaked && senderName ? senderLeak : senderMasked

  // ── Deck kupon (stabil via useMemo — identitas tak berubah antar render)
  const deck = useMemo(() => {
    if (coupons && coupons.length) return coupons.slice(0, COUPON_MAX)
    const first = title?.trim() || DEFAULT_DECK[0].title
    return [{ title: first, desc: "" }, ...DEFAULT_DECK.slice(1)]
  }, [coupons, title])

  // ── Muat status sobek dari localStorage (sekali, pasca-hydration).
  // SetState dipanggil dari callback timer — aturan react-hooks/set-state-in-
  // effect (hindari render berantai sinkron); 1 tick tak terlihat mata.
  const tornKey = kadoId ? `kangenin:kupon:${kadoId}` : null
  useEffect(() => {
    if (!tornKey) return
    const t = setTimeout(() => {
      let m: Record<number, number> = {}
      try {
        const raw = localStorage.getItem(tornKey)
        if (raw) {
          const parsed: unknown = JSON.parse(raw)
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
              const i = Number(k)
              if (Number.isInteger(i) && i >= 0 && i < COUPON_MAX && typeof v === "number") m[i] = v
            }
          }
        }
      } catch {
        // localStorage rusak/diblokir → buklet mulai utuh, alur tetap jalan
      }
      if (!Object.keys(m).length) return
      const left = deck.length - Object.keys(m).length
      setTornMap(m)
      // Revisit: semua sudah diklaim → langsung kartu penutup;
      // sebagian → lewati seremoni sampul/segel, langsung ke deck.
      setBabak((b) => {
        if (b !== "sampul") return b
        if (left === 0) return "penutup"
        if (left > 0 && left < deck.length) {
          setSealStage(2)
          return "sobek"
        }
        return b
      })
    }, 0)
    return () => clearTimeout(t)
  }, [tornKey, deck])

  // ── Persist status sobek
  const persistTorn = useCallback(
    (next: Record<number, number>) => {
      if (!tornKey) return
      try {
        localStorage.setItem(tornKey, JSON.stringify(next))
      } catch {
        // penuh/diblokir — biarkan, pengalaman tidak bergantung penyimpanan
      }
    },
    [tornKey]
  )

  const remainingIdx = useMemo(
    () => deck.map((_, i) => i).filter((i) => tornMap[i] == null),
    [deck, tornMap]
  )
  const currentIdx = remainingIdx[0]
  const isLast = remainingIdx.length === 1
  const tornCount = deck.length - remainingIdx.length
  const threshold = isLast ? LAST_TEAR_THRESHOLD_PX : TEAR_THRESHOLD_PX

  // ── Real-time posisi tarikan sobekan — inti seluruh efek visual
  const x = useMotionValue(0)
  const controls = useAnimationControls()

  // ── Binding visual useTransform (semua turunan x, tanpa re-render)
  /** Tiket utama bergetar halus — makin jauh ditarik, makin tertekan. */
  const strainRotate = useTransform(x, (v) =>
    v <= 4 || tornIdx != null ? 0 : Math.sin(v * 0.5) * (v / threshold) * 1.3
  )
  /** Tepi gerigi badan makin jelas "retak" seiring tarikan. */
  const teethOpacity = useTransform(x, [0, threshold - 8], [0.4, 1])
  /** Garis putus-putus perforasi memudar saat kertas mulai terpisah. */
  const perforationOpacity = useTransform(x, [0, threshold - 24], [0.9, 0])
  /** Sobekan sedikit miring mengikuti tarikan. */
  const stubRotate = useTransform(x, [0, threshold], [0, 4])

  // ── The Tear — tiket terklaim
  const tear = useCallback(() => {
    if (tornIdx != null || currentIdx == null) return
    const idx = currentIdx
    const last = remainingIdx.length === 1
    const now = Date.now()

    const nextMap = { ...tornMap, [idx]: now }
    setTornMap(nextMap)
    persistTorn(nextMap)
    setTornIdx(idx)

    audio.slip()
    audio.rustle()
    later(() => audio.stamp(), 120)
    if (last) {
      buzz([15, 30, 15, 30, 60])
      fireFinalConfetti(!!reduceMotion)
      audio.swell()
      later(() => setBabak("penutup"), reduceMotion ? 250 : 1400)
    } else {
      buzz([15, 25])
      fireMiniConfetti(!!reduceMotion)
      // sobekan melayang jatuh + stamp → tiket berikutnya spring masuk
      controls.start({
        x: STUB_FLY.x,
        y: STUB_FLY.y,
        rotate: STUB_FLY.rotate,
        opacity: 0,
        transition: reduceMotion
          ? { duration: 0 }
          : { duration: 0.75, ease: "easeIn", opacity: { duration: 0.75, times: [0, 0.55, 1] } },
      })
      later(() => {
        setTornIdx(null)
        audio.pop(tornCount)
        x.set(0)
        controls.set({ x: 0, y: 0, rotate: 0, opacity: 1 })
      }, reduceMotion ? 200 : NEXT_DELAY_MS)
    }
  }, [
    tornIdx,
    currentIdx,
    remainingIdx.length,
    tornMap,
    tornCount,
    persistTorn,
    audio,
    buzz,
    later,
    controls,
    reduceMotion,
    x,
  ])

  // Sobek real-time: begitu x melampaui ambang — tak menunggu jari dilepas.
  useEffect(() => {
    const unsub = x.on("change", (v) => {
      if (tornIdx == null && v > threshold) tear()
    })
    return unsub
  }, [x, tear, tornIdx, threshold])

  // ── Drag handlers sobekan
  function handleDragEnd(_e: unknown, _info: PanInfo) {
    if (tornIdx != null) return
    if (x.get() > threshold) {
      tear()
    } else {
      // belum lewat ambang → sobekan "melawan" kembali seperti kertas elastis
      animate(x, 0, { type: "spring", stiffness: 420, damping: 32 })
    }
  }

  // Keyboard fallback — sobek bukan cuma jalan drag
  function handleStubKey(e: ReactKeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault()
      tear()
    }
  }

  // ── Babak 0 → 1: menyambut buklet (gesture pertama = unlock audio)
  const sambut = useCallback(() => {
    audio.unlock()
    audio.swell()
    buzz(12)
    if (reduceMotion) {
      // saluran instan: segel dianggap lepas — deck langsung siap
      setSealStage(2)
      setBabak("sobek")
      return
    }
    later(() => setBabak("segel"), 650)
  }, [audio, buzz, reduceMotion, later])

  // ── Babak 1 tahap 1: band longgar + derit kertas
  const stage1 = useCallback(() => {
    if (sealStage >= 1) return
    setSealStage(1)
    audio.slide()
    audio.rustle()
    buzz(15)
  }, [sealStage, audio, buzz])

  // ── Babak 1 tahap 2: SEGEL LEPAS → deck menyebar
  const untie = useCallback(() => {
    if (sealStage >= 2) return
    setSealStage(2)
    audio.slip()
    buzz([20, 40, 60])
    setLeaked(true)
    audio.chime(1)
    setShowLanjut(false)
    if (reduceMotion) {
      setBabak("sobek")
      return
    }
    later(() => setBabak("sobek"), 560)
  }, [sealStage, audio, buzz, reduceMotion, later])

  /** Jalan pintas (tombol Lanjutkan / keyboard): longgar → lepas terskrip. */
  const scriptedPull = useCallback(() => {
    stage1()
    later(untie, 420)
  }, [stage1, untie, later])

  // ── Babak 3: chime per baris pesan (bersamaan dengan reveal blur)
  const chimesRanRef = useRef(false)
  useEffect(() => {
    if (babak !== "penutup" || reduceMotion || chimesRanRef.current) return
    chimesRanRef.current = true
    lines.forEach((_, i) => later(() => audio.chime(i), 650 + i * 420))
  }, [babak, reduceMotion, lines, audio, later])

  // Fail-safe reduced-motion: tidak ada animasi yang "selesai" → timer
  useEffect(() => {
    if (babak !== "penutup" || !reduceMotion) return
    later(notifyOpenComplete, 400)
  }, [babak, reduceMotion, later, notifyOpenComplete])

  // Gerbang otomatis 1 — sampul tak disambut 8 dtk → masuk senyap
  useEffect(() => {
    if (babak !== "sampul") return
    const t = setTimeout(sambut, IDLE_SAMPUL_MS)
    return () => clearTimeout(t)
  }, [babak, sambut])

  // Gerbang otomatis 2 — segel tak ditarik 12 dtk → tawarkan Lanjutkan
  useEffect(() => {
    if (babak !== "segel" || sealStage >= 2) return
    const t = setTimeout(() => setShowLanjut(true), IDLE_SEGEL_MS)
    return () => clearTimeout(t)
  }, [babak, sealStage])

  // Gerbang otomatis 3 — sobek tak dirobek 20 dtk → tawarkan Klaim sekarang
  const [showKlaim, setShowKlaim] = useState(false)
  useEffect(() => {
    if (babak !== "sobek" || tornIdx != null) return
    const t = setTimeout(() => setShowKlaim(true), IDLE_SOBEK_MS)
    return () => clearTimeout(t)
  }, [babak, tornIdx])

  // ── Konten tiket (dipakai badan & sobekan)

  /** Badan tiket emas — konten = kupon aktif (atau yang baru disobek). */
  function ticketBody(idx: number, stamped: boolean) {
    const c = deck[idx]
    return (
      <div className="relative flex h-full flex-col p-4" style={{ paddingRight: 16 }}>
        <div className="flex items-center justify-between">
          <p className="text-[8px] font-bold uppercase tracking-[0.3em] text-amber-900/80">
            Kangenin·Love Coupon
          </p>
          <p className="text-[8px] font-semibold tabular-nums tracking-[0.18em] text-amber-900/60">
            No. {serialFor(`${targetName}|${idx}|${c.title}`)}
          </p>
        </div>

        <p className="font-hand mt-1.5 truncate text-2xl font-bold leading-tight text-amber-950">
          {c.title}
        </p>

        {c.desc && (
          <p className="mt-0.5 truncate text-[11px] italic text-amber-950/60">{c.desc}</p>
        )}

        <div className="flex-1" />

        <div className="mt-1.5 flex items-center justify-between border-t border-amber-900/15 pt-1.5 text-[10px]">
          <span className="font-semibold text-amber-950/85">
            untuk: {targetName} · tiket {idx + 1}/{deck.length}
          </span>
          <span className="flex items-center gap-1 text-amber-950/70">
            dari:
            <AnimatePresence mode="wait" initial={false}>
              {revealName ? (
                <motion.span
                  key="real"
                  initial={reduceMotion ? false : { opacity: 0, y: 5, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="font-bold text-rose-900"
                >
                  {revealName}
                </motion.span>
              ) : (
                <motion.span
                  key="masked"
                  exit={reduceMotion ? undefined : { opacity: 0, y: -5, filter: "blur(4px)" }}
                  transition={{ duration: 0.45 }}
                  className="font-bold text-amber-950/80"
                >
                  {senderDisplay}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </div>

        {/* flash saat diklaim */}
        {stamped && !reduceMotion && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-30 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.85, 0] }}
            transition={{ delay: 0.05, duration: 0.55, times: [0, 0.2, 1], ease: "easeOut" }}
          />
        )}

        {/* stempel DIKLAIM — menghantam dengan spring setelah sobek */}
        {stamped && (
          <motion.div
            key="stamp"
            initial={reduceMotion ? false : { scale: 2.4, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 0.94, rotate: -10 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 17, delay: 0.15 }}
            className="absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 rounded-lg border-[3px] border-rose-700/90 bg-white/25 px-4 py-1.5 font-black uppercase tracking-[0.2em] text-rose-800 shadow-lg backdrop-blur-[1px]"
            style={{ fontSize: 14 }}
          >
            ✔ Diklaim
            {tornMap[idx] ? (
              <span className="mt-0.5 block text-center text-[8px] font-semibold tracking-normal text-rose-800/80">
                {tanggalStempel(tornMap[idx])}
              </span>
            ) : null}
          </motion.div>
        )}
      </div>
    )
  }

  return (
    <section className="relative flex w-full flex-col items-center py-6 text-zinc-100">
      <ShimmerStyle />

      {/* tombol mute — selalu tersedia */}
      <button
        type="button"
        onClick={audio.toggleMuted}
        aria-label={audio.muted ? "Nyalakan suara" : "Bisukan suara"}
        className="absolute right-0 top-0 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-zinc-400 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-zinc-200"
      >
        {audio.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
      </button>

      {/* Header narasi per babak */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          🎟️ Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          {babak === "sampul" && "Ada buklet untukmu 🎫"}
          {babak === "segel" && "Segelnya diikat rapi 🎀"}
          {babak === "sobek" && "Sobek satu, klaim satu ✂️"}
          {babak === "penutup" && "Semua tiket punya pemiliknya 🤍"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          {babak === "sampul" && "Bukan bunga, bukan surat — mata uang resmi antara kamu & dia."}
          {babak === "segel" &&
            (sealStage >= 1 ? "Sedikit lagi — tarik terus ke kanan!" : "Tarik pita segelnya ke kanan, pelan-pelan.")}
          {babak === "sobek" &&
            (isLast
              ? "Ini yang terakhir — tiket emasnya ✨"
              : `${remainingIdx.length} tiket nunggu giliranmu.`)}
          {babak === "penutup" && "Satu pesan terakhir dari pengirimnya…"}
        </p>
      </header>

      {/* Panggung buklet */}
      <div className="relative mt-8" style={{ width: TICKET_W }}>
        {/* glow emas — menyala saat segel lepas / klaim */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: babak === "penutup" || tornIdx != null ? 1 : sealStage >= 2 ? 0.5 : 0 }}
          transition={{ duration: 0.6 }}
          className="pointer-events-none absolute -inset-8 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.30), rgba(244,63,94,0.12), transparent)",
          }}
        />

        <AnimatePresence initial={false} mode="popLayout">
          {babak === "sampul" || babak === "segel" ? (
            <motion.div
              key="cover"
              initial={reduceMotion ? false : { y: 90, opacity: 0, scale: 0.94 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 120, damping: 16 }}
              className="relative will-change-transform"
            >
              <BookletCover
                targetName={targetName}
                sender={senderDisplay}
                total={deck.length}
                sealStage={sealStage}
                reduceMotion={reduceMotion}
              />
              {babak === "segel" && sealStage < 2 && (
                <SealBand
                  sealStage={sealStage}
                  onGesture={audio.unlock}
                  onStage1={stage1}
                  onUntied={untie}
                  reduceMotion={reduceMotion}
                />
              )}
            </motion.div>
          ) : babak === "sobek" && currentIdx != null ? (
            <motion.div
              key="deck"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.45, ease: "easeOut" }}
              className="relative will-change-transform"
              style={{ width: TICKET_W, height: TICKET_H }}
            >
              {/* ghost stack — tiket di belakangnya (murah: statis) */}
              {remainingIdx.length > 1 && (
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-2xl border border-amber-200/25 bg-gradient-to-br from-amber-900/40 to-zinc-900/60"
                  style={{ transform: "rotate(-3deg) translateY(9px)" }}
                />
              )}
              {remainingIdx.length > 2 && (
                <div
                  aria-hidden
                  className="absolute inset-0 rounded-2xl border border-amber-200/20 bg-gradient-to-br from-amber-900/30 to-zinc-900/50"
                  style={{ transform: "rotate(2.5deg) translateY(18px)" }}
                />
              )}

              <AnimatePresence initial={false} mode="popLayout">
                {tornIdx == null ? (
                  /* TIKET AKTIF — badan + sobekan yang di-drag */
                  <motion.div
                    key={`a-${currentIdx}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 34, scale: 0.93 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 260, damping: 20 }}
                    className="relative will-change-transform"
                    style={{ width: TICKET_W, height: TICKET_H }}
                  >
                    {/* latar gelap di balik tiket — terlihat saat sobekan menganga */}
                    <div aria-hidden className="absolute inset-y-0 right-0 rounded-r-2xl bg-zinc-950" style={{ width: STUB_W }} />

                    {/* BADAN TIKET (porsi besar, kiri) */}
                    <motion.div
                      style={{ rotate: strainRotate, transformOrigin: "0% 50%" }}
                      className="absolute inset-y-0 left-0 z-10 overflow-hidden rounded-l-2xl rounded-r-md shadow-[0_26px_60px_-16px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/40 will-change-transform"
                    >
                      {/* kertas emas — tiket terakhir full gold-foil */}
                      <div
                        className={`absolute inset-0 ${INK}`}
                        style={{
                          background: isLast
                            ? GOLD_FOIL
                            : "linear-gradient(135deg, #f6d787 0%, #e3b34f 28%, #c98f2a 52%, #e8c06a 78%, #f9e6a8 100%)",
                        }}
                      />
                      {/* lapisan holografik */}
                      <div
                        aria-hidden
                        className="absolute inset-0 mix-blend-soft-light"
                        style={{
                          background:
                            "linear-gradient(115deg, rgba(255,64,129,0.35), rgba(56,189,248,0.4) 30%, rgba(250,204,21,0.45) 52%, rgba(168,85,247,0.35) 78%, rgba(255,255,255,0.3))",
                        }}
                      />
                      {/* sheen/shimmer menyapu (CSS infinite) */}
                      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="coupon-shimmer absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                      </div>

                      {ticketBody(currentIdx, false)}

                      {/* tepi gerigi badan — makin jelas "retak" saat ditarik */}
                      <motion.div aria-hidden className="absolute inset-y-0 right-0 z-10" style={{ opacity: teethOpacity }}>
                        <TearTeeth height={TICKET_H} opacity={1} />
                      </motion.div>
                    </motion.div>

                    {/* Perforasi — garis putus-putus bergerigi di batas robekan */}
                    <motion.div className="absolute inset-0 z-30" style={{ opacity: perforationOpacity, pointerEvents: "none" }}>
                      <PerforationLine opacity={1} />
                    </motion.div>

                    {/* SOBEKAN (potongan kecil, kanan) — di-drag ke kanan untuk klaim */}
                    <motion.button
                      type="button"
                      aria-label="Tarik potongan kanan untuk mengklaim kupon"
                      drag="x"
                      dragConstraints={{ left: 0 }}
                      dragMomentum={false}
                      dragElastic={0.08}
                      onDragEnd={handleDragEnd}
                      onKeyDown={handleStubKey}
                      style={{ x, rotate: stubRotate, width: STUB_W }}
                      className="absolute inset-y-0 right-0 z-20 flex touch-none select-none items-center justify-center rounded-r-2xl shadow-[0_26px_60px_-16px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/40 will-change-transform active:cursor-grabbing"
                    >
                      <div
                        className={`absolute inset-0 rounded-r-2xl ${INK}`}
                        style={{
                          background: isLast
                            ? "linear-gradient(150deg, #f9e6a8, #e8c06a 45%, #c98f2a)"
                            : "linear-gradient(150deg, #e8bd55, #c8922e 45%, #b37f1f)",
                        }}
                      />
                      <div
                        aria-hidden
                        className="absolute inset-0 rounded-r-2xl mix-blend-soft-light"
                        style={{
                          background:
                            "linear-gradient(200deg, rgba(56,189,248,0.4), rgba(250,204,21,0.45) 45%, rgba(255,64,129,0.35))",
                        }}
                      />
                      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-r-2xl">
                        <div className="coupon-shimmer absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/40 to-transparent" style={{ animationDelay: "1.6s" }} />
                      </div>
                      <span aria-hidden className="absolute inset-y-0 left-0 w-1.5 rounded-l-sm bg-gradient-to-r from-black/25 to-transparent" />

                      <div className={`relative flex flex-col items-center gap-2 px-2 text-center ${INK}`}>
                        <span aria-hidden className="text-base">✂️</span>
                        <span className="text-[11px] font-black uppercase leading-relaxed tracking-[0.14em]">
                          Tarik<br />untuk<br />Klaim
                        </span>
                        <motion.span
                          aria-hidden
                          animate={reduceMotion ? undefined : { x: [0, 5, 0] }}
                          transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
                          className="text-sm font-bold"
                        >
                          ➜
                        </motion.span>
                      </div>
                    </motion.button>
                  </motion.div>
                ) : (
                  /* TIKET BARU DIROBEK — stempel menghantam + sobekan terbang */
                  <motion.div
                    key={`t-${tornIdx}`}
                    initial={false}
                    exit={reduceMotion ? undefined : { opacity: 0, y: 26, transition: { duration: 0.3 } }}
                    className="relative will-change-transform"
                    style={{ width: TICKET_W, height: TICKET_H }}
                  >
                    <div aria-hidden className="absolute inset-y-0 right-0 rounded-r-2xl bg-zinc-950" style={{ width: STUB_W }} />

                    <motion.div
                      style={{ transformOrigin: "0% 50%" }}
                      className="absolute inset-y-0 left-0 z-10 overflow-hidden rounded-l-2xl rounded-r-md shadow-[0_26px_60px_-16px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/40"
                    >
                      <div
                        className={`absolute inset-0 ${INK}`}
                        style={{
                          background:
                            "linear-gradient(135deg, #e8c06a 0%, #c98f2a 45%, #b37f1f 75%, #d8ab52 100%)",
                        }}
                      />
                      {ticketBody(tornIdx, true)}
                    </motion.div>

                    {/* sobekan terpental jatuh (x:210, y:320, rotate:48) lalu memudar */}
                    <motion.button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      animate={controls}
                      initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
                      style={{ width: STUB_W }}
                      className="absolute inset-y-0 right-0 z-20 flex items-center justify-center rounded-r-2xl shadow-[0_26px_60px_-16px_rgba(0,0,0,0.8)] ring-1 ring-amber-200/40"
                    >
                      <div
                        className={`absolute inset-0 rounded-r-2xl ${INK}`}
                        style={{ background: "linear-gradient(150deg, #e8bd55, #c8922e 45%, #b37f1f)" }}
                      />
                      <span className={`relative text-[10px] font-black uppercase tracking-[0.1em] ${INK}`}>✂️</span>
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.span key="kosong" />
          )}
        </AnimatePresence>
      </div>

      {/* area aksi/hint di bawah panggung — tinggi tetap anti-lompat layout */}
      <div className="mt-6 flex min-h-[88px] w-full flex-col items-center justify-start gap-2">
        <AnimatePresence mode="wait">
          {babak === "sampul" ? (
            <motion.button
              key="sambut"
              type="button"
              onClick={sambut}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-full border border-amber-200/40 bg-gradient-to-r from-amber-300/90 to-amber-500/90 px-6 py-2.5 text-sm font-bold text-amber-950 shadow-[0_0_30px_-6px_rgba(251,191,36,0.6)] transition-transform active:scale-95"
            >
              Buka bukletnya 🤲
            </motion.button>
          ) : babak === "segel" && showLanjut ? (
            <motion.button
              key="lanjut"
              type="button"
              onClick={scriptedPull}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold text-zinc-200 backdrop-blur-md"
            >
              Lanjutkan ⏭
            </motion.button>
          ) : babak === "segel" ? (
            <motion.p
              key="hint-segel"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-zinc-500"
            >
              {sealStage >= 1 ? "dikit lagi… tarik terus ke kanan 🤫" : "psst… tarik pita segelnya ke kanan 🤫"}
            </motion.p>
          ) : babak === "sobek" && showKlaim && tornIdx == null ? (
            <motion.button
              key="klaim"
              type="button"
              onClick={tear}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs font-semibold text-zinc-200 backdrop-blur-md"
            >
              Klaim sekarang ✂️
            </motion.button>
          ) : babak === "sobek" ? (
            <motion.p
              key="hint-sobek"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="text-xs text-zinc-500"
            >
              psst… tarik sobekannya ke kanan sampai lepas 🤫
            </motion.p>
          ) : (
            <span key="kosong" />
          )}
        </AnimatePresence>

        {/* progres buklet */}
        {babak === "sobek" && tornCount > 0 && (
          <p className="text-[11px] font-medium text-amber-200/80">
            {tornCount} dari {deck.length} sudah diklaim ✔
          </p>
        )}
        {babak === "sobek" && tornCount === 0 && (
          <p className="text-[11px] text-zinc-600">klaimnya resmi — berlaku selamanya, nggak bisa ditukar</p>
        )}
      </div>

      {/* Babak 3 — kartu penutup emas */}
      <AnimatePresence>
        {babak === "penutup" && (
          <motion.div
            key="card"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="mt-6 w-full"
          >
            <ClosingCard
              lines={lines}
              senderDisplay={senderDisplay}
              revealName={revealName}
              tanggal={tanggal}
              reduceMotion={reduceMotion}
              onEntered={notifyOpenComplete}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

/** Kartu penutup — naik dari bawah, baris blur → tajam (chime dari parent). */
function ClosingCard({
  lines,
  senderDisplay,
  revealName,
  tanggal,
  reduceMotion,
  onEntered,
}: {
  lines: string[]
  senderDisplay: string
  revealName: string | null
  tanggal: string
  reduceMotion: boolean
  onEntered: () => void
}) {
  return (
    <motion.div
      initial={reduceMotion ? false : { y: 70, opacity: 0, scale: 0.94 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 170, damping: 20, delay: 0.2 }}
      onAnimationComplete={onEntered}
      className="mx-auto w-full max-w-xs will-change-transform"
    >
      <div
        className="rounded-[20px] p-[2px] shadow-[0_24px_70px_-18px_rgba(180,120,40,0.5)]"
        style={{ background: GOLD_FOIL }}
      >
        <div className="relative overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-br from-zinc-900/95 to-zinc-950/95 p-5 backdrop-blur-md">
          <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: PAPER_TEXTURE }} />
          <p className="relative text-center text-[10px] font-semibold uppercase tracking-[0.3em] text-zinc-500">
            Kartu dari buklet kupon
          </p>

          <div className="relative mt-3 space-y-2.5">
            {lines.map((line, i) => (
              <motion.p
                key={i}
                initial={reduceMotion ? false : { opacity: 0, filter: "blur(9px)", y: 6 }}
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                transition={
                  reduceMotion ? { duration: 0 } : { duration: 0.55, delay: 0.55 + i * 0.42, ease: "easeOut" }
                }
                className="font-hand whitespace-pre-wrap text-lg leading-relaxed text-zinc-100"
              >
                {line}
              </motion.p>
            ))}
          </div>

          <p className="relative mt-4 text-center text-[11px] italic text-amber-200/80">
            kuponnya berlaku selamanya — nggak bisa ditukar, nggak bisa dibatalkan 🤍
          </p>

          <div className="relative mt-4 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />

          <div className="relative mt-3 flex items-center justify-end gap-2 text-sm">
            <span className="text-zinc-500">Dari:</span>
            <AnimatePresence mode="wait" initial={false}>
              {revealName ? (
                <motion.span
                  key="real"
                  initial={reduceMotion ? false : { opacity: 0, y: 8, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="font-semibold text-rose-200 drop-shadow-[0_0_12px_rgba(244,63,94,0.6)]"
                >
                  {revealName}
                </motion.span>
              ) : (
                <motion.span
                  key="masked"
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8, filter: "blur(6px)" }}
                  transition={{ duration: 0.5 }}
                  className="font-semibold text-rose-300/70 drop-shadow-[0_0_8px_rgba(244,63,94,0.35)]"
                >
                  {senderDisplay}
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {tanggal && (
            <p className="relative mt-2 text-right text-[10px] italic text-zinc-500">
              diikat tangan, {tanggal}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}
