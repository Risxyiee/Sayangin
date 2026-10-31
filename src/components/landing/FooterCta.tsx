"use client";

import { motion } from "framer-motion";
import { Heart } from "lucide-react";

export default function FooterCta() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-[#2b0a1c] via-[#4a0e2e] to-[#160510] py-24 text-center">
        <div className="absolute inset-0" aria-hidden>
          {[
            { l: "8%", t: "16%", s: 22, d: "0s" },
            { l: "88%", t: "22%", s: 28, d: "1.4s" },
            { l: "16%", t: "76%", s: 18, d: "2.2s" },
            { l: "80%", t: "70%", s: 24, d: "0.8s" },
            { l: "48%", t: "10%", s: 16, d: "1.9s" },
          ].map((h, i) => (
            <div
              key={i}
              className="absolute anim-drift opacity-25"
              style={{ left: h.l, top: h.t, animationDelay: h.d }}
            >
              <div className="relative" style={{ width: h.s, height: h.s }}>
                <div className="heart-shape" />
              </div>
            </div>
          ))}
        </div>
        <div className="relative mx-auto max-w-2xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7 }}
          >
            <p className="font-hand text-4xl leading-snug text-rose-200 sm:text-5xl">
              &ldquo;Berani dikit, siapa tau dia juga{" "}
              <span className="text-rose-400">nunggu</span>.&rdquo;
            </p>
            <p className="mx-auto mt-5 max-w-md text-base text-rose-100/70">
              Satu link, tiga menit, gratis. Yang hilang cuma kesempatan kalau
              ditunda terus.
            </p>
            <a
              href="#confess"
              className="mt-9 inline-block rounded-full bg-rose-500 px-10 py-4 text-base font-bold text-white shadow-2xl shadow-rose-600/40 transition hover:scale-105 hover:bg-rose-600"
            >
              💌 Buat Confess-ku Sekarang
            </a>
          </motion.div>
        </div>
      </section>

      <footer className="border-t border-rose-100 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-sm text-rose-950/60 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Heart className="h-4 w-4 fill-rose-500 text-rose-500" />
            <span className="font-bold text-rose-950">sayang.in</span>
            <span>— confess & kado digital buat Indonesia 🇮🇩</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#confess" className="hover:text-rose-600">
              Confess
            </a>
            <a href="#kado" className="hover:text-rose-600">
              Kado
            </a>
            <a href="#harga" className="hover:text-rose-600">
              Harga
            </a>
          </div>
          <p className="text-xs">© 2026 Sayang.in — dibuat dengan ❤️</p>
        </div>
      </footer>
    </>
  );
}
