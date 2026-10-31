"use client";

import { motion } from "framer-motion";
import { Check, Heart, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const PLANS = [
  {
    name: "Gratis",
    price: "Rp0",
    note: "buat marketing & buat kamu yang mau coba dulu",
    highlight: false,
    features: [
      "Confess anonim + animasi amplop",
      "Kartu ucapan sederhana",
      "3 tema warna",
      "Link aktif selamanya",
      "Watermark kecil Sayang.in",
    ],
    cta: "Confess Gratis",
    href: "#confess",
  },
  {
    name: "Satu Kado",
    price: "Rp19rb",
    note: "sekali bayar, bukan langganan",
    highlight: false,
    features: [
      "Pilih 1 kado digital: buket, surat, photobox, kue, coupons, atau playlist",
      "Tanpa watermark",
      "Upload foto & musik asli",
      "Kartu QR siap cetak buat tempel di hadiah fisik",
    ],
    cta: "Beli via QRIS — Segera",
    toast: "Fitur bayar sedang disiapkan 🙏 Confess-nya aktif sekarang, gratis!",
  },
  {
    name: "Paket Sayang",
    price: "Rp39rb",
    note: "semua kado sekaligus — tetap di bawah Rp50rb",
    highlight: true,
    features: [
      "Semua 6 kado digital",
      "Scrollytelling timeline kisah kalian",
      "5 surat Open When Letters",
      "Couple quiz: dia harus jawab bener buat buka hadiah",
      "Prioritas request fitur",
    ],
    cta: "Beli via QRIS — Segera",
    toast: "Fitur bayar sedang disiapkan 🙏 Confess-nya aktif sekarang, gratis!",
  },
];

export default function Pricing() {
  const { toast } = useToast();

  return (
    <section id="harga" className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute left-1/2 top-24 h-72 w-[700px] -translate-x-1/2 rounded-full bg-rose-100/80 blur-[110px]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-bold tracking-wide text-rose-700">
            <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> HARGA JUJUR
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-rose-950 sm:text-4xl">
            Semua di bawah{" "}
            <span className="text-gradient-rose">Rp50rb.</span> Nggak ada
            langganan.
          </h2>
          <p className="mt-3 text-base text-rose-950/70">
            Harga segelas boba untuk kado yang bikin dia nangis bahagia.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {PLANS.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                p.highlight
                  ? "border-rose-500 bg-gradient-to-b from-rose-500 to-rose-600 text-white shadow-2xl shadow-rose-300 lg:-translate-y-3"
                  : "border-rose-100 bg-white shadow-sm"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3.5 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-amber-400 px-4 py-1 text-xs font-extrabold text-amber-950 shadow">
                  <Sparkles className="h-3 w-3" /> PALING LARIS
                </span>
              )}
              <h3
                className={`text-sm font-bold tracking-wide uppercase ${
                  p.highlight ? "text-rose-100" : "text-rose-500"
                }`}
              >
                {p.name}
              </h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span
                  className={`text-4xl font-extrabold tracking-tight ${
                    p.highlight ? "text-white" : "text-rose-950"
                  }`}
                >
                  {p.price}
                </span>
              </div>
              <p
                className={`mt-1 text-xs ${
                  p.highlight ? "text-rose-100/90" : "text-muted-foreground"
                }`}
              >
                {p.note}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${
                        p.highlight ? "text-amber-300" : "text-rose-500"
                      }`}
                    />
                    <span className={p.highlight ? "text-rose-50" : "text-rose-950/80"}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              {p.href ? (
                <a
                  href={p.href}
                  className={`mt-7 rounded-full py-3.5 text-center text-sm font-bold transition hover:scale-[1.03] ${
                    p.highlight
                      ? "bg-white text-rose-600 shadow-lg"
                      : "bg-rose-500 text-white shadow-lg shadow-rose-500/25 hover:bg-rose-600"
                  }`}
                >
                  {p.cta}
                </a>
              ) : (
                <Button
                  onClick={() =>
                    toast({ title: "Segera hadir! 🚀", description: p.toast })
                  }
                  className={`mt-7 rounded-full py-3.5 text-sm font-bold ${
                    p.highlight
                      ? "bg-white text-rose-600 hover:bg-rose-50"
                      : "bg-rose-500 text-white hover:bg-rose-600"
                  }`}
                >
                  {p.cta}
                </Button>
              )}
            </motion.div>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Gratis tidak akan pernah berbayar untuk confess. Kado premium sekali
          bayar — aktif selamanya. Pembayaran via QRIS & e-wallet (sedang
          disiapkan).
        </p>
      </div>
    </section>
  );
}
