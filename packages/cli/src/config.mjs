import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

/** Where the login is stored. Override with REACTPRESS_CONFIG (used by tests). */
export function configPath() {
  return process.env.REACTPRESS_CONFIG || path.join(homedir(), ".reactpress", "config.json");
}

/** `{ url, token, email }` from the config file, with REACTPRESS_URL / REACTPRESS_TOKEN taking precedence. */
export async function loadConfig() {
  let file = {};
  try {
    file = JSON.parse(await readFile(configPath(), "utf8"));
  } catch {
    // not logged in
  }
  return {
    url: process.env.REACTPRESS_URL || file.url || null,
    token: process.env.REACTPRESS_TOKEN || file.token || null,
    email: file.email || null,
  };
}

export async function saveConfig(config) {
  const file = configPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(config, null, 2) + "\n", { mode: 0o600 });
  await chmod(file, 0o600).catch(() => {}); // no-op on Windows
}

export async function clearConfig() {
  await rm(configPath(), { force: true });
}

/** The site URL without a trailing slash. The path part (e.g. /shop) selects the site on a multisite network. */
export function normalizeUrl(input) {
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `http://${input}`);
  } catch {
    throw new Error(`"${input}" is not a valid URL`);
  }
  return (url.origin + url.pathname).replace(/\/+$/, "");
}
