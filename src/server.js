import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { chromium } from "playwright";
import { z } from "zod";

const server = new McpServer({ name: "browzi-codex", version: "0.1.0" });
let browser;
let context;
let page;
const events = [];
const record = (kind, value) => {
  events.push({ time: new Date().toISOString(), kind, value: String(value).slice(0, 1500) });
  if (events.length > 300) events.shift();
};
const ensure = async () => {
  if (page && !page.isClosed()) return page;
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
  page = await context.newPage();
  page.on("pageerror", error => record("js-error", error.message));
  page.on("console", msg => { if (msg.type() === "error") record("console-error", msg.text()); });
  page.on("requestfailed", request => record("request-failed", request.url() + " " + (request.failure()?.errorText || "")));
  page.on("response", response => { if (response.status() >= 400) record("http-" + response.status(), response.url()); });
  return page;
};
const output = value => ({ content: [{ type: "text", text: JSON.stringify(value, null, 2) }] });
server.tool("open_page", "Open a public HTTP(S) URL in an isolated mobile browser", { url: z.string().url() }, async ({ url }) => {
  if (!/^https?:$/.test(new URL(url).protocol)) throw new Error("Only HTTP(S) URLs supported");
  const p = await ensure();
  events.length = 0;
  try { await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 }); }
  catch (e) { record("navigation-error", e.message); }
  return output({ url: p.url(), title: await p.title().catch(() => ""), errors: events });
});
server.tool("inspect_page", "Inspect page state, visible text, resources and recent errors", {}, async () => {
  const p = await ensure();
  const data = await p.evaluate(() => ({
    title: document.title,
    readyState: document.readyState,
    text: document.body?.innerText?.slice(0, 6000) || "",
    resourceCount: performance.getEntriesByType("resource").length,
    navigation: performance.getEntriesByType("navigation").map(n => ({ duration: n.duration, domContentLoaded: n.domContentLoadedEventEnd, load: n.loadEventEnd }))
  }));
  return output({ url: p.url(), ...data, errors: events });
});
server.tool("click_element", "Click an element by Playwright locator selector (no arbitrary JS)", { selector: z.string() }, async ({ selector }) => {
  const p = await ensure(); await p.locator(selector).first().click({ timeout: 10000 }); return output({ clicked: selector, url: p.url() });
});
server.tool("fill_element", "Fill a form field by selector; avoid entering secrets in diagnostic sessions", { selector: z.string(), value: z.string() }, async ({ selector, value }) => {
  const p = await ensure(); await p.locator(selector).first().fill(value, { timeout: 10000 }); return output({ filled: selector });
});
server.tool("network_errors", "Return recent failed requests and browser errors", {}, async () => output(events));
server.tool("close_browser", "Close isolated browser", {}, async () => {
  await browser?.close(); browser = undefined; context = undefined; page = undefined; return output({ closed: true });
});
await server.connect(new StdioServerTransport());
