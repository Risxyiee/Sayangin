import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E — Kangenin.
 *
 * Target default: produksi (www.kangenin.web.id). Override lewat env:
 *   E2E_BASE_URL=https://kangenin.risyxieee123.workers.dev npx playwright test
 *
 * Catatan desain:
 * - workers: 1 & fullyParallel: false → app anonim tanpa sandbox per-test;
 *   semua create nyawa-nyawa data produksi + rate limit 5 create/15 menit/IP,
 *   jadi tes dijalankan seri, bukan paralel.
 * - timeout longgar (30 dtk) → origin DB sesekali "episode" hang 6–12 dtk;
 *   retry 2× menelan noise transien itu.
 * - trace & screenshot hanya saat gagal/retry supaya hasil lulus tetap cepat.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 2,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://www.kangenin.web.id",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    // mayoritas user Kangenin lewat HP (iPhone Safari) — cek viewport mobile.
    // Engine tetap chromium (webkit butuh browser & deps terpisah di CI/CI-cache);
    // perilaku khusus Safari dijamin lewat pengujian manual di perangkat iPhone.
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
})
