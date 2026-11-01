"use client";

const ITEMS = [
  "Buket Digital",
  "Open When Letters",
  "Photobox",
  "Kue Tiup Lilin",
  "Love Coupons",
  "Dinding Confess",
  "Confess Anonim",
  "Timeline Kisah",
];

export default function Marquee() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div
      className="relative overflow-hidden bg-[#211d1a] py-3.5"
      aria-hidden
    >
      <div
        className="flex w-max items-center gap-10 whitespace-nowrap"
        style={{ animation: "marquee-x 30s linear infinite" }}
      >
        {row.map((t, i) => (
          <span
            key={i}
            className="flex items-center gap-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/50"
          >
            {t}
            <span className="h-1 w-1 rounded-full bg-primary" aria-hidden />
          </span>
        ))}
      </div>
    </div>
  );
}
