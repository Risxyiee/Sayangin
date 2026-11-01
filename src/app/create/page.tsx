"use client"

/**
 * Creator Studio Kangenin — halaman /create
 *
 * Wizard 3 langkah untuk merangkai kado kejutan:
 *   1. Pesan & identitas FOMO (anonim total default, inisial bertopeng "R***I")
 *   2. Pilih kunci buka (fingerprint / tap / scratch / quiz)
 *   3. Ringkasan + Generate Link Kado → POST /api/kado → redirect /kado/[id]/share
 *
 * Catatan integrasi:
 * - Identitas FOMO diproses lewat buildFomoIdentity() dari @/utils/fomoLogic,
 *   helper yang sama yang dipakai API → payload selalu konsisten dengan model Kado.
 * - fomoInitials dihitung ulang di SERVER — klien cuma kirim senderName + isAnonymous.
 */

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Camera,
  Check,
  EyeOff,
  Fingerprint,
  Flower2,
  Loader2,
  LockKeyhole,
  Mail,
  MousePointerClick,
  ScanLine,
  Stamp,
  Ticket,
  UserRound,
  Wand2,
  type LucideIcon,
} from "lucide-react"
import { buildFomoIdentity, toFomoInitials } from "@/utils/fomoLogic"

// ─────────────────────────────────────────────────────────────────────────────
// Tipe & konstanta
// ─────────────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3
type KadoType = "fingerprint" | "tap" | "scratch" | "quiz" | "bouquet" | "openwhen" | "photobox" | "coupon"

/** Payload yang dikirim Creator Studio ke POST /api/kado. */
interface KadoCreatePayload {
  targetName: string
  message: string
  /** null = anonim total — fomoInitials dihitung ulang di server. */
  senderName: string | null
  isAnonymous: boolean
  kadoType: KadoType
  kadoData: Record<string, string | number> | null
}

/** Bentuk respons POST /api/kado. */
type KadoApiResponse = { success?: boolean; data?: { id?: string }; error?: string }

const KADO_OPTIONS: { value: KadoType; label: string; desc: string; icon: LucideIcon }[] = [
  { value: "fingerprint", label: "Sidik Jari", desc: "Tahan layar 3 detik", icon: Fingerprint },
  { value: "tap", label: "Tap Layar", desc: "Ketuk berkali-kali", icon: MousePointerClick },
  { value: "scratch", label: "Kartu Gosok", desc: "Gosok buat mengintip", icon: ScanLine },
  { value: "quiz", label: "Kuis", desc: "Jawab dulu, baru buka", icon: BrainCircuit },
  { value: "bouquet", label: "Buket Bunga", desc: "Tarik pita, bunga mekar", icon: Flower2 },
  { value: "openwhen", label: "Open When", desc: "Segel lilin surat kangen", icon: Stamp },
  { value: "photobox", label: "Photobox", desc: "Goyang HP buat cuci foto", icon: Camera },
  { value: "coupon", label: "Love Coupon", desc: "Sobek tiket buat klaim", icon: Ticket },
]

/** Konfigurasi default per kadoType — quiz diisi sendiri oleh pembuat kado. */
const DEFAULT_KADO_DATA: Record<KadoType, Record<string, string | number> | null> = {
  fingerprint: { holdMs: 3000 },
  tap: { taps: 5 },
  scratch: { coverText: "Gosok pelan-pelan ✨" },
  quiz: null,
  bouquet: null, // interaksinya bawaan PremiumBouquet (pita emas)
  openwhen: null, // interaksinya bawaan PremiumOpenWhen (judul & prompt default)
  photobox: null, // foto teks vintage bawaan PremiumPhotobox (kadoData.imageUrl opsional)
  coupon: { title: "1x Bebas Ngambek" }, // judul kupon — bisa diganti via kadoData.title
}

/** Kelas input bersama biar semua field seragam & elegan. */
const inputCls =
  "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-100 " +
  "placeholder:text-zinc-500 outline-none transition-colors duration-200 " +
  "focus:border-rose-400/50 focus:bg-white/[0.07] focus:ring-2 focus:ring-rose-500/20"

/** Transisi antar langkah: cuma x & opacity — ringan di HP. */
const stepVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 56 : -56, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -56 : 56, opacity: 0 }),
}

// ─────────────────────────────────────────────────────────────────────────────
// Halaman utama (state machine wizard)
// ─────────────────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [step, setStep] = useState<Step>(1)
  const [dir, setDir] = useState<1 | -1>(1) // arah slide: 1 = maju, -1 = mundur

  // Form data — penampung sebelum dikirim ke API
  const [targetName, setTargetName] = useState("")
  const [message, setMessage] = useState("")
  const [isAnonymous, setIsAnonymous] = useState(true) // default: anonim total
  const [senderName, setSenderName] = useState("")
  const [kadoType, setKadoType] = useState<KadoType | null>(null)
  const [kadoData, setKadoData] = useState<Record<string, string | number> | null>(null)

  // Draft jawaban kuis — tersimpan walau sempat ganti-ganti tipe kado
  const [quizQuestion, setQuizQuestion] = useState("")
  const [quizAnswer, setQuizAnswer] = useState("")

  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const reduceMotion = useReducedMotion()
  const router = useRouter()

  const canNextStep1 = targetName.trim().length > 0 && message.trim().length > 0
  const canPreview =
    kadoType !== null &&
    (kadoType !== "quiz" || (quizQuestion.trim().length > 0 && quizAnswer.trim().length > 0))

  function goTo(next: Step, direction: 1 | -1) {
    setDir(direction)
    setStep(next)
  }

  /** Pilih tipe kado → kadoData langsung diisi default-nya (quiz menunggu input user). */
  function selectKado(type: KadoType) {
    setKadoType(type)
    setKadoData(
      type === "quiz" ? { question: quizQuestion, answer: quizAnswer } : DEFAULT_KADO_DATA[type]
    )
  }

  function updateQuiz(field: "question" | "answer", value: string) {
    if (field === "question") setQuizQuestion(value)
    else setQuizAnswer(value)
    setKadoData((prev) => ({ ...(prev ?? {}), [field]: value }))
  }

  /** Simpan kado via POST /api/kado, lalu redirect ke halaman share. */
  async function handleGenerate() {
    if (!kadoType || generating) return
    setGenerating(true)
    setErrorMsg(null)

    try {
      const payload: KadoCreatePayload = {
        targetName: targetName.trim(),
        message: message.trim(),
        senderName: isAnonymous ? null : senderName.trim() || null,
        isAnonymous,
        kadoType,
        kadoData,
      }

      const res = await fetch("/api/kado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json().catch(() => null)) as KadoApiResponse | null

      if (res.ok && json?.success && json.data?.id) {
        router.push(`/kado/${json.data.id}/share`)
        return
      }
      setErrorMsg(json?.error ?? "Gagal membuat kado. Coba lagi ya.")
    } catch {
      setErrorMsg("Koneksi bermasalah — cek internetmu lalu coba lagi ya.")
    } finally {
      setGenerating(false)
    }
  }

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
          <span className="text-xs font-medium tracking-widest text-zinc-500 uppercase">
            Langkah {step}/3
          </span>
        </header>

        <h1 className="mb-1 text-2xl font-bold tracking-tight text-white">Creator Studio</h1>
        <p className="mb-6 text-sm text-zinc-400">
          Rangkai kado kejutan — pesan rahasia plus kunci bukanya.
        </p>

        {/* Indikator langkah */}
        <StepDots step={step} />

        {/* Card Glassmorphism */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-black/40 backdrop-blur-md sm:p-6">
          <AnimatePresence mode="wait" custom={dir} initial={false}>
            <motion.div
              key={step}
              custom={dir}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
            >
              {step === 1 && (
                <StepIdentity
                  targetName={targetName}
                  message={message}
                  isAnonymous={isAnonymous}
                  senderName={senderName}
                  canNext={canNextStep1}
                  onTargetName={setTargetName}
                  onMessage={setMessage}
                  onAnonymous={setIsAnonymous}
                  onSenderName={setSenderName}
                  onNext={() => goTo(2, 1)}
                />
              )}

              {step === 2 && (
                <StepLock
                  kadoType={kadoType}
                  kadoData={kadoData}
                  quizQuestion={quizQuestion}
                  quizAnswer={quizAnswer}
                  canPreview={canPreview}
                  onSelectKado={selectKado}
                  onQuizChange={updateQuiz}
                  onBack={() => goTo(1, -1)}
                  onNext={() => goTo(3, 1)}
                />
              )}

              {step === 3 && (
                <StepGenerate
                  targetName={targetName}
                  message={message}
                  isAnonymous={isAnonymous}
                  senderName={senderName}
                  kadoType={kadoType}
                  kadoData={kadoData}
                  generating={generating}
                  errorMsg={errorMsg}
                  onBack={() => goTo(2, -1)}
                  onGenerate={handleGenerate}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          Dibuat dengan 💜 di Kangenin — kado kecil, rindu besar.
        </p>
      </div>
    </main>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Indikator langkah (CSS transition saja — super ringan)
// ─────────────────────────────────────────────────────────────────────────────

function StepDots({ step }: { step: Step }) {
  return (
    <div className="mb-5 flex gap-2" aria-label={`Langkah ${step} dari 3`}>
      {([1, 2, 3] as Step[]).map((n) => (
        <div
          key={n}
          className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
            n <= step ? "bg-gradient-to-r from-rose-500 to-purple-500" : "bg-white/10"
          }`}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Pesan & identitas FOMO
// ─────────────────────────────────────────────────────────────────────────────

interface StepIdentityProps {
  targetName: string
  message: string
  isAnonymous: boolean
  senderName: string
  canNext: boolean
  onTargetName: (v: string) => void
  onMessage: (v: string) => void
  onAnonymous: (v: boolean) => void
  onSenderName: (v: string) => void
  onNext: () => void
}

function StepIdentity(props: StepIdentityProps) {
  const initialsPreview = props.isAnonymous ? null : toFomoInitials(props.senderName)

  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="targetName" className="mb-2 block text-sm font-medium text-zinc-300">
          Nama Target (Penerima)
        </label>
        <input
          id="targetName"
          value={props.targetName}
          onChange={(e) => props.onTargetName(e.target.value)}
          placeholder="Untuk siapa kado ini?"
          maxLength={60}
          className={inputCls}
        />
      </div>

      <div>
        <label htmlFor="message" className="mb-2 block text-sm font-medium text-zinc-300">
          Pesan Utama (Confess/Ucapan)
        </label>
        <textarea
          id="message"
          value={props.message}
          onChange={(e) => props.onMessage(e.target.value)}
          placeholder="Tulis apa yang selama ini pengen kamu sampaikan…"
          rows={5}
          maxLength={1000}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* Toggle anonim total */}
      <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="pr-3">
          <p className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <EyeOff className="h-4 w-4 text-rose-300" />
            Kirim sebagai Anonim Total
          </p>
          <p className="mt-0.5 text-xs text-zinc-500">Nama kamu nggak akan muncul sama sekali.</p>
        </div>
        <ToggleSwitch checked={props.isAnonymous} onChange={props.onAnonymous} />
      </div>

      {/* Input nama asli — hanya muncul kalau toggle dimatikan */}
      <AnimatePresence initial={false}>
        {!props.isAnonymous && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <label htmlFor="senderName" className="mb-2 block text-sm font-medium text-zinc-300">
              Nama Aslimu
            </label>
            <div className="relative">
              <input
                id="senderName"
                value={props.senderName}
                onChange={(e) => props.onSenderName(e.target.value)}
                placeholder="Siapa kamu?"
                maxLength={60}
                className={inputCls}
              />
              {initialsPreview && (
                <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full border border-rose-400/30 bg-rose-500/10 px-2.5 py-1 text-xs font-semibold tracking-wider text-rose-300">
                  {initialsPreview}
                </span>
              )}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              Nama ini akan disembunyikan dan hanya muncul 2 huruf inisialnya untuk bikin target
              penasaran, misal: Rizqi → <span className="text-zinc-400">R***I</span>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={props.onNext}
        disabled={!props.canNext}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
      >
        Lanjut Pilih Kunci
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Pilih tantangan (kunci buka kado)
// ─────────────────────────────────────────────────────────────────────────────

interface StepLockProps {
  kadoType: KadoType | null
  kadoData: Record<string, string | number> | null
  quizQuestion: string
  quizAnswer: string
  canPreview: boolean
  onSelectKado: (type: KadoType) => void
  onQuizChange: (field: "question" | "answer", value: string) => void
  onBack: () => void
  onNext: () => void
}

function StepLock(props: StepLockProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <LockKeyhole className="h-4 w-4 text-rose-300" />
          Pilih Kunci Buka Kado
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          Target harus menyelesaikan tantangan ini dulu sebelum kado terbuka.
        </p>
      </div>

      {/* Grid radio cards */}
      <div role="radiogroup" aria-label="Tipe kado" className="grid grid-cols-2 gap-3">
        {KADO_OPTIONS.map((opt) => {
          const selected = props.kadoType === opt.value
          const Icon = opt.icon
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={selected}
              onClick={() => props.onSelectKado(opt.value)}
              className={`relative rounded-2xl border p-4 text-left transition-all duration-200 ${
                selected
                  ? "border-rose-400/60 bg-rose-500/10 shadow-[0_0_24px_-8px_rgba(244,63,94,0.7)]"
                  : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.08]"
              }`}
            >
              {selected && (
                <span className="absolute top-2.5 right-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <Icon
                className={`h-6 w-6 ${selected ? "text-rose-300" : "text-zinc-400"}`}
                strokeWidth={1.75}
              />
              <p className={`mt-3 text-sm font-semibold ${selected ? "text-white" : "text-zinc-200"}`}>
                {opt.label}
              </p>
              <p className="mt-0.5 text-xs text-zinc-500">{opt.desc}</p>
            </button>
          )
        })}
      </div>

      {/* Form kuis — hanya muncul kalau quiz dipilih */}
      <AnimatePresence initial={false}>
        {props.kadoType === "quiz" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div>
              <label htmlFor="quizQuestion" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Pertanyaan Kuis
              </label>
              <input
                id="quizQuestion"
                value={props.quizQuestion}
                onChange={(e) => props.onQuizChange("question", e.target.value)}
                placeholder="Kapan kita pertama kali jalan?"
                maxLength={120}
                className={inputCls}
              />
            </div>
            <div>
              <label htmlFor="quizAnswer" className="mb-1.5 block text-xs font-medium text-zinc-400">
                Jawaban
              </label>
              <input
                id="quizAnswer"
                value={props.quizAnswer}
                onChange={(e) => props.onQuizChange("answer", e.target.value)}
                placeholder="Minggu"
                maxLength={60}
                className={inputCls}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Jawaban tidak peka huruf besar-kecil — target boleh salah ketik sedikit.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-3 pt-1">
        <button
          onClick={props.onBack}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </button>
        <button
          onClick={props.onNext}
          disabled={!props.canPreview}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 to-purple-500 px-4 py-3.5 text-sm font-semibold text-white shadow-[0_0_24px_-6px_rgba(244,63,94,0.5)] transition-shadow hover:shadow-[0_0_32px_-4px_rgba(244,63,94,0.65)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          Preview
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Ringkasan & Generate
// ─────────────────────────────────────────────────────────────────────────────

interface StepGenerateProps {
  targetName: string
  message: string
  isAnonymous: boolean
  senderName: string
  kadoType: KadoType | null
  kadoData: Record<string, string | number> | null
  generating: boolean
  errorMsg: string | null
  onBack: () => void
  onGenerate: () => void
}

function StepGenerate(props: StepGenerateProps) {
  const selected = KADO_OPTIONS.find((o) => o.value === props.kadoType)
  const identity = buildFomoIdentity(props.senderName, props.isAnonymous)

  return (
    <div className="space-y-5">
      {/* Ringkasan: amplop + nama target */}
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.03] p-5 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-400/30 bg-rose-500/15 shadow-[0_0_24px_-6px_rgba(244,63,94,0.6)]">
          <Mail className="h-6 w-6 text-rose-300" strokeWidth={1.75} />
        </div>
        <p className="mt-3 text-xs tracking-widest text-zinc-500 uppercase">Untuk</p>
        <p className="text-lg font-bold text-white">{props.targetName || "—"}</p>
        <p className="font-hand mt-3 text-xl leading-snug text-zinc-200">“{props.message || "…"}”</p>
      </div>

      {/* Detail ringkasan */}
      <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-500">Dari</span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-200">
            {props.isAnonymous || !identity.senderName ? (
              <>
                <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                Seseorang
              </>
            ) : (
              <>
                <UserRound className="h-3.5 w-3.5 text-zinc-400" />
                {identity.senderName}
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs tracking-wider text-rose-300">
                  {identity.fomoInitials}
                </span>
              </>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-zinc-500">Kunci buka</span>
          <span className="flex items-center gap-1.5 font-medium text-zinc-200">
            {selected && <selected.icon className="h-3.5 w-3.5 text-rose-300" />}
            {selected?.label ?? "—"}
          </span>
        </div>
        {props.kadoType === "quiz" && props.kadoData && (
          <div className="border-t border-white/5 pt-2.5 text-xs text-zinc-400">
            <p>
              <span className="text-zinc-500">Tanya:</span> {props.kadoData.question || "—"}
            </p>
            <p className="mt-1">
              <span className="text-zinc-500">Jawab:</span> {props.kadoData.answer || "—"}
            </p>
          </div>
        )}
      </div>

      {/* Aksi */}
      <div className="space-y-3">
        {props.errorMsg && (
          <div
            role="alert"
            className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-center text-sm text-rose-200"
          >
            {props.errorMsg}
          </div>
        )}
          <motion.button
            onClick={props.onGenerate}
            disabled={props.generating || !props.kadoType}
            whileTap={props.generating ? undefined : { scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-500 via-fuchsia-500 to-purple-500 px-6 py-4 text-base font-bold text-white shadow-[0_0_36px_-6px_rgba(244,63,94,0.65)] transition-shadow hover:shadow-[0_0_48px_-4px_rgba(244,63,94,0.8)] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {props.generating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Menyiapkan kejutan…
              </>
            ) : (
              <>
                <Wand2 className="h-5 w-5" />
                Generate Link Kado
              </>
            )}
          </motion.button>
          <button
            onClick={props.onBack}
            disabled={props.generating}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Toggle switch custom (tanpa dependensi ekstra — tetap satu file)
// ─────────────────────────────────────────────────────────────────────────────

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label="Kirim sebagai anonim total"
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-200 ${
        checked ? "border-rose-400/50 bg-rose-500/80" : "border-white/15 bg-white/10"
      }`}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 34 }}
        className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow ${
          checked ? "right-1" : "left-1"
        }`}
      />
    </button>
  )
}
