import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Bantuan — Degdegin",
  description:
    "Cara pakai Degdegin: confess anonim, Open When Letters, kado digital. Pertanyaan yang paling sering ditanyakan, dijawab to the point.",
};

const QA = [
  {
    q: "Gimana cara confess-nya?",
    a: "Isi form di halaman utama: nama kamu (boleh kosong = anonim), nama dia, dan pesanmu. Klik 'Buat link confess' — kamu dapat satu link untuk dikirim ke dia (lewat WA paling gampang), plus link pantauan khusus buat kamu.",
  },
  {
    q: "Dia gimana cara bukanya?",
    a: "Dia buka link di browser apa pun (tanpa install apa pun), lalu ketuk & tahan amplopnya sampai segel lilinnya terbuka. Pesanmu muncul seperti diketik langsung, disertai hati yang berjatuhan. Di akhir dia bisa menjawab.",
  },
  {
    q: "Aku mau tahu dia udah baca atau belum — bisa?",
    a: "Bisa. Setiap confess dapat link pantauan (?s=...) yang cuma kamu punya. Di situ kelihatan sudah dibuka belum dan apa jawabannya, update otomatis. Dia tidak akan tahu halaman itu ada.",
  },
  {
    q: "Link yang tadi kubuat hilang / lupa disimpan?",
    a: "Tenang — daftar confess kamu juga tersimpan otomatis di perangkatmu (localStorage browser). Buka lagi situsnya dari browser yang sama dan cek bagian form; draft & daftar confess kamu tetap ada. Kalau browsernya beda, sayangnya link tidak bisa dipulihkan — jadi kebiasaan baik: langsung simpan linknya di catatan.",
  },
  {
    q: "Isi draft-ku hilang kalau keluar halaman?",
    a: "Tidak. Draft (nama, pesan, tema) tersimpan otomatis di perangkatmu saat menulis — tutup tab pun tetap ada. Draft baru terhapus setelah link confess berhasil dibuat atau kamu menghapusnya sendiri.",
  },
  {
    q: "Open When Letters itu apa?",
    a: "Kumpulan surat kecil dalam satu link. Kamu tentukan surat apa yang boleh dibuka minggu ke-berapa sejak dia mulai. Cocok buat hadiah ulang tahun, perpisahan, atau buat pasangan LDR.",
  },
  {
    q: "Kado digitalnya apa saja?",
    a: "Buket bunga yang mekar saat ditahan, photobox polaroid, kue tiup lilin, love coupons yang bisa dicoret saat dipakai, playlist bersama, dan timeline kisah kalian. Semua dikirim sebagai satu link.",
  },
  {
    q: "Bayarnya gimana?",
    a: "Confess selalu gratis. Saat masa uji coba, semua kado juga gratis — nanti kalau sudah keluar dari masa uji, harganya di bawah Rp50rb sekali bayar, tanpa langganan.",
  },
  {
    q: "Ada konten yang tidak pantas di link yang kuterima?",
    a: "Setiap halaman confess/kado punya tombol lapor. Cukup 3 laporan, kontennya otomatis disembunyikan dan masuk antrean tinjauan.",
  },
  {
    q: "Bisa hapus confess yang sudah kubuat?",
    a: "Fitur hapus mandiri sedang disiapkan — sementara ini simpan senderKey pantauanmu baik-baik. Data yang kamu kirim tidak dibagikan ke siapa pun (lihat halaman Privasi).",
  },
];

export default function BantuanPage() {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-16 sm:px-6">
      <Link
        href="/"
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← kembali ke beranda
      </Link>
      <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-foreground">
        Bantuan
      </h1>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Semua yang sering ditanyakan soal Degdegin — dijawab to the point.
      </p>

      <div className="mt-10 space-y-3">
        {QA.map((item) => (
          <details
            key={item.q}
            className="group rounded-lg border border-border bg-card p-5 open:bg-card/70"
          >
            <summary className="cursor-pointer list-none font-semibold text-foreground">
              <span className="mr-2 inline-block text-primary transition-transform group-open:rotate-90">
                ›
              </span>
              {item.q}
            </summary>
            <p className="mt-3 pl-5 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Belum terjawab? Coba buka{" "}
        <Link href="/tentang" className="text-primary underline underline-offset-2">
          halaman Tentang
        </Link>{" "}
        — atau langsung coba sendiri,{" "}
        <Link href="/#confess" className="text-primary underline underline-offset-2">
          gratis kok
        </Link>
        .
      </p>
    </main>
  );
}
