import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Tentang — Degdegin",
  description:
    "Degdegin dibuat untuk yang malu bilang langsung: confess anonim yang bisa dijawab, surat mingguan, dan kado digital — cukup lewat link.",
};

export default function TentangPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← kembali ke beranda
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">
        Tentang Degdegin
      </h1>

      <div className="mt-8 space-y-6 text-base leading-relaxed text-muted-foreground">
        <p>
          Degdegin lahir dari satu pengamatan sederhana: perasaan paling sulit
          diucapkan justru yang paling jujur. Banyak orang lebih berani
          menuliskannya daripada mengatakannya — tapi chat biasa terlalu
          datar, dan kartu ucapan biasa terlalu satu arah.
        </p>
        <p>
          Jadi Degdegin dibuat berbeda: surat yang <b className="text-foreground">bisa dijawab</b>.
          Penerima membacanya dengan ritual amplop, lalu bisa membalas — dan
          identitas pengirim baru muncul kalau jawabannya &ldquo;iya&rdquo;. Kalau tidak,
          anonim tetap terjaga.
        </p>
        <p>
          Selain confess, ada <b className="text-foreground">Open When Letters</b> (surat
          yang terbuka mingguan untuk momen-momen tertentu) dan{" "}
          <b className="text-foreground">kado digital</b> — buket bunga, photobox, kue
          tiup lilin, love coupons, playlist, dan timeline kisah. Semua
          dikirim sebagai satu link yang dibuka di browser mana pun, tanpa
          install, tanpa akun.
        </p>
        <p>
          Degdegin dibuat di Indonesia, dan selama masa uji coba{" "}
          <b className="text-foreground">semuanya gratis</b>. Kalau kamu suka, ceritakan
          ke temanmu — itu bantuannya yang paling besar.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          ["Tanpa akun", "Tidak perlu daftar, tidak ada email yang diminta."],
          ["Anonim terjaga", "Nama kamu hanya muncul kalau dia bilang iya."],
          ["Cukup satu link", "Dibuka di browser mana pun, ringan dan cepat."],
        ].map(([t, d]) => (
          <div key={t} className="rounded-lg border border-border bg-card p-5">
            <p className="font-display font-bold text-foreground">{t}</p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Siap mencoba?{" "}
        <Link href="/#confess" className="text-primary underline underline-offset-2">
          Tulis suratmu sekarang
        </Link>{" "}
        — gratis.
      </p>
    </main>
  );
}
