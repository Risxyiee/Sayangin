// Util token/slug acak — dipakai confess & letters.
// Karakter sengaja tanpa 0/O/1/I biar gampang dibaca saat copy manual.
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export function makeToken(length = 16): string {
  let s = "";
  for (let i = 0; i < length; i++) {
    s += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return s;
}

export function makeSlug(length = 8): string {
  return makeToken(length);
}
