import { z } from "zod";

const keyField = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_-]{0,31}$/, "Key must be lowercase letters, digits, - or _ (max 32)");

export const createPostTypeSchema = z.object({
  key: keyField,
  label: z.string().trim().min(1, "Label is required"),
  singular: z.string().trim().optional(),
  taxonomies: z.array(z.string().min(1)).optional(),
});

export const updatePostTypeSchema = createPostTypeSchema.omit({ key: true }).partial();

export const createTaxonomySchema = z.object({
  key: keyField,
  label: z.string().trim().min(1, "Label is required"),
  singular: z.string().trim().optional(),
  hierarchical: z.boolean().optional(),
});

export const updateTaxonomySchema = createTaxonomySchema.omit({ key: true }).partial();
