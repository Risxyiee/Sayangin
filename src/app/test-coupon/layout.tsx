import type { Metadata } from "next"

/**
 * Layout /test-coupon — hanya menyematkan noindex.
 * Halaman panggung uji/demo internal; jangan muncul di hasil pencarian.
 */
export const metadata: Metadata = {
  title: "Panggung Uji — Coupon | Kangenin",
  robots: { index: false, follow: false },
}

export default function TestCouponLayout({ children }: { children: React.ReactNode }) {
  return children
}
