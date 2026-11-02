import type { Metadata } from "next"

/**
 * Layout /test-timeline — hanya menyematkan noindex.
 * Halaman panggung uji/demo internal; jangan muncul di hasil pencarian.
 */
export const metadata: Metadata = {
  title: "Panggung Uji — Timeline | Kangenin",
  robots: { index: false, follow: false },
}

export default function TestTimelineLayout({ children }: { children: React.ReactNode }) {
  return children
}
