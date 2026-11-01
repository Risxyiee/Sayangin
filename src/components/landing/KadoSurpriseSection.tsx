"use client";

/**
 * KadoSurpriseSection — showcase lima pengalaman premium di Creator Studio
 * (/create). SATU fitur confess di landing (ConfessSection di atas) — versi
 * sinematiknya (Heartstring) tetap ada di Creator Studio sebagai "Kado
 * Confess" dan di-upsell dari panel sukses ConfessSection, bukan ditampilkan
 * sebagai fitur kedua di sini. Kartu lama "06 Confess" DIHAPUS supaya
 * landing tidak terasa punya dua fitur confess.
 *
 * Gaya visual: kicker + heading center, kartu rounded-lg border bg-card
 * dengan nomor, ikon lucide, deskripsi interaksi, dan chip tag — grid
 * sm:2 lg:3 dengan fade-up whileInView.
 */

import { motion } from "framer-motion";
import {
  Camera,
  Flame,
  Flower2,
  Stamp,
  Ticket,
  type LucideIcon,
} from "lucide-react";

const SURPRISES: {
  num: string;
  icon: LucideIcon;
  title: string;
  desc: string;
  tag: string;
}[] = [
  {
    num: "01",
    icon: Flower2,
    title: "Buket Bunga",
    desc: "Tarik pita emasnya pelan-pelan — buketnya mekar satu per satu, pesanmu terbaca di kartu buket.",
    tag: "tarik pita → mekar",
  },
  {
    num: "02",
    icon: Stamp,
    title: "Open When",
    desc: "Amplop vintage bersegel lilin. Tekan segelnya, lilin meleleh, surat perkamen meluncur keluar.",
    tag: "segel lilin meleleh",
  },
  {
    num: "03",
    icon: Camera,
    title: "Photobox",
    desc: "Polaroidnya masih gelap. Goyang HP — atau usap layar — buat 'mencuci' fotonya sampai muncul.",
    tag: "goyang HP → foto jadi",
  },
  {
    num: "04",
    icon: Ticket,
    title: "Love Coupon",
    desc: "Tiket emas holografik yang harus disobek buat diklaim — \"1x bebas ngambek\" dan temannya.",
    tag: "sobek tiket → klaim",
  },
  {
    num: "05",
    icon: Flame,
    title: "Candle Blow",
    desc: "Lilin menyala di ruangan gelap. Tiup lewat mic HP sampai padam — lalu muncul make a wish-nya.",
    tag: "tiup mic → padam",
  },
];

export default function KadoSurpriseSection() {
  return (
    <section id="kejutan" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="kicker">Kado kejutan — buka pakai gerakan</p>
          <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            Kadonya nggak cuma dibuka —{" "}
            <em className="text-primary">dialami dulu.</em>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Lima pengalaman premium di Creator Studio: penerima tidak hanya
            mengeklik link — dia menarik, menggoyang, menyobek, meniup,
            lalu pesanmu muncul. Semuanya gratis selama masa uji.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SURPRISES.map((s, i) => (
            <motion.article
              key={s.num}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="group rounded-lg border border-border bg-card p-6 transition-shadow hover:shadow-[0_16px_40px_-24px_rgba(28,25,23,0.35)]"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
                  <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
                </div>
                <span className="font-display text-sm font-bold text-primary/70">
                  {s.num}
                </span>
              </div>
              <h3 className="mt-5 font-display text-lg font-bold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 min-h-[72px] text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
              <span className="mt-3 inline-block rounded-sm border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                {s.tag}
              </span>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mt-12 text-center"
        >
          <a
            href="/create"
            className="inline-block rounded-md bg-primary px-8 py-4 text-sm font-bold text-white transition-colors hover:bg-[#b52743]"
          >
            Racik kado kejutannya di Creator Studio
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            ±3 menit · gratis selama masa uji · tanpa perlu akun
          </p>
        </motion.div>
      </div>
    </section>
  );
}
