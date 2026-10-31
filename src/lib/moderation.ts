/**
 * Moderasi ringan buat konten UGC (confess & surat).
 *
 * Filosofi: blokir kata keras (profanity, seksual eksplisit, SARA, ancaman)
 * sebelum masuk DB. Bukan pengganti review manusia — kombinasi dgn tombol lapor.
 *
 * Strategi matching biar gak gampang di-bypass tapi minim false positive:
 * 1. Normalisasi: lowercase, leet speak (4→a, 3→e, 0→o, 1→i, 5→s),
 *    dan huruf berulang 3+ kali diringkas (anjiiiir → anjir).
 * 2. Kata tunggal: cocokkan persis; kalau panjang >= 6 boleh cek "mengandung"
 *    (nangkep "ngentotan" dkk). Kata pendek harus persis — biar "banjir"
 *    gak kena "anjir".
 * 3. Frasa (mis. "bunuh diri"): cek di teks utuh yang sudah diratakan
 *    (spasi & simbol dibuang).
 */

// Kata terlarang: profanity kasar, seksual eksplisit, SARA, ancaman kekerasan.
// Daftar sengaja moderat — perluasan bisa mengikuti laporan pengguna.
const PROHIBITED = [
  // profanity kasar (id)
  "anjing", "anjir", "ajg", "bangsat", "bego", "tolol", "goblok", "bodoh",
  "jancok", "jancuk", "ngentot", "ngentod", "kontol", "memek", "pepek",
  "peler", "titit", "bugil", "telanjang", "bokep", "porn", "porno",
  "sange", "colmek", "pukimak", "celaka", "keparat", "brengsek",
  "bajingan", "banci",
  // ancaman / kekerasan
  "bunuh diri", "gantung diri", "mutilasi", "perkosa", "pemerkosa",
  "bacok", "tembak mati",
  // narkoba
  "narkoba", "ganja", "sabu", "ekstasi",
  // english yang relevan
  "fuck", "fucking", "bitch", "bastard", "asshole", "dumbass", "stupid",
  "retard", "slut", "whore", "pussy", "pornhub",
  "kill yourself", "kys", "rape", "nigger", "nigga",
] as const;

const LEET: Record<string, string> = {
  "4": "a", "@": "a", "3": "e", "0": "o", "1": "i", "!": "i",
  "5": "s", "$": "s", "7": "t", "9": "g",
};

/** Ringkas huruf berulang 3+ jadi 1 (anjiiiir → anjir) */
function collapseRuns(s: string): string {
  let out = "";
  let run = 0;
  let prev = "";
  for (const ch of s) {
    if (ch === prev) {
      run += 1;
      if (run >= 3) continue; // skip huruf ke-3 dst
    } else {
      prev = ch;
      run = 1;
    }
    out += ch;
  }
  return out;
}

function normalizeToken(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/[4@301!5$79]/g, (c) => LEET[c] ?? c);
  s = s.replace(/[^a-z]/g, ""); // buang angka/simbol sisa
  return collapseRuns(s);
}

/** Teks utuh → huruf saja (buat cek frasa) */
function flatten(text: string): string {
  return collapseRuns(text.toLowerCase().replace(/[^a-z]/g, ""));
}

/**
 * Cek teks terhadap daftar terlarang.
 * Return kata yang kena (untuk pesan error) atau null kalau bersih.
 */
export function findProhibited(text: string): string | null {
  if (!text) return null;

  const words = text
    .toLowerCase()
    .split(/[\s.,!?;:'"()[\]{}\\/|_\-+=*&#~`^<>]+/)
    .filter(Boolean);

  const tokens = words.map(normalizeToken).filter((t) => t.length >= 2);
  const flat = flatten(text);

  for (const banned of PROHIBITED) {
    const b = collapseRuns(banned.toLowerCase()).replace(/[^a-z]/g, "");
    if (!b) continue;

    // frasa multi-kata → cocokkan di teks utuh yang diratakan
    if (banned.includes(" ")) {
      if (flat.includes(b)) return banned;
      continue;
    }

    for (const tok of tokens) {
      if (tok === b || (b.length >= 6 && tok.includes(b))) return banned;
    }
  }
  return null;
}

/** Pesan error ramah buat ditampilkan ke user */
export const MODERATION_ERROR =
  "Ada kata yang nggak boleh dipakai di sini. Tolong ulang pakai bahasa yang baik ya 🙏";
