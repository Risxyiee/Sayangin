"use client";

import { motion } from "framer-motion";
import { Pencil, Palette, Send } from "lucide-react";

const STEPS = [
  {
    icon: Pencil,
    title: "1. Tulis",
    desc: "Isi nama, pesan, dan momen kalian. Ada contoh kata-kata kalau bingung mau nulis apa.",
  },
  {
    icon: Palette,
    title: "2. Pilih",
    desc: "Pilih kadonya — buket yang mekar, surat bersegel lilin, polaroid yang dicuci, tiket yang disobek, lilin yang ditiup, sampai pengakuan yang harus ditahan.",
  },
  {
    icon: Send,
    title: "3. Kirim",
    desc: "Dapat link + kartu QR. Kirim via WhatsApp atau tempel di kado fisik. Selesai.",
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
          <p className="kicker">Cara pakai</p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Tiga langkah, tiga menit.
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Nggak perlu desainer, nggak perlu coding.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative rounded-lg border border-border bg-card p-7 transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(28,25,23,0.35)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
                <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              {i < 2 && (
                <span className="absolute -right-3.5 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-background text-xs text-muted-foreground md:flex">
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
