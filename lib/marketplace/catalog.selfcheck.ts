/** ponytail: run with `npx tsx lib/marketplace/catalog.selfcheck.ts` (needs the dev database) */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { PrismaClient } from "@prisma/client";
import { safeFetch } from "@/lib/net/safe-fetch";
import { getDefaultNetwork } from "@/lib/network/sites";
import { clearRegistryCache, fetchRegistry, findCatalogItem, loadCatalog } from "./catalog";
import { compareVersions } from "./format";
import { setRegistries } from "./registries";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const fails = (fn: () => Promise<unknown> | unknown) => Promise.resolve().then(fn).then(() => false, () => true);

const sha = "a".repeat(64);
const item = (o: object) => ({ type: "plugin", slug: "x", name: "X", version: "1.0.0", author: "me", description: "d", download: "https://example.com/x.zip", sha256: sha, ...o });
const registry = (items: object[], name = "Test registry") => ({ format: "reactpress-registry", version: 1, name, items });

async function main() {
  // versions
  check(compareVersions("1.2.0", "1.10.0") < 0 && compareVersions("2.0.0", "1.9.9") > 0 && compareVersions("1.0.0", "1.0.0") === 0, "semver compare is numeric");

  // a local server plays the registry host
  let served: unknown = registry([]);
  const hits: string[] = [];
  const server = createServer((req, res) => {
    hits.push(req.url ?? "");
    if (req.url === "/big.json") return void res.end("x".repeat(2 * 1024 * 1024));
    if (req.url === "/redirect-private") {
      res.statusCode = 302;
      res.setHeader("location", "http://169.254.169.254/latest");
      return void res.end();
    }
    if (req.url === "/redirect-ok") {
      res.statusCode = 302;
      res.setHeader("location", "/registry.json");
      return void res.end();
    }
    if (req.url === "/bad.json") return void res.end("not json");
    if (req.url === "/notfound") return void res.writeHead(404).end();
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(served));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const net = await getDefaultNetwork();
  const original = net.registries;
  try {
    // private targets are refused unless dev mode is on
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    delete process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE;
    check(await fails(() => safeFetch(`${base}/registry.json`, { maxBytes: 1000 })), "fetching a private address is refused");
    check(await fails(() => setRegistries(net.id, [`${base}/registry.json`])), "private registry URL cannot be saved");
    check(await fails(() => setRegistries(net.id, ["http://example.com/registry.json"])), "registries must be https");
    check(await fails(() => setRegistries(net.id, ["not a url"])), "garbage URL refused");
    check(hits.length === 0, "nothing reached the private server");

    process.env.REACTPRESS_ALLOW_PRIVATE_FETCH = "1";
    check((await safeFetch(`${base}/registry.json`, { maxBytes: 100_000 })).status === 200, "dev mode allows local hosts");
    check(await fails(() => safeFetch(`${base}/big.json`, { maxBytes: 1024 })), "size cap enforced");
    check(await fails(() => safeFetch(`${base}/notfound`, { maxBytes: 1024 })), "non-2xx is an error");
    check((await safeFetch(`${base}/redirect-ok`, { maxBytes: 100_000 })).finalUrl.endsWith("/registry.json"), "redirects are followed");
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE = "1"; // legacy flag still works
    check((await safeFetch(`${base}/registry.json`, { maxBytes: 100_000 })).status === 200, "legacy flag still honoured");
    delete process.env.REACTPRESS_WEBHOOKS_ALLOW_PRIVATE;
    process.env.REACTPRESS_ALLOW_PRIVATE_FETCH = "1";
    // a redirect INTO a private range is blocked even when the first hop was fine: use real metadata address
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    check(await fails(() => safeFetch("http://169.254.169.254/latest", { maxBytes: 1000 })), "metadata address refused");
    process.env.REACTPRESS_ALLOW_PRIVATE_FETCH = "1";

    // saving + loading
    const saved = await setRegistries(net.id, [`${base}/registry.json#frag`, `${base}/registry.json`, `${base}/bad.json`]);
    check(saved.length === 2 && !saved[0].includes("#"), "urls normalised and deduplicated");

    served = registry([
      item({ slug: "cool-plugin", name: "Cool Plugin" }),
      item({ type: "theme", slug: "pretty", name: "Pretty", version: "2.1.0" }),
      item({ slug: "reading-time", name: "Reading Time (clone)" }), // clashes with a bundled plugin
    ]);
    clearRegistryCache();
    const cat = await loadCatalog(net.id);
    check(cat.items.length === 3, `three items from the good registry (${cat.items.length})`);
    check(cat.errors.length === 1 && cat.errors[0].registry.endsWith("/bad.json") && /not valid JSON/.test(cat.errors[0].error), "a broken registry is reported, not fatal");
    const byslug = Object.fromEntries(cat.items.map((i) => [i.slug, i]));
    check(byslug["cool-plugin"].status === "available" && byslug["cool-plugin"].registryName === "Test registry", "available item");
    check(byslug["reading-time"].status === "bundled", "an item that clashes with a bundled package is marked bundled");
    check(byslug.pretty.type === "theme" && byslug.pretty.sha256 === sha, "theme entry with checksum");

    // caching: the registry is not fetched again within the window
    const before = hits.filter((h) => h === "/registry.json").length;
    await loadCatalog(net.id);
    check(hits.filter((h) => h === "/registry.json").length === before, "responses are cached");
    await loadCatalog(net.id, { fresh: true });
    check(hits.filter((h) => h === "/registry.json").length === before + 1, "fresh bypasses the cache");

    // lookups only trust registries the network lists
    check((await findCatalogItem(net.id, `${base}/registry.json`, "plugin", "cool-plugin"))?.name === "Cool Plugin", "find by registry+type+slug");
    check((await findCatalogItem(net.id, `${base}/registry.json`, "theme", "cool-plugin")) === null, "type must match");
    check((await findCatalogItem(net.id, `${base}/elsewhere.json`, "plugin", "cool-plugin")) === null, "unlisted registry is ignored");

    // validation of registry content
    for (const [label, doc] of [
      ["wrong format", { ...registry([]), format: "other" }],
      ["bad slug", registry([item({ slug: "../evil" })])],
      ["bad version", registry([item({ version: "1" })])],
      ["missing sha256", registry([item({ sha256: undefined })])],
      ["short sha256", registry([item({ sha256: "abc" })])],
      ["non-http download", registry([item({ download: "file:///etc/passwd" })])],
      ["unknown type", registry([item({ type: "widget" })])],
    ] as const) {
      served = doc;
      check(await fails(() => fetchRegistry(`${base}/registry.json`, { fresh: true })), `rejected: ${label}`);
    }
  } finally {
    server.close();
    delete process.env.REACTPRESS_ALLOW_PRIVATE_FETCH;
    await prisma.network.update({ where: { id: net.id }, data: { registries: original } });
    clearRegistryCache();
  }
  if (failures) throw new Error(`${failures} marketplace check(s) failed`);
  console.log("marketplace catalog self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
