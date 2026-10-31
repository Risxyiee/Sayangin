// Util token/slug acak — dipakai confess, letters & gifts.
// Karakter sengaja tanpa 0/O/1/I biar gampang dibaca saat copy manual.
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * CSPRNG-based (Web Crypto) — aman untuk senderKey yang jadi satu-satunya
 * kunci panel pantauan. Jangan pakai Math.random(): prediktabel.
 * crypto.getRandomValues() tersedia di Node 18+, Edge Runtime, dan
 * Cloudflare Workers — cocok untuk rencana deploy Cloudflare.
 *
 * Rejection sampling supaya distribusi karakter benar-benar seragam
 * (256 % 31 ≠ 0, jadi ada nilai byte yang dibuang).
 */
function randomIndex(max: number): number {
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);
  return value % max;
}

export function makeToken(length = 16): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CHARS[randomIndex(CHARS.length)];
  }
  return s;
}

export function makeSlug(length = 8): string {
  return makeToken(length);
}
