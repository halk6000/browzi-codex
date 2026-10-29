import { chromium } from "playwright";
import { mkdir, writeFile, appendFile } from "node:fs/promises";

const target = "https://www.akinoxmusic.pl/";
const events = [];
const started = Date.now();
const browser = await chromium.launch({ headless: true });
let report;
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await context.newPage();
  const requests = new Map();
  page.on("request", r => requests.set(r, { started: Date.now(), url: r.url().split("?")[0], type: r.resourceType() }));
  page.on("requestfinished", r => requests.delete(r));
  page.on("requestfailed", r => {
    const info = requests.get(r);
    events.push({ type: "network", url: info?.url, error: r.failure()?.errorText });
    requests.delete(r);
  });
  page.on("pageerror", e => events.push({ type: "js", message: e.message }));
  page.on("console", m => { if (m.type() === "error") events.push({ type: "console", message: m.text().slice(0, 400) }); });
  page.on("response", r => { if (r.status() >= 400) events.push({ type: "http", status: r.status(), url: r.url().split("?")[0] }); });
  let navigationError = null;
  let mainStatus = null;
  try {
    const response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
    mainStatus = response?.status() ?? null;
  } catch (e) { navigationError = e.message; }
  await page.waitForTimeout(3000);
  const state = await page.evaluate(() => ({
    readyState: document.readyState,
    text: (document.body?.innerText || "").slice(0, 1500),
    resources: performance.getEntriesByType("resource").length,
    navigation: performance.getEntriesByType("navigation").map(n => ({
      responseStart: Math.round(n.responseStart),
      domContentLoadedEnd: Math.round(n.domContentLoadedEventEnd),
      loadEventEnd: Math.round(n.loadEventEnd)
    }))
  })).catch(() => ({}));
  report = {
    target, timestamp: new Date().toISOString(), elapsedMs: Date.now() - started,
    navigationError, mainStatus, url: page.url(),
    title: await page.title().catch(() => ""),
    ...state,
    pendingRequests: [...requests.values()].map(r => ({ ...r, elapsedMs: Date.now() - r.started })).slice(0, 30),
    events: events.slice(0, 100)
  };
  await mkdir("reports", { recursive: true });
  await writeFile("reports/report.json", JSON.stringify(report, null, 2));
  await page.screenshot({ path: "reports/mobile.png", fullPage: true, timeout: 10000 }).catch(() => {});
  await context.close();
} finally { await browser.close(); }
const failed = Boolean(report.navigationError || report.mainStatus >= 400 || report.readyState === "loading");
const summary = [
  "# Browzi — mobile diagnostic",
  "",
  "| Check | Result |",
  "|---|---|",
  `| Status | ${failed ? "⚠️ Issue detected" : "OK"} |`,
  `| Main HTTP status | ${report.mainStatus ?? "unknown"} |`,
  `| DOM ready state | ${report.readyState ?? "unknown"} |`,
  `| Navigation error | ${(report.navigationError || "none").split("\n")[0].replaceAll("|", "/")} |`,
  `| Resource count | ${report.resources ?? "unknown"} |`,
  `| Pending requests | ${report.pendingRequests.length} |`,
  `| Browser events | ${report.events.length} |`,
  "",
  "Full report and screenshot are uploaded as a workflow artifact."
].join("\n");
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
console.log(JSON.stringify(report, null, 2));
if (failed) process.exitCode = 1;
