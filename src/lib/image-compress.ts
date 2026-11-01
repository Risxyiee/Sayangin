/**
 * Kompresi foto di sisi klien — dipakai Creator Studio (Photobox & Timeline).
 *
 * Foto dibaca sebagai DataURL, digambar ulang ke <canvas> (sisi terpanjang
 * dibatasi maxDim, PNG transparan diberi latar putih), lalu diekspor JPEG
 * dengan kualitas adaptif sampai ukuran base64-nya masuk batas
 * (default 200.000 karakter — di bawah plafon 220.000 API kado).
 *
 * Tanpa dependensi — File API + Canvas, aman di semua browser modern.
 */

/** Batas karakter base64 per foto (harus < 220.000 plafon API). */
export const PHOTO_MAX_BASE64 = 200_000

/** Tipe mime yang diterima — sesuai regex validasi API. */
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp"

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(String(fr.result))
    fr.onerror = () => reject(new Error("Gagal membaca berkas foto"))
    fr.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Foto nggak bisa dibuka — coba file lain"))
    img.src = src
  })
}

/** Kompres satu berkas foto → data URL JPEG siap disimpan sebagai base64. */
export async function compressImageFile(
  file: File,
  opts?: { maxDim?: number; maxBase64?: number }
): Promise<string> {
  const maxBase64 = opts?.maxBase64 ?? PHOTO_MAX_BASE64
  const raw = await readAsDataURL(file)

  // Cek format: regex sama dengan validasi API (jpeg/png/webp data URL).
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(raw)) {
    throw new Error("Format foto nggak didukung — pakai JPG, PNG, atau WebP")
  }

  const img = await loadImage(raw)
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) throw new Error("Foto nggak bisa dibaca")

  const maxDim = opts?.maxDim ?? 1024
  const scale = Math.min(1, maxDim / Math.max(iw, ih))
  const w = Math.max(1, Math.round(iw * scale))
  const h = Math.max(1, Math.round(ih * scale))

  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Canvas tidak tersedia di browser ini")
  ctx.fillStyle = "#ffffff" // PNG transparan → latar putih, bukan hitam
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)

  // Kualitas adaptif: turun bertahap sampai muat batas.
  for (const q of [0.82, 0.72, 0.62, 0.52, 0.42, 0.34, 0.28]) {
    const out = canvas.toDataURL("image/jpeg", q)
    if (out.length <= maxBase64) return out
  }

  // Masih kegedean → gambar ulang dari foto asli dengan dimensi setengah.
  const w2 = Math.max(1, Math.round(w / 2))
  const h2 = Math.max(1, Math.round(h / 2))
  canvas.width = w2
  canvas.height = h2
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, w2, h2)
  ctx.drawImage(img, 0, 0, w2, h2)
  const final = canvas.toDataURL("image/jpeg", 0.5)
  if (final.length <= maxBase64) return final
  throw new Error("Fotonya kegedean — coba pilih yang lebih kecil")
}
