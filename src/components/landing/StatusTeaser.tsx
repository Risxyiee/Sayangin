"use client";

import { motion } from "framer-motion";
import { Check, Eye, Heart, MailOpen, Sparkles } from "lucide-react";

/* mini mock kartu status — persis seperti yang dilihat pengirim */
function StatusMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-3xl border border-white/10 bg-gradient-to-b from-[#2b0a1c] via-[#3d0c24] to-[#160510] p-5 shadow-2xl">
      <div className="absolute -left-10 top-6 h-24 w-24 rounded-full bg-rose-600/25 blur-2xl" />
      <div className="absolute -right-6 bottom-6 h-24 w-24 rounded-full bg-pink-500/20 blur-2xl" />

      <div className="relative">
        <p className="font-hand text-xl text-rose-200">Buat Sari,</p>
        <p className="text-[11px] text-white/50">dari Seseorang 🤍 • dikirim 2 jam lalu</p>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-white">Surat terkirim</p>
              <p className="text-[11px] text-white/55">Link-nya aktif, tinggal ditunggu...</p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/50 bg-emerald-500/15 text-emerald-300">
              <MailOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-white">Udah dibuka! (3x)</p>
              <p className="text-[11px] text-white/55">
                Pertama kali 1 jam lalu. Dia lagi baca... tunggu jawabannya 😳
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-rose-400/60 bg-rose-500/20 p-3 text-left">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-400/60 bg-rose-500/25 text-rose-300 anim-heartbeat">
              <Heart className="h-4 w-4 fill-rose-300" />
            </span>
            <div>
              <p className="text-xs font-bold text-white">IYA! Dia juga suka kamu 🎉</p>
              <p className="text-[11px] text-white/65">
                Selamat! Chat dia sekarang sebelum momennya lewat.{" "}
                <span className="font-semibold text-emerald-300">buka WA →</span>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-white/35">
          halaman ini cuma buat pengirim — dia nggak tahu ada 👀
        </p>
      </div>
    </div>
  );
}

export default function StatusTeaser() {
  return (
    <section id="pantau" className="relative overflow-hidden py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* kiri: copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.6 }}
            className="order-2 lg:order-1"
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-xs font-bold tracking-wide text-amber-700">
              <Eye className="h-3.5 w-3.5" /> RAHASIA PENGIRIM — DIA NGGAK TAHU
            </span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-rose-950 sm:text-4xl">
              Kirim, terus...{" "}
              <span className="font-hand text-4xl text-rose-500">udah dibuka belum?</span>{" "}
              👀
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-rose-950/70">
              Setiap surat dapat halaman pantau pribadi: kelihatan{" "}
              <b>udah dibuka belum</b>, dibuka berapa kali, sampai{" "}
              <b>jawabannya apa</b> — update otomatis kayak live chat, tapi
              buat perasaan kamu.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-rose-950/75">
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-600">
                  ✓
                </span>
                Dia buka link jam 2 pagi? Kamu tahu jam 2 pagi.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-600">
                  ✓
                </span>
                Jawab &ldquo;iya&rdquo;? Ada tombol langsung buka WA.
              </li>
              <li className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] text-emerald-600">
                  ✓
                </span>
                Dia nggak akan pernah tahu halaman ini ada. 😉
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#confess"
                className="rounded-full bg-rose-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-500/30 transition hover:scale-105 hover:bg-rose-600"
              >
                Coba gratis di atas 💌
              </a>
              <a
                href="#openwhen"
                className="rounded-full border border-rose-300 px-6 py-3 text-sm font-bold text-rose-700 transition hover:bg-rose-50"
              >
                Atau bikin surat mingguan →
              </a>
            </div>
          </motion.div>

          {/* kanan: mock */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative order-1 lg:order-2"
          >
            <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-200/50 blur-[90px]" />
            <StatusMock />
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-rose-950/60">
              <Sparkles className="h-4 w-4 text-amber-500" />
              Tampilan asli halaman pantau — gratis semua.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
