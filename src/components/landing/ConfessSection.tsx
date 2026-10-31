"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Copy,
  Check,
  Eye,
  Loader2,
  Share2,
  Gift,
  Heart,
  PartyPopper,
} from "lucide-react";
import ConfessionView, { CONFESS_THEMES } from "@/components/confess/ConfessionView";

type Phase = "closed" | "opening" | "letter" | "question" | "yes";
const DEMO_MSG =
  "Hei... aku udah lama pengen bilang ini. Setiap kamu ketawa, aku ikut senyum. Aku suka kamu. Sudah lama. 🙈";

/* ---------- demo looping di dalam HP ---------- */
function PhoneDemo() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [chars, setChars] = useState(0);

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setInterval>;
    if (phase === "closed") {
      t1 = setTimeout(() => setPhase("opening"), 2200);
    } else if (phase === "opening") {
      t1 = setTimeout(() => {
        setPhase("letter");
        setChars(0);
      }, 750);
    } else if (phase === "letter") {
      t2 = setInterval(() => {
        setChars((c) => {
          if (c + 1 >= DEMO_MSG.length) {
            clearInterval(t2);
            setTimeout(() => setPhase("question"), 900);
            return DEMO_MSG.length;
          }
          return c + 1;
        });
      }, 34);
    } else if (phase === "question") {
      t1 = setTimeout(() => setPhase("yes"), 2600);
    } else if (phase === "yes") {
      t1 = setTimeout(() => {
        setPhase("closed");
        setChars(0);
      }, 3400);
    }
    return () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
  }, [phase]);

  return (
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-rose-950 bg-rose-950 shadow-2xl shadow-rose-900/30 sm:w-[310px]">
      {/* notch */}
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-rose-950" />
      <div className="relative h-[480px] overflow-hidden rounded-[1.7rem] bg-gradient-to-b from-[#2b0a1c] via-[#4a0e2e] to-[#160510]">
        {/* hati latar */}
        <div className="absolute inset-0" aria-hidden>
          {[
            { l: "12%", t: "8%", s: 16, d: "0s" },
            { l: "78%", t: "14%", s: 22, d: "1.2s" },
            { l: "20%", t: "72%", s: 14, d: "2s" },
            { l: "82%", t: "66%", s: 18, d: "0.6s" },
            { l: "50%", t: "4%", s: 12, d: "1.6s" },
          ].map((h, i) => (
            <div
              key={i}
              className="absolute anim-drift opacity-30"
              style={{ left: h.l, top: h.t, animationDelay: h.d }}
            >
              <div className="relative" style={{ width: h.s, height: h.s }}>
                <div className="heart-shape" />
              </div>
            </div>
          ))}
        </div>

        {/* layar sesuai fase */}
        {phase === "closed" || phase === "opening" ? (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="font-hand text-2xl text-rose-200">Buat kamu,</p>
            <p className="mt-0.5 text-[11px] text-white/50">
              seseorang meninggalkan surat
            </p>
            <div className="perspective-1200 relative mt-8 h-[120px] w-[180px] anim-float">
              {/* amplop */}
              <div className="absolute inset-0 rounded-lg bg-rose-100 shadow-xl" />
              <div
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-rose-200 to-rose-300"
                style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
              />
              <div
                className="absolute left-0 top-0 h-[58%] w-full rounded-t-lg bg-gradient-to-b from-rose-300 to-rose-400"
                style={{
                  transformOrigin: "top",
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  transform: phase === "opening" ? "rotateX(172deg)" : "rotateX(0deg)",
                  transition: "transform 0.65s ease-in-out",
                }}
              />
              <div
                className="absolute left-1/2 top-[44%] z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 shadow-md"
                style={{
                  animation: phase === "opening" ? undefined : "seal-glow 1.8s ease-in-out infinite",
                  opacity: phase === "opening" ? 0 : 1,
                  transition: "opacity 0.4s",
                }}
              >
                <Heart className="h-4 w-4 fill-white text-white" />
              </div>
            </div>
            <p className="mt-9 text-[11px] text-white/40">
              {phase === "opening" ? "membuka..." : "mengetuk otomatis..."}
            </p>
          </div>
        ) : phase === "yes" ? (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/25 text-5xl anim-heartbeat">
              💗
            </div>
            <p className="mt-5 text-xl font-extrabold text-white">
              Iya, aku juga!
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/70">
              Chat dia sekarang — jangan ditunda 📱
            </p>
            <div className="mt-6 rounded-full bg-white/10 px-4 py-2 text-[10px] text-white/60">
              konfeti 🎉❤️✨ bertebaran
            </div>
          </div>
        ) : (
          /* letter / question */
          <div className="relative z-10 flex h-full flex-col justify-center px-4">
            <div className="rounded-xl bg-[#fffaf5] p-4 text-left shadow-xl">
              <p className="font-hand text-lg leading-6 text-rose-700">
                Hai kamu 🌷
              </p>
              <p className="mt-2 min-h-[92px] text-[11.5px] leading-relaxed text-rose-950/90">
                {DEMO_MSG.slice(0, chars)}
                {phase === "letter" && (
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-rose-500 align-middle" />
                )}
              </p>
              <p className="mt-2 text-right font-hand text-base text-rose-500">
                — Seseorang 🤍
              </p>
            </div>
            {phase === "question" ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-full bg-rose-500 py-2.5 text-center text-[11px] font-bold text-white shadow-lg shadow-rose-500/40">
                  Iya, aku juga suka kamu 💗
                </div>
                <div className="rounded-full border border-white/20 bg-white/5 py-2.5 text-center text-[11px] text-white/80">
                  Beri aku waktu dulu 🥲
                </div>
              </div>
            ) : (
              <p className="mt-4 text-center text-[10px] text-white/30">
                membaca...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- section utama ---------- */
export default function ConfessSection() {
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState("rose");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewData, setPreviewData] = useState<null | {
    fromName: string;
    toName: string;
    message: string;
    theme: string;
  }>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    setError("");
    if (toName.trim().length < 1) {
      setError("Isi dulu nama dia ya 😊");
      return;
    }
    if (message.trim().length < 5) {
      setError("Pesanmu kependekan — minimal 5 karakter.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/confess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: fromName.trim(),
          toName: toName.trim(),
          message: message.trim(),
          theme,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat confess");
      setLink(`${window.location.origin}/?k=${data.slug}`);
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        120
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* diabaikan */
    }
  };

  const shareWA = () => {
    const text = encodeURIComponent(
      `Pssst... ada surat rahasia buat kamu 💌 Buka di sini ya: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <section id="confess" className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute left-1/2 top-0 h-72 w-[720px] -translate-x-1/2 rounded-full bg-rose-200/50 blur-[110px]" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          {/* kiri: copy + form */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-4 py-1.5 text-xs font-bold tracking-wide text-rose-700">
                <PartyPopper className="h-3.5 w-3.5" /> FITUR ANDALAN — 100% GRATIS
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-rose-950 sm:text-4xl">
                Buat kamu yang suka, tapi{" "}
                <span className="font-hand text-4xl text-rose-500">malu</span>{" "}
                bilang langsung 🙈
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-rose-950/70">
                Isi form ini → dapat link → kirim ke dia. Dia buka, baca suratmu
                dengan animasi amplop, lalu pilih jawabannya. Namamu{" "}
                <b>baru muncul kalau dia jawab &ldquo;iya&rdquo;</b>. Kalau nggak?
                Tetap anonim, aman. 😉
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-8 rounded-3xl border border-rose-100 bg-white p-6 shadow-xl shadow-rose-100/70 sm:p-7"
            >
              {!link ? (
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fromName" className="text-rose-950">
                        Nama kamu{" "}
                        <span className="font-normal text-muted-foreground">
                          (kosongin = anonim)
                        </span>
                      </Label>
                      <Input
                        id="fromName"
                        placeholder="misal: Raka"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        maxLength={40}
                        className="border-rose-200 focus-visible:ring-rose-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toName" className="text-rose-950">
                        Nama dia <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="toName"
                        placeholder="misal: Nadia"
                        value={toName}
                        onChange={(e) => setToName(e.target.value)}
                        maxLength={40}
                        className="border-rose-200 focus-visible:ring-rose-400"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-rose-950">
                      Pesan confess kamu <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Contoh: Aku udah perhatiin kamu dari semester 1. Setiap ketawa kamu tuh bikin hariku baik-baik aja. Boleh nggak kita kenalan lebih?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={600}
                      rows={4}
                      className="resize-none border-rose-200 focus-visible:ring-rose-400"
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {message.length}/600
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-rose-950">Tema suratnya</Label>
                    <div className="flex gap-3">
                      {Object.entries(CONFESS_THEMES).map(([key, t]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTheme(key)}
                          aria-label={`Tema ${t.name}`}
                          aria-pressed={theme === key}
                          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            theme === key
                              ? "border-rose-500 bg-rose-50 text-rose-700 shadow-sm"
                              : "border-rose-200 text-rose-950/60 hover:border-rose-300"
                          }`}
                        >
                          <span
                            className={`h-4 w-4 rounded-full bg-gradient-to-br ${
                              key === "rose"
                                ? "from-rose-400 to-rose-700"
                                : key === "sunset"
                                  ? "from-orange-400 to-rose-600"
                                  : "from-purple-400 to-fuchsia-700"
                            }`}
                          />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                      {error}
                    </p>
                  )}

                  <Button
                    onClick={submit}
                    disabled={loading}
                    className="w-full rounded-full bg-rose-500 py-4 text-base font-bold shadow-lg shadow-rose-500/30 hover:bg-rose-600"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bikin
                        suratnya...
                      </>
                    ) : (
                      <>💌 Buat Link Confess — Gratis</>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Tanpa daftar akun. Tanpa install. Link aktif selamanya.
                  </p>
                </div>
              ) : (
                <div ref={resultRef} className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-3xl">
                    🎉
                  </div>
                  <h3 className="text-xl font-extrabold text-rose-950">
                    Suratmu siap dikirim!
                  </h3>
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50/60 p-3 text-left">
                    <span className="flex-1 truncate text-sm font-medium text-rose-900">
                      {link}
                    </span>
                    <Button
                      size="sm"
                      onClick={copy}
                      className="shrink-0 rounded-full bg-rose-500 hover:bg-rose-600"
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={() =>
                        setPreviewData({
                          fromName,
                          toName,
                          message,
                          theme,
                        })
                      }
                      variant="outline"
                      className="rounded-full border-rose-300 text-rose-700 hover:bg-rose-50"
                    >
                      <Eye className="mr-2 h-4 w-4" /> Pratinjau
                    </Button>
                    <Button
                      onClick={shareWA}
                      className="rounded-full bg-emerald-500 hover:bg-emerald-600"
                    >
                      <Share2 className="mr-2 h-4 w-4" /> Kirim via WA
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Tip: kirim pas dia lagi santai (malam hari paling aman 😌).
                    Yang bakal dia lihat persis seperti pratinjau di atas.
                  </p>
                  <button
                    onClick={() => {
                      setLink("");
                      setMessage("");
                    }}
                    className="text-xs font-semibold text-rose-500 underline underline-offset-2 hover:text-rose-600"
                  >
                    buat confess lagi untuk orang lain
                  </button>
                </div>
              )}
            </motion.div>
          </div>

          {/* kanan: HP demo */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative"
          >
            <div className="absolute left-1/2 top-1/2 h-[430px] w-[430px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-300/40 blur-[100px]" />
            <PhoneDemo />
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-rose-950/60">
              <Gift className="h-4 w-4 text-rose-400" />
              Ini simulasi animasi yang diterima dia — coba sendiri gratis di
              form sebelah.
            </div>
          </motion.div>
        </div>
      </div>

      {/* pratinjau fullscreen */}
      {previewData && (
        <ConfessionView
          preview={previewData}
          onClose={() => setPreviewData(null)}
        />
      )}
    </section>
  );
}
