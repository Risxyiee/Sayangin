"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

const LINKS = [
  { href: "#confess", label: "Confess" },
  { href: "#kado", label: "Kado Digital" },
  { href: "#cara", label: "Cara Pakai" },
  { href: "#harga", label: "Harga" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/85 shadow-sm shadow-rose-100 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-center gap-2" aria-label="Sayang.in - beranda">
          <span className="relative flex h-8 w-8 items-center justify-center">
            <Heart className="h-7 w-7 fill-rose-500 text-rose-500 anim-heartbeat" />
          </span>
          <span
            className={`text-lg font-extrabold tracking-tight ${
              scrolled ? "text-rose-950" : "text-white"
            }`}
          >
            sayang<span className="text-rose-500">.in</span>
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                scrolled
                  ? "text-rose-950/70 hover:bg-rose-50 hover:text-rose-700"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>

        <a
          href="#confess"
          className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/25 transition hover:scale-105 hover:bg-rose-600"
        >
          Buat Confess
        </a>
      </nav>
    </header>
  );
}
