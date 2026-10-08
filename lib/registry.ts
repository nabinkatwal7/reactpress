import { prisma } from "@/lib/prisma";

export type PostTypeDef = {
  key: string;
  label: string;
  singular: string;
  taxonomies: string[];
  source: "code" | "db";
};

export type TaxonomyDef = {
  key: string;
  label: string;
  singular: string;
  hierarchical: boolean;
  source: "code" | "db";
};

const codeTypes = new Map<string, PostTypeDef>();
const codeTaxonomies = new Map<string, TaxonomyDef>();

/** Code registration: call at module load (themes/plugins later). Wins over DB rows. */
export function registerPostType(def: Omit<PostTypeDef, "source">) {
  codeTypes.set(def.key, { ...def, source: "code" });
}

export function registerTaxonomy(def: Omit<TaxonomyDef, "source">) {
  codeTaxonomies.set(def.key, { ...def, source: "code" });
}

registerPostType({ key: "post", label: "Posts", singular: "Post", taxonomies: ["category", "tag"] });
registerTaxonomy({ key: "category", label: "Categories", singular: "Category", hierarchical: true });
registerTaxonomy({ key: "tag", label: "Tags", singular: "Tag", hierarchical: false });

export const RESERVED_KEYS = new Set(["post", "page", "category", "tag", "revision", "attachment"]);

export async function listPostTypes(siteId: string): Promise<PostTypeDef[]> {
  const rows = await prisma.postType.findMany({ where: { siteId }, orderBy: { label: "asc" } });
  const fromDb = rows
    .filter((r) => !codeTypes.has(r.key))
    .map((r) => ({ ...r, source: "db" as const }));
  return [...codeTypes.values(), ...fromDb];
}

export async function getPostType(siteId: string, key: string) {
  return (await listPostTypes(siteId)).find((t) => t.key === key) ?? null;
}

export async function listTaxonomies(siteId: string): Promise<TaxonomyDef[]> {
  const rows = await prisma.taxonomy.findMany({ where: { siteId }, orderBy: { label: "asc" } });
  const fromDb = rows
    .filter((r) => !codeTaxonomies.has(r.key))
    .map((r) => ({ ...r, source: "db" as const }));
  return [...codeTaxonomies.values(), ...fromDb];
}

export async function getTaxonomy(siteId: string, key: string) {
  return (await listTaxonomies(siteId)).find((t) => t.key === key) ?? null;
}

export async function createPostType(
  siteId: string,
  input: { key: string; label: string; singular?: string; taxonomies?: string[] },
) {
  if (RESERVED_KEYS.has(input.key) || codeTypes.has(input.key)) {
    throw new Error("Key is reserved");
  }
  return prisma.postType.create({
    data: {
      siteId,
      key: input.key,
      label: input.label,
      singular: input.singular || input.label,
      taxonomies: input.taxonomies ?? [],
    },
  });
}

export async function updatePostType(
  siteId: string,
  key: string,
  input: { label?: string; singular?: string; taxonomies?: string[] },
) {
  const row = await prisma.postType.findUnique({ where: { siteId_key: { siteId, key } } });
  if (!row) return null;
  return prisma.postType.update({ where: { id: row.id }, data: input });
}

export async function deletePostType(siteId: string, key: string) {
  const inUse = await prisma.post.count({ where: { siteId, type: key } });
  if (inUse) throw new Error("Type still has content");
  const res = await prisma.postType.deleteMany({ where: { siteId, key } });
  return res.count > 0;
}

export async function createTaxonomy(
  siteId: string,
  input: { key: string; label: string; singular?: string; hierarchical?: boolean },
) {
  if (RESERVED_KEYS.has(input.key) || codeTaxonomies.has(input.key)) {
    throw new Error("Key is reserved");
  }
  return prisma.taxonomy.create({
    data: {
      siteId,
      key: input.key,
      label: input.label,
      singular: input.singular || input.label,
      hierarchical: input.hierarchical ?? false,
    },
  });
}

export async function updateTaxonomy(
  siteId: string,
  key: string,
  input: { label?: string; singular?: string; hierarchical?: boolean },
) {
  const row = await prisma.taxonomy.findUnique({ where: { siteId_key: { siteId, key } } });
  if (!row) return null;
  return prisma.taxonomy.update({ where: { id: row.id }, data: input });
}

export async function deleteTaxonomy(siteId: string, key: string) {
  const inUse = await prisma.term.count({ where: { siteId, taxonomy: key } });
  if (inUse) throw new Error("Taxonomy still has terms");
  const res = await prisma.taxonomy.deleteMany({ where: { siteId, key } });
  return res.count > 0;
}
