"use client";

const ITEMS = [
  "Buket Digital 🌷",
  "Open When Letters 💌",
  "Photobox 📸",
  "Kue Digital 🎂",
  "Love Coupons 🎫",
  "Playlist Kita 🎵",
  "Confess Anonim 🤫",
  "Timeline Kisah 📖",
];

export default function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      className="relative overflow-hidden border-y border-rose-200/60 bg-rose-50 py-3.5"
      aria-hidden
    >
      <div
        className="flex w-max items-center gap-8 whitespace-nowrap"
        style={{ animation: "marquee-x 26s linear infinite" }}
      >
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-8 text-sm font-semibold tracking-wide text-rose-800/80"
          >
            {t}
            <span className="text-rose-400">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
