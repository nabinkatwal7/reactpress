import { z } from "zod";

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const taxonomySchema = z.string().trim().min(1);

export const createTermSchema = z.object({
  taxonomy: taxonomySchema,
  name: z.string().trim().min(1, "Name is required"),
  slug: slugField.optional(),
  description: z.string().trim().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const updateTermSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  slug: slugField.optional(),
  description: z.string().trim().nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export type CreateTermInput = z.infer<typeof createTermSchema>;
export type UpdateTermInput = z.infer<typeof updateTermSchema>;
