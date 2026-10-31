"use client";

import { motion } from "framer-motion";
import { Film } from "lucide-react";

const TIMELINE = [
  { date: "12 Feb 2025", cap: "Chat pertama: 'hujan, boleh minta pullutan?' ☔", grad: "from-sky-300 to-rose-200" },
  { date: "1 Mar 2025", cap: "Nonton pertama — kamu ketiduran 🍿", grad: "from-rose-300 to-amber-200" },
  { date: "17 Apr 2025", cap: "Jadian! (di tengah hujan lagi, kebetulan) 💗", grad: "from-rose-400 to-pink-300" },
  { date: "3 Agu 2025", cap: "LDR dimulai: Bandung–Jakarta 🚆", grad: "from-amber-200 to-rose-300" },
  { date: "12 Feb 2026", cap: "Anniversary pertama... dan terus berlanjut ✨", grad: "from-rose-300 to-rose-400" },
];

function TimelinePhone() {
  return (
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-rose-950 bg-rose-950 shadow-2xl sm:w-[310px]">
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-rose-950" />
      <div className="relative h-[500px] overflow-hidden rounded-[1.7rem] bg-[#fff8f5]">
        {/* header */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-rose-500 to-pink-500 px-5 py-4 text-white">
          <p className="font-hand text-xl">Kisah Kita 💞</p>
          <p className="text-[10px] text-white/80">Raka & Nadia — sejak 17 Apr 2025</p>
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
                <div className="absolute bottom-0 left-[9px] top-0 w-px bg-rose-200" />
                <div className="absolute left-0 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[9px] text-white shadow-md">
                  ♥
                </div>
                <span className="inline-block rounded-full bg-rose-100 px-2.5 py-0.5 text-[9px] font-bold text-rose-600">
                  {t.date}
                </span>
                <div className="mt-2 rounded-2xl rounded-tl-sm border border-rose-100 bg-white p-3 shadow-sm">
                  <div className={`grain relative h-24 rounded-xl bg-gradient-to-br ${t.grad}`} />
                  <p className="mt-2 text-[11px] leading-4 text-rose-950/80">{t.cap}</p>
                </div>
              </div>
            ))}
            <div className="pt-2 text-center">
              <span className="inline-block rounded-full bg-rose-500 px-4 py-1.5 text-[10px] font-bold text-white shadow">
                cerita kalian berlanjut... ✨
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
    <section className="relative overflow-hidden bg-[#1a0511] py-20 sm:py-28">
      <div className="absolute -left-20 top-20 h-80 w-80 rounded-full bg-rose-600/20 blur-[110px]" />
      <div className="absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-pink-500/15 blur-[110px]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -32 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7 }}
          className="order-2 lg:order-1"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-4 py-1.5 text-xs font-bold tracking-wide text-rose-200">
            <Film className="h-3.5 w-3.5" /> SCROLLYTELLING TIMELINE
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Ubah chat & foto kalian jadi{" "}
            <span className="font-hand text-4xl text-rose-300">film pendek</span>{" "}
            yang bisa di-scroll
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-rose-100/70">
            Dari chat pertama sampai sekarang — setiap momen muncul satu per
            satu saat dia menggulir, diiringi musik dan animasi. Cocok untuk
            anniversary, ulang tahun, atau sekadar{" "}
            <span className="italic">"lihat sejauh mana kita sudah jalan"</span>.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-rose-100/80">
            {[
              "Foto, tanggal, dan caption diatur lewat form — tanpa coding",
              "Musik latar pilihan kalian, mulai otomatis",
              "Diakhiri halaman kejutan: pesan rahasia atau hadiah berupa kode voucher",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[10px] text-rose-300">
                  ♥
                </span>
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-rose-200/50">
            ← Demo di samping otomatis scroll seperti yang dialami dia.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <div className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500/10 blur-[90px]" />
          <TimelinePhone />
        </motion.div>
      </div>
    </section>
  );
}
