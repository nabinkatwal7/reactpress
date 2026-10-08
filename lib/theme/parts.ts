import { toBlocks, type Block } from "@/lib/blocks";
import { prisma } from "@/lib/prisma";
import { PART_NAMES, type PartName } from "./manifest";

export function isPartName(slug: string): slug is PartName {
  return (PART_NAMES as readonly string[]).includes(slug);
}

/** Site-edited content for each part of a theme. Parts without a saved row are simply absent. */
export async function getPartContent(siteId: string, theme: string): Promise<Partial<Record<PartName, Block[]>>> {
  const rows = await prisma.templatePart.findMany({ where: { siteId, theme } });
  const out: Partial<Record<PartName, Block[]>> = {};
  for (const r of rows) {
    if (isPartName(r.slug)) out[r.slug] = toBlocks(r.content);
  }
  return out;
}

export async function savePart(siteId: string, theme: string, slug: PartName, blocks: Block[]) {
  const content = blocks as unknown as object;
  return prisma.templatePart.upsert({
    where: { siteId_theme_slug: { siteId, theme, slug } },
    update: { content },
    create: { siteId, theme, slug, content },
  });
}

/** Back to the theme default. */
export async function resetPart(siteId: string, theme: string, slug: PartName) {
  const res = await prisma.templatePart.deleteMany({ where: { siteId, theme, slug } });
  return res.count > 0;
}
