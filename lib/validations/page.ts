import { z } from "zod";

export const pageStatusSchema = z.enum(["draft", "publish", "private", "trash"]);

export const pageContentSchema = z.array(z.record(z.string(), z.unknown())).default([]);

const slugField = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase kebab-case");

export const createPageSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: slugField.optional(),
  status: pageStatusSchema.default("draft"),
  content: pageContentSchema.optional(),
  parentId: z.string().min(1).nullable().optional(),
});

export const updatePageSchema = z.object({
  title: z.string().trim().min(1, "Title is required").optional(),
  slug: slugField.optional(),
  status: pageStatusSchema.optional(),
  content: pageContentSchema.optional(),
  parentId: z.string().min(1).nullable().optional(),
});

/** Client form schema — empty slug allowed, stripped before submit. */
export const pageFormSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  slug: z.string().trim(),
  status: pageStatusSchema,
  contentText: z.string(),
});

export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type PageFormValues = z.infer<typeof pageFormSchema>;
