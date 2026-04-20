#!/usr/bin/env node
/**
 * wanderlog_mcp-auth — one-time login helper.
 *
 * Opens a Chromium window at wanderlog.com. Once the user logs in, the
 * connect.sid session cookie is captured, validated, and saved to
 * ~/.wanderlog_mcp/auth.json. The MCP server reads from that file
 * automatically — no env var needed.
 *
 * Usage:
 *   npx wanderlog_mcp-auth
 *   node dist/auth.js
 */

import { chromium } from "playwright";
import {
  AUTH_FILE,
  PROFILE_DIR,
  readAuthFile,
  writeAuthFile,
} from "./auth-storage.js";

/** Validate a cookie header against the Wanderlog API. */
async function validateCookie(cookieHeader: string): Promise<boolean> {
  try {
    const res = await fetch("https://wanderlog.com/api/user", {
      headers: {
        Cookie: cookieHeader,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { user?: { id?: number } };
    return typeof data.user?.id === "number";
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  console.log("Wanderlog MCP — Login");
  console.log("─────────────────────");

  // Ensure profile dir exists for the browser.
  const { mkdirSync } = await import("node:fs");
  mkdirSync(PROFILE_DIR, { recursive: true });

  // If there's already a saved cookie, check if it's still valid first.
  const existing = readAuthFile();
  if (existing?.cookie) {
    process.stdout.write("Checking existing session... ");
    const valid = await validateCookie(existing.cookie);
    if (valid) {
      console.log("still valid. No login needed.\n");
      console.log(`Session saved at: ${AUTH_FILE}`);
      console.log("If you want to force a re-login, delete that file and run again.");
      return;
    }
    console.log("expired. Starting fresh login.");
  }

  // Launch persistent context so Google login is remembered across runs.
  // Try real browser installs first — Google blocks automated Chromium.
  // channel:'chrome' → system Chrome, channel:'msedge' → Edge (always on Windows).
  const CHANNELS = ["chrome", "msedge", null] as const;
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  let lastErr: Error | undefined;

  for (const channel of CHANNELS) {
    try {
      const opts: Parameters<typeof chromium.launchPersistentContext>[1] = {
        headless: false,
        args: [
          "--no-first-run",
          "--disable-blink-features=AutomationControlled",
        ],
        // Remove --enable-automation so Chrome doesn't show the
        // "controlled by automated software" banner and Google doesn't block login.
        ignoreDefaultArgs: ["--enable-automation"],
      };
      if (channel) opts.channel = channel;
      context = await chromium.launchPersistentContext(PROFILE_DIR, opts);
      console.log(`Using browser: ${channel ?? "bundled Chromium"}`);
      break;
    } catch (err) {
      lastErr = err as Error;
      // Not installed — try next option.
    }
  }

  if (!context) {
    const msg = lastErr?.message ?? "";
    if (msg.includes("Executable doesn't exist") || msg.includes("not found")) {
      console.log("\nChromium not found. Installing now...");
      const { execSync } = await import("node:child_process");
      try {
        execSync("npx playwright install chromium", { stdio: "inherit" });
        console.log("\nChromium installed. Re-run: wanderlog_mcp-auth\n");
      } catch {
        console.error("Auto-install failed. Run manually:\n  npx playwright install chromium");
      }
      process.exit(0);
    }
    throw lastErr;
  }

  // Hide navigator.webdriver so Google doesn't detect automation.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Remove any stale connect.sid so we always capture a fresh one.
  try {
    await context.clearCookies({ name: "connect.sid" });
  } catch {
    // Older Playwright versions don't support filtered clearCookies — ignore.
  }

  const page = await context.newPage();

  console.log("\n┌─────────────────────────────────────────────────┐");
  console.log("│  A Chrome window has opened.                    │");
  console.log("│                                                 │");
  console.log("│  1. Sign in to Wanderlog in that window         │");
  console.log("│  2. Wait until you see your trips/dashboard     │");
  console.log("│  3. Do NOT close the window — it closes itself  │");
  console.log("└─────────────────────────────────────────────────┘\n");

  await page.goto("https://wanderlog.com/login", { waitUntil: "domcontentloaded" }).catch(() => {});

  // Poll until we have a connect.sid that the API accepts.
  // We validate on every tick — Wanderlog may reuse the same cookie value
  // and just update the session server-side on login.
  let cookieHeader: string | undefined;

  process.stdout.write("Waiting for login");
  while (!cookieHeader) {
    let cookies: Array<{ name: string; value: string }> = [];
    try {
      cookies = await context.cookies("https://wanderlog.com");
    } catch {
      // Context closed — browser was shut by the user.
      console.error("\nBrowser was closed before login completed. Run the command again.");
      process.exit(1);
    }

    const sid = cookies.find((c) => c.name === "connect.sid");
    if (sid) {
      const candidate = `connect.sid=${sid.value}`;
      const valid = await validateCookie(candidate);
      if (valid) {
        process.stdout.write(" done.\n");
        cookieHeader = candidate;
        break;
      }
    }

    process.stdout.write(".");
    await new Promise<void>((r) => setTimeout(r, 2000));
  }

  // Give the page a moment to settle before closing.
  await new Promise<void>((r) => setTimeout(r, 800));
  await context.close();

  writeAuthFile({ cookie: cookieHeader, savedAt: new Date().toISOString() });

  console.log(`\nLogged in successfully.`);
  console.log(`Session saved to: ${AUTH_FILE}`);
  console.log(`\nRestart Claude Desktop to apply the new session.`);
}

main().catch((err: Error) => {
  console.error("Auth failed:", err.message);
  process.exit(1);
});
