"use client";

import { motion } from "framer-motion";
import { Check, Eye, MailOpen, Heart } from "lucide-react";

/* mini mock kartu status — persis seperti yang dilihat pengirim */
function StatusMock() {
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-[0_12px_32px_-20px_rgba(28,25,23,0.3)]">
      <div className="relative">
        <div className="flex items-baseline justify-between">
          <p className="font-hand text-xl text-primary">Buat Sari,</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            dikirim 2 jam lalu
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">dari Seseorang</p>

        <div className="mt-4 space-y-2.5">
          <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1faa59]/10 text-[#1faa59]">
              <Check className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Surat terkirim</p>
              <p className="text-[11px] text-muted-foreground">
                Link-nya aktif, tinggal ditunggu...
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1faa59]/10 text-[#1faa59]">
              <MailOpen className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Udah dibuka (3x)</p>
              <p className="text-[11px] text-muted-foreground">
                Pertama kali 1 jam lalu. Dia lagi membaca...
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-left">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Heart className="h-4 w-4 fill-primary" />
            </span>
            <div>
              <p className="text-xs font-bold text-foreground">Iya — dia juga suka kamu</p>
              <p className="text-[11px] text-muted-foreground">
                Selamat. Chat dia sekarang sebelum momennya lewat.{" "}
                <span className="font-semibold text-primary">buka WA</span>
              </p>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[10px] text-muted-foreground">
          halaman ini cuma buat pengirim — dia tidak tahu ada
        </p>
      </div>
    </div>
  );
}

export default function StatusTeaser() {
  return (
    <section id="pantau" className="relative py-16 sm:py-20">
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
            <p className="kicker">Halaman pantau — hanya kamu yang lihat</p>
            <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              Kirim, lalu periksa:{" "}
              <em className="text-primary">udah dibaca belum?</em>
            </h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
              Setiap surat punya halaman pantau pribadi: kelihatan{" "}
              <b className="text-foreground">sudah dibuka belum</b>, dibuka
              berapa kali, sampai <b className="text-foreground">apa jawabannya</b> —
              update otomatis.
            </p>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-[#1faa59]" />
                Dia buka link jam 2 pagi? Kamu tahu jam 2 pagi.
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-[#1faa59]" />
                Jawab &ldquo;iya&rdquo;? Ada tombol langsung buka WA.
              </li>
              <li className="flex items-center gap-2.5">
                <Check className="h-4 w-4 shrink-0 text-[#1faa59]" />
                Dia tidak akan pernah tahu halaman ini ada.
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="#confess"
                className="rounded-md bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
              >
                Coba gratis di atas
              </a>
              <a
                href="/create"
                className="rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition-colors hover:bg-secondary"
              >
                Atau racik kado kejutan
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
            <StatusMock />
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Eye className="h-4 w-4" />
              Tampilan asli halaman pantau — gratis.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
