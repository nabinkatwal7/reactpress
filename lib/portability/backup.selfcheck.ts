/** ponytail: run with `npx tsx lib/portability/backup.selfcheck.ts` (needs the dev database; writes and removes test media) */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { absolutePath, createMedia } from "@/lib/media";
import { createSite, deleteSite, getDefaultNetwork } from "@/lib/network/sites";
import { createZip, readZip } from "@/lib/net/zip";
import { createBackup, restoreBackup, verifyBackup } from "./backup";
import { exportSite } from "./export";
import { buildRichSite, normalize, removeMediaFiles, PNG } from "./fixtures";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const fails = (fn: () => unknown, re?: RegExp) => Promise.resolve().then(fn).then(() => false, (e) => (re ? re.test((e as Error).message) : true));

async function main() {
  const net = await getDefaultNetwork();
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const ann = await prisma.user.create({ data: { email: "sc-ann@example.com", name: "Ann" } });
  const A = await createSite(net.id, { name: "Original", slug: "sc-orig" }, admin.id);
  const B = await createSite(net.id, { name: "Disaster", slug: "sc-disaster" }, admin.id);
  const created: string[] = [];

  try {
    await buildRichSite(A.id, admin, ann, created);
    await prisma.comment.updateMany({ where: { siteId: A.id }, data: { ip: "198.51.100.7", userAgent: "UA-secret" } });
    await prisma.webhook.create({ data: { siteId: A.id, url: "https://example.com/hook", events: ["post.published"], secret: "whsec_topsecret" } });

    // ---- create
    const { zip, manifest } = await createBackup(A.id);
    const names = readZip(zip, { maxEntries: 1000, maxTotalBytes: 1e8, maxEntryBytes: 1e8 }).map((e) => e.path).sort();
    check(names.includes("manifest.json") && names.includes("site.json") && names.filter((n) => n.startsWith("media/")).length === 2, `archive layout: ${names.join(", ")}`);
    check(manifest.counts.posts === 4 && manifest.counts.media === 2 && manifest.counts.pages === 2, "manifest counts");
    const raw = Buffer.from(zip).toString("latin1");
    check(!/198\.51\.100\.7|UA-secret|whsec_topsecret|passwordHash/.test(raw) && !JSON.stringify(readZip(zip).map((e) => e.data.toString("utf8").slice(0, 0))).includes("secret"), "no secrets in the archive");
    const siteJson = readZip(zip).find((e) => e.path === "site.json")!.data.toString("utf8");
    check(!/198\.51\.100\.7|UA-secret|whsec_topsecret/.test(siteJson) && (JSON.parse(siteJson).media as { data?: string }[]).every((m) => m.data === undefined), "site.json has no secrets and no embedded media");
    check(verifyBackup(zip).manifest.site.slug === "sc-orig", "a good backup verifies");

    // ---- disaster: the target site has other content that must go
    const junk = await createMedia(B.id, admin.id, new File([PNG], "junk.png"));
    created.push(junk.path);
    await prisma.post.create({ data: { siteId: B.id, title: "Junk", slug: "junk", authorId: admin.id, content: [] } });
    const membersBefore = await prisma.siteMember.count({ where: { siteId: B.id } });
    const hooksBefore = await prisma.webhook.count({ where: { siteId: B.id } });

    const report = await restoreBackup(B.id, zip, { importerId: admin.id });
    check(report.warnings.length === 0, `restore without warnings: ${report.warnings.join(" | ")}`);
    check(report.counts.posts === 4 && report.counts.media === 2 && report.backup.site === "Original", `restore report ${JSON.stringify(report.counts)}`);
    check(!existsSync(absolutePath(junk.path)) && !(await prisma.post.findFirst({ where: { siteId: B.id, slug: "junk" } })), "what was there is gone");
    check((await prisma.siteMember.count({ where: { siteId: B.id } })) === membersBefore && (await prisma.webhook.count({ where: { siteId: B.id } })) === hooksBefore, "memberships and webhooks of the target are left alone");

    const restored = await exportSite(B.id, { includeMedia: true });
    for (const m of restored.media) created.push(m.path);
    const original = await exportSite(A.id, { includeMedia: true });
    const na = normalize(original);
    const nb = normalize(restored);
    for (const k of Object.keys(na) as (keyof typeof na)[]) check(JSON.stringify(na[k]) === JSON.stringify(nb[k]), `restored site matches the original: ${k}`);
    check(restored.media.every((m) => existsSync(absolutePath(m.path))), "restored media files exist on disk");

    // ---- tampering and damage: refused, and the site stays as it was
    const entries = readZip(zip, { maxEntries: 1000, maxTotalBytes: 1e8, maxEntryBytes: 1e8 });
    const rebuild = (fn: (e: typeof entries) => typeof entries) => createZip(fn(entries.map((e) => ({ ...e, data: Buffer.from(e.data) }))));
    const snapshot = JSON.stringify(normalize(await exportSite(B.id, { includeMedia: true })));
    const untouched = async () => JSON.stringify(normalize(await exportSite(B.id, { includeMedia: true }))) === snapshot;
    const refused = async (label: string, buf: Buffer, re: RegExp) => {
      check(await fails(() => restoreBackup(B.id, buf, { importerId: admin.id }), re), `refused: ${label}`);
      check(await untouched(), `site unchanged after: ${label}`);
    };

    await refused("a changed media file", rebuild((e) => e.map((x) => (x.path.startsWith("media/") ? { ...x, data: Buffer.concat([x.data, Buffer.from("x")]) } : x))), /damaged|checksum/);
    await refused("a changed site.json", rebuild((e) => e.map((x) => (x.path === "site.json" ? { ...x, data: Buffer.from(x.data.toString("utf8").replace("Hello", "Hacked")) } : x))), /damaged|checksum/);
    await refused("a missing media file", rebuild((e) => e.filter((x) => !x.path.startsWith("media/")).concat([])), /incomplete|missing/);
    await refused("an extra file", rebuild((e) => [...e, { path: "media/extra.png", data: Buffer.from("x") }]), /not in its manifest/);
    await refused("no manifest", rebuild((e) => e.filter((x) => x.path !== "manifest.json")), /manifest/);
    await refused("a broken manifest", rebuild((e) => e.map((x) => (x.path === "manifest.json" ? { ...x, data: Buffer.from("{}") } : x))), /manifest is invalid/);
    await refused("not a zip", Buffer.from("plain text"), /usable backup/);
    await refused("a plain export file renamed to zip", Buffer.from(siteJson), /usable backup/);
    const slip = Buffer.from(createZip([{ path: "aaaaaaaaaa", data: Buffer.from("x") }]));
    for (let i = slip.indexOf("aaaaaaaaaa"); i >= 0; i = slip.indexOf("aaaaaaaaaa", i + 1)) slip.write("../evil.txt", i, "utf8");
    await refused("a path escaping the archive", slip, /usable backup|Unsafe/);

    // a valid manifest cannot smuggle media paths: files are looked up by name only
    const sneaky = JSON.parse(siteJson);
    sneaky.media[0].path = "../../../../etc/passwd";
    const sneakyBytes = Buffer.from(JSON.stringify(sneaky));
    const m2 = JSON.parse(readZip(zip).find((e) => e.path === "manifest.json")!.data.toString("utf8"));
    m2.files["site.json"] = { sha256: (await import("node:crypto")).createHash("sha256").update(sneakyBytes).digest("hex"), size: sneakyBytes.length };
    const r = await restoreBackup(B.id, rebuild((e) => e.map((x) => (x.path === "site.json" ? { ...x, data: sneakyBytes } : x.path === "manifest.json" ? { ...x, data: Buffer.from(JSON.stringify(m2)) } : x))), { importerId: admin.id });
    for (const m of await prisma.media.findMany({ where: { siteId: B.id } })) created.push(m.path);
    check(r.warnings.some((w) => /not in the export/.test(w)) && (await prisma.media.count({ where: { siteId: B.id } })) === 1, "a hostile media path just means that file is skipped");
  } finally {
    await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
    await deleteSite(A.id);
    await deleteSite(B.id);
    await removeMediaFiles(created);
  }
  if (failures) throw new Error(`${failures} backup check(s) failed`);
  console.log("backup self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
