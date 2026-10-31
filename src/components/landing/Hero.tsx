"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

/*
  Hero editorial dengan panggung 3D. Kartu surat melayang di ruang
  berperspektif dan miring mengikuti kursor; setiap elemen kertas —
  perangko, cap pos, selotip, pesawat kertas, segel lilin — berada di
  kedalaman translateZ berbeda sehingga parallax-nya nyata. Bayangan
  lantai bergeser berlawanan arah kemiringan. Tanpa gradien, glow,
  atau partikel.
*/

const PRESERVE_3D: CSSProperties = { transformStyle: "preserve-3d" };

function PaperPlane({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path fill="currentColor" d="M2 21l21-9L2 3v7l15 2-15 2v7z" />
      {/* lipatan kertas di sisi atas */}
      <path fill="#000" fillOpacity="0.28" d="M2 3l15 9L2 10V3z" />
    </svg>
  );
}

function WaxSeal({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-[#8e2137] shadow-[0_12px_24px_-10px_rgba(0,0,0,0.8)] ring-1 ring-black/30 ${
        className ?? ""
      }`}
      style={style}
    >
      <div className="relative h-4 w-4">
        <div className="heart-shape !bg-[#f0e4dc]" />
      </div>
    </div>
  );
}

function LetterCard() {
  return (
    <div className="relative mx-auto w-full max-w-sm" style={PRESERVE_3D}>
      {/* kartu surat */}
      <div
        className="rounded-sm border border-border bg-card p-7 shadow-[0_1px_2px_rgba(28,25,23,0.06),0_12px_32px_-16px_rgba(28,25,23,0.25)]"
        style={PRESERVE_3D}
      >
        {/* baris kepala surat */}
        <div className="flex items-start justify-between" style={PRESERVE_3D}>
          <div className="space-y-2.5 pt-1">
            <div className="h-2 w-28 rounded-sm bg-neutral-200" />
            <div className="h-2 w-20 rounded-sm bg-neutral-200/80" />
          </div>
          {/* perangko — melayang di depan permukaan kartu */}
          <div
            className="flex h-14 w-12 items-center justify-center border-2 border-dashed border-primary/40 bg-primary/5"
            style={{ transform: "translateZ(42px)" }}
          >
            <div className="relative h-5 w-5">
              <div className="heart-shape" />
            </div>
          </div>
        </div>

        {/* salam */}
        <p className="mt-6 font-hand text-2xl leading-none text-primary">
          Buat kamu,
        </p>

        {/* isi surat: baris teks dengan satu baris disorot */}
        <div className="mt-5 space-y-3">
          <div className="h-2 w-full rounded-sm bg-neutral-200" />
          <div className="h-2 w-11/12 rounded-sm bg-neutral-200/90" />
          <div className="h-2 w-4/5 rounded-sm bg-neutral-200/80" />
          <div className="h-2 w-full rounded-sm bg-neutral-200" />
          <div className="h-2 w-2/3 rounded-sm bg-neutral-200/70" />
        </div>

        {/* tanda tangan + cap */}
        <div className="mt-7 flex items-end justify-between" style={PRESERVE_3D}>
          <p className="font-hand text-xl text-foreground/70">— seseorang</p>
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/50 text-center"
            style={{ transform: "translateZ(26px)" }}
          >
            <div className="text-[7px] font-bold uppercase leading-tight tracking-[0.15em] text-primary/70">
              degdegin
              <br />
              pos
              <br />
              2026
            </div>
          </div>
        </div>
      </div>

      {/* selotip kertas — lapisan paling depan */}
      <motion.div
        aria-hidden
        className="absolute -top-2.5 left-8 h-5 w-16 rounded-[2px] bg-secondary/90 shadow-sm"
        style={{ z: 58, rotate: -4 }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-2.5 right-10 h-5 w-14 rounded-[2px] bg-secondary/90 shadow-sm"
        style={{ z: 50, rotate: 3 }}
      />
    </div>
  );
}

/* penghitung live dari /api/stats — bukti sosial ala "X orang sedang melihat".
   Diambil client-side setelah mount supaya tidak bikin hydration mismatch. */
function LiveCounter() {
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && typeof d.total === "number") setTotal(d.total);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  if (total === null) return null;
  return (
    <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs text-white/75 backdrop-blur">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#e8b4bb] opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#e8b4bb]" />
      </span>
      <span>
        <b className="font-bold text-white">
          {total.toLocaleString("id-ID")}
        </b>{" "}
        surat rahasia udah terkirim lewat sini
      </span>
    </p>
  );
}

export default function Hero() {
  const reduce = useReducedMotion();
  const sceneRef = useRef<HTMLDivElement>(null);

  // posisi kursor dinormalisasi (-0.5 .. 0.5), dihaluskan dengan spring
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 150, damping: 18, mass: 0.5 });
  const sy = useSpring(my, { stiffness: 150, damping: 18, mass: 0.5 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [8, -8]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-11, 11]);
  const shadowX = useTransform(sx, [-0.5, 0.5], [20, -20]);

  const handleMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce || e.pointerType === "touch") return;
    const rect = sceneRef.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set((e.clientX - rect.left) / rect.width - 0.5);
    my.set((e.clientY - rect.top) / rect.height - 0.5);
  };
  const handleLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <section
      className="relative overflow-hidden bg-[#211d1a] pb-20 pt-32 sm:pb-24 sm:pt-40"
      aria-label="Pembuka"
    >
      {/* tekstur titik halus, sangat tipis */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr]">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center lg:text-left"
        >
          <p className="kicker !text-[#d9a0a6]">
            Gratis &middot; tanpa akun &middot; cukup lewat link
          </p>

          <div className="mt-4">
            <LiveCounter />
          </div>

          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.12] text-white sm:text-5xl xl:text-[3.6rem]">
            Suka dia, belum berani
            <br className="hidden sm:block" /> bilang langsung?
          </h1>
          <p className="mt-3 font-display text-3xl italic leading-snug text-[#e8b4bb] sm:text-4xl">
            Tulis dia surat.
          </p>

          <p className="mx-auto mt-6 max-w-md text-base leading-relaxed text-white/60 lg:mx-0">
            Degdegin mengubah pesanmu jadi surat yang dikirim sebagai link
            anonim — dia buka, baca pelan-pelan, lalu menjawab. Namamu baru
            muncul kalau jawabannya <i>iya</i>. Sudah jadian? Ada kado
            digitalnya juga.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <a
              href="#confess"
              className="w-full rounded-md bg-primary px-7 py-3.5 text-center text-sm font-bold text-white transition-colors hover:bg-[#b52743] sm:w-auto"
            >
              Tulis suratnya
            </a>
            <a
              href="#kado"
              className="w-full rounded-md border border-white/25 px-7 py-3.5 text-center text-sm font-semibold text-white/90 transition-colors hover:border-white/50 hover:text-white sm:w-auto"
            >
              Lihat kado digital
            </a>
          </div>

          <div className="mt-10 flex items-center justify-center gap-8 text-left lg:justify-start">
            {[
              { v: "Rp0", k: "confess anonim" },
              { v: "±3 menit", k: "dari tulis ke kirim" },
              { v: "6 kado", k: "gratis (masa uji)" },
            ].map((s) => (
              <div key={s.v}>
                <div className="font-display text-lg font-bold text-white">{s.v}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/40">
                  {s.k}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* panggung 3D */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15 }}
          className="pb-4 lg:pb-0"
        >
          <div
            ref={sceneRef}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            className="relative mx-auto max-w-md cursor-default px-4 py-16"
            style={{ perspective: "1300px" }}
          >
            {/* bayangan lantai — bergeser berlawanan arah kemiringan */}
            <div aria-hidden className="absolute inset-x-0 bottom-6 flex justify-center">
              <motion.div
                className="h-7 w-60 rounded-full bg-black/60 blur-xl"
                style={{ x: shadowX }}
                animate={
                  reduce
                    ? undefined
                    : { scaleX: [1, 0.9, 1], opacity: [0.85, 0.6, 0.85] }
                }
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>

            {/* masuk panggung */}
            <motion.div
              style={PRESERVE_3D}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              {/* melayang naik-turun pelan */}
              <motion.div
                style={PRESERVE_3D}
                animate={reduce ? undefined : { y: [0, -12, 0] }}
                transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
              >
                {/* kemiringan mengikuti kursor */}
                <motion.div
                  className="relative"
                  style={{
                    rotateX,
                    rotateY,
                    rotate: -1.5,
                    willChange: "transform",
                    ...PRESERVE_3D,
                  }}
                >
                  {/* goyangan ambient pelan saat kursor tidak di atas kartu */}
                  <motion.div
                    style={PRESERVE_3D}
                    animate={reduce ? undefined : { rotateY: [-2.5, 2.5, -2.5] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                  >
                    <LetterCard />

                    {/* pesawat kertas — lapisan paling depan */}
                    <motion.div
                      aria-hidden
                      className="absolute -top-10 right-4"
                      style={{ z: 95 }}
                      animate={
                        reduce ? undefined : { y: [0, -14, 0], x: [0, 5, 0] }
                      }
                      transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <PaperPlane className="h-8 w-8 rotate-[16deg] text-white/30" />
                    </motion.div>

                    {/* segel lilin — di depan, sisi kiri bawah */}
                    <motion.div
                      aria-hidden
                      className="absolute -bottom-9 -left-4"
                      style={{ z: 75 }}
                      animate={reduce ? undefined : { y: [0, 10, 0] }}
                      transition={{
                        duration: 5.2,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.7,
                      }}
                    >
                      <WaxSeal />
                    </motion.div>

                    {/* hiasan tinta kecil */}
                    <motion.span
                      aria-hidden
                      className="absolute -top-5 left-8 font-display text-lg text-white/25"
                      style={{ z: 60 }}
                      animate={
                        reduce ? undefined : { y: [0, -8, 0], rotate: [0, 12, 0] }
                      }
                      transition={{
                        duration: 6.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 1.3,
                      }}
                    >
                      ✦
                    </motion.span>
                    <motion.span
                      aria-hidden
                      className="absolute top-1/2 -right-7 font-display text-base text-white/15"
                      style={{ z: 45 }}
                      animate={reduce ? undefined : { y: [0, 9, 0] }}
                      transition={{
                        duration: 7,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 2,
                      }}
                    >
                      +
                    </motion.span>
                  </motion.div>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
