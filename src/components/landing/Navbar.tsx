"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { History } from "lucide-react";

const LINKS = [
  { href: "#confess", label: "Confess" },
  { href: "#kado", label: "Kado Digital" },
  { href: "/create", label: "Kado Kejutan 💝" },
  { href: "/history", label: "Kado Saya 🕒" },
  { href: "/dinding", label: "Dinding 👀" },
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
          ? "border-b border-border bg-background/95 backdrop-blur-sm"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a href="#" className="flex items-baseline gap-0.5" aria-label="Kangenin - beranda">
          <span
            className={`font-display text-xl font-bold tracking-tight transition-colors ${
              scrolled ? "text-foreground" : "text-white"
            }`}
          >
            kangen<span className="text-primary">in</span>
          </span>
        </a>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-md px-3.5 py-2 text-sm transition-colors ${
                scrolled
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-white/70 hover:text-white"
              }`}
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Kado Saya (Ghost Dashboard) — selalu ada di mobile (LINKS cuma md+):
              satu-satunya cara user menemukan lagi kado lama tanpa akun. */}
          <Link
            href="/history"
            aria-label="Kado Saya — riwayat kado di perangkat ini"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors md:hidden ${
              scrolled
                ? "border-border text-muted-foreground hover:text-foreground"
                : "border-white/20 text-white/80 hover:text-white"
            }`}
          >
            <History className="h-5 w-5" />
          </Link>
          <a
            href="/create"
            className={`rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              scrolled
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-white text-neutral-900 hover:bg-white/90"
            }`}
          >
            Bikin kado
          </a>
        </div>
      </nav>
    </header>
  );
}
