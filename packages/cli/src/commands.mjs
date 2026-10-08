import { readFile, writeFile } from "node:fs/promises";
import { api, request } from "./client.mjs";
import { clearConfig, loadConfig, normalizeUrl, saveConfig } from "./config.mjs";
import { textToBlocks } from "./content.mjs";
import { printJson, table } from "./output.mjs";
import { ask, readStdin } from "./prompt.mjs";
import { packageFolder } from "./package.mjs";
import { scaffold } from "./scaffold.mjs";

const need = (v, usage) => {
  if (v === undefined || v === true || v === "") throw new Error(`Usage: ${usage}`);
  return String(v);
};

/** Post/page body from --content, or --file (a path, or - for stdin). */
async function bodyFrom(flags) {
  if (flags.file) return textToBlocks(flags.file === "-" ? await readStdin() : await readFile(String(flags.file), "utf8"));
  if (typeof flags.content === "string") return textToBlocks(flags.content);
  return undefined;
}

const when = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// ---- auth -----------------------------------------------------------------------------------

async function login({ positionals, flags }) {
  const url = normalizeUrl(need(positionals[0] ?? process.env.REACTPRESS_URL, "reactpress login <site-url> [--email you@example.com]"));
  const email = String(flags.email ?? process.env.REACTPRESS_EMAIL ?? (await ask("Email: ")));
  const password = flags["password-stdin"]
    ? (await readStdin()).replace(/\r?\n$/, "")
    : String(flags.password ?? process.env.REACTPRESS_PASSWORD ?? (await ask("Password: ", { hidden: true })));

  const { token } = await request(url, null, "POST", "/api/v1/auth/token", { email, password, name: "cli" });
  const me = await request(url, token, "GET", "/api/admin/me");
  await saveConfig({ url, token, email });
  console.log(`Logged in as ${me.user.email} on "${me.site.name}" (${me.super_admin ? "super admin" : "role-based access"}).`);
}

async function logout() {
  const { url, token } = await loadConfig();
  if (url && token) await request(url, token, "DELETE", "/api/admin/tokens/current").catch(() => {});
  await clearConfig();
  console.log("Logged out.");
}

async function whoami({ flags }) {
  const me = await api("GET", "/api/admin/me");
  if (flags.json) return printJson(me);
  const { url } = await loadConfig();
  console.log(`${me.user.email} on "${me.site.name}" (${url})`);
  console.log(`Capabilities: ${me.capabilities.join(", ") || "none"}${me.super_admin ? " (super admin)" : ""}`);
}

// ---- posts and pages --------------------------------------------------------------------------

function contentCommands(kind) {
  const plural = `${kind}s`;
  const base = `/api/admin/${plural}`;
  const usage = (s) => `reactpress ${kind} ${s}`;
  return {
    async list({ flags }) {
      const qs = new URLSearchParams();
      for (const k of ["status", "type"]) if (typeof flags[k] === "string") qs.set(k, flags[k]);
      const res = await api("GET", `${base}${qs.size ? `?${qs}` : ""}`);
      const items = res[plural];
      if (flags.json) return printJson(items);
      if (!items.length) return console.log(`No ${plural}.`);
      console.log(table(["ID", "STATUS", "DATE", "TITLE", "SLUG"], items.map((p) => [p.id, p.status, when(p.publishedAt ?? p.updatedAt), p.title, p.slug])));
    },
    async get({ positionals }) {
      printJson((await api("GET", `${base}/${encodeURIComponent(need(positionals[0], usage("get <id>")))}`))[kind]);
    },
    async create({ flags }) {
      const body = { title: need(flags.title, usage('create --title "Title" [--status publish] [--content text | --file f.md]')), status: String(flags.status ?? "draft") };
      if (typeof flags.slug === "string") body.slug = flags.slug;
      if (kind === "post" && typeof flags.type === "string") body.type = flags.type;
      const content = await bodyFrom(flags);
      if (content) body.content = content;
      const created = (await api("POST", base, body))[kind];
      if (flags.json) return printJson(created);
      console.log(`Created ${kind} ${created.id} (${created.status}): ${created.title}`);
    },
    async update({ positionals, flags }) {
      const id = need(positionals[0], usage("update <id> [--title T] [--status S] [--slug s] [--content text | --file f.md]"));
      const body = {};
      for (const k of ["title", "status", "slug"]) if (typeof flags[k] === "string") body[k] = flags[k];
      const content = await bodyFrom(flags);
      if (content) body.content = content;
      if (!Object.keys(body).length) throw new Error("Nothing to update. Pass --title, --status, --slug, --content or --file");
      const updated = (await api("PATCH", `${base}/${encodeURIComponent(id)}`, body))[kind];
      console.log(`Updated ${kind} ${updated.id} (${updated.status}): ${updated.title}`);
    },
    async publish({ positionals }) {
      const id = need(positionals[0], usage("publish <id>"));
      const p = (await api("PATCH", `${base}/${encodeURIComponent(id)}`, { status: "publish" }))[kind];
      console.log(`Published ${kind} ${p.id}: ${p.title}`);
    },
    async delete({ positionals, flags }) {
      const id = need(positionals[0], usage("delete <id> --yes"));
      if (!flags.yes) throw new Error("This permanently deletes the " + kind + ". Add --yes to confirm.");
      await api("DELETE", `${base}/${encodeURIComponent(id)}`);
      console.log(`Deleted ${kind} ${id}.`);
    },
  };
}

// ---- plugins and themes --------------------------------------------------------------------------

function extensionCommands(kind, actions) {
  const plural = `${kind}s`;
  const path = `/api/admin/${plural}`;
  const act = (action) => async ({ positionals }) => {
    const slug = need(positionals[0], `reactpress ${kind} ${action} <slug>`);
    await api("POST", path, { action, slug });
    console.log(`${kind} ${slug}: ${action} done.`);
  };
  return {
    async list({ flags }) {
      const items = (await api("GET", path))[plural];
      if (flags.json) return printJson(items);
      console.log(
        table(
          ["SLUG", "VERSION", "STATUS", "NAME"],
          items.map((i) => [i.manifest.slug, i.manifest.version, i.active ? "active" : i.installed ? "installed" : "available", i.manifest.name]),
        ),
      );
    },
    ...Object.fromEntries(actions.map((a) => [a, act(a)])),
  };
}

// ---- users --------------------------------------------------------------------------------------------

const userCommands = {
  async list({ flags }) {
    const { members } = await api("GET", "/api/admin/users");
    if (flags.json) return printJson(members);
    console.log(table(["ID", "EMAIL", "NAME", "ROLE"], members.map((m) => [m.id, m.email, m.name ?? "", m.isSuperAdmin ? `${m.role} (super admin)` : m.role])));
  },
  async add({ positionals, flags }) {
    const email = need(positionals[0], "reactpress user add <email> --role editor");
    await api("POST", "/api/admin/users", { email, role: String(flags.role ?? "subscriber") });
    console.log(`${email} is now ${flags.role ?? "subscriber"} on this site.`);
  },
  async role({ positionals }) {
    const [id, role] = positionals;
    await api("PATCH", `/api/admin/users/${encodeURIComponent(need(id, "reactpress user role <user-id> <role>"))}`, { role: need(role, "reactpress user role <user-id> <role>") });
    console.log(`User ${id} is now ${role}.`);
  },
  async remove({ positionals }) {
    const id = need(positionals[0], "reactpress user remove <user-id>");
    await api("DELETE", `/api/admin/users/${encodeURIComponent(id)}`);
    console.log(`User ${id} removed from this site.`);
  },
  /** Create a network account (super admin only). */
  async create({ flags }) {
    const email = need(flags.email, "reactpress user create --email a@b.co [--name N] --password-stdin");
    const password = flags["password-stdin"] ? (await readStdin()).replace(/\r?\n$/, "") : String(flags.password ?? (await ask("Password: ", { hidden: true })));
    const { user } = await api("POST", "/api/network/users", { email, name: typeof flags.name === "string" ? flags.name : undefined, password });
    console.log(`Created ${user.email} (${user.id}). Give it a role with: reactpress user add ${user.email} --role editor`);
  },
};

// ---- webhooks ---------------------------------------------------------------------------------------

const webhookCommands = {
  async list({ flags }) {
    const { webhooks } = await api("GET", "/api/admin/webhooks");
    if (flags.json) return printJson(webhooks);
    if (!webhooks.length) return console.log("No webhooks.");
    console.log(table(["ID", "ACTIVE", "EVENTS", "LAST", "URL"], webhooks.map((w) => [w.id, w.active ? "yes" : "paused", w.events.join(","), w.lastAt ? (w.lastError ?? `HTTP ${w.lastStatus}`) : "-", w.url])));
  },
  async create({ flags }) {
    const url = need(flags.url, "reactpress webhook create --url https://example.com/hook [--events post.published,post.updated] [--name n]");
    const events = String(flags.events ?? "post.published").split(",").map((e) => e.trim()).filter(Boolean);
    const { webhook } = await api("POST", "/api/admin/webhooks", { url, events, name: typeof flags.name === "string" ? flags.name : undefined });
    if (flags.json) return printJson(webhook);
    console.log(`Created webhook ${webhook.id}.`);
    console.log(`Signing secret (shown once): ${webhook.secret}`);
  },
  async test({ positionals }) {
    const id = need(positionals[0], "reactpress webhook test <id>");
    const { result } = await api("POST", `/api/admin/webhooks/${encodeURIComponent(id)}/test`);
    if (result.status) console.log(`Receiver answered HTTP ${result.status}.`);
    else throw new Error(`Test failed: ${result.error}`);
  },
  async pause({ positionals }) {
    await api("PATCH", `/api/admin/webhooks/${encodeURIComponent(need(positionals[0], "reactpress webhook pause <id>"))}`, { active: false });
    console.log("Paused.");
  },
  async resume({ positionals }) {
    await api("PATCH", `/api/admin/webhooks/${encodeURIComponent(need(positionals[0], "reactpress webhook resume <id>"))}`, { active: true });
    console.log("Resumed.");
  },
  async delete({ positionals }) {
    await api("DELETE", `/api/admin/webhooks/${encodeURIComponent(need(positionals[0], "reactpress webhook delete <id>"))}`);
    console.log("Deleted.");
  },
};

// ---- marketplace ---------------------------------------------------------------------------------------

const marketplaceCommands = {
  async list({ flags }) {
    const { items, errors } = await api("GET", `/api/network/marketplace${flags.fresh ? "?fresh=1" : ""}`);
    const shown = items.filter((i) => !flags.type || i.type === flags.type);
    if (flags.json) return printJson({ items: shown, errors });
    for (const e of errors) console.error(`registry problem: ${e.error}`);
    if (!shown.length) return console.log("Nothing in the marketplace. Add a registry with: reactpress registry add <url>");
    console.log(table(["TYPE", "SLUG", "VERSION", "STATUS", "NAME"], shown.map((i) => [i.type, i.slug, i.version, i.status === "update" ? `update (have ${i.installedVersion})` : i.status, i.name])));
  },
  async install({ positionals, flags }) {
    const slug = need(positionals[0], "reactpress marketplace install <slug> [--type theme|plugin] [--no-activate]");
    const { items } = await api("GET", "/api/network/marketplace");
    const matches = items.filter((i) => i.slug === slug && (!flags.type || i.type === flags.type) && (!flags.registry || i.registry === flags.registry));
    if (!matches.length) throw new Error(`"${slug}" is not in the marketplace`);
    if (matches.length > 1) throw new Error(`"${slug}" matches several packages: pass --type and/or --registry`);
    const item = matches[0];
    const res = await api("POST", "/api/network/marketplace/install", { registry: item.registry, type: item.type, slug, activate: !flags["no-activate"] });
    console.log(`Installed ${item.type} ${slug} v${item.version}${res.activated ? " and switched it on for this site" : ""}.`);
    console.log(res.needsRebuild ? "This is a production server: rebuild it (next build) to load the new code." : "It is picked up on the next page load.");
  },
  async remove({ positionals, flags }) {
    const [type, slug] = positionals;
    need(type, "reactpress marketplace remove <theme|plugin> <slug> [--force]");
    need(slug, "reactpress marketplace remove <theme|plugin> <slug> [--force]");
    const res = await api("DELETE", `/api/network/marketplace/packages/${encodeURIComponent(type)}/${encodeURIComponent(slug)}${flags.force ? "?force=1" : ""}`);
    console.log(`Removed ${type} ${slug}.${res.needsRebuild ? " Rebuild the production server to drop the code." : ""}`);
  },
};

const registryCommands = {
  async list({ flags }) {
    const { registries } = await api("GET", "/api/network/registries");
    if (flags.json) return printJson(registries);
    if (!registries.length) console.log("No registries.");
    for (const r of registries) console.log(r);
  },
  async add({ positionals }) {
    const url = need(positionals[0], "reactpress registry add <url>");
    const { registries } = await api("GET", "/api/network/registries");
    await api("PUT", "/api/network/registries", { registries: [...registries, url] });
    console.log(`Added ${url}`);
  },
  async remove({ positionals }) {
    const url = need(positionals[0], "reactpress registry remove <url>");
    const { registries } = await api("GET", "/api/network/registries");
    if (!registries.includes(url)) throw new Error("That registry is not in the list");
    await api("PUT", "/api/network/registries", { registries: registries.filter((r) => r !== url) });
    console.log(`Removed ${url}`);
  },
};

async function packageCmd({ positionals, flags }) {
  const folder = need(positionals[0], "reactpress package <theme-or-plugin-folder> [--out dir] [--url-base https://host/downloads]");
  const res = await packageFolder(folder, { outDir: typeof flags.out === "string" ? flags.out : ".", urlBase: typeof flags["url-base"] === "string" ? flags["url-base"] : undefined });
  console.error(`Wrote ${res.file} (${res.files} files). Add this entry to your registry's "items":`);
  printJson(res.entry);
}

// ---- scaffold + export ----------------------------------------------------------------------------------

async function scaffoldCmd({ positionals, flags }) {
  const [kind, slug] = positionals;
  const dir = await scaffold(kind, slug, { baseDir: typeof flags.dir === "string" ? flags.dir : undefined, author: typeof flags.author === "string" ? flags.author : undefined });
  const registry = kind === "plugin" ? "plugins/registry.ts" : "themes/registry.ts";
  console.log(`Created ${kind} in ${dir}`);
  console.log(`Next: register it in ${registry} (one import + one entry, see ${kind}s/README.md), then run \`npm run dev\`.`);
}

async function exportCmd({ flags }) {
  const data = await api("GET", `/api/admin/export${flags.media ? "?media=1" : ""}`);
  const json = JSON.stringify(data, null, 2) + "\n";
  if (typeof flags.out === "string") {
    await writeFile(flags.out, json);
    console.error(`Exported ${data.posts.length} posts, ${data.pages.length} pages and ${data.media.length} media items to ${flags.out}`);
  } else process.stdout.write(json);
}

async function importCmd({ positionals, flags }) {
  const file = need(positionals[0], "reactpress import <file.json> [--mode merge|replace] [--yes]");
  const mode = flags.mode === "replace" ? "replace" : "merge";
  if (mode === "replace" && !flags.yes) throw new Error("--mode replace deletes this site's current content first. Add --yes to confirm.");
  const body = JSON.parse(file === "-" ? await readStdin() : await readFile(file, "utf8"));
  const { report } = await api("POST", `/api/admin/import?mode=${mode}${mode === "replace" ? "&confirm=replace" : ""}`, body);
  console.log(`Imported (${report.mode}): ${Object.entries(report.counts).map(([k, v]) => `${v} ${k}`).join(", ")}`);
  for (const w of report.warnings) console.error(`warning: ${w}`);
}

export const COMMANDS = {
  login: { run: login, help: "login <site-url> [--email e] [--password-stdin]   Log in and store an API token" },
  logout: { run: logout, help: "logout                                          Revoke the stored token and forget it" },
  whoami: { run: whoami, help: "whoami [--json]                                 Show the logged-in user, site and capabilities" },
  post: { sub: contentCommands("post"), help: "post list|get|create|update|publish|delete       Manage posts" },
  page: { sub: contentCommands("page"), help: "page list|get|create|update|publish|delete       Manage pages" },
  plugin: { sub: extensionCommands("plugin", ["install", "activate", "deactivate", "delete"]), help: "plugin list|install|activate|deactivate|delete  Manage plugins" },
  theme: { sub: extensionCommands("theme", ["install", "activate", "uninstall"]), help: "theme list|install|activate|uninstall          Manage themes" },
  user: { sub: userCommands, help: "user list|add|role|remove|create                Manage who can do what on this site" },
  webhook: { sub: webhookCommands, help: "webhook list|create|test|pause|resume|delete       Outbound webhooks on content changes" },
  marketplace: { sub: marketplaceCommands, help: "marketplace list|install|remove                      Browse and install themes and plugins (super admin)" },
  registry: { sub: registryCommands, help: "registry list|add|remove                           Marketplace registries of this network (super admin)" },
  package: { run: packageCmd, help: "package <folder> [--out dir] [--url-base u]       Zip a theme/plugin and print its registry entry" },
  scaffold: { run: scaffoldCmd, help: "scaffold <plugin|theme> <slug> [--dir d]       Create a starter plugin or theme in this project" },
  export: { run: exportCmd, help: "export [--media] [--out file.json]                Export the site as ReactPress JSON" },
  import: { run: importCmd, help: "import <file.json> [--mode merge|replace] [--yes]   Import a ReactPress JSON export" },
};
