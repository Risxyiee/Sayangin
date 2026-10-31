"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  ChevronDown,
  Copy,
  Eye,
  Heart,
  Loader2,
  Lock,
  LockOpen,
  MailOpen,
  Share2,
  Sparkles,
  BookOpenCheck,
} from "lucide-react";
import { CONFESS_THEMES } from "@/components/confess/ConfessionView";

type DraftLetter = { title: string; body: string; unlockDays: number };

/* ---------- preset template surat ---------- */
const PRESETS: Record<string, { label: string; emoji: string; letters: DraftLetter[] }> = {
  romantis: {
    label: "Romantis",
    emoji: "💗",
    letters: [
      {
        title: "Open When kamu kangen aku",
        unlockDays: 0,
        body: "Iya, aku juga lagi kangen kamu. Aneh ya, rasanya kayak ada yang kurang pas kamu nggak ada. Tarik napas pelan-pelan — kamu kangen, aku juga. Kita sama-sama kuat sampai ketemu lagi. 🤍",
      },
      {
        title: "Open When kamu lagi sedih",
        unlockDays: 7,
        body: "Kamu lagi sedih ya? Nggak apa-apa, nangis aja dulu kalau perlu. Kamu udah hebat banget bisa bertahan sejauh ini. Ingat ya: hari yang buruk bukan berarti hidup yang buruk. Aku di sini, selalu. 🤗",
      },
      {
        title: "Open When kamu capek banget",
        unlockDays: 14,
        body: "Tarik napas dulu. Kamu udah ngelakuin banyak hal hari ini, dan itu luar biasa. Rehat sebentar — dunia nggak kemana-mana kok. Kalau udah kuat lagi, aku yakin kamu bisa. Aku bangga sama kamu. 💪🤍",
      },
      {
        title: "Open When kamu kangen suara aku",
        unlockDays: 21,
        body: "Coba buka foto kita yang paling kamu suka. Terasa kan? Nanti malam teleponan lama-lama ya, aku pengen dengar cerita kamu semuanya — sampai ketawa-ketawa nggak jelas lagi. 📞💗",
      },
      {
        title: "Open When kamu mau tidur",
        unlockDays: 28,
        body: "Sebelum tidur, satu hal dulu: kamu berarti banget buat aku. Mimpi indah ya, jangan lupa selimutnya. Besok kita mulai hari baru lagi — pelan-pelan aja. Good night, sayang. 🌙✨",
      },
    ],
  },
  supportif: {
    label: "Supportif",
    emoji: "🤍",
    letters: [
      {
        title: "Open When kamu butuh semangat",
        unlockDays: 0,
        body: "Hei, tarik napas dulu. Kamu udah sejauh ini, dan itu bukan hal kecil. Hari ini cuma butuh versi kamu yang 'cukup', bukan yang sempurna. Kamu lebih kuat dari yang kamu kira. Gas terus, pelan-pelan. ✨",
      },
      {
        title: "Open When kamu ragu sama diri sendiri",
        unlockDays: 7,
        body: "Ragu itu tandanya kamu peduli sama hasilnya, bukan tandanya kamu nggak mampu. Ingat waktu kamu berhasil melewati hal yang dulu kelihatannya mustahil? Kamu udah buktiin sekali, bisa lagi. 🤍",
      },
      {
        title: "Open When kamu merasa nggak cukup baik",
        unlockDays: 14,
        body: "Kalau kamu bisa dilihat pakai mataku, kamu bakal lihat orang yang selalu usaha, pernah bikin orang lain senyum, dan terus belajar. 'Cukup baik' itu mitos — kamu udah lebih dari cukup. 💛",
      },
      {
        title: "Open When kamu pengen menyerah",
        unlockDays: 21,
        body: "Boleh istirahat, tapi jangan menyerah ya. Bedanya cuma satu langkah kecil, tapi hasilnya jauh banget. Tarik napas, hitung sampai sepuluh, terus satu langkah kecil lagi. Aku percaya kamu bisa. 🤍",
      },
      {
        title: "Open When kamu lupa seberapa hebat kamu",
        unlockDays: 28,
        body: "Bikin daftar 3 hal yang kamu raih bulan ini — walau kecil. Nggak kehitung kan? Itu bukti kamu terus gerak maju. Simpen surat ini buat dibaca lagi kapan pun kamu lupa. Kamu hebat, beneran. ✨🤍",
      },
    ],
  },
};

/* ---------- demo HP: grid amplop ---------- */
function LettersPhoneDemo() {
  return (
    <div className="relative mx-auto w-[290px] rounded-[2.4rem] border-[10px] border-rose-950 bg-rose-950 shadow-2xl shadow-rose-900/30 sm:w-[310px]">
      <div className="absolute left-1/2 top-0 z-30 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-rose-950" />
      <div className="relative h-[480px] overflow-hidden rounded-[1.7rem] bg-gradient-to-b from-[#2b0a1c] via-[#4a0e2e] to-[#160510]">
        <div className="relative z-10 flex h-full flex-col px-4 py-6">
          <p className="text-center font-hand text-2xl text-rose-200">Buat kamu 🤍</p>
          <p className="mt-0.5 text-center text-[11px] text-white/50">
            1 dari 5 surat sudah kamu baca
          </p>
          <div className="mx-auto mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/5 rounded-full bg-gradient-to-r from-rose-400 to-rose-600" />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {/* sudah dibaca */}
            <div className="relative rounded-xl border border-rose-300/20 bg-white/[0.06] p-3 text-center">
              <span className="absolute -right-1 -top-1 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500 p-0.5 text-white">
                <BookOpenCheck className="h-2.5 w-2.5" />
              </span>
              <div className="relative mx-auto h-11 w-16">
                <div className="absolute inset-0 rounded bg-rose-100" />
                <div
                  className="absolute inset-0 rounded bg-gradient-to-br from-rose-200 to-rose-300"
                  style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
                />
              </div>
              <p className="mt-1.5 font-hand text-[11px] leading-3 text-rose-100">
                Open When kangen
              </p>
              <p className="mt-0.5 text-[8px] text-white/40">sudah dibaca</p>
            </div>
            {/* baru terbuka */}
            <div className="relative rounded-xl border border-rose-300/50 bg-rose-500/10 p-3 text-center shadow-lg shadow-rose-500/10">
              <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[7.5px] font-bold text-white anim-heartbeat">
                BARU
              </span>
              <div className="relative mx-auto h-11 w-16 anim-float">
                <div className="absolute inset-0 rounded bg-rose-100 shadow" />
                <div
                  className="absolute inset-0 rounded bg-gradient-to-br from-rose-200 to-rose-300"
                  style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
                />
                <div
                  className="absolute left-0 top-0 h-[58%] w-full rounded-t bg-gradient-to-b from-rose-300 to-rose-400"
                  style={{ clipPath: "polygon(0 0, 100% 0, 50% 100%)" }}
                />
                <div className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700">
                  <Heart className="h-2 w-2 fill-white text-white" />
                </div>
              </div>
              <p className="mt-1.5 font-hand text-[11px] leading-3 text-rose-100">
                Open When sedih
              </p>
              <p className="mt-0.5 text-[8px] text-rose-300">tap buka sekarang 💌</p>
            </div>
            {/* terkunci x2 + 1 */}
            {[
              { label: "Open When capek", t: "bisa dibuka 6 hari lagi", d: "0s" },
              { label: "Open When kangen suara", t: "bisa dibuka 13 hari lagi", d: "0.6s" },
              { label: "Open When mau tidur", t: "bisa dibuka 20 hari lagi", d: "1.1s" },
            ].map((l, i) => (
              <div
                key={i}
                className={`relative rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center ${
                  i === 2 ? "col-span-2" : ""
                }`}
                style={{ animation: `float-y ${5 + i}s ease-in-out ${l.d} infinite` }}
              >
                <div className="relative mx-auto h-11 w-16">
                  <div className="absolute inset-0 rounded bg-white/10" />
                  <div
                    className="absolute inset-0 rounded bg-white/10"
                    style={{ clipPath: "polygon(0 18%, 50% 62%, 100% 18%, 100% 100%, 0 100%)" }}
                  />
                  <div className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15">
                    <Lock className="h-2 w-2 text-white/60" />
                  </div>
                </div>
                <p className="mt-1.5 font-hand text-[11px] leading-3 text-white/40">{l.label}</p>
                <p className="mt-0.5 text-[8px] text-white/35">{l.t}</p>
              </div>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-center gap-1.5 text-[9px] text-white/35">
            <LockOpen className="h-2.5 w-2.5" /> satu surat terbuka tiap minggu
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- section utama ---------- */
export default function OpenWhenSection() {
  const [preset, setPreset] = useState<keyof typeof PRESETS>("romantis");
  const [fromName, setFromName] = useState("");
  const [toName, setToName] = useState("");
  const [theme, setTheme] = useState("rose");
  const [letters, setLetters] = useState<DraftLetter[]>(PRESETS.romantis.letters);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [statusUrl, setStatusUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  const applyPreset = (key: keyof typeof PRESETS) => {
    setPreset(key);
    setLetters(PRESETS[key].letters);
    setOpenIdx(null);
  };

  const editLetter = (idx: number, patch: Partial<DraftLetter>) => {
    setLetters((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  };

  const submit = async () => {
    setError("");
    if (toName.trim().length < 1) {
      setError("Isi dulu nama dia ya 😊");
      return;
    }
    const bad = letters.findIndex((l) => l.title.trim().length < 2 || l.body.trim().length < 5);
    if (bad !== -1) {
      setError(`Surat #${bad + 1} belum lengkap — cek judul & isinya ya.`);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromName: fromName.trim(),
          toName: toName.trim(),
          theme,
          letters: letters.map((l) => ({
            title: l.title.trim(),
            body: l.body.trim(),
            unlockDays: l.unlockDays,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Gagal membuat surat");
      setLink(`${window.location.origin}/?k=${data.slug}`);
      setStatusUrl(`${window.location.origin}/?s=${data.senderKey}`);
      // simpan ke daftar pribadi (sama dgn confess) biar bisa dipantau lagi
      try {
        const saved = JSON.parse(
          localStorage.getItem("sayangin_confessions") ?? "[]"
        ) as Array<Record<string, string>>;
        saved.unshift({
          slug: data.slug,
          senderKey: data.senderKey,
          toName: toName.trim(),
          theme,
          type: "letters",
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem(
          "sayangin_confessions",
          JSON.stringify(saved.slice(0, 20))
        );
      } catch {
        /* localStorage mungkin diblokir */
      }
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
      `Aku bikinin ${letters.length} surat kecil buat kamu 💌 Satu boleh dibuka tiap minggu — pelan-pelan aja bacanya ya: ${link}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <section id="openwhen" className="relative overflow-hidden py-20 sm:py-28">
      <div className="absolute left-1/2 top-1/3 h-72 w-[720px] -translate-x-1/2 rounded-full bg-rose-200/40 blur-[110px]" />
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
                <Sparkles className="h-3.5 w-3.5" /> FITUR FAVORIT COUPLE LDR — GRATIS
              </span>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-rose-950 sm:text-4xl">
                5 surat kecil,{" "}
                <span className="font-hand text-4xl text-rose-500">dibuka tiap minggu</span>{" "}
                📬
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-rose-950/70">
                Kamu tulis sekali, dia buka pelan-pelan selama sebulan. Surat
                pertama langsung terbuka, sisanya terbuka 1 per minggu — biar
                dia balik lagi, lagi, dan lagi. 🥹
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
                  {/* preset */}
                  <div className="space-y-2">
                    <Label className="text-rose-950">Mau buat siapa?</Label>
                    <div className="flex gap-3">
                      {Object.entries(PRESETS).map(([key, p]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => applyPreset(key as keyof typeof PRESETS)}
                          aria-pressed={preset === key}
                          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${
                            preset === key
                              ? "border-rose-500 bg-rose-50 text-rose-700 shadow-sm"
                              : "border-rose-200 text-rose-950/60 hover:border-rose-300"
                          }`}
                        >
                          <span>{p.emoji}</span> {p.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Isi suratnya udah kami siapin — tinggal edit kalau mau.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ow-from" className="text-rose-950">
                        Nama kamu{" "}
                        <span className="font-normal text-muted-foreground">
                          (kosongin = rahasia)
                        </span>
                      </Label>
                      <Input
                        id="ow-from"
                        placeholder="misal: Raka"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        maxLength={40}
                        className="border-rose-200 focus-visible:ring-rose-400"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ow-to" className="text-rose-950">
                        Nama dia <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="ow-to"
                        placeholder="misal: Nadia"
                        value={toName}
                        onChange={(e) => setToName(e.target.value)}
                        maxLength={40}
                        className="border-rose-200 focus-visible:ring-rose-400"
                      />
                    </div>
                  </div>

                  {/* editor surat */}
                  <div className="space-y-2">
                    <Label className="text-rose-950">Isi suratnya ({letters.length} surat)</Label>
                    <div className="space-y-2">
                      {letters.map((l, i) => {
                        const open = openIdx === i;
                        return (
                          <div
                            key={i}
                            className={`overflow-hidden rounded-xl border transition-colors ${
                              open ? "border-rose-300 bg-rose-50/40" : "border-rose-100 bg-white"
                            }`}
                          >
                            <div className="flex items-center gap-2 p-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-xs font-bold text-rose-600">
                                {i + 1}
                              </span>
                              <Input
                                value={l.title}
                                onChange={(e) => editLetter(i, { title: e.target.value })}
                                maxLength={80}
                                aria-label={`Judul surat ${i + 1}`}
                                className="h-8 border-0 bg-transparent px-1 text-sm font-semibold shadow-none focus-visible:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => setOpenIdx(open ? null : i)}
                                aria-expanded={open}
                                aria-label={`Edit isi surat ${i + 1}`}
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rose-500 transition hover:bg-rose-100"
                              >
                                <ChevronDown
                                  className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
                                />
                              </button>
                            </div>
                            {open && (
                              <div className="px-3 pb-3">
                                <Textarea
                                  value={l.body}
                                  onChange={(e) => editLetter(i, { body: e.target.value })}
                                  maxLength={600}
                                  rows={4}
                                  aria-label={`Isi surat ${i + 1}`}
                                  className="resize-none border-rose-200 text-sm focus-visible:ring-rose-400"
                                />
                                <p className="mt-1 text-right text-[11px] text-muted-foreground">
                                  {l.body.length}/600 • terbuka{" "}
                                  {l.unlockDays === 0
                                    ? "hari ini"
                                    : `minggu ke-${l.unlockDays / 7}`}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyegel suratnya...
                      </>
                    ) : (
                      <>📬 Segel {letters.length} Surat — Gratis</>
                    )}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Tanpa daftar akun. Dia balik tiap minggu buka suratnya. 🥹
                  </p>
                </div>
              ) : (
                <div ref={resultRef} className="space-y-4 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-3xl">
                    📬
                  </div>
                  <h3 className="text-xl font-extrabold text-rose-950">
                    {letters.length} suratmu sudah tersgel!
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
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      onClick={() => window.open(link, "_blank")}
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
                  <a
                    href={statusUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 rounded-full border border-amber-300 bg-amber-50 py-3 text-sm font-bold text-amber-700 transition hover:bg-amber-100"
                  >
                    <Eye className="h-4 w-4" /> Pantau: dia udah baca surat ke berapa?
                  </a>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Waktu buka mulai berjalan pas dia tekan &ldquo;mulai&rdquo; — bukan pas
                    kamu kirim. Jadi santai, pratinjau dulu juga nggak apa-apa. 😉
                  </p>
                  <button
                    onClick={() => {
                      setLink("");
                      setStatusUrl("");
                    }}
                    className="text-xs font-semibold text-rose-500 underline underline-offset-2 hover:text-rose-600"
                  >
                    buat set surat lagi untuk orang lain
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
            <LettersPhoneDemo />
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-rose-950/60">
              <Heart className="h-4 w-4 text-rose-400" />
              Beginilah yang dilihat dia — satu terbuka tiap minggu.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
