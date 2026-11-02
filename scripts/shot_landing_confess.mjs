/**
 * shot_landing_confess.mjs — verifikasi visual perubahan landing:
 *   - PhoneDemo baru (alur baru + tema muter) di section #confess
 *   - StatusTeaser dgn kartu "Balasan dari Sari 💬" di section #pantau
 * Output: /tmp/render/landing-*.png + ringkasan error konsol.
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const OUT = "/tmp/render"
fs.mkdirSync(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch({
  executablePath:
    "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 420, height: 920 } })
page.on("pageerror", (e) => errors.push(String(e)))
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 160))
})

await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 })

// ── 1. section #confess: tunggu demo masuk fase surat (typewriter) ──
const confess = page.locator("#confess")
await confess.scrollIntoViewIfNeeded()
await page.waitForTimeout(4500) // closed 2.4s + opening 0.8s + mulai ngetik
await confess.screenshot({ path: `${OUT}/landing-confess-phone.png` })

// teks chip tema harus ada (Tema Rose/Matcha/Midnight)
const chip = await page
  .locator("#confess p", { hasText: /^Tema (Rose|Matcha|Midnight)$/ })
  .first()
  .isVisible()
  .catch(() => false)
console.log(`chip tema terlihat: ${chip}`)

// tunggu fase reply → kartu "Mau kirim pesan buat dia?" di dalam HP
await page.waitForTimeout(6500)
const replyCard = await page
  .locator("#confess p", { hasText: "Mau kirim pesan buat dia? 💬" })
  .first()
  .isVisible()
  .catch(() => false)
console.log(`kartu balasan di demo terlihat: ${replyCard}`)
await confess.screenshot({ path: `${OUT}/landing-confess-reply.png` })

// ── 2. section #pantau: kartu balasan di teaser ──
const pantau = page.locator("#pantau")
await pantau.scrollIntoViewIfNeeded()
await page.waitForTimeout(900)
const replyTeaser = await page
  .locator("#pantau p", { hasText: "Balasan dari Sari 💬" })
  .first()
  .isVisible()
  .catch(() => false)
console.log(`kartu 'Balasan dari Sari' di teaser terlihat: ${replyTeaser}`)
await pantau.screenshot({ path: `${OUT}/landing-pantau.png` })

console.log(errors.length ? `KONSOL ERROR (${errors.length}):` : "konsol bersih ✓")
for (const e of errors.slice(0, 6)) console.log("  -", e)
await browser.close()
