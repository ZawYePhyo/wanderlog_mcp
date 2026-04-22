# wanderlog_mcp

[![npm](https://img.shields.io/npm/v/%40zaw_ye%2Fwanderlog_mcp)](https://www.npmjs.com/package/@zaw_ye/wanderlog_mcp)
[![npm downloads](https://img.shields.io/npm/dm/%40zaw_ye%2Fwanderlog_mcp)](https://www.npmjs.com/package/@zaw_ye/wanderlog_mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org/)

An MCP server that lets Claude (or any MCP-compatible agent) view, build, and manage [Wanderlog](https://wanderlog.com) trip itineraries through conversation.

## Works Well With

For the best experience, pair this MCP server with [Travel Planner Skill](https://github.com/ZawYePhyo/travel-planner-skill).

- `wanderlog_mcp` is the execution layer: it reads and updates trips inside Wanderlog
- `Travel Planner Skill` is the planning layer: it helps an agent ask better trip questions, research destinations, shape realistic itineraries, and then hand the approved plan off to Wanderlog MCP

If you want an agent to both plan trips intelligently and write them into Wanderlog, these two repos are meant to be used together.

Instead of clicking through the Wanderlog UI to plan a trip, just ask:

> *"Create a 5-day Tokyo itinerary starting May 3 with restaurants, temples, and a hotel in Shinjuku."*

The agent builds a complete itinerary — places, notes, hotels, checklists, and a budget — directly in your Wanderlog account.

## Features

- Build full trip itineraries from a single prompt
- Add, remove, and update places, notes, hotels, and checklists
- Track trip expenses and summarise budget by category
- One-command login — no DevTools, no cookie copy-pasting

## Tools

| Tool | What it does |
|---|---|
| `wanderlog_list_trips` | List all trips in your account |
| `wanderlog_get_trip` | View a full itinerary, or filter to a single day |
| `wanderlog_get_trip_url` | Get a shareable wanderlog.com link |
| `wanderlog_search_places` | Find real-world places near a trip's destination |
| `wanderlog_create_trip` | Create a new trip with destination and date range |
| `wanderlog_add_place` | Add a place to a specific day or general list |
| `wanderlog_add_note` | Add a note (transit tips, booking info, local advice) |
| `wanderlog_add_hotel` | Add a hotel booking with check-in/check-out dates |
| `wanderlog_add_checklist` | Add a pre-trip or per-day checklist |
| `wanderlog_remove_place` | Remove a place by natural-language reference |
| `wanderlog_update_trip_dates` | Change a trip's date range |
| `wanderlog_list_expenses` | List all expenses in a trip's budget |
| `wanderlog_get_budget_summary` | Spending breakdown by category vs budget total |
| `wanderlog_add_expense` | Add an expense (amount, category, date, description) |
| `wanderlog_delete_expense` | Delete an expense by id |

## Prerequisites

- **Node.js 22 or newer**
- **A [Wanderlog](https://wanderlog.com) account**
- An MCP-compatible client — Claude Desktop, Claude Code, Cursor, VS Code, or any stdio MCP host

## Installation

### Step 1 — Install the package

```bash
npm install -g @zaw_ye/wanderlog_mcp
```

### Step 2 — Log in

```bash
wanderlog_mcp-auth
```

A Chrome or Edge window opens. Log in to Wanderlog normally. The window closes automatically once your session is captured. You won't need to do this again until the session expires (typically several weeks).

> If you see a Chromium install prompt on first run, follow the on-screen instructions and re-run `wanderlog_mcp-auth`.

### Step 3 — Configure your MCP client

#### Claude Desktop

Edit `claude_desktop_config.json`:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "wanderlog": {
      "command": "wanderlog_mcp"
    }
  }
}
```

Restart Claude Desktop after saving.

#### Claude Code

```bash
claude mcp add wanderlog_mcp wanderlog_mcp
```

#### Cursor

Settings → MCP → Add server, or edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "wanderlog": {
      "command": "wanderlog_mcp"
    }
  }
}
```

#### VS Code (GitHub Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "wanderlog": {
      "type": "stdio",
      "command": "wanderlog_mcp"
    }
  }
}
```

#### Antigravity

Open the Agent panel, then go to `Manage MCP Servers` and choose `View raw config`.

Add:

```json
{
  "servers": {
    "wanderlog": {
      "type": "stdio",
      "command": "wanderlog_mcp"
    }
  }
}
```

Save the config, then restart Antigravity so the new MCP server is picked up.

### Step 4 — Verify

Ask your agent: *"What trips do I have in Wanderlog?"*

It should call `wanderlog_list_trips` and return your trips.

## Example Prompts

```
"What trips do I have in Wanderlog?"
```
```
"Create a 5-day itinerary for Kyoto starting May 3 — temples, restaurants, and a ryokan."
```
```
"Add a day trip to Nara on day 2 of my Kyoto trip."
```
```
"Look at my Tokyo trip and add practical notes between each place."
```
```
"Add a pre-trip checklist to my Paris trip — visa, currency, offline maps, travel insurance."
```
```
"Move my Osaka trip back by one week."
```
```
"Give me the shareable link to my Hakone itinerary."
```
```
"Add a 3500 JPY train expense to my Japan trip for May 3."
```
```
"Show me the budget summary for my Japan trip."
```

## When your session expires

Run `wanderlog_mcp-auth` again. It checks the existing session first — if still valid, it exits immediately with no login required. If expired, Chrome opens and you log in once.

## Troubleshooting

**`wanderlog_mcp-auth` says "No supported browser found"**
Install Chrome or Edge, then run `wanderlog_mcp-auth` again. If neither is available, run `npx playwright install chromium` manually.

**Tools return an auth error after working before**
Your session has expired. Run `wanderlog_mcp-auth` and log in again, then restart your MCP client.

**`wanderlog_mcp` hangs when run directly in a terminal**
The server speaks stdio MCP — it's meant to be launched by an MCP host, not run directly. Use it through Claude Desktop or another MCP client as described above.

**Tools work but the agent ignores notes/checklists**
The server injects instructions into the MCP `initialize` response that tell the agent to interleave places and notes. This works reliably with Claude. Other clients may vary.

## Security

- Your session cookie is stored locally in `~/.wanderlog_mcp/auth.json` — it never leaves your machine
- wanderlog_mcp runs entirely on your machine with no relay server
- To revoke access: log out of wanderlog.com (invalidates all sessions), then run `wanderlog_mcp-auth` to re-authenticate

## Attribution

This project began as a fork of [`shaikhspeare/wanderlog-mcp`](https://github.com/shaikhspeare/wanderlog-mcp) and has since diverged substantially.

The current version adds a browser-based auth flow, local auth storage, and expanded trip-management features including budget and expense tools.

## Disclaimer

wanderlog_mcp is an unofficial third-party tool, not affiliated with or endorsed by Wanderlog. It uses Wanderlog's private web-client API, which may change without notice. Use at your own risk.

## License

MIT — see [LICENSE](LICENSE)

---

Made by [Zaw Ye](https://github.com/ZawYePhyo)
