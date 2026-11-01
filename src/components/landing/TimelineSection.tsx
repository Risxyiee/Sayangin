"use client";

import { motion } from "framer-motion";

const TIMELINE = [
  { date: "12 Feb 2025", cap: "Chat pertama: 'hujan, boleh minta pullutan?'" },
  { date: "1 Mar 2025", cap: "Nonton pertama — kamu ketiduran" },
  { date: "17 Apr 2025", cap: "Jadian! (di tengah hujan lagi, kebetulan)" },
  { date: "3 Agu 2025", cap: "LDR dimulai: Bandung–Jakarta" },
  { date: "12 Feb 2026", cap: "Anniversary pertama... dan terus berlanjut" },
];

function TimelinePhone() {
  return (
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-neutral-800 bg-neutral-800 shadow-xl sm:w-[310px]">
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
      <div className="relative h-[500px] overflow-hidden rounded-[1.7rem] bg-[#faf8f3]">
        {/* header */}
        <div className="sticky top-0 z-20 bg-[#211d1a] px-5 py-4 text-white">
          <p className="font-hand text-xl">Kisah Kita</p>
          <p className="text-[10px] text-white/60">Raka &amp; Nadia — sejak 17 Apr 2025</p>
        </div>
        {/* konten auto-scroll */}
        <div className="absolute inset-x-0 top-[64px] bottom-0 overflow-hidden">
          <div
            className="space-y-5 px-5 py-6"
            style={{ animation: "phone-scroll-demo 16s ease-in-out infinite" }}
          >
            {TIMELINE.map((t, i) => (
              <div key={i} className="relative pl-8">
                {/* garis + node */}
                <div className="absolute bottom-0 left-[9px] top-0 w-px bg-border" />
                <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[9px] text-white">
                  ♥
                </div>
                <span className="inline-block rounded-sm bg-secondary px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                  {t.date}
                </span>
                <div className="mt-2 rounded-md rounded-tl-none border border-border bg-card p-3 shadow-sm">
                  <div className="grain relative h-24 rounded-sm bg-gradient-to-br from-[#e7d8cb] to-[#d9c4b6]" />
                  <p className="mt-2 text-[11px] leading-4 text-foreground/80">{t.cap}</p>
                </div>
              </div>
            ))}
            <div className="pt-2 text-center">
              <span className="inline-block rounded-md bg-primary px-4 py-1.5 text-[10px] font-bold text-white">
                cerita kalian berlanjut...
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TimelineSection() {
  return (
    <section className="relative bg-[#211d1a] py-20 sm:py-28">
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="order-2 lg:order-1"
        >
          <p className="kicker !text-[#d9a0a6]">Timeline kisah kalian</p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">
            Riwayat kalian,{" "}
            <em className="text-[#e8b4bb]">jadi halaman yang bisa di-scroll</em>
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            Dari chat pertama sampai sekarang — setiap momen muncul satu per
            satu saat dia menggulir, diiringi musik dan animasi. Cocok untuk
            anniversary, ulang tahun, atau sekadar{" "}
            <i>&ldquo;lihat sejauh mana kita sudah jalan&rdquo;</i>.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-white/70">
            {[
              "Foto, tanggal, dan caption diatur lewat form — tanpa coding",
              "Musik latar pilihan kalian, nyala begitu dia mulai buka",
              "Diakhiri halaman kejutan: pesan rahasia atau kode voucher",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-white/40">
            Demo di samping otomatis scroll seperti yang dialami dia.
          </p>

          {/* CTA — fitur ini nyata & bisa langsung diracik / dicoba */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="/create?tipe=timeline"
              className="inline-block rounded-md bg-primary px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
            >
              Racik Timeline Kisah Kalian →
            </a>
            <a
              href="/kado/demo-timeline?pratinjau=1"
              className="inline-block rounded-md border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white/85 transition-colors hover:bg-white/10"
            >
              Coba Demo 👁
            </a>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <TimelinePhone />
        </motion.div>
      </div>
    </section>
  );
}
