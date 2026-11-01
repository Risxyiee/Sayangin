/**
 * shot_coupon.mjs — verifikasi visual PremiumLoveCoupon (Golden Booklet
 * Edition). Jalankan setelah dev server siap di http://localhost:3000/test-coupon.
 * Output: /tmp/render/3*.png
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000/test-coupon"
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
// mulai dari keadaan bersih (hapus status sobek demo dari run sebelumnya)
await page.getByTestId("btn-reset").click()
await page.waitForTimeout(800)

// 1 — sampul: buklet emas tiba + label + CTA
await page.screenshot({ path: `${OUT}/30-sampul.png` })

// 2 — sambut → segel
await page.getByRole("button", { name: /Buka bukletnya/ }).click()
await page.waitForTimeout(1000)
await page.screenshot({ path: `${OUT}/31-segel.png` })

// 3 — tahap 1: tarik segel 50px (band longgar + rustle)
const seal = page.getByRole("button", { name: /Tarik pita segel/ })
const sbox = await seal.boundingBox()
await page.mouse.move(sbox.x + sbox.width / 2, sbox.y + sbox.height / 2)
await page.mouse.down()
await page.mouse.move(sbox.x + sbox.width / 2 + 50, sbox.y + sbox.height / 2, { steps: 8 })
await page.waitForTimeout(600)
await page.screenshot({ path: `${OUT}/32-segel-tahap1.png` })

// 4 — tahap 2: lewati 92px + lepas → segel lepas → deck menyebar
await page.mouse.move(sbox.x + sbox.width / 2 + 108, sbox.y + sbox.height / 2, { steps: 6 })
await page.waitForTimeout(250)
await page.mouse.up()
await page.waitForTimeout(1400)
await page.screenshot({ path: `${OUT}/33-deck.png` })

// 5 — tiket pertama: tarik sobekan melewati ambang → RIP + stempel
const stub = page.getByRole("button", { name: /Tarik potongan kanan/ })
const stubBox = await stub.boundingBox()
await page.mouse.move(stubBox.x + stubBox.width / 2, stubBox.y + stubBox.height / 2)
await page.mouse.down()
await page.mouse.move(stubBox.x + stubBox.width / 2 + 140, stubBox.y + stubBox.height / 2, { steps: 7 })
await page.waitForTimeout(250)
await page.mouse.up()
await page.waitForTimeout(450)
await page.screenshot({ path: `${OUT}/34-stamp.png` })
await page.waitForTimeout(1100) // tiket berikutnya spring masuk
await page.screenshot({ path: `${OUT}/35-tiket-berikutnya.png` })

// 6 — klaim sisa tiket lewat keyboard (Enter di sobekan) sampai penutup
for (let i = 0; i < 6; i++) {
  const done = await page.getByTestId("done-flag").textContent()
  if (done?.includes("selesai")) break
  const s = page.getByRole("button", { name: /Tarik potongan kanan/ })
  if (!(await s.count())) break
  await s.focus()
  await page.keyboard.press("Enter")
  await page.waitForTimeout(1500)
}
await page.waitForTimeout(1600)
await page.screenshot({ path: `${OUT}/36-penutup.png` })
const flag = await page.getByTestId("done-flag").textContent()
console.log("DONE-FLAG:", flag)

// 7 — simulasi diterima → nama asli
await page.getByTestId("btn-accept").click()
await page.waitForTimeout(1400)
await page.screenshot({ path: `${OUT}/37-reveal.png` })

// 8 — uji persistensi: reload → buklet tetap terklaim → langsung kartu penutup
await page.reload({ waitUntil: "networkidle" })
await page.waitForTimeout(1600)
const revisitFlag = await page.getByTestId("done-flag").textContent()
console.log("REVISIT-FLAG:", revisitFlag)
await page.screenshot({ path: `${OUT}/38-revisit.png` })

await browser.close()
console.log("CONSOLE-ERRORS:", errors.length ? errors.join("\n") : "(tidak ada)")
