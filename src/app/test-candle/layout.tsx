import type { Metadata } from "next"

/**
 * Layout /test-candle — hanya menyematkan noindex.
 * Halaman panggung uji/demo internal; jangan muncul di hasil pencarian.
 */
export const metadata: Metadata = {
  title: "Panggung Uji — Candle | Kangenin",
  robots: { index: false, follow: false },
}

export default function TestCandleLayout({ children }: { children: React.ReactNode }) {
  return children
}
