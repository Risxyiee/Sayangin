import { expect, test } from "@playwright/test"

/**
 * J5 — Dinding Kangenin: halaman publik memuat daftar confess publik.
 */

test.describe("Dinding", () => {
  test("halaman dinding terbuka dan berisi konten", async ({ page }) => {
    await page.goto("/dinding")
    // heading halaman ada, grid/kartu dirender (min. 1 kartu dari data publik)
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.locator("main a, main article, main section").first()).toBeVisible()
  })
})
