import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const target = "https://www.akinoxmusic.pl/";
const events = [];
const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  page.on("pageerror", e => events.push({ type: "js", message: e.message }));
  page.on("requestfailed", r => events.push({ type: "network", url: r.url().split("?")[0], error: r.failure()?.errorText }));
  page.on("response", r => { if (r.status() >= 400) events.push({ type: "http", status: r.status(), url: r.url().split("?")[0] }); });
  let navigationError = null;
  try { await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 }); }
  catch (e) { navigationError = e.message; }
  await page.waitForTimeout(5000);
  const report = {
    target, timestamp: new Date().toISOString(), navigationError,
    url: page.url(), title: await page.title().catch(() => ""),
    visibleText: (await page.locator("body").innerText().catch(() => "")).slice(0, 1500),
    resourceCount: await page.evaluate(() => performance.getEntriesByType("resource").length).catch(() => null),
    events: events.slice(0, 100)
  };
  await mkdir("reports", { recursive: true });
  await writeFile("reports/report.json", JSON.stringify(report, null, 2));
  await page.screenshot({ path: "reports/mobile.png", fullPage: true, timeout: 10000 }).catch(() => {});
  console.log(JSON.stringify({ navigationError, url: report.url, title: report.title, resourceCount: report.resourceCount, eventCount: events.length }, null, 2));
  await context.close();
} finally { await browser.close(); }
