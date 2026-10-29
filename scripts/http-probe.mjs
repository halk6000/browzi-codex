import { writeFile, mkdir, appendFile } from "node:fs/promises";
const base = "https://www.akinoxmusic.pl";
const paths = ["/api/health", "/"];
const results = [];
for (const path of paths) {
  const url = base + path;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "manual", headers: { accept: "application/json" } });
    const text = await response.text();
    results.push({
      path, status: response.status, elapsedMs: Date.now() - started,
      contentType: response.headers.get("content-type"),
      location: response.headers.get("location"),
      bodyPreview: text.slice(0, 300),
      bodyLength: text.length
    });
  } catch (e) {
    results.push({ path, elapsedMs: Date.now() - started, error: e.name + ": " + e.message });
  } finally { clearTimeout(timer); }
}
await mkdir("reports", { recursive: true });
await writeFile("reports/http-probe.json", JSON.stringify({ timestamp: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify(results, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, [
    "## HTTP probe (no browser JavaScript)",
    "| Path | Status | Time | Type | Redirect |",
    "|---|---|---|---|---|",
    ...results.map(r => `| ${r.path} | ${r.status ?? r.error} | ${r.elapsedMs} ms | ${r.contentType ?? "-"} | ${(r.location ?? "-").replaceAll("|", "/")} |`)
  ].join("\n") + "\n");
}
