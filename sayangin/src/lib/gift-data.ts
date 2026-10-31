/**
 * Tipe, skema, & util konten kado digital (dipakai API + view).
 * Isi kado disimpan sebagai string JSON di kolom Gift.data —
 * skema di bawah dipakai buat validasi sebelum masuk DB.
 */
import { z } from "zod";

export const GIFT_TYPES = ["bouquet", "photobox", "cake", "coupons", "playlist"] as const;
export type GiftType = (typeof GIFT_TYPES)[number];

export const GIFT_META: Record<
  GiftType,
  { emoji: string; label: string; ogTitle: (toName: string) => string }
> = {
  bouquet: {
    emoji: "💐",
    label: "Buket Digital",
    ogTitle: (t) => `Ada buket bunga buat ${t} 💐`,
  },
  photobox: {
    emoji: "📸",
    label: "Photobox Digital",
    ogTitle: (t) => `Ada strip foto spesial buat ${t} 📸`,
  },
  cake: {
    emoji: "🎂",
    label: "Kue Tiup Lilin",
    ogTitle: (t) => `Ada kue + permintaan buat ${t} 🎂`,
  },
  coupons: {
    emoji: "🎫",
    label: "Love Coupons",
    ogTitle: (t) => `Ada kupon cinta buat ${t} 🎟️`,
  },
  playlist: {
    emoji: "🎵",
    label: "Playlist Kita",
    ogTitle: (t) => `Ada playlist spesial buat ${t} 🎵`,
  },
};

/* ---------- bunga buat buket ---------- */
export const FLOWERS = {
  rose: { emoji: "🌹", label: "Mawar" },
  tulip: { emoji: "🌷", label: "Tulip" },
  sunflower: { emoji: "🌻", label: "Matahari" },
  lavender: { emoji: "🪻", label: "Lavender" },
  daisy: { emoji: "🌼", label: "Daisy" },
  sakura: { emoji: "🌸", label: "Sakura" },
} as const;
export type FlowerId = keyof typeof FLOWERS;
export const FLOWER_IDS = Object.keys(FLOWERS) as FlowerId[];

/* ---------- skema data per tipe ---------- */
export const bouquetDataSchema = z.object({
  card: z.string().trim().min(5, "Kartu ucapannya minimal 5 karakter").max(400),
  flowers: z.array(z.enum(FLOWER_IDS as [FlowerId, ...FlowerId[]])).min(3, "Pilih minimal 3 bunga").max(9),
});

export const photoboxDataSchema = z.object({
  caption: z.string().trim().min(2, "Caption minimal 2 karakter").max(60),
  note: z.string().trim().max(300).optional().default(""),
  photos: z
    .array(
      z
        .string()
        .regex(/^data:image\/(jpeg|png|webp);base64,/, "Format foto nggak didukung")
        .max(220_000, "Fotonya kegedean — coba yang lebih kecil")
    )
    .min(3, "Pilih minimal 3 foto")
    .max(4, "Maksimal 4 foto"),
});

export const cakeDataSchema = z.object({
  occasion: z.enum(["ultah", "anniversary", "graduasi"]),
  message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(300),
});

export const couponsDataSchema = z.object({
  coupons: z
    .array(
      z.object({
        title: z.string().trim().min(2, "Judul kupon minimal 2 karakter").max(40),
        desc: z.string().trim().max(80).optional().default(""),
      })
    )
    .min(3, "Minimal 3 kupon ya")
    .max(6, "Maksimal 6 kupon"),
});

export const playlistSongSchema = z.object({
  title: z.string().trim().min(1, "Tiap lagu harus ada judulnya").max(80),
  artist: z.string().trim().max(60).optional().default(""),
  note: z
    .string()
    .trim()
    .max(120, "Catatannya maksimal 120 karakter")
    .optional()
    .default(""),
  link: z
    .string()
    .trim()
    .max(300, "Linknya kepanjangan")
    .optional()
    .default("")
    .refine(
      (v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v),
      "Link lagunya harus diawali http:// atau https://"
    ),
});

export const playlistDataSchema = z.object({
  title: z.string().trim().min(3, "Judul playlistnya minimal 3 karakter").max(60),
  message: z.string().trim().min(5, "Catatan penutupnya minimal 5 karakter").max(400),
  songs: z
    .array(playlistSongSchema)
    .min(3, "Minimal 3 lagu ya 🎵")
    .max(15, "Maksimal 15 lagu"),
});

export type BouquetData = z.infer<typeof bouquetDataSchema>;
export type PhotoboxData = z.infer<typeof photoboxDataSchema>;
export type CakeData = z.infer<typeof cakeDataSchema>;
export type CouponsData = z.infer<typeof couponsDataSchema>;
export type PlaylistSong = z.infer<typeof playlistSongSchema>;
export type PlaylistData = z.infer<typeof playlistDataSchema>;

export type GiftProgress = { redeemed?: Record<string, string> };

/** Kumpulkan semua teks bebas dari data kado buat difilter moderasi. */
export function giftTexts(type: string, data: unknown): string[] {
  const d = data as Record<string, unknown>;
  switch (type) {
    case "bouquet":
      return [String(d.card ?? "")];
    case "photobox":
      return [String(d.caption ?? ""), String(d.note ?? "")];
    case "cake":
      return [String(d.message ?? "")];
    case "coupons":
      return (Array.isArray(d.coupons) ? d.coupons : []).map((c) => {
        const o = c as { title?: string; desc?: string };
        return `${o.title ?? ""} ${o.desc ?? ""}`;
      });
    case "playlist":
      return [
        String(d.title ?? ""),
        String(d.message ?? ""),
        ...(Array.isArray(d.songs) ? d.songs : []).map((s) => {
          const o = s as { title?: string; artist?: string; note?: string };
          return `${o.title ?? ""} ${o.artist ?? ""} ${o.note ?? ""}`;
        }),
      ];
    default:
      return [];
  }
}
