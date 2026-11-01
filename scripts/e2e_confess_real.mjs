/**
 * e2e_confess_real.mjs — uji integrasi penuh halaman /kado/[id] sungguhan
 * (server component + CinematicUnboxing + dilemma PATCH + persistensi status).
 *
 * Prasyarat: dev server jalan di http://localhost:3000 dan bisa mengakses DB.
 * Skrip ini membuat DUA kado uji (confess) lalu:
 *   kado 1 → diterima : alur 4 babak → klik "Aku juga suka" → verifikasi
 *                       nama asli tampil, tombol dilemma MATI hilang, reload
 *                       → kartu "sudah dibuka" (status accepted tersimpan).
 *   kado 2 → ditolak  : alur dilewati (skip instan via fail-safe) → klik
 *                       "Maaf, kita temenan aja" → verifikasi overlay rahasia.
 * Output: log ringkas + screenshot di /tmp/render-real/.
 */
import { chromium } from "playwright"
import fs from "node:fs"

const BASE = "http://localhost:3000"
const OUT = "/tmp/render-real"
fs.mkdirSync(OUT, { recursive: true })

const CHROME = "/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome"
const log = (...a) => console.log("•", ...a)

async function createKado() {
  const res = await fetch(`${BASE}/api/kado`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targetName: "Budi",
      message:
        "Aku nggak pernah berencana nulis ini, tapi tiap kali kamu ketawa, aku lupa semua kalimat yang udah kususun.\n\nTerima kasih sudah jadi kamu.",
      senderName: "Rizri Ananda",
      isAnonymous: true,
      kadoType: "confess",
      kadoData: {},
    }),
  })
  const json = await res.json()
  if (!res.ok || !json?.data?.id) throw new Error(`POST /api/kado gagal: ${res.status} ${JSON.stringify(json)}`)
  return json.data.id
}

const errors = []
const browser = await chromium.launch({ executablePath: CHROME, args: ["--no-sandbox"] })
const page = await browser.newPage({ viewport: { width: 420, height: 920 } })
page.on("pageerror", (e) => errors.push(`pageerror: ${e}`))
page.on("response", (r) => {
  if (r.status() >= 500) errors.push(`${r.status()}: ${r.url()}`)
})

async function openFlow(id) {
  await page.goto(`${BASE}/kado/${id}`, { waitUntil: "networkidle" })
  await page.getByRole("button", { name: "Buka segel pengakuan" }).click()
  const heart = page.getByRole("button", { name: /Tahan hatinya/ })
  const box = await heart.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  // 850+650+480 = 1980ms ritual + retak 1750ms + surat — tahan sampai lewat
  await page.waitForTimeout(4300)
  await page.mouse.up()
  // tunggu dilemma muncul (onOpenComplete → fase 3)
  await page.getByRole("button", { name: "Aku juga suka ✨" }).waitFor({ timeout: 8000 })
}

// ── KADO 1: diterima ─────────────────────────────────────────────────────────
const id1 = await createKado()
log("kado-1 dibuat:", id1)
await openFlow(id1)
await page.getByRole("button", { name: "Aku juga suka ✨" }).click()
await page.waitForTimeout(1800)
await page.screenshot({ path: `${OUT}/10-accepted.png` })

const deadButtons = await page.getByRole("button", { name: "Aku juga suka ✨" }).count()
const mementoVisible = await page.getByText("resmi jadi kenangan").first().isVisible()
const realNameVisible = await page.getByText("Rizri Ananda").first().isVisible()
log("tombol-dilemma-setelah-terima (harus 0):", deadButtons)
log("memento-tampil:", mementoVisible, "| nama-asli-tampil:", realNameVisible)

// status tersimpan? reload → kartu "sudah dibuka"
await page.reload({ waitUntil: "networkidle" })
const alreadyOpened = await page.getByText("sudah dibuka dan menjadi kenangan").count()
log("reload→kartu-sudah-dibuka (harus 1):", alreadyOpened)
await page.screenshot({ path: `${OUT}/11-already-opened.png` })

// ── KADO 2: ditolak ──────────────────────────────────────────────────────────
const id2 = await createKado()
log("kado-2 dibuat:", id2)
await page.goto(`${BASE}/kado/${id2}`, { waitUntil: "networkidle" })
await page.getByRole("button", { name: "Buka segel pengakuan" }).click()
const heart2 = page.getByRole("button", { name: /Tahan hatinya/ })
const box2 = await heart2.boundingBox()
await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2)
await page.mouse.down()
await page.waitForTimeout(4300)
await page.mouse.up()
await page.getByRole("button", { name: "Maaf, kita temenan aja" }).waitFor({ timeout: 8000 })
await page.getByRole("button", { name: "Maaf, kita temenan aja" }).click()
await page.waitForTimeout(2200)
const secretOverlay = await page.getByText("Rahasia tetap terjaga.").count()
log("overlay-rahasia-tampil (harus 1):", secretOverlay)
await page.screenshot({ path: `${OUT}/12-rejected.png` })

await browser.close()
log("PAGE-ERRORS:", errors.length ? errors.join(" | ") : "(tidak ada)")
console.log("SELESAI: kado-1:", id1, "| kado-2:", id2)
