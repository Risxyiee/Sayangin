import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";
import { reportError } from "@/lib/monitor";

/**
 * POST /api/image-to-text — deskripsi gambar via Workers AI (gratis).
 *
 * Binding `AI` (Workers AI) hanya ada di runtime Cloudflare, jadi:
 * - produksi: getCloudflareContext().env.AI.run(...)
 * - lokal/dev: balas 503 dengan pesan jelas
 *
 * Dipakai nanti untuk fitur "upload screenshot → jadi bahan surat kangen".
 * Model vision gratis: @cf/meta/llama-3.2-11b-vision-instruct.
 */

// Tipe minimum binding Workers AI — hindari dependensi @cloudflare/workers-types
type AiBinding = {
  run(model: string, input: unknown): Promise<unknown>;
};

const MODEL = "@cf/meta/llama-3.2-11b-vision-instruct";
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — model vision tak butuh lebih besar
const DEFAULT_PROMPT =
  "Deskripsikan gambar ini secara singkat dan jelas dalam bahasa Indonesia.";

function aiBinding(): AiBinding | undefined {
  try {
    const { env } = getCloudflareContext() as unknown as {
      env?: { AI?: AiBinding };
    };
    return env?.AI;
  } catch {
    return undefined; // bukan runtime Cloudflare (next dev lokal)
  }
}

/* Model vision menerima gambar sebagai data URI base64 (bukan ArrayBuffer). */
function toDataUri(bytes: ArrayBuffer, mime: string): string {
  const u8 = new Uint8Array(bytes);
  let bin = "";
  const CHUNK = 8192; // hindari stack overflow String.fromCharCode(...)
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function POST(req: NextRequest) {
  // anti-spam: 10 gambar per 10 menit per IP (hemat kuota Neurons harian)
  const rl = await rateLimit(req, "image-to-text", 10, 10 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Terlalu sering — coba lagi beberapa menit lagi ya 😅" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const ai = aiBinding();
  if (!ai) {
    return NextResponse.json(
      { error: "Fitur AI hanya tersedia di deploy Cloudflare." },
      { status: 503 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Kirim gambar sebagai multipart/form-data, field 'image'." },
      { status: 400 }
    );
  }

  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Field 'image' wajib diisi (file gambar)." },
      { status: 400 }
    );
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Format harus JPG, PNG, atau WebP." },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Ukuran gambar maksimal 6 MB." },
      { status: 413 }
    );
  }

  const rawPrompt = form.get("prompt");
  const prompt =
    typeof rawPrompt === "string" && rawPrompt.trim().length > 0
      ? rawPrompt.trim().slice(0, 300)
      : DEFAULT_PROMPT;

  try {
    const bytes = await file.arrayBuffer();
    const messages = [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: toDataUri(bytes, file.type) } },
        ],
      },
    ];

    const runVision = () =>
      ai.run(MODEL, { messages, max_tokens: 512 }) as Promise<
        { description?: string; response?: string } | string
      >;

    let result;
    try {
      result = await runVision();
    } catch (firstErr) {
      // Penyebab paling umum: Meta License model ini belum disetujui.
      // Model card mewajibkan satu request awal { prompt: "agree" } —
      // kirim sekali, lalu ulangi panggilan vision-nya.
      console.warn(
        "[image-to-text] run pertama gagal — kirim 'agree' Meta License lalu ulangi:",
        describeError(firstErr)
      );
      try {
        await ai.run(MODEL, { prompt: "agree" });
      } catch {
        /* persetujuan gagal — ulangan tetap dicoba, error aslinya yang menang */
      }
      result = await runVision();
    }

    const description =
      typeof result === "string"
        ? result
        : (result?.description ?? result?.response ?? "");

    if (!description) {
      return NextResponse.json(
        { error: "AI tidak mengembalikan deskripsi. Coba gambar lain." },
        { status: 502 }
      );
    }
    return NextResponse.json({ description });
  } catch (err) {
    console.error("POST /api/image-to-text error:", describeError(err), err);
    reportError(err, { route: "POST /api/image-to-text" });
    return NextResponse.json(
      { error: "Gagal memproses gambar. Coba lagi ya." },
      { status: 500 }
    );
  }
}
