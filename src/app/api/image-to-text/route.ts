import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { rateLimit } from "@/lib/rate-limit";
import { describeError } from "@/lib/log-error";

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

export async function POST(req: NextRequest) {
  // anti-spam: 10 gambar per 10 menit per IP (hemat kuota Neurons harian)
  const rl = rateLimit(req, "image-to-text", 10, 10 * 60 * 1000);
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
    const result = (await ai.run(MODEL, {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image: bytes },
          ],
        },
      ],
    })) as { description?: string; response?: string } | string;

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
    return NextResponse.json(
      { error: "Gagal memproses gambar. Coba lagi ya." },
      { status: 500 }
    );
  }
}
