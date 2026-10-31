"use client";

import { motion } from "framer-motion";

/*
  Hero editorial: kertas hangat, tipografi serif, satu objek —
  kartu surat dengan cap pos. Tanpa gradien, glow, atau partikel.
*/

function LetterCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm rotate-[-1.5deg]">
      {/* kartu surat */}
      <div className="rounded-sm border border-border bg-card p-7 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_12px_32px_-16px_rgba(28,25,23,0.25)]">
        {/* baris kepala surat */}
        <div className="flex items-start justify-between">
          <div className="space-y-2.5 pt-1">
            <div className="h-2 w-28 rounded-sm bg-neutral-200" />
            <div className="h-2 w-20 rounded-sm bg-neutral-200/80" />
          </div>
          {/* perangko */}
          <div className="flex h-14 w-12 items-center justify-center border-2 border-dashed border-primary/40 bg-primary/5">
            <div className="relative h-5 w-5">
              <div className="heart-shape" />
            </div>
          </div>
        </div>

        {/* salam */}
        <p className="mt-6 font-hand text-2xl leading-none text-primary">
          Buat kamu,
        </p>

        {/* isi surat: baris teks dengan satu baris disorot */}
        <div className="mt-5 space-y-3">
          <div className="h-2 w-full rounded-sm bg-neutral-200" />
          <div className="h-2 w-11/12 rounded-sm bg-neutral-200/90" />
          <div className="h-2 w-4/5 rounded-sm bg-neutral-200/80" />
          <div className="h-2 w-full rounded-sm bg-neutral-200" />
          <div className="h-2 w-2/3 rounded-sm bg-neutral-200/70" />
        </div>

        {/* tanda tangan + cap */}
        <div className="mt-7 flex items-end justify-between">
          <p className="font-hand text-xl text-foreground/70">— seseorang</p>
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 text-center">
            <div className="text-[7px] font-bold uppercase leading-tight tracking-[0.15em] text-primary/70">
              sayangin
              <br />
              pos
              <br />
              2026
            </div>
          </div>
        </div>
      </div>

      {/* selotip kertas di pojok */}
      <div className="absolute -top-2.5 left-8 h-5 w-16 rotate-[-4deg] rounded-[2px] bg-secondary/90 shadow-sm" />
      <div className="absolute -bottom-2.5 right-10 h-5 w-14 rotate-[3deg] rounded-[2px] bg-secondary/90 shadow-sm" />
    </div>
  );
}

export default function Hero() {
  return (
    <section
      className="relative overflow-hidden bg-[#211d1a] pb-20 pt-32 sm:pb-24 sm:pt-40"
      aria-label="Pembuka"
    >
      {/* tekstur titik halus, sangat tipis */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center lg:text-left"
        >
          <p className="kicker !text-[#d9a0a6]">
            Gratis &middot; tanpa akun &middot; cukup lewat link
          </p>

          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.12] text-white sm:text-5xl xl:text-[3.6rem]">
            Suka dia, belum berani
            <br className="hidden sm:block" /> bilang langsung?
          </h1>
          <p className="mt-3 font-display text-3xl italic leading-snug text-[#e8b4bb] sm:text-4xl">
            Tulis dia surat.
          </p>

          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/60 lg:mx-0">
            Sayangin mengubah pesanmu jadi surat yang dikirim sebagai link
            anonim — dia buka, baca pelan-pelan, lalu menjawab. Namamu baru
            muncul kalau jawabannya <i>iya</i>. Sudah jadian? Ada kado
            digitalnya juga.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a
              href="#confess"
              className="w-full rounded-md bg-primary px-7 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-[#b52743] sm:w-auto"
            >
              Tulis suratnya
            </a>
            <a
              href="#kado"
              className="w-full rounded-md border border-white/25 px-7 py-3.5 text-center text-sm font-semibold text-white/90 transition-colors hover:border-white/50 hover:text-white sm:w-auto"
            >
              Lihat kado digital
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-8 text-left lg:justify-start">
            {[
              { v: "Rp0", k: "confess anonim" },
              { v: "±3 menit", k: "dari tulis ke kirim" },
              { v: "< Rp50rb", k: "kado premium" },
            ].map((s) => (
              <div key={s.v}>
                <div className="font-display text-lg font-bold text-white">{s.v}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/40">
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="pb-4 lg:pb-0"
        >
          <LetterCard />
        </motion.div>
      </div>
    </section>
  );
}
