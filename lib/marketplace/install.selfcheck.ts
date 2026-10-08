/** ponytail: run with `npx tsx lib/marketplace/install.selfcheck.ts` (needs the dev database; writes and removes a test package in plugins/ and themes/) */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createZip, type ZipEntry } from "@/lib/net/zip";
import { clearRegistryCache } from "./catalog";
import { generatedFile } from "./generate";
import { activateOnSite, installFromRegistry, packageFiles, removeInstalledPackage, usageOf } from "./install";
import { MARKER, packageDir, readMarker } from "./packages";
import { setRegistries } from "./registries";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const fails = (fn: () => Promise<unknown> | unknown, re?: RegExp) =>
  Promise.resolve().then(fn).then(() => false, (e) => (re ? re.test((e as Error).message) : true));

const PLUGIN = "sc-test-plugin";
const THEME = "sc-test-theme";
const j = (v: unknown) => Buffer.from(JSON.stringify(v));
const f = (p: string, text: string): ZipEntry => ({ path: p, data: Buffer.from(text) });

const pluginFiles = (version = "1.0.0", extra: ZipEntry[] = [], register = 'import type { PluginApi } from "@/lib/plugins/api";\nexport default function register(api: PluginApi) { void api; }\n'): ZipEntry[] => [
  { path: "plugin.json", data: j({ name: "SC Test", slug: PLUGIN, version, author: "tests" }) },
  f("register.ts", register),
  ...extra,
];
const themeFiles = (version = "1.0.0"): ZipEntry[] => [
  { path: "theme.json", data: j({ name: "SC Theme", slug: THEME, version, author: "tests", templates: ["index"], parts: [] }) },
  f("index.ts", 'import type { ThemeModule } from "@/lib/theme/types";\nimport Index from "./templates/index";\nconst theme: ThemeModule = { templates: { index: Index }, parts: {} };\nexport default theme;\n'),
  f("templates/index.tsx", "export default function Index() { return null; }\n"),
];

async function main() {
  // ---- pure archive handling
  const wrapped = packageFiles([f("pkg/plugin.json", "{}"), f("pkg/register.ts", "")], "plugin.json");
  check(wrapped.map((x) => x.path).join() === "plugin.json,register.ts", "one wrapping folder is stripped");
  check(await fails(() => packageFiles([f("plugin.json", "{}"), f("run.sh", "")], "plugin.json"), /not allowed/), "shell scripts are refused");
  check(await fails(() => packageFiles([f("plugin.json", "{}"), f("a.node", "")], "plugin.json"), /not allowed/), "native modules are refused");
  check(await fails(() => packageFiles([f("plugin.json", "{}"), f("logo.svg", "<svg/>")], "plugin.json"), /not allowed/), "svg is refused (script risk)");
  check(await fails(() => packageFiles([f("register.ts", "")], "plugin.json"), /missing/), "manifest required");
  check(await fails(() => packageFiles([f("plugin.json", "{}"), f(MARKER, "{}")], "plugin.json"), /reserved/), "marker name is reserved");
  check(await fails(() => packageFiles(Array.from({ length: 501 }, (_, i) => f(`f${i}.ts`, "")).concat(f("plugin.json", "{}")), "plugin.json"), /too many/), "file count limit");

  // ---- registry host
  const bodies = new Map<string, Buffer>();
  const server = createServer((req, res) => {
    const body = bodies.get(req.url ?? "");
    if (!body) return void res.writeHead(404).end();
    res.setHeader("content-type", req.url?.endsWith(".json") ? "application/json" : "application/zip");
    res.end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
  type Entry = { type: "plugin" | "theme"; slug: string; version: string; zip: Buffer; sha?: string };
  const publish = (entries: Entry[]) => {
    bodies.set(
      "/registry.json",
      j({
        format: "reactpress-registry",
        version: 1,
        name: "SC",
        items: entries.map((e) => {
          bodies.set(`/${e.slug}-${e.version}.zip`, e.zip);
          return { type: e.type, slug: e.slug, name: e.slug, version: e.version, author: "tests", description: "", download: `${base}/${e.slug}-${e.version}.zip`, sha256: e.sha ?? sha(e.zip) };
        }),
      }),
    );
    clearRegistryCache();
  };

  const net = await prisma.network.findFirstOrThrow();
  const original = net.registries;
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  process.env.REACTPRESS_ALLOW_PRIVATE_FETCH = "1";
  const registry = `${base}/registry.json`;
  await setRegistries(net.id, [registry]);
  const ref = (type: "plugin" | "theme", slug: string) => ({ registry, type, slug });
  const cleanup = async () => {
    for (const [t, s] of [["plugin", PLUGIN], ["theme", THEME]] as const) if (readMarker(t, s)) await removeInstalledPackage(t, s, { force: true });
    await prisma.pluginInstall.deleteMany({ where: { slug: PLUGIN } });
    await prisma.themeInstall.deleteMany({ where: { slug: THEME } });
  };

  try {
    await cleanup();

    // ---- happy path
    const good = createZip(pluginFiles());
    publish([{ type: "plugin", slug: PLUGIN, version: "1.0.0", zip: good }, { type: "theme", slug: THEME, version: "1.0.0", zip: createZip(themeFiles()) }]);
    const r = await installFromRegistry(net.id, ref("plugin", PLUGIN));
    check(!r.replaced && existsSync(path.join(packageDir("plugin", PLUGIN), "register.ts")), "plugin files placed");
    check(readMarker("plugin", PLUGIN)?.sha256 === sha(good) && readMarker("plugin", PLUGIN)?.version === "1.0.0", "marker records version and checksum");
    check(readFileSync(generatedFile("plugin"), "utf8").includes(`"${PLUGIN}"`), "generated registry lists the plugin");
    await installFromRegistry(net.id, ref("theme", THEME));
    check(readFileSync(generatedFile("theme"), "utf8").includes(`./${THEME}/theme.json`), "generated registry lists the theme");

    // ---- site activation writes rows even though the running build has not seen the code yet
    await activateOnSite(site.id, "plugin", PLUGIN, "1.0.0");
    await activateOnSite(site.id, "theme", THEME, "1.0.0");
    check((await prisma.pluginInstall.findFirst({ where: { siteId: site.id, slug: PLUGIN, active: true } })) !== null, "plugin switched on for the site");
    check((await prisma.themeInstall.findMany({ where: { siteId: site.id, active: true } })).map((t) => t.slug).join() === THEME, "theme is the only active theme");
    check((await usageOf("plugin", PLUGIN)).installs === 1, "usage counts the site install");

    // ---- refusals leave nothing behind
    const untouched = () => !existsSync(path.join(packageDir("plugin", "sc-bad")));
    const bad = async (label: string, entries: Entry[], re: RegExp, slug = "sc-bad") => {
      publish(entries);
      check(await fails(() => installFromRegistry(net.id, ref("plugin", slug)), re), `refused: ${label}`);
      check(untouched(), `nothing left behind after: ${label}`);
    };
    const badManifest = (o: object, files: ZipEntry[] = []) => createZip([{ path: "plugin.json", data: j({ name: "Bad", slug: "sc-bad", version: "1.0.0", author: "t", ...o }) }, f("register.ts", "export default function register() {}\n"), ...files]);
    await bad("checksum mismatch", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: badManifest({}), sha: "0".repeat(64) }], /checksum/);
    await bad("slug in the package differs", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: badManifest({ slug: "other" }) }], /invalid|says it is/);
    await bad("version differs from the registry", [{ type: "plugin", slug: "sc-bad", version: "2.0.0", zip: badManifest({ version: "1.0.0" }) }], /version/);
    await bad("forbidden import", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: createZip([{ path: "plugin.json", data: j({ name: "Bad", slug: "sc-bad", version: "1.0.0", author: "t" }) }, f("register.ts", 'import fs from "node:fs";\nexport default function register() { void fs; }\n')]) }], /not allowed/);
    await bad("reads the environment", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: createZip([{ path: "plugin.json", data: j({ name: "Bad", slug: "sc-bad", version: "1.0.0", author: "t" }) }, f("register.ts", "export default function register() { return process.env.AUTH_SECRET; }\n")]) }], /process/);
    await bad("disallowed file type", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: badManifest({}, [f("install.sh", "rm -rf /")]) }], /not allowed/);
    await bad("not a zip", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: Buffer.from("this is not a zip file at all") }], /unpacked|Not a zip/);
    const slip = Buffer.from(createZip([f("aaaaaaaaaaaa/plugin.json", "{}")]));
    for (let i = slip.indexOf("aaaaaaaaaaaa"); i >= 0; i = slip.indexOf("aaaaaaaaaaaa", i + 1)) slip.write("../../evil.ts", i, "utf8");
    await bad("zip-slip path", [{ type: "plugin", slug: "sc-bad", version: "1.0.0", zip: slip }], /Unsafe|unpacked/);
    check(!existsSync(path.join(packageDir("plugin", ".."), "evil.ts")) && !existsSync(path.resolve(packageDir("plugin", "x"), "../../evil.ts")), "no file escaped the package folder");

    publish([{ type: "plugin", slug: "reading-time", version: "9.9.9", zip: good }]);
    check(await fails(() => installFromRegistry(net.id, ref("plugin", "reading-time")), /ships with ReactPress/), "bundled packages cannot be replaced");
    check(await fails(() => installFromRegistry(net.id, ref("plugin", "not-listed")), /not in the registry/), "unknown package refused");
    check(await fails(() => installFromRegistry(net.id, { registry: "https://evil.example/r.json", type: "plugin", slug: PLUGIN }), /not in the registry/), "an unlisted registry is ignored");

    // ---- update replaces; a bad update keeps the old version
    publish([{ type: "plugin", slug: PLUGIN, version: "1.1.0", zip: createZip(pluginFiles("1.1.0")) }]);
    const up = await installFromRegistry(net.id, ref("plugin", PLUGIN));
    check(up.replaced && readMarker("plugin", PLUGIN)?.version === "1.1.0", "update replaces the installed version");
    publish([{ type: "plugin", slug: PLUGIN, version: "1.2.0", zip: createZip(pluginFiles("1.2.0", [f("x.sh", "")])) }]);
    check(await fails(() => installFromRegistry(net.id, ref("plugin", PLUGIN))), "a bad update is refused");
    check(readMarker("plugin", PLUGIN)?.version === "1.1.0" && existsSync(path.join(packageDir("plugin", PLUGIN), "register.ts")), "the working version stays in place");

    // ---- removal
    check(await fails(() => removeInstalledPackage("plugin", PLUGIN), /still used/), "removal is blocked while in use");
    check(await fails(() => removeInstalledPackage("plugin", "reading-time", { force: true }), /ships with/), "bundled packages cannot be removed");
    check(await fails(() => removeInstalledPackage("plugin", "../x"), /Invalid slug/), "slug is validated");
    await removeInstalledPackage("plugin", PLUGIN, { force: true });
    check(!existsSync(packageDir("plugin", PLUGIN)) && !readFileSync(generatedFile("plugin"), "utf8").includes(PLUGIN), "force removal deletes files and registry entry");
    check((await usageOf("plugin", PLUGIN)).installs === 0, "force removal clears the site installs");

    // ---- the switch
    process.env.REACTPRESS_DISALLOW_FILE_MODS = "1";
    check(await fails(() => installFromRegistry(net.id, ref("theme", THEME)), /disabled/) && await fails(() => removeInstalledPackage("theme", THEME), /disabled/), "REACTPRESS_DISALLOW_FILE_MODS turns installs off");
    delete process.env.REACTPRESS_DISALLOW_FILE_MODS;
  } finally {
    server.close();
    delete process.env.REACTPRESS_DISALLOW_FILE_MODS;
    await cleanup().catch((e) => console.error("cleanup:", e));
    await prisma.network.update({ where: { id: net.id }, data: { registries: original } });
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    clearRegistryCache();
  }
  if (failures) throw new Error(`${failures} install check(s) failed`);
  console.log("marketplace install self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
