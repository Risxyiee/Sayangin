"use client"

/**
 * Tombol muat ulang — dipisah ke Client Component karena Server Component
 * (page.tsx) tidak boleh punya event handler.
 */

import { RefreshCcw } from "lucide-react"

export default function ReloadButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="mt-6 inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/10"
    >
      <RefreshCcw className="h-4 w-4" />
      Muat Ulang
    </button>
  )
}
