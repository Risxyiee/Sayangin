/**
 * shot_confess.mjs — verifikasi visual PremiumConfess (Heartstring Edition).
 * Jalankan setelah dev server siap di http://localhost:3210/test-confess.
 * Output: /tmp/render/0*.png
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000/test-confess"
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
await page.waitForTimeout(600)

// 1 — veil
await page.screenshot({ path: `${OUT}/01-veil.png` })

// 2 — tap segel → heartbeat
await page.getByRole("button", { name: "Buka segel pengakuan" }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/02-heartbeat.png` })

// 3 — tahan lewat 2 detak pertama (850+650=1500ms) → teaser + topeng bocor
const heart = page.getByRole("button", { name: /Tahan hatinya/ })
const box = await heart.boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.waitForTimeout(1100) // detak 1 selesai (850ms) → teaser muncul
await page.screenshot({ path: `${OUT}/03-beat1-teaser.png` })
await page.waitForTimeout(700) // detak 2 selesai → topeng bocor
await page.screenshot({ path: `${OUT}/04-beat2-leak.png` })

// 4 — terus menahan sampai retak + surat terbuka penuh
await page.waitForTimeout(2600) // detak 3 (480ms) + shatter 1750ms + reveal surat
await page.screenshot({ path: `${OUT}/05-letter.png` })

// beri waktu baris terakhir selesai → onOpenComplete
await page.waitForTimeout(1800)
const flag = await page.getByTestId("done-flag").textContent()
console.log("DONE-FLAG:", flag)

// 5 — simulasi diterima → nama asli + memento
await page.getByTestId("btn-accept").click()
await page.waitForTimeout(1400)
await page.screenshot({ path: `${OUT}/06-memento.png` })

await page.mouse.up().catch(() => {})
await browser.close()
console.log("CONSOLE-ERRORS:", errors.length ? errors.join("\n") : "(tidak ada)")
