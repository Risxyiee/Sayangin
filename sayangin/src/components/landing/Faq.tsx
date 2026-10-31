"use client";

import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQS = [
  {
    q: "Confess-nya beneran anonim?",
    a: "Beneran. Nama kamu itu opsional — kalau nggak diisi, dia cuma lihat 'Seseorang 🤍'. Namamu baru ditampilkan kalau dia menjawab 'Iya, aku juga suka kamu'. Kalau dia butuh waktu, identitasmu tetap tersembunyi.",
  },
  {
    q: "Gratis sampai kapan? Ada trik tersembunyi?",
    a: "Confess selalu gratis, selamanya — karena justru ini fitur favorit semua orang (dan kamu dipersilakan posting reaksinya ke TikTok 😄). Yang berbayar hanya kado premium, semuanya di bawah Rp50rb dan sekali bayar.",
  },
  {
    q: "Dia harus install aplikasi atau daftar akun?",
    a: "Nggak sama sekali. Dia cukup buka link di browser apa pun — Android, iPhone, laptop. Halaman confess-nya ringan, cuma puluhan KB.",
  },
  {
    q: "Kami LDR (jarak jauh), cocok nggak?",
    a: "Justru paling cocok. Fitur favorit couple LDR: Open When Letters (surat buat momen-momen tertentu), timeline kisah, playlist bersama, dan kupon yang bisa 'dipakai' pas ketemu.",
  },
  {
    q: "Bisa dipakai buat ulang tahun?",
    a: "Bisa banget. Kombinasi paling populer: timeline scrollytelling + kue digital tiup lilin + surat terakhir. Kamu juga bisa cetak kartu QR dan tempel di kado fisik supaya ada kejutan digitalnya.",
  },
  {
    q: "Datanya aman? Bisa dihapus?",
    a: "Pesan cuma disimpan untuk menampilkan halaman confess dan bisa dihapus kapan pun kamu minta. Kami nggak jual data, nggak ada iklan, nggak ada tracking aneh-aneh.",
  },
];

export default function Faq() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="text-3xl font-extrabold tracking-tight text-rose-950 sm:text-4xl">
            Sering ditanyakan
          </h2>
          <p className="mt-3 text-base text-rose-950/70">
            Masih ragu? Jawabannya di sini.
          </p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-10"
        >
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-rose-100">
                <AccordionTrigger className="text-left text-base font-semibold text-rose-950 hover:text-rose-600 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-rose-950/70">
                  {f.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
