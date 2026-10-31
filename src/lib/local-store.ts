// Kunci localStorage + pembacaan back-compat.
// Nama merek sudah dua kali berganti: Sayangin → Degdegin → Kangenin.
// Draft & daftar confess lama di perangkat user tetap dibaca dari
// kunci era sebelumnya biar tidak "hilang".
const PREFIX = "kangenin";
const LEGACY = ["degdegin", "sayangin"] as const;

export const LS_KEYS = {
  draftConfess: `${PREFIX}_draft_confess`,
  confessions: `${PREFIX}_confessions`,
} as const;

/** Baca localStorage dengan fallback otomatis ke kunci era sebelumnya. */
export function lsGet(key: string): string | null {
  try {
    for (const legacy of LEGACY) {
      const old = localStorage.getItem(key.replace(PREFIX, legacy));
      if (old !== null) return old;
    }
    return localStorage.getItem(key);
  } catch {
    return null; // localStorage bisa diblokir (mode privat dsb.)
  }
}

/** Tulis localStorage — diam saja kalau diblokir browser. */
export function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* diabaikan */
  }
}
