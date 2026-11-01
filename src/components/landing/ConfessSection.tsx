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
} from "lucide-react";
import ConfessionView, { CONFESS_THEMES } from "@/components/confess/ConfessionView";
import { LS_KEYS, lsGet, lsSet } from "@/lib/local-store";
import { FETCH_TIMEOUT_MESSAGE, fetchWithTimeout, isTimeoutError } from "@/lib/fetch-timeout";

type Phase = "closed" | "opening" | "letter" | "question" | "yes";
const DEMO_MSG =
  "Hei... aku udah lama pengen bilang ini. Setiap kamu ketawa, aku ikut senyum. Aku suka kamu. Sudah lama.";

/* cerita di balik tiap tema — ala kartu template kompetitor, gratis semua.
   Tema ber-flag limited ditampilkan dgn badge mundur (FOMO edisi terbatas). */
const THEME_TAGS: Record<string, string> = {
  rose: "klasik — rahasia paling manis",
  sunset: "hangat kayak senja jam 6",
  midnight: "malam berbintang, dalam",
  sakura: "selembut kelopak yang jatuh",
  matcha: "tenang, hangat kayak matcha latte",
};

/* pilihan jadwal buka — surat terkunci sampai waktunya (countdown di penerima) */
function unlockDateFor(preset: string): string | null {
  if (!preset) return null;
  const d = new Date();
  if (preset === "malam") {
    d.setHours(20, 0, 0, 0);
    if (d.getTime() < Date.now() + 60_000) d.setDate(d.getDate() + 1); // sudah lewat → besok
  } else if (preset === "besok") {
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
  } else if (preset === "minggu") {
    d.setDate(d.getDate() + 7);
  } else {
    return null;
  }
  return d.toISOString();
}

const UNLOCK_OPTIONS = [
  { value: "", label: "Kirim sekarang — dia bisa langsung buka" },
  { value: "malam", label: "Kejutan: buka jam 8 malam nanti 🌙" },
  { value: "besok", label: "Kejutan: buka besok pagi ☀️" },
  { value: "minggu", label: "Kejutan: buka seminggu lagi 📅" },
];

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
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-neutral-800 bg-neutral-800 shadow-xl sm:w-[310px]">
      {/* notch */}
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-neutral-800" />
      <div className="relative h-[480px] overflow-hidden rounded-[1.7rem] bg-[#faf8f3]">
        {/* layar sesuai fase */}
        {phase === "closed" || phase === "opening" ? (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">
            <p className="font-hand text-2xl text-primary">Buat kamu,</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">
              seseorang meninggalkan surat
            </p>
            <div className="perspective-1200 relative mt-8 h-[120px] w-[180px] anim-float">
              {/* amplop */}
              <div className="absolute inset-0 rounded-lg bg-white shadow-md ring-1 ring-black/5" />
              <div
                className="absolute inset-0 rounded-lg bg-[#f3ece2]"
                style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
              />
              <div
                className="absolute left-0 top-0 h-[58%] w-full rounded-t-lg bg-[#ece2d4]"
                style={{
                  transformOrigin: "top",
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  transform: phase === "opening" ? "rotateX(172deg)" : "rotateX(0deg)",
                  transition: "transform 0.65s ease-in-out",
                }}
              />
              <div
                className="absolute left-1/2 top-[44%] z-10 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full bg-primary shadow-md"
                style={{
                  animation: phase === "opening" ? undefined : "seal-glow 1.8s ease-in-out infinite",
                  opacity: phase === "opening" ? 0 : 1,
                  transition: "opacity 0.4s",
                }}
              >
                <Check className="h-4 w-4 text-white" strokeWidth={3} />
              </div>
            </div>
            <p className="mt-9 text-[11px] text-neutral-400">
              {phase === "opening" ? "membuka..." : "mengetuk otomatis..."}
            </p>
          </div>
        ) : phase === "yes" ? (
          <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <div className="relative h-9 w-9 anim-heartbeat">
                <div className="heart-shape" />
              </div>
            </div>
            <p className="mt-5 font-display text-xl font-bold text-neutral-900">
              Iya, aku juga!
            </p>
            <p className="mt-2 text-xs leading-relaxed text-neutral-500">
              Chat dia sekarang — jangan ditunda.
            </p>
          </div>
        ) : (
          /* letter / question */
          <div className="relative z-10 flex h-full flex-col justify-center px-4">
            <div className="rounded-lg bg-white p-4 text-left shadow-md ring-1 ring-black/5">
              <p className="font-hand text-lg leading-6 text-primary">
                Hai kamu,
              </p>
              <p className="mt-2 min-h-[92px] text-[11.5px] leading-relaxed text-neutral-800">
                {DEMO_MSG.slice(0, chars)}
                {phase === "letter" && (
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
                )}
              </p>
              <p className="mt-2 text-right font-hand text-base text-neutral-600">
                — Seseorang
              </p>
            </div>
            {phase === "question" ? (
              <div className="mt-4 space-y-2">
                <div className="rounded-md bg-primary py-2.5 text-center text-[11px] font-bold text-white">
                  Iya, aku juga suka kamu
                </div>
                <div className="rounded-md border border-neutral-300 py-2.5 text-center text-[11px] text-neutral-600">
                  Beri aku waktu dulu
                </div>
              </div>
            ) : (
              <p className="mt-4 text-center text-[10px] text-neutral-400">
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
  const [showOnWall, setShowOnWall] = useState(false);
  const [unlockPreset, setUnlockPreset] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [scheduled, setScheduled] = useState(false);
  const [previewData, setPreviewData] = useState<null | {
    fromName: string;
    toName: string;
    message: string;
    theme: string;
  }>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  /* draft tersimpan otomatis (localStorage) — pulih saat balik ke halaman */
  useEffect(() => {
    try {
      const raw = lsGet(LS_KEYS.draftConfess); // fallback otomatis ke draft era Sayangin
      if (!raw) return;
      const d = JSON.parse(raw) as Record<string, unknown>;
      if (typeof d.fromName === "string") setFromName(d.fromName);
      if (typeof d.toName === "string") setToName(d.toName);
      if (typeof d.message === "string") setMessage(d.message);
      if (typeof d.theme === "string" && CONFESS_THEMES[d.theme]) setTheme(d.theme);
    } catch {
      /* localStorage mungkin diblokir */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      lsSet(
        LS_KEYS.draftConfess,
        JSON.stringify({ fromName, toName, message, theme })
      );
    }, 400);
    return () => clearTimeout(t);
  }, [fromName, toName, message, theme]);

  const clearDraft = () => {
    lsSet(
      LS_KEYS.draftConfess,
      JSON.stringify({ fromName: "", toName: "", message: "", theme: "rose" })
    );
  };

  const submit = async () => {
    setError("");
    if (toName.trim().length < 1) {
      setError("Isi dulu nama dia, ya.");
      return;
    }
    if (message.trim().length < 5) {
      setError("Pesanmu kependekan — minimal 5 karakter.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetchWithTimeout(
        "/api/confess",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromName: fromName.trim(),
            toName: toName.trim(),
            message: message.trim(),
            theme,
            isPublic: showOnWall,
            unlockAt: unlockDateFor(unlockPreset),
          }),
        },
        20_000
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat confess");
      setLink(`${window.location.origin}/?k=${data.slug}`);
      setStatusUrl(`${window.location.origin}/?s=${data.senderKey}`);
      setScheduled(!!unlockDateFor(unlockPreset));
      clearDraft();
      // simpan ke daftar pribadi (localStorage) biar bisa dipantau lagi kapan pun
      try {
        const saved = JSON.parse(lsGet(LS_KEYS.confessions) ?? "[]") as Array<Record<string, string>>;
        saved.unshift({
          slug: data.slug,
          senderKey: data.senderKey,
          toName: toName.trim(),
          theme,
          type: "confess",
          createdAt: new Date().toISOString(),
        });
        lsSet(LS_KEYS.confessions, JSON.stringify(saved.slice(0, 20)));
      } catch {
        /* localStorage mungkin diblokir — status tetap bisa diakses via link */
      }
      setTimeout(
        () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
        120
      );
    } catch (e) {
      setError(
        isTimeoutError(e)
          ? FETCH_TIMEOUT_MESSAGE
          : e instanceof Error
            ? e.message
            : "Terjadi kesalahan. Coba lagi."
      );
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
      `Pssst... ada surat rahasia buat kamu. Buka di sini ya: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  // Web Share API: di HP munculkan share sheet native (WA/IG/TikTok/terserah)
  const shareNative = async () => {
    const text = "Pssst... ada surat rahasia buat kamu 🤫";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Kangenin", text, url: link });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${link}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user batal — diabaikan */
    }
  };

  // Flex ke X: CTA ala "aku berani, kamu kapan?" — link rahasia TIDAK ikut
  const shareX = () => {
    const text = encodeURIComponent(
      `Aku baru berani ngirim surat rahasia lewat Kangenin 💌 Kamu kapan?`
    );
    window.open(
      `https://twitter.com/intent/tweet?text=${text}`,
      "_blank",
      "noopener"
    );
  };

  return (
    <section id="confess" className="relative py-20 sm:py-28">
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
              <p className="kicker">Fitur utama — gratis</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
                Yang malu bilang langsung,{" "}
                <em className="text-primary">tulis di sini.</em>
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-muted-foreground">
                Isi form ini, dapat link, kirim ke dia. Dia buka dan membaca
                suratmu dengan animasi amplop, lalu memilih jawabannya. Namamu{" "}
                <b className="text-foreground">baru muncul kalau dia menjawab &ldquo;iya&rdquo;</b> —
                kalau tidak, kamu tetap anonim.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-8 rounded-lg border border-border bg-card p-6 sm:p-7"
            >
              {!link ? (
                <div className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fromName" className="text-foreground">
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
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="toName" className="text-foreground">
                        Nama dia <span className="text-primary">*</span>
                      </Label>
                      <Input
                        id="toName"
                        placeholder="misal: Nadia"
                        value={toName}
                        onChange={(e) => setToName(e.target.value)}
                        maxLength={40}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-foreground">
                      Pesan confess kamu <span className="text-primary">*</span>
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Contoh: Aku udah perhatiin kamu dari semester 1. Setiap ketawa kamu tuh bikin hariku baik-baik aja. Boleh nggak kita kenalan lebih?"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      maxLength={600}
                      rows={4}
                      className="resize-none"
                    />
                    <p className="text-right text-xs text-muted-foreground">
                      {message.length}/600 · draft tersimpan otomatis di
                      perangkatmu
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-foreground">
                      Tema suratnya{" "}
                      <span className="font-normal text-muted-foreground">
                        (ada yang cuma muncul beberapa hari 👀)
                      </span>
                    </Label>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {Object.entries(CONFESS_THEMES).map(([key, t]) => {
                        // hitung sisa hari edisi terbatas — makin makin mepet, makin panas
                        const daysLeft = t.limited
                          ? Math.ceil(
                              (new Date(t.limited.until).getTime() - Date.now()) /
                                86_400_000
                            )
                          : null;
                        const expired = daysLeft !== null && daysLeft <= 0;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setTheme(key)}
                            aria-label={`Tema ${t.name} — ${THEME_TAGS[key]}${t.limited ? ` (${t.limited.label})` : ""}`}
                            aria-pressed={theme === key}
                            disabled={expired}
                            className={`relative rounded-lg border p-3 text-left transition ${
                              theme === key
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-input"
                            } ${expired ? "hidden" : ""}`}
                          >
                            {t.limited && daysLeft !== null && (
                              <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
                                {t.limited.label} · {daysLeft} hari lagi
                              </span>
                            )}
                            <span
                              className={`mb-2 block h-9 w-full rounded-md bg-gradient-to-br ${t.bg} shadow-inner ring-1 ring-black/20`}
                              aria-hidden
                            />
                            <span className="block text-xs font-bold text-foreground">
                              {t.name}
                            </span>
                            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                              {THEME_TAGS[key]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* jadwal buka — bikin penerima balik lagi (FOMO + antisipasi) */}
                  <div className="space-y-2">
                    <Label htmlFor="unlock" className="text-foreground">
                      Jadwal buka{" "}
                      <span className="font-normal text-muted-foreground">
                        — opsional, rahasia sampai waktunya
                      </span>
                    </Label>
                    <select
                      id="unlock"
                      value={unlockPreset}
                      onChange={(e) => setUnlockPreset(e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {UNLOCK_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* opt-in dinding publik — mesin viral, isi surat TETAP rahasia */}
                  <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/40 p-3.5 transition hover:bg-secondary">
                    <input
                      type="checkbox"
                      checked={showOnWall}
                      onChange={(e) => setShowOnWall(e.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span className="text-xs leading-relaxed text-foreground">
                      <b>Tampilkan di Dinding Kangenin</b> — namamu &amp; tema
                      suratnya ikut pajangan publik biar orang lain ikut
                      berani. Isi surat <b>100% tetap rahasia</b>, kok.
                    </span>
                  </label>

                  {error && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  <Button
                    onClick={submit}
                    disabled={loading}
                    className="w-full rounded-md bg-primary py-3.5 text-sm font-bold text-white hover:bg-[#b52743]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Bikin
                        suratnya...
                      </>
                    ) : (
                      <>Buat link confess</>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Tanpa daftar akun, tanpa install — link-nya langsung
                    aktif dan siap dikirim.
                  </p>
                </div>
              ) : (
                <div ref={resultRef} className="space-y-4 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                    <Check className="h-5 w-5 text-primary" strokeWidth={3} />
                  </div>
                  <h3 className="font-display text-xl font-bold text-foreground">
                    {scheduled
                      ? "Suratmu terjadwal — dia cuma bisa nunggu 👀"
                      : "Suratmu siap dikirim."}
                  </h3>
                  {scheduled && (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      Sampai waktunya, dia cuma melihat hitungan mundur dan
                      pengirimnya rahasia. Antisipasinya bikin deg-degan —
                      itu gunanya.
                    </p>
                  )}
                  <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3 text-left">
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {link}
                    </span>
                    <Button
                      size="sm"
                      onClick={copy}
                      className="shrink-0 rounded-md bg-foreground text-background hover:bg-foreground/85"
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
                      className="rounded-md border-border text-foreground hover:bg-secondary"
                    >
                      <Eye className="mr-2 h-4 w-4" /> Pratinjau
                    </Button>
                    <Button
                      onClick={shareWA}
                      className="rounded-md bg-[#1faa59] text-white hover:bg-[#189249]"
                    >
                      <Share2 className="mr-2 h-4 w-4" /> Kirim via WA
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      onClick={shareNative}
                      variant="outline"
                      className="rounded-md border-border text-foreground hover:bg-secondary"
                    >
                      <Share2 className="mr-2 h-4 w-4" /> Bagikan
                    </Button>
                    <Button
                      onClick={shareX}
                      variant="outline"
                      className="rounded-md border-border text-foreground hover:bg-secondary"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="mr-2 h-4 w-4 fill-current"
                        aria-hidden
                      >
                        <path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41Z" />
                      </svg>
                      Post ke X
                    </Button>
                  </div>
                  <a
                    href={statusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-md border border-border bg-secondary py-3 text-sm font-bold text-foreground transition-colors hover:bg-accent"
                  >
                    <Eye className="h-4 w-4" /> Pantau status: udah dibuka belum?
                  </a>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Halaman status itu cuma buat kamu — dia tidak tahu.
                    Simpan linknya; di sana kelihatan sudah dibuka belum dan
                    apa jawabannya (update otomatis).
                  </p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Tip: kirim pas dia lagi santai — malam hari paling aman.
                    Yang dia lihat persis seperti pratinjau di atas.
                  </p>
                  <a
                    href="/create"
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    mau versi sinematiknya? bikin Kado Confess — segel detak
                    jantung — di Creator Studio →
                  </a>
                  <a
                    href="/kado/demo-confess?pratinjau=1"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    atau cobain dulu seremoninya: Coba Demo Kado Confess 👁
                  </a>
                  <button
                    onClick={() => {
                      setLink("");
                      setStatusUrl("");
                      setMessage("");
                      setFromName("");
                      setToName("");
                    }}
                    className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
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
            <PhoneDemo />
            <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <span>
                Ini simulasi yang diterima dia — coba sendiri lewat form di
                sebelah.
              </span>
              <button
                type="button"
                onClick={() =>
                  setPreviewData({
                    fromName: "",
                    toName: "Kamu",
                    message: DEMO_MSG,
                    theme: "rose",
                  })
                }
                className="text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
              >
                atau buka contoh suratnya fullscreen
              </button>
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
