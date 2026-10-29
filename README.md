# Browzi & Codex

Minimal MCP browser inspector for Codex using Playwright. Version 0.1.0.

## Setup

Requires Node.js 20+.

```bash
npm install
npx playwright install chromium
npm run check
```

Register in Codex MCP config (adjust absolute path):

```toml
[mcp_servers.browzi]
command = "node"
args = ["/absolute/path/to/browzi-codex/src/server.js"]
```

Tools: `open_page`, `inspect_page`, `click_element`, `fill_element`, `network_errors`, `close_browser`.

The browser is isolated, headless, mobile-sized and unauthenticated. No access to a user's installed browser, local passwords, or hosting admin panel is provided. Do not enter production secrets into test sessions.

First diagnostic target: https://www.akinoxmusic.pl/ . Check initial DOM, JS exceptions and HTTP failures. Do not assume backend failure from a loading screen alone.

## Planned

Screenshots, trace export, desktop/mobile comparison, response timing summary, safe authenticated test profiles, and automated test suites.
