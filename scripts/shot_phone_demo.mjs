/**
 * shot_phone_demo.mjs — screenshot langsung PhoneDemo (element shot)
 * di tiga fase: surat, balasan, terkirim.
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const OUT = "/tmp/render"
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath:
    "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome",
  args: ["--no-sandbox"],
})
const page = await browser.newPage({ viewport: { width: 420, height: 1400 } })
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 45000 })

// phone = pembungkus w-[290px]/w-[310px] di dalam #confess
const phone = page.locator("#confess .w-\\[290px\\], #confess .w-\\[310px\\]").first()
await phone.scrollIntoViewIfNeeded()

// fase surat (tunggu melewati closed+opening, tengah typewriter)
await page.waitForTimeout(4200)
await phone.screenshot({ path: `${OUT}/phone-letter.png` })

// fase balasan (question 2.8s + reply 2.2s window)
await page.waitForTimeout(3300)
await phone.screenshot({ path: `${OUT}/phone-reply.png` })

// fase terkirim (sent 3.4s window)
await page.waitForTimeout(2300)
await phone.screenshot({ path: `${OUT}/phone-sent.png` })

// chip tema
const chipText = await phone
  .locator("span", { hasText: /^Tema / })
  .first()
  .textContent()
  .catch(() => "(tidak ketemu)")
console.log("chip tema:", chipText)

await browser.close()
console.log("selesai")
