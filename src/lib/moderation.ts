/* ============ Moderasi konten ringan (server-side) ============
 * Tujuan: cegah bullying / ujaran kebencian / spam lewat kado anonim.
 * Bukan AI — wordlist + normalisasi agresif (leetspeak, spasi, simbol).
 * Pelajaran dari NGL: filter ini wajib sebelum produk viral. */

// kata dasar yang diblokir keras (seksual eksplisit, SARA, kekerasan, narkoba)
const HARD_BAN = [
  // seksual eksplisit (ID+EN)
  "ngentot", "ngentod", "entot", "kontol", "memek", "memekmu", "pepek", "peler",
  "titit", "titid", "itil", "toket", "tetek", "gigolo", "bokep", "ngewe", "ewean",
  "colmek", "coli", "masturbasi", "jilat", "blowjob", "cium pantat", "telanjang",
  "fuck", "fucking", "dick", "cock", "pussy", "cunt", "bitch", "whore", "slut",
  "nude", "nudes", "porn", "porno", "horny", "sex", "seks", "rape", "perkosa", "pemerkosa",
  // SARA & hinaan berat
  "anjing lo", "bangsat", "bajingan", "tolol lo", "idiot", "imbecil", "retard",
  "kampret", "pelacur", "lonte", "puki", "pukimak",
  "penis", "vagina", "gay lo", "lesby lo", "sundal", "haramjada", "haram jadah",
  // kekerasan / ancaman
  "bunuh lo", "gawat nyawa", "dibunuh lo", "bakar rumah lo", "ajak bunuh diri",
  "pergi mati", "dasar mati", "mati aja", "mati sana", "mampus lo", "bias mati",
  "kill you", "kill yourself", "kys", "i hate you so much",
  // narkoba / ilegal
  "jual ganja", "beli ganja", "sabu", "obat bius", "obat tidur kuat",
  "judi online", "situs slot", "slot gacor", "pinjol", "hack akun", "ambil alih akun",
  // spam/phishing umum
  "klik link hadiah", "hadiah gratis klik", "free saldo", "saldo gratis klik",
];

// tema sensitif — ditangani dengan pesan khusus yang peduli, bukan cuma ditolak
const SELF_HARM = ["bunuh diri", "pengen mati", "mau mati", "self harm", "suicide", "end my life"];

// pola link: hampir pasti spam/phishing di konteks kado anonim
const URL_RE = /(https?:\/\/|www\.|bit\.ly|tinyurl|s\.id|cutt\.ly|t\.ly|\.com\/|\.link\/|\.xyz\/)/i;

function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/3/g, "e")
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a")
    .replace(/\$/g, "s")
    .replace(/[!*_'".,;:~`^\\/+|-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ModerationVerdict = {
  ok: boolean;
  kind?: "selfharm" | "banned" | "link";
  message?: string;
};

export const MSG_BANNED =
  "Hmm, kata-katanya ketahanin filter kami 🙏 Ini tempat buat sayang-sayangan — coba tulis ulang pake kata-kata yang lebih baik ya.";
export const MSG_LINK =
  "Link nggak boleh dipasang di sini ya 🙏 Tulis pakai kata-kata sendiri aja.";
export const MSG_SELFHARM =
  "Kalau kamu atau orang yang kamu maksud lagi nggak baik-baik aja, tolong hubungi 119 ext. 8 (SEJIWA) ya 🤍 Sayang.in tempatnya bikin senyum, bukan nyakitin.";

export function moderate(...texts: (string | null | undefined)[]): ModerationVerdict {
  const joined = texts.filter(Boolean).join(" \n ");
  const norm = normalize(joined);

  if (URL_RE.test(joined)) return { ok: false, kind: "link", message: MSG_LINK };
  if (SELF_HARM.some((w) => norm.includes(w)))
    return { ok: false, kind: "selfharm", message: MSG_SELFHARM };
  if (HARD_BAN.some((w) => norm.includes(normalize(w))))
    return { ok: false, kind: "banned", message: MSG_BANNED };

  return { ok: true };
}
