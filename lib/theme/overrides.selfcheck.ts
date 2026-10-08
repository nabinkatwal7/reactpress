/** ponytail: run with `npx tsx lib/theme/overrides.selfcheck.ts` */
import { PrismaClient } from "@prisma/client";
import { getOverrideMap, listOverrides, removeOverride, setOverride } from "./overrides";
import { resolveTemplate, templateCandidates } from "./hierarchy";
import { THEME_REGISTRY } from "@/themes/registry";

const prisma = new PrismaClient();
const manifest = THEME_REGISTRY.default.manifest;

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { isDefault: true } });
  await prisma.templateOverride.deleteMany({ where: { siteId: site.id } });
  const available = new Set(manifest.templates);

  await setOverride(site.id, manifest, "page", "page-wide");
  const map = await getOverrideMap(site.id, manifest.slug);
  console.assert(map.page === "page-wide", "stored");
  console.assert(resolveTemplate(templateCandidates({ kind: "page", slug: "contact" }), available, map) === "page-wide", "applies to pages");
  console.assert(resolveTemplate(templateCandidates({ kind: "single", type: "post", slug: "x" }), available, map) === "single", "only the named template is affected");
  console.assert((await getOverrideMap(site.id, "midnight")).page === undefined, "scoped to the theme");

  await setOverride(site.id, manifest, "page", "archive");
  console.assert((await listOverrides(site.id, manifest.slug)).length === 1, "upsert, not duplicate");

  let bad = 0;
  for (const [t, target] of [["page", "ghost"], ["page", "page"], ["Bad Name", "page-wide"]] as const) {
    try { await setOverride(site.id, manifest, t, target); } catch { bad++; }
  }
  console.assert(bad === 3, "unknown target / self / bad name rejected");

  console.assert(await removeOverride(site.id, manifest.slug, "page"), "removed");
  console.assert(Object.keys(await getOverrideMap(site.id, manifest.slug)).length === 0, "back to theme choice");
  console.log("overrides self-check passed");
}

main().then(() => prisma.$disconnect()).catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
