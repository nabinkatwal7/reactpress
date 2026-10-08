/** ponytail: run with `npx tsx lib/portability/portability.selfcheck.ts` (needs the dev database; writes and removes test media) */
import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { absolutePath, createMedia } from "@/lib/media";
import { createSite, deleteSite, getDefaultNetwork } from "@/lib/network/sites";
import { exportSite } from "./export";
import { buildRichSite, normalize } from "./fixtures";
import type { SiteExport } from "./format";
import { importSite, parseExport } from "./import";

const prisma = new PrismaClient();
let failures = 0;
const check = (ok: boolean, msg: string) => {
  if (!ok) failures += 1;
  console.assert(ok, msg);
};
const fails = (fn: () => Promise<unknown> | unknown, re?: RegExp) =>
  Promise.resolve().then(fn).then(() => false, (e) => (re ? re.test((e as Error).message) : true));

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

async function main() {
  const net = await getDefaultNetwork();
  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });
  const ann = await prisma.user.create({ data: { email: "sc-ann@example.com", name: "Ann" } });
  const A = await createSite(net.id, { name: "Source", slug: "sc-source" });
  const B = await createSite(net.id, { name: "Target", slug: "sc-target" });
  const created: string[] = [];

  try {
    // ---------------- build a rich site A
    await buildRichSite(A.id, admin, ann, created);

    // ---------------- export
    const light = await exportSite(A.id);
    check(light.media.every((m) => m.data === undefined), "export without media has no file data");
    const exported = await exportSite(A.id, { includeMedia: true });
    const text = JSON.stringify(exported);
    check(!/203\.0\.113\.9|UA-secret|passwordHash|"ip"|userAgent/.test(text), "no IP addresses, user agents or password hashes in the export");
    check(!text.includes(admin.id) && !text.includes(ann.id), "no database user ids in the export");
    check(exported.posts.length === 4 && exported.pages.length === 2 && exported.comments.length === 2 && exported.media.length === 2, "counts");
    check(exported.posts.find((p) => p.slug === "hello")!.author_email === "sc-ann@example.com", "authors are exported by email");
    const parsed = parseExport(JSON.parse(text));

    // ---------------- round trip into an empty site
    const photoB = await createMedia(B.id, admin.id, new File([PNG], "old-leftover.png")); // must be wiped
    created.push(photoB.path);
    const report = await importSite(B.id, parsed, { mode: "replace", importerId: admin.id });
    check(report.warnings.length === 0, `no warnings: ${report.warnings.join(" | ")}`);
    check(report.counts.posts === 4 && report.counts.pages === 2 && report.counts.media === 2 && report.counts.comments === 2 && report.counts.menus === 1, `import counts ${JSON.stringify(report.counts)}`);
    check(!existsSync(absolutePath(photoB.path)), "replace removed the old media file");

    const again = await exportSite(B.id, { includeMedia: true });
    for (const m of again.media) created.push(m.path);
    const na = normalize(exported);
    const nb = normalize(again);
    for (const k of Object.keys(na) as (keyof typeof na)[]) {
      check(JSON.stringify(na[k]) === JSON.stringify(nb[k]), `round trip keeps ${k}`);
      if (JSON.stringify(na[k]) !== JSON.stringify(nb[k])) console.error(`--- ${k}\nA: ${JSON.stringify(na[k]).slice(0, 700)}\nB: ${JSON.stringify(nb[k]).slice(0, 700)}`);
    }
    check(again.media.every((m, i) => m.path !== exported.media[i].path), "files got new paths (no clash with the source site)");
    const hB = await prisma.post.findFirstOrThrow({ where: { siteId: B.id, slug: "hello" } });
    check(JSON.stringify(hB.content).includes(again.media.find((m) => m.filename === "photo.png")!.path), "image blocks point at the new file");
    check((await prisma.post.findFirstOrThrow({ where: { siteId: B.id, slug: "hello" }, include: { author: true } })).author?.email === "sc-ann@example.com", "author matched by email");
    check((await prisma.job.count({ where: { siteId: B.id, type: "publish", status: "pending" } })) === 1, "the scheduled post has its publish job");
    check((await prisma.setting.findFirstOrThrow({ where: { siteId: B.id, key: "homepage_page_id" } })).value === (await prisma.page.findFirstOrThrow({ where: { siteId: B.id, slug: "about" } })).id, "homepage setting points at the imported page");
    check((await prisma.post.count({ where: { siteId: A.id } })) === 4, "the source site is untouched");

    // ---------------- merge keeps what is there and avoids clashes
    const merged = await importSite(B.id, parsed, { mode: "merge", importerId: admin.id });
    for (const m of await prisma.media.findMany({ where: { siteId: B.id } })) created.push(m.path);
    check(merged.counts.posts === 4 && merged.counts.terms === 0, `merge: posts added, existing terms reused (${JSON.stringify(merged.counts)})`);
    check((await prisma.post.findMany({ where: { siteId: B.id }, select: { slug: true } })).map((p) => p.slug).sort().join() === "draft-one,draft-one-2,hello,hello-2,later,later-2,soup,soup-2", "slugs that exist get a -2 suffix");
    check((await prisma.term.count({ where: { siteId: B.id, taxonomy: "category", slug: "news" } })) === 1, "no duplicate terms");
    check((await prisma.menu.count({ where: { siteId: B.id } })) === 1 && (await prisma.setting.count({ where: { siteId: B.id } })) > 0, "merge leaves menus and settings alone");
    check((await prisma.postTerm.count({ where: { post: { siteId: B.id, slug: "hello-2" } } })) === 2, "merged posts keep their terms");

    // ---------------- all or nothing
    const before = { posts: await prisma.post.count({ where: { siteId: B.id } }), media: await prisma.media.findMany({ where: { siteId: B.id }, select: { path: true } }) };
    check(await fails(() => importSite(B.id, parsed, { mode: "replace", importerId: "no-such-user" })), "a database failure aborts the import");
    check((await prisma.post.count({ where: { siteId: B.id } })) === before.posts, "...and the site is unchanged");
    check(before.media.every((m) => existsSync(absolutePath(m.path))), "...old files are still there");

    // ---------------- hostile or sloppy files
    const base = JSON.parse(text) as SiteExport;
    const mutate = (fn: (d: SiteExport) => void) => {
      const d = JSON.parse(text) as SiteExport;
      fn(d);
      return d;
    };
    check(await fails(() => parseExport({ ...base, format: "other" }), /valid ReactPress export/), "wrong format rejected");
    check(await fails(() => parseExport({ ...base, version: 2 }), /valid ReactPress export/), "unknown version rejected");
    check(await fails(() => parseExport(mutate((d) => void (d.posts[0].slug = "../etc/passwd"))), /slug/), "unsafe slug rejected");
    check(await fails(() => parseExport(mutate((d) => void (d.posts[1].id = d.posts[0].id))), /duplicate id/), "duplicate ids rejected");
    check(await fails(() => parseExport(mutate((d) => void (d.posts[0].status = "weird" as never)))), "unknown status rejected");
    check(await fails(() => parseExport({ nope: true })), "garbage rejected");

    const sloppy = parseExport(
      mutate((d) => {
        d.pages[0].parent_id = d.pages[1].id; // about -> team
        d.pages[1].parent_id = d.pages[0].id; // team -> about : a loop
        d.posts[0].featured_media_id = "ghost";
        d.posts[1].type = "alien";
        d.media[0].filename = "evil.svg";
        d.media[1].data = undefined;
        d.comments[0].post_id = "ghost";
        d.menus[0].items[1].object_id = "ghost";
        d.posts[2].author_email = "nobody@example.com";
      }),
    );
    const r2 = await importSite(B.id, sloppy, { mode: "replace", importerId: admin.id });
    for (const m of await prisma.media.findMany({ where: { siteId: B.id } })) created.push(m.path);
    const w = r2.warnings.join(" | ");
    check(/unknown post type "alien"/.test(w) && /file type not allowed/.test(w) && /not in the export/.test(w) && /not on a post|not imported/.test(w) || /post that was not imported/.test(w), `warnings explain what was skipped: ${w}`);
    const pages = await prisma.page.findMany({ where: { siteId: B.id }, select: { slug: true, parentId: true } });
    check(pages.filter((p) => p.parentId === null).length >= 1, "a parent loop was broken");
    check((await prisma.post.findFirstOrThrow({ where: { siteId: B.id, slug: sloppy.posts[2].slug } })).authorId === admin.id, "unknown authors fall back to the importer");
    check((await prisma.media.count({ where: { siteId: B.id } })) === 0, "no media row without a usable file");
    check(!(await prisma.post.findFirst({ where: { siteId: B.id, type: "alien" } })), "unknown post type is not imported");
  } finally {
    await prisma.user.deleteMany({ where: { email: { startsWith: "sc-" } } });
    await deleteSite(A.id);
    await deleteSite(B.id);
    const { unlink } = await import("node:fs/promises");
    await Promise.all(created.map((p) => unlink(absolutePath(p)).catch(() => {})));
  }
  if (failures) throw new Error(`${failures} portability check(s) failed`);
  console.log("portability self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
