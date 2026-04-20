import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = join(homedir(), ".wanderlog_mcp");
export const AUTH_FILE = join(CONFIG_DIR, "auth.json");
export const PROFILE_DIR = join(CONFIG_DIR, "browser-profile");

export type AuthData = {
  cookie: string;
  savedAt: string;
};

/** Read saved auth data from disk, or null if not present / unreadable. */
export function readAuthFile(): AuthData | null {
  if (!existsSync(AUTH_FILE)) return null;
  try {
    return JSON.parse(readFileSync(AUTH_FILE, "utf-8")) as AuthData;
  } catch {
    return null;
  }
}

/** Write auth data to disk. Creates the config dir if needed. */
export function writeAuthFile(data: AuthData): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(data, null, 2), "utf-8");
}
