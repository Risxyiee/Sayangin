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
    a: "Beneran. Nama kamu itu opsional — kalau tidak diisi, dia hanya melihat 'Seseorang'. Namamu baru ditampilkan kalau dia menjawab 'Iya, aku juga suka kamu'. Kalau dia butuh waktu, identitasmu tetap tersembunyi.",
  },
  {
    q: "Gratis sampai kapan? Ada biaya tersembunyi?",
    a: "Confess selalu gratis, selamanya — kamu juga dipersilakan membagikan reaksinya ke TikTok. Saat ini semua kado premium juga gratis selama masa uji coba; nanti harganya di bawah Rp50rb, sekali bayar, tanpa langganan.",
  },
  {
    q: "Dia harus install aplikasi atau daftar akun?",
    a: "Tidak sama sekali. Dia cukup buka link di browser apa pun — Android, iPhone, laptop. Halaman confess-nya ringan, hanya puluhan KB.",
  },
  {
    q: "Kami LDR (jarak jauh), cocok nggak?",
    a: "Justru paling cocok. Fitur favorit couple LDR: Open When bersegel lilin (surat untuk momen-momen tertentu), timeline kisah, candle blow yang ditiup lewat mic, dan kupon yang bisa 'dipakai' pas ketemu.",
  },
  {
    q: "Bisa dipakai buat ulang tahun?",
    a: "Bisa. Kombinasi paling populer: timeline scrollytelling + candle blow (tiup lilin lewat mic sampai padam) + surat pengakuan. Kamu juga bisa cetak kartu QR dan tempel di kado fisik supaya ada kejutan digitalnya.",
  },
  {
    q: "Datanya aman? Bisa dihapus?",
    a: "Pesan hanya disimpan untuk menampilkan halaman confess dan bisa dihapus kapan pun kamu minta. Kami tidak menjual data, tidak ada iklan, tidak ada tracking.",
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
          <p className="kicker">Pertanyaan umum</p>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Sering ditanyakan
          </h2>
          <p className="mt-3 text-base text-muted-foreground">
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
              <AccordionItem key={i} value={`item-${i}`} className="border-border">
                <AccordionTrigger className="text-left text-base font-semibold text-foreground hover:text-primary hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
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
