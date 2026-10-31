"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

/* ============ 1. BUKET DIGITAL: bunga mekar ============ */
function BuketAnim() {
  const flowers = [
    { left: "18%", delay: "0.9s", color: "#f43f5e" },
    { left: "46%", delay: "1.4s", color: "#fb7185" },
    { left: "72%", delay: "1.9s", color: "#e11d48" },
  ];
  return (
    <div className="relative h-full w-full">
      {/* kertas bungkus */}
      <div
        className="absolute bottom-2 left-1/2 h-36 w-40 -translate-x-1/2 bg-gradient-to-b from-rose-200 to-rose-300 shadow-inner"
        style={{ clipPath: "polygon(0 12%, 100% 0, 88% 100%, 12% 100%)" }}
      />
      <div
        className="absolute bottom-2 left-1/2 h-36 w-40 -translate-x-1/2 bg-white/40"
        style={{ clipPath: "polygon(0 12%, 50% 0, 50% 100%, 12% 100%)" }}
      />
      {/* pita */}
      <div className="absolute bottom-9 left-1/2 z-10 h-3.5 w-20 -translate-x-1/2 rounded-full bg-rose-500 shadow" />
      <div className="absolute bottom-11 left-1/2 z-10 -translate-x-1/2">
        <div className="relative h-4 w-4 rotate-45 rounded-sm bg-rose-600" />
      </div>
      {/* batang */}
      {flowers.map((f, i) => (
        <div
          key={i}
          className="absolute bottom-12 h-24 w-1 origin-bottom rounded bg-emerald-500"
          style={{
            left: `calc(${f.left} + 8px)`,
            animation: `grow-stem 5s ease-out ${f.delay} infinite`,
          }}
        />
      ))}
      {/* kepala bunga mekar */}
      {flowers.map((f, i) => (
        <div
          key={`h${i}`}
          className="absolute bottom-32 z-10"
          style={{
            left: f.left,
            animation: `bloom-flower 5s ease-out ${f.delay} infinite`,
          }}
        >
          <div className="relative h-8 w-8">
            <span className="absolute inset-x-0 top-0 mx-auto h-4 w-4 rounded-full" style={{ background: f.color }} />
            <span className="absolute bottom-0 left-0 h-4 w-4 rounded-full" style={{ background: f.color }} />
            <span className="absolute bottom-0 right-0 h-4 w-4 rounded-full" style={{ background: f.color }} />
            <span className="absolute bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-amber-300" />
          </div>
        </div>
      ))}
      {/* kelip */}
      {[
        { l: "10%", t: "18%", d: "2.6s" },
        { l: "86%", t: "24%", d: "3.4s" },
        { l: "60%", t: "10%", d: "4.1s" },
      ].map((s, i) => (
        <span
          key={`s${i}`}
          className="absolute text-sm"
          style={{ left: s.l, top: s.t, animation: `sparkle-pop 5s ease ${s.d} infinite` }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

/* ============ 2. OPEN WHEN LETTERS ============ */
function OpenWhenAnim() {
  const letters = [
    { label: "Open when you miss me", rot: "-8deg", x: "6%", z: 10, delay: "0s" },
    { label: "Open when you can't sleep", rot: "3deg", x: "22%", z: 20, delay: "0.4s" },
    { label: "Open on our 1st date", rot: "-2deg", x: "38%", z: 30, delay: "0.8s" },
  ];
  return (
    <div className="relative h-full w-full">
      <span className="absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap font-hand text-xl text-rose-500">
        buat hari-hari beratmu 🤍
      </span>
      {letters.map((l, i) => (
        <div
          key={i}
          className="absolute bottom-10 h-24 w-40 rounded-lg border border-rose-200 bg-white shadow-lg"
          style={{
            left: l.x,
            transform: `rotate(${l.rot})`,
            zIndex: l.z,
            animation: `float-y ${4 + i}s ease-in-out ${l.delay} infinite`,
          }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-1.5 px-3">
            <div className="h-1.5 w-3/4 rounded bg-rose-100" />
            <p className="text-center font-hand text-[13px] leading-4 text-rose-700">
              {l.label}
            </p>
          </div>
          {i === 2 && (
            <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-md anim-wiggle">
              <span className="text-[10px] text-white">♥</span>
            </div>
          )}
        </div>
      ))}
      {/* segel */}
      <div className="absolute bottom-1 left-1/2 z-40 -translate-x-1/2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow" style={{ animation: "seal-glow 2.2s ease-in-out infinite" }}>
          <span className="text-xs text-white">♥</span>
        </div>
      </div>
    </div>
  );
}

/* ============ 3. PHOTOBOX ============ */
function PhotoboxAnim() {
  const pics = [
    { rot: "-7deg", x: "12%", grad: "from-rose-300 via-pink-200 to-amber-200", cap: "first date 🌷", delay: "0s" },
    { rot: "3deg", x: "34%", grad: "from-amber-200 via-rose-200 to-rose-300", cap: "capek tapi lucu 😴", delay: "0.5s" },
    { rot: "-2deg", x: "56%", grad: "from-pink-200 via-rose-300 to-rose-400", cap: "senyummu 🤍", delay: "1s" },
  ];
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-6 bottom-8 top-6 rounded-xl bg-neutral-900 shadow-2xl" />
      {pics.map((p, i) => (
        <div
          key={i}
          className="absolute bottom-14 w-24 rounded-md bg-white p-1.5 pb-5 shadow-lg"
          style={{
            left: p.x,
            transform: `rotate(${p.rot})`,
            animation: `pop-in 5s ease ${p.delay} infinite, float-y ${4 + i * 0.7}s ease-in-out ${p.delay} infinite`,
          }}
        >
          <div className={`grain relative h-20 rounded-sm bg-gradient-to-br ${p.grad}`} />
          <p className="mt-1 text-center font-hand text-[11px] leading-3 text-neutral-600">
            {p.cap}
          </p>
        </div>
      ))}
      <span className="absolute right-5 top-4 text-xs font-bold tracking-widest text-white/50">
        SAYANG.STUDIO ✦ 2026
      </span>
    </div>
  );
}

/* ============ 4. KUE DIGITAL: tiup lilin (interaktif) ============ */
function KueAnim() {
  const [lit, setLit] = useState(true);
  return (
    <button
      type="button"
      onClick={() => {
        setLit(false);
        setTimeout(() => setLit(true), 4000);
      }}
      aria-label={lit ? "Tiup lilinnya" : "Nyalakan lagi lilinnya"}
      className="relative h-full w-full cursor-pointer text-center"
    >
      <p className={`font-hand text-lg transition-colors ${lit ? "text-rose-500" : "text-rose-300"}`}>
        {lit ? "ada 3 permintaan nih… tiup! 💨" : "yeay! semua permintaan jadi 🎉"}
      </p>
      {/* api */}
      <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="relative h-10 w-2">
            {lit ? (
              <span
                className="absolute -top-4 left-1/2 h-5 w-3 -translate-x-1/2 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-amber-200 via-amber-400 to-orange-500 shadow-[0_0_16px_4px_rgba(251,191,36,0.55)]"
                style={{ animation: `flame-flicker 0.35s ease-in-out ${i * 0.12}s infinite` }}
              />
            ) : (
              <span
                className="absolute -top-8 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-gray-300/80 blur-[3px]"
                style={{ animation: "smoke-rise 1.6s ease-out infinite", animationDelay: `${i * 0.3}s` }}
              />
            )}
            {/* lilin */}
            <span className="absolute bottom-0 left-1/2 h-9 w-2 -translate-x-1/2 rounded-sm bg-gradient-to-b from-rose-300 to-rose-400" />
          </div>
        ))}
      </div>
      {/* kue */}
      <div className="absolute bottom-6 left-1/2 w-40 -translate-x-1/2">
        <div className="mx-auto h-9 w-40 rounded-t-md bg-gradient-to-b from-pink-300 to-pink-400" />
        <div className="relative mx-auto h-10 w-36 rounded-t-md bg-gradient-to-b from-rose-300 to-rose-400">
          <div className="absolute -top-1 left-2 h-3 w-3 rounded-b-full bg-rose-200" />
          <div className="absolute -top-1 left-9 h-4 w-3 rounded-b-full bg-rose-200" />
          <div className="absolute -top-1 right-8 h-3 w-3 rounded-b-full bg-rose-200" />
          <div className="absolute -top-1 right-3 h-4 w-3 rounded-b-full bg-rose-200" />
        </div>
        <div className="mx-auto h-9 w-32 rounded-b-xl bg-gradient-to-b from-rose-400 to-rose-500 shadow-lg" />
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-rose-400">
        {lit ? "tap untuk meniup 🎂" : "tap untuk menyalakan ulang"}
      </span>
    </button>
  );
}

/* ============ 5. LOVE COUPONS ============ */
function CouponsAnim() {
  const coupons = ["1× Pelukan Gratis", "1× Nonton Pilihanmu", "1× Sarapan Dibawain"];
  const [idx, setIdx] = useState(0);
  return (
    <button
      type="button"
      onClick={() => setIdx((i) => (i + 1) % coupons.length)}
      aria-label="Ganti kupon"
      className="relative h-full w-full"
    >
      <div
        key={idx}
        className="absolute left-1/2 top-1/2 w-56 -translate-x-1/2 -translate-y-1/2 rotate-[-3deg] overflow-hidden rounded-xl border-2 border-dashed border-rose-400 bg-white shadow-xl"
        style={{ animation: "pop-in 0.5s ease" }}
      >
        <div className="flex items-center justify-between bg-rose-500 px-3 py-1.5">
          <span className="text-[9px] font-bold tracking-widest text-white">SAYANG.IN CO.</span>
          <span className="text-[9px] font-bold text-white">NO EXPIRY ♾️</span>
        </div>
        <div className="relative px-4 py-5">
          <p className="font-hand text-2xl text-rose-700">{coupons[idx]}</p>
          <p className="mt-1 text-[10px] text-rose-400">berlaku kapan pun kamu minta</p>
          <span
            className="pointer-events-none absolute inset-y-0 w-10 bg-white/70 blur-md"
            style={{ animation: "shimmer-sweep 2.8s ease-in-out infinite" }}
          />
        </div>
        <div className="absolute -left-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-rose-50" />
        <div className="absolute -right-2.5 top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-rose-50" />
      </div>
      <span className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-rose-400">
        tap untuk ganti kupon 🎫
      </span>
    </button>
  );
}

/* ============ 6. PLAYLIST KITA ============ */
function PlaylistAnim() {
  const songs = [
    { t: "Monolog - Pamungkas", active: true },
    { t: "Rumah Ke Rumah - Hindia", active: false },
    { t: "Sial - Mahalini", active: false },
  ];
  return (
    <div className="relative flex h-full w-full items-center justify-center gap-5">
      {/* piringan hitam */}
      <div className="relative h-28 w-28 shrink-0 anim-spin-slow">
        <div
          className="h-full w-full rounded-full bg-neutral-900 shadow-xl"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at center, #1c1c1c 0 2px, #2b2b2b 2px 4px)",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500">
          <div className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neutral-900" />
        </div>
      </div>
      {/* lagu */}
      <div className="w-36 space-y-2">
        <div className="flex items-end gap-1 pb-1">
          {[0.9, 0.5, 1.1, 0.7, 1.3, 0.6].map((d, i) => (
            <span
              key={i}
              className="w-1.5 origin-bottom rounded-t bg-rose-500"
              style={{ height: 14 + i * 3, animation: `eq-bounce ${d}s ease-in-out infinite` }}
            />
          ))}
        </div>
        {songs.map((s, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-medium ${
              s.active ? "bg-rose-100 text-rose-700" : "bg-white/80 text-rose-950/60"
            }`}
          >
            <span>{s.active ? "▶" : "♡"}</span>
            <span className="truncate">{s.t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============ daftar kado ============ */
const GIFTS = [
  {
    id: "buket",
    anim: <BuketAnim />,
    emoji: "🌷",
    title: "Buket Digital",
    desc: "Buket bunga yang nggak pernah layu — bunganya mekar satu-satu pas dia buka. Buat anniversary, mumpuni, atau sekadar bikin dia senyum.",
    tag: "pengganti buket Rp150rb",
  },
  {
    id: "openwhen",
    anim: <OpenWhenAnim />,
    emoji: "💌",
    title: "Open When Letters",
    desc: "5 surat terkunci: buka pas kangen, pas gabut, pas missing you banget. Favorit couple LDR di seluruh Indonesia.",
    tag: "surat tangan → digital",
  },
  {
    id: "photobox",
    anim: <PhotoboxAnim />,
    emoji: "📸",
    title: "Photobox Digital",
    desc: "Strip foto gaya photobox mall, versi digital. Upload foto kalian, kasih caption, dia bisa simpan langsung ke galeri.",
    tag: "photobox Rp50rb → gratis ongkir",
  },
  {
    id: "kue",
    anim: <KueAnim />,
    emoji: "🎂",
    title: "Kue Tiup Lilin",
    desc: "Kue ulang tahun interaktif: dia tiup lilinnya (tap layar), asap keluar, konfeti muncul. Tetap kirim kue beneran kalau bisa!",
    tag: "kue tiba-tiba hilang? nggak akan",
  },
  {
    id: "coupons",
    anim: <CouponsAnim />,
    emoji: "🎫",
    title: "Love Coupons",
    desc: "Buku kupon manual yang dulu kalian buat dari kertas HVS — sekarang versi rapi yang nggak bisa hilang & nggak bisa dipalsu.",
    tag: "kupon kertas → anti lecek",
  },
  {
    id: "playlist",
    anim: <PlaylistAnim />,
    emoji: "🎵",
    title: "Playlist Kita",
    desc: "Halaman lagu-lagunya kalian berdua, lengkap dengan piringan hitam berputar dan catatan kenangan di tiap lagu.",
    tag: "playlist Spotify → halaman spesial",
  },
];

export default function GiftsSection() {
  return (
    <section id="kado" className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-bold tracking-wide text-rose-700">
            <Sparkles className="h-3.5 w-3.5" /> KADO YANG BIASA DIKASIH → VERSI DIGITAL
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-rose-950 sm:text-4xl">
            Kado favorit orang pacaran,{" "}
            <span className="text-gradient-rose">sekarang jadi link.</span>
          </h2>
          <p className="mt-3 text-base leading-relaxed text-rose-950/70">
            Kami riset apa yang paling sering dikasih couple di Indonesia —
            lalu ubah semuanya jadi kado digital yang nggak bisa hilang, rusak,
            atau kedaluwarsa.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {GIFTS.map((g, i) => (
            <motion.article
              key={g.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
              className="group overflow-hidden rounded-3xl border border-rose-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-rose-200/60"
            >
              <div className="relative h-48 overflow-hidden bg-gradient-to-br from-rose-50 to-rose-100 p-4">
                {g.anim}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{g.emoji}</span>
                  <h3 className="text-lg font-extrabold text-rose-950">{g.title}</h3>
                </div>
                <p className="mt-2 min-h-[72px] text-sm leading-relaxed text-rose-950/70">
                  {g.desc}
                </p>
                <span className="mt-3 inline-block rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600">
                  {g.tag}
                </span>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
