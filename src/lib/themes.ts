/**
 * Sumber tunggal (single source of truth) untuk tema surat/kado Kangenin.
 *
 * Dipakai bersama oleh:
 *  - komponen UI (ConfessionView, ConfessSection, GiftView, dst.) untuk
 *    merender pratinjau & pemilih tema;
 *  - API routes (POST /api/confess, /api/gifts, /api/letters) untuk validasi `theme`.
 *
 * ATURAN: menambah/menghapus tema HANYA di file ini — enum validasi API dan
 * pemilih UI otomatis ikut, jadi tidak akan pernah selangkah lagi (bug lama:
 * UI menawarkan "matcha", API hanya menerima "galaksi" → 400).
 */

export type ConfessionTheme = {
  name: string;
  /** kelas gradien tailwind untuk latar kartu/amplop */
  bg: string;
  /** warna aksen (hex) dipakai di halaman surat */
  accent: string;
  /** kelas gradien tailwind untuk segel lilin */
  seal: string;
  /** warna glow radial atas halaman kado (rgba) — dipakai inline style,
   *  BUKAN kelas tailwind (JIT tidak meng-compile class dinamis runtime) */
  glowTop: string;
  /** warna glow radial bawah halaman kado (rgba) */
  glowBottom: string;
  /** Edisi terbatas: hilang dari pemilih tema setelah tanggal ini (FOMO) */
  limited?: { until: string; label: string };
};

export const CONFESS_THEMES: Record<ThemeKey, ConfessionTheme> = {
  rose: {
    name: "Rose",
    bg: "from-[#2b0a1c] via-[#4a0e2e] to-[#160510]",
    accent: "#ff5f9e",
    seal: "from-rose-500 to-rose-700",
    glowTop: "rgba(244,63,94,0.13)",
    glowBottom: "rgba(244,63,94,0.11)",
  },
  sunset: {
    name: "Sunset",
    bg: "from-[#3b0f1e] via-[#7c2d12] to-[#1f0806]",
    accent: "#fb923c",
    seal: "from-orange-500 to-rose-600",
    glowTop: "rgba(251,146,60,0.13)",
    glowBottom: "rgba(251,113,133,0.11)",
  },
  midnight: {
    name: "Midnight",
    bg: "from-[#150620] via-[#3b0764] to-[#0b0313]",
    accent: "#c084fc",
    seal: "from-purple-500 to-fuchsia-700",
    glowTop: "rgba(139,92,246,0.14)",
    glowBottom: "rgba(244,63,94,0.12)",
  },
  // Edisi terbatas 11.11 — cuma sampai 11 Nov, setelah itu tak bisa dipilih lagi
  sakura: {
    name: "Sakura",
    bg: "from-[#3a0d22] via-[#7e2148] to-[#20060f]",
    accent: "#ffb7d5",
    seal: "from-pink-400 to-rose-600",
    glowTop: "rgba(255,183,213,0.13)",
    glowBottom: "rgba(244,114,182,0.11)",
    limited: { until: "2026-11-11T23:59:59+07:00", label: "Edisi 11.11" },
  },
  matcha: {
    name: "Matcha",
    bg: "from-[#0f2118] via-[#1f4d33] to-[#081209]",
    accent: "#86efac",
    seal: "from-emerald-500 to-green-700",
    glowTop: "rgba(134,239,172,0.12)",
    glowBottom: "rgba(52,211,153,0.10)",
  },
};

/** Kunci tema yang valid — dipakai z.enum() di API, urut sesuai pemilih UI. */
export const THEME_KEYS = ["rose", "sunset", "midnight", "sakura", "matcha"] as const;
export type ThemeKey = (typeof THEME_KEYS)[number];

/** Tema kadaluarsa (edisi terbatas lewat) tidak boleh dipilih lagi. */
export function isThemeSelectable(key: string): boolean {
  const t = CONFESS_THEMES[key as ThemeKey];
  if (!t) return false;
  if (t.limited) return new Date(t.limited.until).getTime() > Date.now();
  return true;
}

/** Bentrokan aman: kembalikan tema valid atau fallback (mis. "rose"). */
export function themeOrFallback(key: string | null | undefined, fallback: ThemeKey = "rose"): ThemeKey {
  return key && key in CONFESS_THEMES ? (key as ThemeKey) : fallback;
}

/**
 * Ambil tema kado dari kadoData (Json Prisma) — bentrokan aman.
 * Kado (semua tipe) menyimpan pemilihan Creator Studio di kadoData.theme.
 */
export function themeFromKadoData(
  kadoData: unknown,
  fallback: ThemeKey = "rose"
): ThemeKey {
  if (!kadoData || typeof kadoData !== "object" || Array.isArray(kadoData)) return fallback;
  const raw = (kadoData as Record<string, unknown>).theme;
  return themeOrFallback(typeof raw === "string" ? raw : null, fallback);
}

/** Pesan validasi Indonesia untuk tema tak dikenal. */
export const THEME_INVALID_MESSAGE =
  "Temanya nggak dikenal — pilih salah satu tema yang tersedia ya.";
