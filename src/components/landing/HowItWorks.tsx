"use client";

import { motion } from "framer-motion";
import { Pencil, Palette, Send } from "lucide-react";

const STEPS = [
  {
    icon: Pencil,
    title: "1. Tulis",
    desc: "Isi nama, pesan, dan momen kalian. Ada contoh kata-kata kalau bingung mau nulis apa.",
    anim: "anim-wiggle",
  },
  {
    icon: Palette,
    title: "2. Pilih",
    desc: "Pilih tema warna dan kado digitalnya — confess, buket, surat, photobox, sampai timeline.",
    anim: "anim-drift",
  },
  {
    icon: Send,
    title: "3. Kirim",
    desc: "Dapat link + kartu QR. Kirim via WhatsApp atau tempel di kado fisik. Selesai!",
    anim: "anim-float",
  },
];

export default function HowItWorks() {
  return (
    <section id="cara" className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-xl text-center"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-rose-950 sm:text-4xl">
            Semudah ngetik chat{" "}
            <span className="font-hand text-4xl text-rose-500">biasa</span>
          </h2>
          <p className="mt-3 text-base text-rose-950/70">
            Nggak perlu desainer, nggak perlu coding. Tiga menit beres.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative rounded-3xl border border-rose-100 bg-white p-7 text-center shadow-sm transition hover:shadow-lg hover:shadow-rose-100"
            >
              <div
                className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-rose-200 ${s.anim}`}
              >
                <s.icon className="h-7 w-7 text-rose-600" />
              </div>
              <h3 className="mt-5 text-lg font-extrabold text-rose-950">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-rose-950/70">{s.desc}</p>
              {i < 2 && (
                <span className="absolute -right-4 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-rose-100 text-rose-400 md:flex">
                  →
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
