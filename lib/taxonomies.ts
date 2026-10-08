/** Built-in taxonomies. Step 12 extends this with a registry. */
export const BUILTIN_TAXONOMIES = {
  category: { label: "Categories", singular: "Category", hierarchical: true },
  tag: { label: "Tags", singular: "Tag", hierarchical: false },
} as const;

export type TaxonomyKey = keyof typeof BUILTIN_TAXONOMIES;

export function isTaxonomy(key: string): key is TaxonomyKey {
  return key in BUILTIN_TAXONOMIES;
}
