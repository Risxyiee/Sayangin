import type { Metadata } from "next"

/**
 * Layout /test-confess — hanya menyematkan noindex.
 * Halaman panggung uji/demo internal; jangan muncul di hasil pencarian.
 */
export const metadata: Metadata = {
  title: "Panggung Uji — Confess | Kangenin",
  robots: { index: false, follow: false },
}

export default function TestConfessLayout({ children }: { children: React.ReactNode }) {
  return children
}
