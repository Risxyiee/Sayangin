"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Gratis",
    price: "Rp0",
    oldPrice: "",
    note: "buat kamu yang mau coba dulu",
    highlight: false,
    features: [
      "Confess anonim + animasi amplop",
      "Kartu ucapan sederhana",
      "3 tema warna",
      "Link aktif selamanya",
      "Watermark kecil Sayangin",
    ],
    cta: "Confess Gratis",
    href: "#confess",
  },
  {
    name: "Satu Kado",
    price: "Rp0",
    oldPrice: "Rp19rb",
    note: "gratis selama masa uji — nanti Rp19rb sekali bayar",
    highlight: false,
    features: [
      "Pilih 1 kado digital: buket, surat, photobox, kue, coupons, atau playlist",
      "Tanpa watermark",
      "Upload foto & musik asli",
      "Kartu QR siap cetak buat tempel di hadiah fisik",
    ],
    cta: "Bikin Kado Gratis",
    href: "#kado",
  },
  {
    name: "Paket Sayang",
    price: "Rp0",
    oldPrice: "Rp39rb",
    note: "semua kado sekaligus — gratis selama masa uji",
    highlight: true,
    features: [
      "Semua 6 kado digital",
      "Scrollytelling timeline kisah kalian",
      "5 surat Open When Letters",
      "Couple quiz: dia harus jawab bener buat buka hadiah",
      "Prioritas request fitur",
    ],
    cta: "Bikin Semua Kado Gratis",
    href: "#kado",
  },
];

export default function Pricing() {
  return (
    <section id="harga" className="relative border-t border-border py-20 sm:py-28">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-xl text-center"
        >
          <p className="kicker">Harga</p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Semua <em className="text-primary">gratis</em> selama masa uji coba.
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
            Sayangin masih tahap uji — semua kado premium dibuka gratis.
            Cukup pakai dan lihat yang paling disukai; nanti harganya tetap
            di bawah Rp50rb.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-lg border p-7 ${
                p.highlight
                  ? "border-[#211d1a] bg-[#211d1a] text-white shadow-[0_20px_48px_-24px_rgba(28,25,23,0.5)] lg:-translate-y-2"
                  : "border-border bg-card"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-7 whitespace-nowrap rounded-sm bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-white">
                  Paling lengkap
                </span>
              )}
              <h3
                className={`text-xs font-bold uppercase tracking-[0.18em] ${
                  p.highlight ? "text-white/60" : "text-muted-foreground"
                }`}
              >
                {p.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`font-display text-4xl font-bold tracking-tight ${
                    p.highlight ? "text-white" : "text-foreground"
                  }`}
                >
                  {p.price}
                </span>
                {p.oldPrice && (
                  <span
                    className={`text-sm line-through ${
                      p.highlight ? "text-white/40" : "text-muted-foreground/60"
                    }`}
                  >
                    {p.oldPrice}
                  </span>
                )}
              </div>
              <p
                className={`mt-1 text-xs ${
                  p.highlight ? "text-white/60" : "text-muted-foreground"
                }`}
              >
                {p.note}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        p.highlight ? "text-[#e8b4bb]" : "text-primary"
                      }`}
                    />
                    <span className={p.highlight ? "text-white/85" : "text-foreground/80"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href={p.href}
                className={`mt-7 rounded-md py-3.5 text-center text-sm font-bold transition-colors ${
                  p.highlight
                    ? "bg-white text-[#211d1a] hover:bg-white/90"
                    : "bg-foreground text-background hover:bg-foreground/85"
                }`}
              >
                {p.cta}
              </a>
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Selama masa uji coba, semua kado dibuka gratis. Nanti kado premium
          sekali bayar di bawah Rp50rb — confess tetap gratis, selamanya.
        </p>
      </div>
    </section>
  );
}
