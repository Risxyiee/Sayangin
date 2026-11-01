import { expect, test } from "@playwright/test"

/**
 * J3 — Confess dari landing: validasi gagal (input kosong) + sukses membuat link.
 */

test.describe("Confess", () => {
  test("validasi: submit kosong ditolak dengan pesan jelas", async ({ page }) => {
    await page.goto("/#confess")
    const submit = page.getByRole("button", { name: /Buat link confess/i })
    await submit.scrollIntoViewIfNeeded()
    await submit.click()
    await expect(page.getByText(/Isi dulu nama dia/i)).toBeVisible()
  })

  test("sukses: isi form → link kado + link status muncul", async ({ page }) => {
    test.setTimeout(90_000) // create menulis ke DB (origin sesekali lambat)
    await page.goto("/#confess")
    await page.locator("#fromName").fill("QA Bot")
    await page.locator("#toName").fill("Penerima Uji")
    await page
      .locator("#message")
      .fill("Tes E2E Playwright confess — pesan ini seharusnya tidak dibaca siapa pun. Abaikan ya.")
    await page.getByRole("button", { name: /Buat link confess/i }).click()

    // hasil: link kado penerima (?k=) dan link pantauan pengirim (?s=)
    await expect(page.getByText(/k=/).first()).toBeVisible({ timeout: 45_000 })
    // link halaman pantau (?s=) — anchor dengan teks label, URL di href
    await expect(
      page.getByRole("link", { name: /Pantau status/i })
    ).toBeVisible()
  })
})
