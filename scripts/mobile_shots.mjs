/**
 * Screenshot mobile (iPhone 13) halaman-halaman kunci produksi — untuk cek
 * layout di HP. Jalankan: node scripts/mobile_shots.mjs
 * Output: /tmp/shots/*.png
 */
import { chromium, devices } from "playwright"
import { mkdirSync } from "fs"

const BASE = process.env.E2E_BASE_URL ?? "https://www.kangenin.web.id"
const OUT = "/tmp/shots"
mkdirSync(OUT, { recursive: true })

const iphone = devices["iPhone 13"]

async function createKado(type) {
  const res = await fetch(`${BASE}/api/kado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetName: "Penerima Uji",
      message: "Cek layout mobile — QA Bot, abaikan ya. Ini pesan yang cukup panjang untuk menguji pembungkusan teks di layar kecil dengan nyaman.",
      senderName: null,
      isAnonymous: true,
      kadoType: type,
      kadoData: null,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.data?.id) {
    console.log(`create kado ${type} gagal:`, res.status, JSON.stringify(json).slice(0, 120))
    return null
  }
  return json.data.id
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ ...iphone, baseURL: BASE })
const page = await ctx.newPage()

async function shot(url, name, actions) {
  try {
    await page.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 45_000 })
    await page.waitForTimeout(1200)
    if (actions) await actions()
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false })
    console.log("OK", name)
  } catch (e) {
    console.log("GAGAL", name, String(e).slice(0, 140))
  }
}

// landing atas + section kado kejutan
await shot("/", "01-landing-atas")
await shot("/#kejutan", "02-landing-kejutan")
// creator studio: langkah 1 & 2
await shot("/create", "03-create-langkah1")
await shot("/create", "04-create-langkah2", async () => {
  await page.locator("#targetName").fill("Penerima Uji")
  await page.locator("#message").fill("Tes layout mobile — QA Bot.")
  await page.getByRole("button", { name: /Lanjut Pilih Kado/i }).click()
  await page.waitForTimeout(600)
})
// kado premium: confess & candle (buat via API lalu buka)
for (const t of ["confess", "candle", "bouquet"]) {
  const id = await createKado(t)
  if (id) await shot(`/kado/${id}`, `05-kado-${t}`)
}
// halaman share
const id = await createKado("confess")
if (id) await shot(`/kado/${id}/share`, "06-kado-share")

await browser.close()
console.log("selesai —", OUT)
