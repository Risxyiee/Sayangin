/**
 * fetch + timeout klien (20 dtk bawaan).
 *
 * Pelajaran dari insiden produksi 2026-11-01: saat origin DB mengalami episode
 * gangguan, POST create bisa menggantung belasan detik sebelum merespons —
 * user menatap spinner tanpa umpan balik. Dengan AbortController, UI berhenti
 * menunggu di 20 dtk dan menampilkan pesan "coba lagi" yang jelas.
 *
 * Dipakai khusus untuk aksi create yang butuh kepastian umpan balik (confess,
 * letters, gifts, kado). Fetch GET baca-view tidak dipaksa — halamannya sudah
 * punya stage error sendiri.
 */

/** Pesan ramah untuk abort/timeout — konsisten di semua form create. */
export const FETCH_TIMEOUT_MESSAGE =
  "Servernya lama merespons — koneksi kamu mungkin labil atau servernya lagi sibuk. Coba lagi ya."

export function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError"
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs = 20_000
): Promise<Response> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(timer)
  }
}
