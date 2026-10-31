// OpenNext Cloudflare — konversi output Next.js menjadi Cloudflare Worker.
// Doc: https://opennext.js.org/cloudflare
// Tanpa incremental cache R2 dulu (halaman dinamis + client-side; R2 = upgrade opsional).
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
