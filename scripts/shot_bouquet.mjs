/**
 * shot_bouquet.mjs — verifikasi visual PremiumBouquet (Blooming Edition).
 * Jalankan setelah dev server siap di http://localhost:3000/test-bouquet.
 * Output: /tmp/render/1*.png
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000/test-bouquet"
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

// 1 — titipan: buket tiba + label + CTA sambut
await page.screenshot({ path: `${OUT}/10-titipan.png` })

// 2 — sambut → pita
await page.getByRole("button", { name: /Sambut buketnya/ }).click()
await page.waitForTimeout(900)
await page.screenshot({ path: `${OUT}/11-pita.png` })

// 3 — tahap 1: tarik 50px (kertas longgar + glow + whisper)
const ribbon = page.getByRole("button", { name: /Tarik pita/ })
const box = await ribbon.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 8 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/12-pita-tahap1.png` })

// 4 — tahap 2: lewati 84px + lepas → simpul lepas
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 105, { steps: 6 })
await page.waitForTimeout(250)
await page.mouse.up()
await page.waitForTimeout(3600) // gelombang 1-3 tuntas + kuncup settle
await page.screenshot({ path: `${OUT}/13-kuncup.png` })

// 5 — puncak: sentuh kuncup terakhir
await page.getByRole("button", { name: "Buka kuncup terakhir" }).click()
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/14-kartu.png` })

// kartu penuh (baris selesai) → onOpenComplete
await page.waitForTimeout(2200)
await page.screenshot({ path: `${OUT}/15-kartu-penuh.png` })
const flag = await page.getByTestId("done-flag").textContent()
console.log("DONE-FLAG:", flag)

// 6 — simulasi diterima → nama asli
await page.getByTestId("btn-accept").click()
await page.waitForTimeout(1400)
await page.screenshot({ path: `${OUT}/16-reveal.png` })

await browser.close()
console.log("CONSOLE-ERRORS:", errors.length ? errors.join("\n") : "(tidak ada)")
