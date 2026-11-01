import { expect, test } from "@playwright/test"

/**
 * J1 — Landing page: fitur baru TERLIHAT & bisa dijangkau.
 * (Akar keluhan "fitur masih seperti awal": landing dulu tak punya link ke /create.)
 */

test.describe("Landing", () => {
  test("hero, navbar, dan CTA utama tampil", async ({ page }) => {
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Suka dia")
    // navbar CTA menuju Creator Studio
    const navCta = page.locator("header").getByRole("link", { name: "Bikin kado" })
    await expect(navCta).toHaveAttribute("href", "/create")
  })

  test("section 'Kado Kejutan' memuat 5 pengalaman premium + CTA /create", async ({
    page,
  }) => {
    await page.goto("/")
    const section = page.locator("#kejutan")
    await expect(section).toBeVisible()
    await expect(section.getByRole("heading", { name: /dialami dulu/i })).toBeVisible()
    for (const judul of [
      "Buket Bunga",
      "Open When",
      "Photobox",
      "Love Coupon",
      "Candle Blow",
    ]) {
      await expect(section.getByRole("heading", { name: judul, exact: true })).toBeVisible()
    }
    // confess cuma SATU fitur di landing — versi sinematik tidak di-duplicate
    // di showcase kado (upsell-nya ada di panel sukses ConfessSection)
    await expect(
      section.getByRole("heading", { name: "Confess", exact: true })
    ).toHaveCount(0)
    await expect(
      section.getByRole("link", { name: /Racik kado kejutannya/i })
    ).toHaveAttribute("href", "/create")
  })
})
