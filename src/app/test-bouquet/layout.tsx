import type { Metadata } from "next"

/**
 * Layout /test-bouquet — hanya menyematkan noindex.
 * Halaman panggung uji/demo internal; jangan muncul di hasil pencarian.
 */
export const metadata: Metadata = {
  title: "Panggung Uji — Bouquet | Kangenin",
  robots: { index: false, follow: false },
}

export default function TestBouquetLayout({ children }: { children: React.ReactNode }) {
  return children
}
