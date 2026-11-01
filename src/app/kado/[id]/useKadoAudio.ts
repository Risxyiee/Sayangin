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

  return { unlock, beat, crack, chime, shimmer, muted, toggleMuted }
}
