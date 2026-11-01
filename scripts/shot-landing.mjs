import { chromium } from "playwright";

const BASE = "http://localhost:3000";

async function shoot(page, name, width, height, fullPage = false) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `/tmp/render/${name}.png`, fullPage });
  console.log("saved", name);
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await shoot(page, "land-mobile-top", 390, 844);
  await shoot(page, "land-desktop-top", 1440, 900);
  // full page mobile: scroll pelan biar whileInView ke-trigger semua
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  for (let y = 0; y < 14000; y += 500) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/render/land-mobile-full.png", fullPage: true });
  console.log("saved land-mobile-full");
  await browser.close();
};

run().catch((e) => { console.error(e); process.exit(1); });
