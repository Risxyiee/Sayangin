/**
 * shot_candle.mjs — verifikasi visual PremiumCandleBlow (Wish Keeper Edition).
 * Jalankan setelah dev server siap di http://localhost:3000/test-candle.
 * Output: /tmp/render/2*.png
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000/test-candle"
const OUT = "/tmp/render"
fs.mkdirSync(OUT, { recursive: true })

const errors = []
const browser = await chromium.launch({
  executablePath:
    "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 420, height: 920 } })
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text())
})
page.on("pageerror", (e) => errors.push(String(e)))
page.on("response", (r) => {
  if (r.status() === 404) errors.push(`404: ${r.url()}`)
})

await page.goto(BASE, { waitUntil: "networkidle" })
await page.waitForTimeout(900)

// 1 — kedatangan: ruang gelap + lilin padam + CTA nyalakan
await page.screenshot({ path: `${OUT}/20-kedatangan.png` })

// 2 — nyalakan → korek meluncir + api menyala + label titipan
await page.getByRole("button", { name: /Nyalakan lilinnya/ }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: `${OUT}/21-ritual.png` })

// 3 — gerbang ritual: TAHAN ring permintaan sampai penuh (3 dtk)
const gate = page.getByRole("button", { name: /Tahan 3 detik/ })
const gbox = await gate.boundingBox()
await page.mouse.move(gbox.x + gbox.width / 2, gbox.y + gbox.height / 2)
await page.mouse.down()
await page.waitForTimeout(3400) // ring 3 dtk tuntas + lanjut otomatis
await page.mouse.up()
await page.waitForTimeout(1400) // transisi ke babak tiup

// 4 — babak tiup: headless tanpa izin mic → klik tombol mic → fallback tap
await page.getByRole("button", { name: /Buka mic & tiup/ }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/22-tiup-fallback.png` })

// 5 — tap 1-2 = tease "keras lagi!", tap ke-3 = padam (jaring pengaman)
await page.mouse.click(210, 420)
await page.waitForTimeout(450)
await page.screenshot({ path: `${OUT}/23-tease.png` })
await page.mouse.click(210, 420)
await page.waitForTimeout(450)
await page.mouse.click(210, 420) // → THE EXTINGUISH

// 6 — asap + "Make a wish" + kartu baris-per-baris
await page.waitForTimeout(2600)
await page.screenshot({ path: `${OUT}/24-asap.png` })
await page.waitForTimeout(2400)
await page.screenshot({ path: `${OUT}/25-kartu.png` })
const flag = await page.getByTestId("done-flag").textContent()
console.log("DONE-FLAG:", flag)

// 7 — simulasi diterima → nama asli
await page.getByTestId("btn-accept").click()
await page.waitForTimeout(1400)
await page.screenshot({ path: `${OUT}/26-reveal.png` })

await browser.close()
console.log("CONSOLE-ERRORS:", errors.length ? errors.join("\n") : "(tidak ada)")
