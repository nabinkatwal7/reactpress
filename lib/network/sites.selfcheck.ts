/** ponytail: run with `npx tsx lib/network/sites.selfcheck.ts` (needs the dev database) */
import { PrismaClient } from "@prisma/client";
import { createPost } from "@/lib/posts";
import { createSite, deleteSite, getDefaultNetwork, listSites, updateSite } from "./sites";

const prisma = new PrismaClient();

const fails = (fn: () => Promise<unknown>) => fn().then(() => false, () => true);

async function main() {
  const net = await getDefaultNetwork();
  const main = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  console.assert(main.networkId === net.id, "default site belongs to the network");

  await prisma.site.deleteMany({ where: { slug: { startsWith: "sc-" } } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@reactpress.local" } });

  const second = await createSite(net.id, { name: "Second", slug: "sc-second", domain: "Second.Example.com" });
  console.assert(second.networkId === net.id && !second.isDefault, "second site created in the network");
  console.assert(second.domain === "second.example.com", "domain is lower-cased");
  console.assert((await listSites(net.id)).map((s) => s.slug).includes("sc-second"), "listed");
  console.assert((await listSites(net.id))[0].isDefault, "default site listed first");

  console.assert(await fails(() => createSite(net.id, { name: "Dup", slug: "sc-second" })), "duplicate slug rejected");
  console.assert(await fails(() => createSite(net.id, { name: "Dup", slug: "sc-dup", domain: "second.example.com" })), "duplicate domain rejected");
  for (const slug of ["admin", "api", "category", "Bad Slug", "-x", "", "a".repeat(41)]) {
    console.assert(await fails(() => createSite(net.id, { name: "X", slug })), `slug rejected: ${slug}`);
  }
  for (const domain of ["has space.com", "http://x.com", "x.com:3000", "localhost", "a_b.com"]) {
    console.assert(await fails(() => createSite(net.id, { name: "X", slug: "sc-x", domain })), `domain rejected: ${domain}`);
  }
  console.assert(await fails(() => createSite("nope", { name: "X", slug: "sc-x" })), "unknown network rejected");

  // a path on the main site blocks the same slug
  const page = await prisma.page.create({ data: { siteId: main.id, title: "SC", slug: "sc-page", content: [] } });
  console.assert(await fails(() => createSite(net.id, { name: "X", slug: "sc-page" })), "slug shadowing a main-site page rejected");
  await prisma.page.delete({ where: { id: page.id } });

  const renamed = await updateSite(second.id, { name: "Renamed", slug: "sc-second", domain: null });
  console.assert(renamed.name === "Renamed" && renamed.domain === null, "update");
  const keep = await updateSite(main.id, { name: main.name, slug: "ignored" });
  console.assert(keep.slug === main.slug, "default site keeps its slug");

  // content lives under its own site and goes away with it
  await createPost(second.id, admin.id, { title: "On second", status: "draft" });
  console.assert((await prisma.post.count({ where: { siteId: second.id } })) === 1, "post created on the second site");
  console.assert(await fails(() => deleteSite(main.id)), "default site cannot be deleted");
  console.assert((await deleteSite(second.id)) === true, "delete second site");
  console.assert((await prisma.post.count({ where: { siteId: second.id } })) === 0, "its content is gone");
  console.assert((await deleteSite(second.id)) === false, "second delete is a no-op");

  console.log("sites self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
