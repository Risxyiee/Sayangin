"use client"

/**
 * PremiumPhotobox — kado "Photobox Digital": polaroid vintage yang harus
 * "dicuci" dengan menggoyangkan HP (atau diusap layar).
 *
 * State machine 4 fase:
 *   printing   — saat mount, polaroid meluncur keluar dari slot mesin
 *                photobox di atas panggung lalu berhenti di tengah layar.
 *   blank      — kanvas foto masih abu-abu gelap (film kosong). Muncul teks
 *                kedap-kedip "Goyangkan HP untuk mencuci foto…" + fallback
 *                "Atau usap layar ini…". Di iOS 13+ sensor gerak butuh izin
 *                eksplisit → tombol glassmorphism "Izinkan Sensor Gerak".
 *   developing — DeviceMotionEvent (devicemotion) mengakumulasi akselerasi
 *                goyangan; fallback onPan Framer Motion mengakumulasi jarak
 *                usapan. Keduanya mengisi progress yang sama (0→100%).
 *                Semakin penuh, bayangan foto mulai "muncul" (ghost preview).
 *   developed  — progress 100% → konten foto transisi perlahan
 *                opacity 0→1, grayscale(100%) blur(10px) → 0. Lalu kilatan
 *                flash kamera + polaroid miring -3deg. onOpenComplete()
 *                dipanggil setelah transisi selesai — parent lanjut dilemma.
 *
 * Sensor & izin (kritis iOS 13+):
 * - `DeviceMotionEvent.requestPermission()` HARUS dipanggil dari gesture
 *   handler (klik tombol) — bukan otomatis. Tanpa izin, devicemotion diam.
 * - Desktop/experimental browser yang mengekspos DeviceMotionEvent tanpa
 *   pernah mem-fire event: setelah 3,5 dtk hening → hint berubah menekankan
 *   usapan, jadi user tidak pernah buntu.
 * - Listener selalu di-cleanup saat unmount & saat fase developed tercapai.
 *
 * Performa mobile 60FPS:
 * - Animasi hanya transform/opacity/filter; elemen utama diberi
 *   will-change-transform (polaroid, konten foto).
 * - Update progress di-throttle ke perubahan persen bulat (bukan tiap event
 *   sensor 60Hz).
 * - Semua efek menghormati prefers-reduced-motion (instant / tanpa blink).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from "framer-motion"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe publik
// ─────────────────────────────────────────────────────────────────────────────

export interface PremiumPhotoboxProps {
  /** Nama penerima — tampil di badge header & caption polaroid. */
  targetName: string
  /** Pesan pengirim — tercetak di foto vintage setelah dicuci. */
  message: string
  /** Inisial bertopeng pengirim ("R***I") — null → "Seseorang". */
  fomoInitials: string | null
  /** Nama asli pengirim saat jawaban diterima — null = masih bertopeng. */
  revealName?: string | null
  /** URL foto kustom (kadoData.imageUrl) — kalau ada, foto = gambar, bukan teks. */
  imageUrl?: string | null
  /** Dipanggil SEKALI setelah foto selesai tercuci (transisi develop selesai). */
  onOpenComplete: () => void
}

type PhotoPhase = "printing" | "blank" | "developing" | "developed"
type SensorState = "idle" | "granted" | "denied"
type HintMode = "shake" | "swipe"

// ─────────────────────────────────────────────────────────────────────────────
// Konstanta
// ─────────────────────────────────────────────────────────────────────────────

/** Geometri panggung (px) — fix biar mesin & polaroid presisi. */
const STAGE_W = 340
const LIP_H = 88 // mesin photobox di atas panggung
const GAP = 18 // jarak mulut slot → puncak polaroid
const FRAME_W = 272 // lebar bingkai polaroid (canvas 248 + padding 24)
const CANVAS_H = 248 // tinggi kanvas foto (rasio ~square khas polaroid)
const POLAROID_H = 12 + CANVAS_H + 8 + 34 + 12 // p-3 + canvas + caption + p-3
const STAGE_H = LIP_H + GAP + POLAROID_H + 26
const PRINT_TRAVEL = POLAROID_H + 130 // posisi awal: seluruhnya di atas stage (ter-clip)

/** Target akumulasi — goyangan (m/s² berlebih) & usapan (px total). */
const SHAKE_TARGET_EXCESS = 150
const SWIPE_TARGET_PX = 2200
/** Ambang mikro: gerakan di bawah ini diabaikan (getar tangan/denormal). */
const SHAKE_DEAD_ZONE = 1.4
/** Batas kontribusi per event biar satu spike tak langsung 100%. */
const SHAKE_PER_EVENT_CAP = 30
/** Tanpa event sensor dalam waktu ini → hint berpindah ke usapan. */
const SENSOR_SILENCE_MS = 3500

/** Filter film kosong → tercuci (spesifikasi). */
const FILTER_BLANK = "grayscale(100%) blur(10px)"
const FILTER_DEVELOPED = "grayscale(0%) blur(0px)"

// ─────────────────────────────────────────────────────────────────────────────
// Util kecil
// ─────────────────────────────────────────────────────────────────────────────

function buzz(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms)
}

/** iOS 13+ butuh izin eksplisit — terdeteksi dari ada taknya requestPermission. */
function detectNeedsPermission(): boolean {
  if (typeof window === "undefined") return false
  const dme = (window as unknown as { DeviceMotionEvent?: { requestPermission?: unknown } })
    .DeviceMotionEvent
  return typeof dme?.requestPermission === "function"
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-komponen kecil
// ─────────────────────────────────────────────────────────────────────────────

/** Mesin photobox vintage di atas panggung — polaroid keluar dari slotnya. */
function CameraLip() {
  return (
    <div
      aria-hidden
      className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-b-[20px] rounded-t-[14px] border border-white/10 shadow-2xl shadow-black/60"
      style={{
        width: 300,
        height: LIP_H,
        background: "linear-gradient(180deg, #2a2724, #1c1a18 55%, #141312)",
      }}
    >
      {/* lensa kecil */}
      <span className="absolute left-1/2 top-3 h-8 w-8 -translate-x-1/2 rounded-full border-[3px] border-zinc-950 bg-[radial-gradient(circle_at_35%_30%,#3b5a6b,#101b22_60%,#05090c)] shadow-[inset_0_0_8px_rgba(0,0,0,0.8)]">
        <span className="absolute left-[5px] top-[5px] h-1.5 w-1.5 rounded-full bg-white/25" />
      </span>
      {/* strip pelangi khas photobooth */}
      <span className="absolute left-5 top-[52px] h-1 w-[calc(100%-40px)] rounded-full bg-gradient-to-r from-rose-400/70 via-amber-300/70 to-emerald-400/70" />
      {/* label mesin */}
      <span className="absolute left-1/2 top-[66px] -translate-x-1/2 text-[8px] font-bold tracking-[0.34em] text-zinc-500">
        KANGERIN·KAM400
      </span>
      {/* slot keluaran foto */}
      <span className="absolute bottom-1.5 left-1/2 h-[9px] w-44 -translate-x-1/2 rounded-full bg-black shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]" />
      <span className="absolute bottom-[7px] left-1/2 h-px w-40 -translate-x-1/2 rounded-full bg-amber-200/10" />
    </div>
  )
}

/** Konten foto bergaya vintage — pesan + identitas di atas kertas tua. */
function VintageTextPhoto({
  targetName,
  message,
  fomoInitials,
  revealName,
  reduceMotion,
}: {
  targetName: string
  message: string
  fomoInitials: string | null
  revealName: string | null
  reduceMotion: boolean
}) {
  return (
    <div
      className="flex h-full w-full flex-col p-4"
      style={{ background: "linear-gradient(170deg, #f0e5cb, #e7d6b2 62%, #dcc79c)" }}
    >
      <p className="text-[9px] font-semibold uppercase tracking-[0.28em] text-[#8a7a5e]">
        Untuk {targetName}
      </p>
      <p className="font-hand mt-2 flex-1 overflow-y-auto overscroll-contain whitespace-pre-wrap text-[15px] leading-relaxed text-[#3f3428]">
        {message}
      </p>

      <div className="h-px bg-[#3f3428]/15" />

      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs">
        <span className="text-[#8a7a5e]">Dari:</span>
        <AnimatePresence mode="wait" initial={false}>
          {revealName ? (
            <motion.span
              key="real"
              initial={reduceMotion ? false : { opacity: 0, y: 6, filter: "blur(5px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="font-semibold text-rose-700 drop-shadow-[0_0_8px_rgba(190,24,93,0.3)]"
            >
              {revealName}
            </motion.span>
          ) : (
            <motion.span
              key="masked"
              exit={reduceMotion ? undefined : { opacity: 0, y: -6, filter: "blur(5px)" }}
              transition={{ duration: 0.45 }}
              className="font-semibold text-[#a3452f]/90"
            >
              {fomoInitials ?? "Seseorang"}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Komponen utama
// ─────────────────────────────────────────────────────────────────────────────

export default function PremiumPhotobox({
  targetName,
  message,
  fomoInitials,
  revealName = null,
  imageUrl = null,
  onOpenComplete,
}: PremiumPhotoboxProps) {
  const [phase, setPhase] = useState<PhotoPhase>("printing")
  const [progress, setProgress] = useState(0)
  const [needsPermission, setNeedsPermission] = useState(false)
  const [sensorState, setSensorState] = useState<SensorState>("idle")
  const [sensorPending, setSensorPending] = useState(false)
  const [hintMode, setHintMode] = useState<HintMode>("shake")
  const [imgFailed, setImgFailed] = useState(false)

  const reduceMotion = useReducedMotion()

  // Akumulasi mentah disimpan di ref; state hanya di-update tiap perubahan
  // persen bulat (throttle, bukan tiap event sensor 60Hz).
  const rawRef = useRef(0)
  const shownPctRef = useRef(0)
  const sensorLiveRef = useRef(false)
  const panLastRef = useRef<{ x: number; y: number } | null>(null)

  // onOpenComplete dijamin cuma sekali
  const firedRef = useRef(false)
  const notifyOpenComplete = useCallback(() => {
    if (firedRef.current) return
    firedRef.current = true
    onOpenComplete()
  }, [onOpenComplete])

  // ── Deteksi kebutuhan izin sensor (client-only, hindari hydration mismatch)
  useEffect(() => {
    setNeedsPermission(detectNeedsPermission())
  }, [])

  // ── Fase printing → blank (fallback timer; onAnimationComplete juga ada)
  useEffect(() => {
    if (phase !== "printing") return
    const t = setTimeout(() => setPhase((p) => (p === "printing" ? "blank" : p)), reduceMotion ? 250 : 1400)
    return () => clearTimeout(t)
  }, [phase, reduceMotion])

  // ── Fase developed → onOpenComplete (fallback timer + onAnimationComplete)
  useEffect(() => {
    if (phase !== "developed") return
    const t = setTimeout(notifyOpenComplete, reduceMotion ? 300 : 1500)
    return () => clearTimeout(t)
  }, [phase, reduceMotion, notifyOpenComplete])

  const develop = useCallback(() => {
    setPhase((p) => {
      if (p === "developed") return p
      buzz(20) // kilatan "kamera" — getar halus, diabaikan browser tanpa dukungan
      return "developed"
    })
  }, [])

  const addProgress = useCallback(
    (delta: number) => {
      rawRef.current = Math.min(1, rawRef.current + delta)
      const pct = Math.round(rawRef.current * 100)
      if (pct === shownPctRef.current) return
      shownPctRef.current = pct
      setProgress(rawRef.current)
      if (rawRef.current >= 1) develop()
    },
    [develop]
  )

  // ── Sensor gerak (devicemotion) — aktif di fase blank/developing, dan hanya
  //    kalau tidak butuh izin (langsung listen) atau izin sudah granted.
  const listening =
    (phase === "blank" || phase === "developing") &&
    (sensorState === "granted" || (sensorState === "idle" && !needsPermission))

  useEffect(() => {
    if (!listening) return

    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity ?? e.acceleration
      if (!a || a.x == null || a.y == null || a.z == null) return
      if (!sensorLiveRef.current) {
        sensorLiveRef.current = true
        setHintMode("shake") // sensor benar-benar hidup → teks utama goyangan
      }
      const magnitude = Math.hypot(a.x, a.y, a.z)
      const base = e.accelerationIncludingGravity ? 9.81 : 0 // kompensasi gravitasi
      const excess = Math.abs(magnitude - base)
      if (excess < SHAKE_DEAD_ZONE) return
      addProgress(Math.min(SHAKE_PER_EVENT_CAP, excess) / SHAKE_TARGET_EXCESS)
    }

    window.addEventListener("devicemotion", onMotion)
    // Browser desktop/experimental: sensor "ada" tapi tak pernah fire →
    // setelah hening, arahkan user ke fallback usap biar tak buntu.
    const silent = setTimeout(() => {
      if (!sensorLiveRef.current) setHintMode("swipe")
    }, SENSOR_SILENCE_MS)

    return () => {
      window.removeEventListener("devicemotion", onMotion)
      clearTimeout(silent)
    }
  }, [listening, addProgress])

  // ── Fallback usap (onPan Framer Motion) — akumulasi jarak antar event pan.
  function handlePanStart(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    panLastRef.current = { x: info.offset.x, y: info.offset.y }
  }
  function handlePan(_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (phase !== "blank" && phase !== "developing") return
    const last = panLastRef.current
    panLastRef.current = { x: info.offset.x, y: info.offset.y }
    if (!last) return
    const d = Math.hypot(info.offset.x - last.x, info.offset.y - last.y)
    if (d < 2) return // abaikan mikro-geseran biar tak kosong progresnya
    addProgress(d / SWIPE_TARGET_PX)
  }
  function handlePanEnd() {
    panLastRef.current = null
  }

  // ── Izin sensor iOS 13+ — HARUS dipanggil dari gesture handler (klik).
  async function requestSensor() {
    if (sensorPending) return
    setSensorPending(true)
    try {
      const dme = (window as unknown as {
        DeviceMotionEvent?: { requestPermission?: () => Promise<string> }
      }).DeviceMotionEvent
      const res = await dme?.requestPermission?.()
      setSensorState(res === "granted" ? "granted" : "denied")
    } catch {
      setSensorState("denied")
    } finally {
      setSensorPending(false)
    }
  }

  // Kalau izin ditolak → hint langsung menekankan usapan.
  useEffect(() => {
    if (sensorState === "denied") setHintMode("swipe")
  }, [sensorState])

  const printing = phase === "printing"
  const developed = phase === "developed"
  const showHints = phase === "blank" || phase === "developing"
  const percent = Math.round(progress * 100)

  const primaryHint =
    hintMode === "swipe"
      ? "Usap layar ini untuk mencuci foto… 👆"
      : progress > 0.03
        ? "Itu dia… fotonya mulai muncul! 🔥"
        : "Goyangkan HP untuk mencuci foto… 📸"

  return (
    <section className="flex w-full flex-col items-center py-6 text-zinc-100">
      {/* Header */}
      <header className="text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-400/10 px-3.5 py-1.5 text-xs text-amber-200">
          📸 Kado untuk <b className="font-semibold">{targetName}</b>
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-white">
          Sebuah foto keluar dari mesin…
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Filmnya masih kosong — bantu cuci fotonya dulu ya.
        </p>
      </header>

      {/* Panggung: mesin photobox di atas, polaroid meluncur keluar dari slot */}
      <div className="relative mt-2 overflow-hidden" style={{ width: STAGE_W, height: STAGE_H }}>
        {/* glow hangat saat foto tercuci — opacity saja */}
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: developed ? 1 : 0 }}
          transition={{ duration: 0.8, delay: developed ? 0.6 : 0 }}
          className="pointer-events-none absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(251,191,36,0.20), rgba(244,63,94,0.10), transparent)",
          }}
        />

        {/* Polaroid — luncur keluar dari slot saat printing */}
        <motion.div
          className="absolute left-1/2 z-10 will-change-transform"
          style={{ top: LIP_H + GAP, marginLeft: -FRAME_W / 2, width: FRAME_W }}
          initial={reduceMotion ? false : { y: -PRINT_TRAVEL }}
          animate={{ y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
          onAnimationComplete={() => setPhase((p) => (p === "printing" ? "blank" : p))}
        >
          {/* miring -3deg + kilau pop saat tercuci */}
          <motion.div
            onPanStart={handlePanStart}
            onPan={handlePan}
            onPanEnd={handlePanEnd}
            animate={developed ? { rotate: -3, scale: 1.02 } : { rotate: 0, scale: 1 }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : developed
                  ? { delay: 0.7, type: "spring", stiffness: 180, damping: 15 }
                  : { duration: 0.2 }
            }
            className="will-change-transform"
            style={{
              cursor: printing || developed ? "default" : "grab",
              touchAction: "pan-y", // usap horizontal → pan; scroll vertikal tetap hidup
            }}
          >
            {/* bingkai polaroid: putih tipis di atas/samping, tebal di bawah */}
            <div className="rounded-[6px] bg-[#f4f1e8] p-3 ring-1 ring-black/5 shadow-[0_30px_70px_-18px_rgba(0,0,0,0.75)]">
              {/* kanvas foto */}
              <div
                className="relative overflow-hidden rounded-[2px]"
                style={{ width: "100%", height: CANVAS_H }}
              >
                {/* film kosong — abu-abu gelap */}
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(150deg, #56534e, #403e3a 45%, #2e2c29)",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-40"
                  style={{
                    background:
                      "linear-gradient(115deg, transparent 25%, rgba(255,255,255,0.09) 45%, transparent 60%)",
                  }}
                />

                {/* konten tercuci — transisi opacity + grayscale + blur */}
                <motion.div
                  className="absolute inset-0 will-change-[opacity,filter]"
                  initial={{ opacity: 0, filter: FILTER_BLANK }}
                  animate={
                    developed
                      ? { opacity: 1, filter: FILTER_DEVELOPED }
                      : { opacity: progress * 0.35, filter: FILTER_BLANK }
                  }
                  transition={developed ? { duration: reduceMotion ? 0 : 1.05, ease: "easeOut" } : { duration: 0.2 }}
                  onAnimationComplete={() => {
                    if (phase === "developed") notifyOpenComplete()
                  }}
                >
                  {imageUrl && !imgFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={imageUrl}
                      alt={`Foto kado untuk ${targetName}`}
                      className="h-full w-full object-cover"
                      draggable={false}
                      onError={() => setImgFailed(true)}
                    />
                  ) : (
                    <VintageTextPhoto
                      targetName={targetName}
                      message={message}
                      fomoInitials={fomoInitials}
                      revealName={revealName}
                      reduceMotion={!!reduceMotion}
                    />
                  )}
                  {/* vignette vintage di atas konten */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ boxShadow: "inset 0 0 46px rgba(50,32,14,0.32)" }}
                  />
                </motion.div>
              </div>

              {/* border bawah tebal — area caption khas polaroid */}
              <div className="mt-2 flex items-end justify-between px-1" style={{ height: 34 }}>
                <p className="font-hand text-lg leading-none text-zinc-600">
                  untuk {targetName} 🤍
                </p>
                <p className="text-[9px] font-bold tracking-[0.18em] text-zinc-400">
                  KANGENIN·400
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        <CameraLip />

        {/* kilatan flash kamera saat tercuci — sekali jalan */}
        {developed && !reduceMotion && (
          <motion.div
            key="flash"
            aria-hidden
            className="pointer-events-none absolute inset-0 z-40 bg-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.95, 0] }}
            transition={{ delay: 0.7, duration: 0.55, times: [0, 0.18, 1], ease: "easeOut" }}
          />
        )}
      </div>

      {/* Teks bantuan + izin sensor + progress pencucian */}
      <AnimatePresence>
        {showHints && (
          <motion.div
            key="hints"
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="mt-5 w-full text-center will-change-transform"
          >
            {needsPermission && sensorState === "idle" ? (
              <>
                <button
                  type="button"
                  onClick={requestSensor}
                  disabled={sensorPending}
                  className="mx-auto flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 shadow-lg shadow-black/30 backdrop-blur-md transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  {sensorPending ? "Meminta izin…" : "📳 Izinkan Sensor Gerak"}
                </button>
                <p className="mt-2.5 text-xs text-zinc-500">
                  Butuh izin buat deteksi goyangan — atau{" "}
                  <span className="text-zinc-400">usap layar ini… 👆</span>
                </p>
              </>
            ) : (
              <>
                <motion.p
                  animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 0.3, 1] }}
                  transition={
                    reduceMotion ? undefined : { duration: 1.15, repeat: Infinity, ease: "easeInOut" }
                  }
                  className="text-sm font-medium text-zinc-300"
                >
                  {primaryHint}
                </motion.p>
                {hintMode === "shake" && (
                  <p className="mt-1.5 text-xs text-zinc-500">Atau usap layar ini… 👆</p>
                )}
                {hintMode === "swipe" && (
                  <p className="mt-1.5 text-xs text-zinc-600">
                    Sensor gerak nggak aktif di perangkat ini — usap aja layarnya.
                  </p>
                )}
              </>
            )}

            {/* progress pencucian */}
            <div className="mx-auto mt-4 h-1 w-44 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-300 to-rose-400 transition-[width] duration-200"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-[10px] tabular-nums tracking-widest text-zinc-600">
              {percent}% TERCIUCI
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
