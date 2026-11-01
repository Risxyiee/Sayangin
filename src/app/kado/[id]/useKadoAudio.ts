"use client"

/**
 * useKadoAudio — mesin suara sintesis untuk pengalaman kado (Web Audio API).
 *
 * SEMUA suara disintesis langsung (oscillator + noise + envelope) — nol file
 * audio, nol download, aman untuk kuota penerima.
 *
 * Aturan autoplay (iOS/Safari): AudioContext WAJIB dibuat/di-resume dari
 * dalam gesture handler. Karena itu `unlock()` dipanggil dari onClick /
 * onPointerDown pertama user (mis. tap segel di PremiumConfess) — BUKAN dari
 * useEffect. Sebelum unlock, semua metode suara adalah no-op yang aman.
 *
 * Metode:
 *   unlock()      — buat/resume AudioContext dari gesture (wajib dipanggil
 *                   dari handler interaksi user, sekali saja).
 *   beat(level)   — detak jantung "lub-dub": dua gelombang sinus rendah
 *                   (~62/54 Hz) berurutan; level 0..1 mengatur kecerahan
 *                   dan kekerasan detak (makin tinggi, makin cepat kencang).
 *   crack()       — retakan: burst noise ter-filter bandpass yang menyapu
 *                   turun + hentakan bass pendek.
 *   chime(i)      — lonceng halus dua-nada detuned; i memilih nada berikutnya
 *                   (dipakai per baris surat, maks 4 nada berbeda).
 *   shimmer()     — hujan kilau: 5 chime kecil menyebar naik.
 *   slide(dur?)   — kain/pita meluncur: noise bandpass menyapu naik pelan.
 *   slip()        — simpul lepas: sapuan turun pendek + pop bass kecil.
 *   pop(i)        — kuncup mekar: blip segitiga lembut, pitch naik per i.
 *   rustle()      — derit kertas: dua burst noise pendek beruntun.
 *   swell()       — akor hangat mengembang: penyambutan / kuncup pamungkas.
 *   strike()      — korek api: gesekan tinggi singkat + nyala "fwoosh" hangat
 *                   (dipakai Wish Keeper Edition saat menyalakan lilin).
 *   whoosh(i)     — tiupan angin: band noise lembut naik; i 0..1 mengatur
 *                   panjang & kekuatan hembusan (tease tiupan lemah).
 *   poof()        — api padam: hentakan bass pendek + desis asap tipis.
 *   stamp()       — cap menghantam kertas: thud pendek (Golden Booklet,
 *                   stempel "DIKLAIM"; reusable untuk stempel lain).
 *   toggleMuted() — mute/unmute master gain (tombol kecil di layar).
 *   muted         — state mute untuk ikon tombol.
 *
 * Bersih-bersih: AudioContext ditutup saat unmount. Semua node sekali pakai
 * (stop + disconnect otomatis lewat onended) — tidak ada kebocoran node.
 */

import { useCallback, useEffect, useRef, useState } from "react"

type AudioCtor = typeof AudioContext

/** Master gain — semua suara di-scale ke sini (pelan, elegan, tak mengejutkan). */
const MASTER_GAIN = 0.5

export function useKadoAudio() {
  const ctxRef = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)
  const noiseRef = useRef<AudioBuffer | null>(null)
  const [muted, setMuted] = useState(false)

  // ── lifecycle ────────────────────────────────────────────────────────────

  /** Buat/resume AudioContext — WAJIB dipanggil dari gesture handler user. */
  const unlock = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      if (!ctxRef.current) {
        const Ctor: AudioCtor | undefined =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext
        if (!Ctor) return
        const ctx = new Ctor()
        const master = ctx.createGain()
        master.gain.value = MASTER_GAIN
        master.connect(ctx.destination)
        // buffer noise sekali buat dipakai crack()
        const len = Math.floor(ctx.sampleRate * 0.5)
        const buf = ctx.createBuffer(1, len, ctx.sampleRate)
        const data = buf.getChannelData(0)
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
        ctxRef.current = ctx
        masterRef.current = master
        noiseRef.current = buf
      }
      if (ctxRef.current.state === "suspended") void ctxRef.current.resume()
    } catch {
      // browser tanpa Web Audio — semua suara jadi no-op, alur tetap jalan
    }
  }, [])

  useEffect(() => {
    return () => {
      const ctx = ctxRef.current
      ctxRef.current = null
      masterRef.current = null
      if (ctx && ctx.state !== "closed") void ctx.close().catch(() => {})
    }
  }, [])

  const toggleMuted = useCallback(() => {
    setMuted((m) => {
      const next = !m
      if (masterRef.current && ctxRef.current) {
        masterRef.current.gain.setTargetAtTime(
          next ? 0 : MASTER_GAIN,
          ctxRef.current.currentTime,
          0.02
        )
      }
      return next
    })
  }, [])

  // ── primitif ─────────────────────────────────────────────────────────────

  /** Gelombang sinus dengan envelope attack/decay — dasar semua suara nada. */
  function tone(
    freq: number,
    startAt: number,
    dur: number,
    peak: number,
    type: OscillatorType = "sine"
  ) {
    const ctx = ctxRef.current
    const master = masterRef.current
    if (!ctx || !master) return
    const t0 = ctx.currentTime + startAt
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t0)
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    osc.connect(gain).connect(master)
    osc.start(t0)
    osc.stop(t0 + dur + 0.05)
    osc.onended = () => {
      osc.disconnect()
      gain.disconnect()
    }
  }

  /** Burst noise ter-bandpass — dasar retakan/tekstur. */
  function noise(startAt: number, dur: number, f0: number, f1: number, peak: number, q = 1.2) {
    const ctx = ctxRef.current
    const master = masterRef.current
    const buf = noiseRef.current
    if (!ctx || !master || !buf) return
    const t0 = ctx.currentTime + startAt
    const src = ctx.createBufferSource()
    src.buffer = buf
    const filter = ctx.createBiquadFilter()
    filter.type = "bandpass"
    filter.Q.value = q
    filter.frequency.setValueAtTime(f0, t0)
    filter.frequency.exponentialRampToValueAtTime(Math.max(f1, 40), t0 + dur)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t0)
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
    src.connect(filter).connect(gain).connect(master)
    src.start(t0)
    src.stop(t0 + dur + 0.05)
    src.onended = () => {
      src.disconnect()
      filter.disconnect()
      gain.disconnect()
    }
  }

  // ── suara kado ───────────────────────────────────────────────────────────

  /** Detak jantung lub-dub. level 0..1 → makin tinggi makin dalam & nyaring. */
  const beat = useCallback((level = 0.5) => {
    if (!ctxRef.current || muted) return
    const depth = 0.5 + level * 0.5 // 0.5..1
    tone(64, 0, 0.16, 0.55 * depth)
    tone(52, 0.13, 0.2, 0.4 * depth)
  }, [muted])

  /** Retakan hati — nyaring lalu menghilang ke bass. */
  const crack = useCallback(() => {
    if (!ctxRef.current || muted) return
    noise(0, 0.28, 2400, 180, 0.5, 0.8)
    tone(48, 0.05, 0.4, 0.6)
  }, [muted])

  /** Lonceng halus — dipakai per baris surat (i memilih pitch berikutnya). */
  const chime = useCallback((i = 0) => {
    if (!ctxRef.current || muted) return
    const scale = [784, 880, 1046.5, 1174.7] // G5 A5 C6 D6 — pentatonik lembut
    const f = scale[i % scale.length]
    tone(f, 0, 0.9, 0.16)
    tone(f * 1.5, 0, 0.7, 0.05) // partial quint — kesan "logam tipis"
  }, [muted])

  /** Hujan kilau naik — dipakai saat hati pecah jadi cahaya. */
  const shimmer = useCallback(() => {
    if (!ctxRef.current || muted) return
    const notes = [1046.5, 1318.5, 1568, 2093, 2637]
    notes.forEach((f, i) => tone(f, i * 0.09, 0.6, 0.07))
  }, [muted])

  /** Kain/pita meluncur — sapuan noise naik pelan; dur dalam detik. */
  const slide = useCallback(
    (dur = 0.35) => {
      if (!ctxRef.current || muted) return
      noise(0, dur, 300, 900, 0.12, 0.7)
    },
    [muted]
  )

  /** Simpul lepas — sapuan turun pendek + pop bass kecil. */
  const slip = useCallback(() => {
    if (!ctxRef.current || muted) return
    noise(0, 0.16, 1400, 350, 0.28, 0.9)
    tone(150, 0.02, 0.1, 0.2, "triangle")
  }, [muted])

  /** Kuncup mekar — blip segitiga lembut; i menaikkan pitch per bunga. */
  const pop = useCallback((i = 0) => {
    if (!ctxRef.current || muted) return
    const scale = [523.25, 587.33, 659.25, 783.99, 880]
    tone(scale[i % scale.length], 0, 0.16, 0.13, "triangle")
    noise(0, 0.05, 2000, 1000, 0.04, 1.5)
  }, [muted])

  /** Derit kertas — dua burst noise pendek beruntun. */
  const rustle = useCallback(() => {
    if (!ctxRef.current || muted) return
    noise(0, 0.08, 1400, 2600, 0.07, 1.3)
    noise(0.1, 0.12, 1100, 2300, 0.06, 1.3)
  }, [muted])

  /** Akor hangat mengembang — penyambutan buket / kuncup pamungkas. */
  const swell = useCallback(() => {
    if (!ctxRef.current || muted) return
    tone(392, 0, 1.3, 0.09)
    tone(493.88, 0.06, 1.3, 0.08)
    tone(587.33, 0.12, 1.3, 0.08)
    tone(783.99, 0.22, 1.1, 0.05)
  }, [muted])

  /** Korek menyala — gesekan tinggi singkat, lalu nyala "fwoosh" hangat. */
  const strike = useCallback(() => {
    if (!ctxRef.current || muted) return
    noise(0, 0.14, 3200, 900, 0.4, 1.1) // gesekan head korek
    noise(0.1, 0.34, 1500, 380, 0.2, 0.7) // api menangkap sumbu
    tone(96, 0.12, 0.4, 0.07) // hangat low-end
  }, [muted])

  /** Tiupan angin — hembusan lembut; i 0..1 memanjang & menguatkan. */
  const whoosh = useCallback((i = 0.4) => {
    if (!ctxRef.current || muted) return
    const k = Math.max(0, Math.min(1, i))
    noise(0, 0.4 + k * 0.3, 240 + k * 340, 900, 0.09 + k * 0.13, 0.6)
  }, [muted])

  /** Api padam — hentakan bass pendek + desis asap tipis menyusul. */
  const poof = useCallback(() => {
    if (!ctxRef.current || muted) return
    noise(0, 0.22, 620, 130, 0.38, 0.8)
    tone(72, 0.02, 0.32, 0.3)
    noise(0.07, 0.55, 1300, 320, 0.07, 0.9) // asap
  }, [muted])

  /** Cap menghantam kertas — thud pendek berbobot. */
  const stamp = useCallback(() => {
    if (!ctxRef.current || muted) return
    tone(120, 0, 0.13, 0.3, "triangle")
    noise(0, 0.06, 900, 280, 0.4, 1)
  }, [muted])

  return { unlock, beat, crack, chime, shimmer, slide, slip, pop, rustle, swell, strike, whoosh, poof, stamp, muted, toggleMuted }
}
