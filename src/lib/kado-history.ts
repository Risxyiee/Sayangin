/**
 * Riwayat kado per perangkat (Ghost Dashboard) — tanpa login.
 *
 * Konsep: Kangenin sengaja tanpa akun biar konversi cepat, tapi user tetap
 * butuh cara menemukan kembali kado yang pernah dibuat di browser ini kalau
 * tab-nya tertutup. Solusinya: setiap kali POST /api/kado sukses, ringkasan
 * kado di-push ke localStorage (kunci "kangenin_history") dan halaman
 * /history membacanya kembali.
 *
 * Aturan aman:
 * - SSR-safe: semua fungsi no-op di server (typeof window === "undefined") —
 *   halaman pembaca HARUS memanggilnya dari useEffect agar tidak hydration
 *   mismatch (render awal server & client identik, data diisi setelah mount).
 * - Anti dobel: id yang sama tidak pernah tersimpan dua kali (double-submit).
 * - Terbatas: maksimum MAX_ENTRIES entri terbaru — localStorage bukan gudang.
 * - Tidak pernah melempar: storage diblokir/penuh/rusak → riwayat dianggap
 *   kosong, alur utama (bikin kado) TIDAK boleh gagal gara-gara ini.
 */

export type KadoHistoryEntry = {
  /** id kado dari POST /api/kado — dipakai rute /kado/<id>/share */
  id: string
  /** judul ringkas untuk kartu, mis. "Untuk Budi" */
  title: string
  /** tanggal dibuat, format YYYY-MM-DD */
  date: string
  /** kadoType, mis. bouquet / openwhen / photobox / coupon / candle / confess */
  type: string
}

export const KADO_HISTORY_KEY = "kangenin_history"

/** Batas riwayat — cukup untuk kenangan, hemat kuota localStorage. */
const MAX_ENTRIES = 50

/** Tanggal hari ini dalam format YYYY-MM-DD (zona waktu lokal perangkat). */
function todayISO(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * Parse string mentah dari localStorage menjadi daftar riwayat tervalidasi,
 * terbaru dulu. Dipisah dari pembacaan agar bisa dipakai pola
 * useSyncExternalStore di halaman (snapshot = string mentah yang stabil).
 */
export function parseKadoHistory(raw: string | null | undefined): KadoHistoryEntry[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // hanya entri yang bentuknya benar — data korup dibuang diam-diam
    const valid = parsed.filter(
      (e): e is KadoHistoryEntry =>
        !!e &&
        typeof e === "object" &&
        typeof (e as KadoHistoryEntry).id === "string" &&
        typeof (e as KadoHistoryEntry).title === "string" &&
        typeof (e as KadoHistoryEntry).date === "string" &&
        typeof (e as KadoHistoryEntry).type === "string"
    )
    return valid.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  } catch {
    return [] // JSON rusak → anggap kosong
  }
}

/**
 * Baca seluruh riwayat kado dari localStorage, terbaru dulu.
 * Aman dipanggil kapan saja — di server mengembalikan array kosong.
 * (Halaman /history memakai useSyncExternalStore + parseKadoHistory;
 * fungsi ini tetap tersedia untuk pemakaian imperatif, mis. skrip/tes.)
 */
export function readKadoHistory(): KadoHistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    return parseKadoHistory(window.localStorage.getItem(KADO_HISTORY_KEY))
  } catch {
    return [] // storage diblokir (mis. mode privat ketat) → anggap kosong
  }
}

/**
 * Simpan satu entri riwayat kado (dipanggil setelah POST /api/kado sukses).
 * Entri dengan id yang sama diganti posisinya jadi paling atas — anti duplikat.
 */
export function saveKadoHistoryEntry(entry: Omit<KadoHistoryEntry, "date"> & { date?: string }): void {
  if (typeof window === "undefined") return
  try {
    const full: KadoHistoryEntry = { date: todayISO(), ...entry }
    const existing = readKadoHistory().filter((e) => e.id !== full.id)
    const next = [full, ...existing].slice(0, MAX_ENTRIES)
    window.localStorage.setItem(KADO_HISTORY_KEY, JSON.stringify(next))
  } catch {
    // storage penuh / mode privat → riwayat tidak tersimpan, biarkan senyap:
    // kegagalan di sini TIDAK boleh mengganggu alur bikin kado.
  }
}
