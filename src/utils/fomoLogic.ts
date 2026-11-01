/**
 * fomoLogic — mesin "siapa dia?" di balik fitur kado.
 *
 * Nama asli pengirim tidak boleh bocor sebelum kado dibuka. Yang dipajang di
 * depan penerima cuma inisial bertopeng: "Rizqi" → "R***I".
 *
 * Dipakai SEBELUM data kado disimpan:
 *   const { senderName, fomoInitials } = buildFomoIdentity(nama, isAnonymous)
 *
 *   → senderName   disimpan ke Kado.senderName
 *   → fomoInitials disimpan ke Kado.fomoInitials
 *
 * Kalau pengirim anonim, keduanya null — UI cukup menampilkan "Seseorang".
 */

/** Topeng tetap 3 tanda bintang, sesuai contoh "R***I". */
const MASK = "***"

function firstGlyph(text: string): string {
  return [...text][0] ?? ""
}

function lastGlyph(text: string): string {
  const glyphs = [...text]
  return glyphs[glyphs.length - 1] ?? ""
}

/**
 * Ubah nama pengirim menjadi inisial FOMO.
 *
 * Aturan:
 * - Satu kata      : huruf pertama + "***" + huruf terakhir → "Rizqi" → "R***I"
 * - Banyak kata    : huruf pertama kata pertama + "***" + huruf terakhir kata
 *                    terakhir → "Putri Ayu" → "P***U"
 * - Hasil di-upcase biar konsisten ("rizqi" → "R***I").
 * - Nama 1 huruf   : "A" → "A***" (jangan diulang jadi "A***A").
 * - Null/kosong    : return null (dianggap anonim).
 * - Aman untuk emoji & karakter non-Latin (dipotong per code point).
 */
export function toFomoInitials(rawName: string | null | undefined): string | null {
  const name = (rawName ?? "").trim()
  if (!name) return null

  const words = name.split(/\s+/).filter(Boolean)
  const first = firstGlyph(words[0] ?? "").toUpperCase()
  const last = lastGlyph(words[words.length - 1] ?? "").toUpperCase()

  // Nama 1 huruf: huruf pertama = huruf terakhir, jangan ditulis dua kali.
  return first === last ? `${first}${MASK}` : `${first}${MASK}${last}`
}

export interface FomoIdentity {
  /** Nama asli pengirim — null kalau anonim. Disimpan ke Kado.senderName. */
  senderName: string | null
  /** Inisial bertopeng untuk dipajang — null kalau anonim. Disimpan ke Kado.fomoInitials. */
  fomoInitials: string | null
}

/**
 * Satu pintu sebelum insert/update baris Kado:
 *   buildFomoIdentity("Rizqi", false) → { senderName: "Rizqi", fomoInitials: "R***I" }
 *   buildFomoIdentity("Rizqi", true)  → { senderName: null,     fomoInitials: null }
 *   buildFomoIdentity(null,    false) → { senderName: null,     fomoInitials: null }
 */
export function buildFomoIdentity(
  rawName: string | null | undefined,
  isAnonymous: boolean
): FomoIdentity {
  if (isAnonymous) return { senderName: null, fomoInitials: null }

  const senderName = rawName?.trim() || null
  return { senderName, fomoInitials: toFomoInitials(senderName) }
}
